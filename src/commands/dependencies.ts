/** Dependency install and upgrade commands, including webview wiring. */
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import type { DependencyTable } from '../core/cargo/types.js';
import { declarationTablePath, parseDependencies, readDependencies } from '../core/cargo/manifestDeps.js';
import { readLockfile } from '../core/cargo/lockfile.js';
import { parseVersionReq, requirementSatisfied } from '../core/deps/versions.js';
import { crateDocsUrl, type CrateDetail } from '../core/deps/registry.js';
import { checkLockBeforeInstall, planInstall, planUpgrades, workspaceReferenceValue, type InstallRequest, type UpgradeEdit } from '../core/deps/write.js';
import type { DependencyNode } from '../core/deps/tree.js';
import { buildModel } from '../core/cargo/project.js';
import { readTextFile } from '../core/process.js';
import { TomlEditor } from '../core/toml/editor.js';
import { readSettings } from '../settings.js';
import { t } from '../core/i18n.js';
import { writeFilesWithVerification } from './shared.js';
import { WebviewPanelHost } from '../webviews/host.js';
import type { CrateDetailData, DependencyRow, InstallPanelData, UpgradePanelData, WebviewMessage } from '../webviews/protocol.js';

/** Open (or reveal) the install panel. */
export async function installDependencyCommand(
  controller: ProjectController,
  services: Services,
  extensionUri: vscode.Uri,
  memberName?: string,
): Promise<void> {
  const model = controller.project;
  if (!model) {
    void vscode.window.showInformationMessage(t('Open a Rust project first.'));
    return;
  }

  const data: InstallPanelData = {
    kind: 'install-panel',
    workspace: model.kind === 'workspace',
    members: model.members.map((m) => ({ name: m.name, manifestPath: m.manifestPath })),
    defaultMembers: memberName ? [memberName] : [],
    defaultTable: 'dependencies',
  };

  let selectedMember = memberName;

  const host = WebviewPanelHost.create({
    extensionUri,
    id: 'install',
    title: t('Install dependency'),
    data,
    // The member list comes from the manifests; keep it current while open.
    watch: [model.manifestPath, ...model.members.map((member) => member.manifestPath)],
    reload: async (current) => {
      const built = await buildModel(model.root);
      const members = (built.model ?? model).members.map((member) => ({
        name: member.name,
        manifestPath: member.manifestPath,
      }));
      return current?.kind === 'install-panel' ? { ...current, members } : { ...data, members };
    },
    handlers: async (message: WebviewMessage) => {
      switch (message.type) {
        case 'searchCrates': {
          host.progress(true, t('Searching crates.io…'));
          const results = await services.registry.search(message.query, 25);
          host.progress(false);
          if (!results.length && services.registry.networkError) {
            host.toast(
              t('crates.io is unreachable ({0}). Enter the crate name manually.', services.registry.networkError),
              'warning',
            );
          }
          host.post({
            type: 'searchResults',
            results: results.map((r) => ({
              name: r.name,
              version: r.maxStableVersion ?? r.maxVersion,
              description: r.description,
              downloads: r.downloads,
              updatedAt: r.updatedAt,
            })),
          });
          break;
        }
        case 'selectCrate': {
          if (message.member) selectedMember = message.member;
          const detail = await services.registry.crate(message.name);
          if (!detail) {
            host.post({ type: 'crateDetailFailed', name: message.name });
            host.toast(t('Could not load {0} from crates.io.', message.name), 'error');
            break;
          }
          host.post({ type: 'crateDetail', detail: await buildCrateDetail(model, detail, selectedMember) });
          break;
        }
        case 'install': {
          await performInstall(controller, services, host, message.request, selectedMember);
          break;
        }
        case 'openUrl':
          if (message.url) await vscode.env.openExternal(vscode.Uri.parse(message.url));
          break;
        default:
          break;
      }
    },
  });
}

async function buildCrateDetail(
  model: NonNullable<ProjectController['project']>,
  detail: CrateDetail,
  memberName: string | undefined,
): Promise<CrateDetailData> {
  const latest = latestOf(detail) ?? detail.maxVersion;
  const member = model.members.find((m) => m.name === memberName) ?? model.members[0];
  const memberText = member ? await readTextFile(member.manifestPath).catch(() => '') : '';
  const existing = memberText ? dependencyRequirement(memberText, detail.name) : undefined;
  const lock = await readLockfile(model.root);
  const locked = [...(lock?.versions.get(detail.name) ?? [])];
  const lockCheck = checkLockBeforeInstall(existing, locked, latest, (req, version) =>
    requirementSatisfied(parseVersionReq(req), version),
  );

  return {
    name: detail.name,
    description: detail.description,
    repository: detail.repository,
    documentation: detail.documentation,
    latest,
    versions: detail.versions.slice(0, 30).map((v) => ({
      version: v.num,
      rustVersion: v.rustVersion,
      yanked: v.yanked,
      features: Object.keys(v.features).sort(),
      defaultFeatures: v.features.default ?? [],
    })),
    lockState: lockCheck.state,
    lockMessage: lockCheck.message,
  };
}

function latestOf(detail: CrateDetail): string | undefined {
  const stable = detail.versions.find((v) => /^\d+\.\d+\.\d+$/.test(v.num) && !v.yanked);
  return stable?.num ?? detail.maxStableVersion ?? detail.maxVersion;
}

function dependencyRequirement(manifestText: string, name: string): string | undefined {
  return parseDependencies(manifestText, 'Cargo.toml').find((d) => d.packageName === name)?.version;
}

async function performInstall(
  controller: ProjectController,
  services: Services,
  host: WebviewPanelHost,
  request: {
    packageName: string;
    versionReq?: string;
    table: DependencyTable;
    features?: string[];
    optional?: boolean;
    noDefaultFeatures?: boolean;
    workspaceMode: boolean;
    memberNames?: string[];
  },
  selectedMember?: string,
): Promise<void> {
  const model = controller.project;
  if (!model) return;

  const requestedNames = request.memberNames ?? (selectedMember ? [selectedMember] : []);
  let targets = model.members
    .filter((member) => requestedNames.includes(member.name))
    .map((member) => ({ name: member.name, manifestPath: member.manifestPath }));
  if (!targets.length && model.kind === 'package') {
    const rootPackage = model.members[0] ?? model.rootPackage;
    if (rootPackage) targets = [{ name: rootPackage.name, manifestPath: rootPackage.manifestPath }];
  }
  const workspaceMode = request.workspaceMode && model.kind === 'workspace';

  if (!workspaceMode && !targets.length) {
    host.toast(t('Select at least one target member.'), 'error');
    return;
  }

  if (request.versionReq && request.versionReq !== '^latest' && request.versionReq !== 'latest') {
    const parsed = parseVersionReq(request.versionReq);
    if (!parsed.range) {
      host.toast(t('"{0}" is not a valid version requirement.', request.versionReq), 'error');
      return;
    }
  }

  const texts = new Map<string, string>();
  if (workspaceMode) texts.set(model.manifestPath, await readTextFile(model.manifestPath));
  for (const target of targets) {
    if (target.manifestPath === model.manifestPath) continue;
    texts.set(target.manifestPath, await readTextFile(target.manifestPath));
  }

  // Refuse silent overwrites of existing declarations. In workspace mode the
  // root table and every selected member are checked independently.
  const existing: string[] = [];
  if (workspaceMode) {
    const rootText = texts.get(model.manifestPath);
    if (rootText && new TomlEditor(rootText).hasKey('workspace.dependencies', request.packageName)) {
      existing.push('[workspace.dependencies]');
    }
  }
  for (const target of targets) {
    const text = texts.get(target.manifestPath);
    if (text && new TomlEditor(text).hasKey(request.table, request.packageName)) existing.push(target.name);
  }
  if (existing.length) {
    const overwrite = await vscode.window.showWarningMessage(
      t('{0} is already declared in {1}. Replace the declaration?', request.packageName, existing.join(', ')),
      { modal: true },
      t('Replace'),
    );
    if (!overwrite) return;
  }

  const installRequest: InstallRequest = {
    packageName: request.packageName,
    versionReq: request.versionReq,
    table: request.table,
    features: request.features ?? [],
    optional: request.optional,
    noDefaultFeatures: request.noDefaultFeatures,
    workspaceMode,
    targets,
    workspaceManifestPath: model.manifestPath,
    texts,
  };

  const planResult = planInstall(installRequest);
  if (!planResult.files.size) {
    host.toast(planResult.notes.join(' ') || t('Could not plan the change.'), 'error');
    return;
  }

  host.busy(true, t('Installing {0}…', request.packageName));
  const result = await writeFilesWithVerification({
    root: model.root,
    files: planResult.files,
    cargo: services.cargo,
    verify: { metadata: true, check: true, workspace: model.kind === 'workspace' },
  });
  host.busy(false);

  if (result.ok) {
    host.toast(t('Installed {0}. cargo check passed.', request.packageName), 'success');
    await controller.refresh();
    await controller.syncContextKeys();
    return;
  }
  if (result.report) {
    const failed = result.report.steps.find((s) => !s.ok);
    host.toast(t('{0} failed. See the Rust Forge output for details.', failed?.name ?? 'Verification'), 'error');
    await controller.refresh();
    return;
  }
  host.toast(result.error ?? t('Install failed.'), 'error');
}

/** Open the safe-upgrade review panel. */
export async function upgradeDependenciesCommand(
  controller: ProjectController,
  services: Services,
  extensionUri: vscode.Uri,
): Promise<void> {
  const snapshot = controller.snapshot;
  if (!snapshot) {
    void vscode.window.showInformationMessage(t('Open a Rust project first.'));
    return;
  }

  const buildData = (using: typeof snapshot = controller.snapshot ?? snapshot): UpgradePanelData => ({
    kind: 'upgrade-panel',
    rows: buildUpgradeRows(using.depTree.root),
    registryDegraded: using.depTree.registryDegraded,
    workspace: using.model.kind === 'workspace',
  });
  const data = buildData();

  const host = WebviewPanelHost.create({
    extensionUri,
    id: 'upgrade',
    title: t('Review safe upgrades'),
    data,
    watch: [
      snapshot.model.manifestPath,
      ...snapshot.model.members.map((member) => member.manifestPath),
      path.join(snapshot.model.root, 'Cargo.lock'),
    ],
    reload: async (current) => {
      // Rebuild from a fresh model so added/removed dependencies show up.
      await controller.refresh();
      const next = controller.snapshot;
      return next ? buildData(next) : current?.kind === 'upgrade-panel' ? current : data;
    },
    handlers: async (message: WebviewMessage) => {
      switch (message.type) {
        case 'upgradeSelected':
          await applyUpgrades(controller, services, host, message.ids);
          break;
        case 'runCommand':
          await vscode.commands.executeCommand(message.command, ...(message.args ?? []));
          break;
        case 'openUrl':
          if (message.url) await vscode.env.openExternal(vscode.Uri.parse(message.url));
          break;
        default:
          break;
      }
    },
  });
}

function buildUpgradeRows(root: DependencyNode): DependencyRow[] {
  const rows: DependencyRow[] = [];
  const visit = (node: DependencyNode) => {
    if (node.kind === 'dependency' || node.kind === 'localDependency') {
      if (node.upgrade && node.declaration) {
        rows.push(toRow(node));
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return rows;
}

function toRow(node: DependencyNode): DependencyRow {
  return {
    id: node.id,
    label: node.label,
    packageName: node.declaration?.packageName ?? node.label,
    member: node.memberName ?? '',
    requirement: node.requirement,
    locked: node.lockedVersion,
    latest: node.latestVersion,
    classification: node.upgrade?.classification ?? 'not-applicable',
    reason: node.upgrade?.reason,
    features: node.features ?? [],
    optional: !!node.optional,
    advisories: node.advisories.map((a) => ({
      id: a.id,
      title: a.title,
      severity: a.severity ?? 'unknown',
      url: a.url,
      fixed: a.fixed,
    })),
    registryUnavailable: !!node.registryUnavailable,
    isWorkspaceDependency: !!node.isWorkspaceDependency,
    table: node.table ?? 'dependencies',
  };
}

async function applyUpgrades(
  controller: ProjectController,
  services: Services,
  host: WebviewPanelHost,
  ids: string[],
): Promise<void> {
  const snapshot = controller.snapshot;
  if (!snapshot) return;

  const nodes = ids
    .map((id) => controller.findDependencyNode(id))
    .filter((node): node is DependencyNode => !!node && !!node.upgrade && !!node.declaration);
  if (!nodes.length) {
    host.toast(t('Nothing to upgrade.'), 'warning');
    return;
  }

  const model = snapshot.model;
  const texts = new Map<string, string>();
  const edits: UpgradeEdit[] = [];
  const notes: string[] = [];

  for (const node of nodes) {
    const target = node.latestVersion;
    const declaration = node.declaration!;
    const upgrade = node.upgrade!;
    if (!target) continue;

    if (declaration.kind === 'workspace' && model.kind === 'workspace') {
      // Rewrite the workspace table, not the member's inheritance stub.
      const rootText = texts.get(model.manifestPath) ?? (await readTextFile(model.manifestPath));
      texts.set(model.manifestPath, rootText);
      const workspaceDecls = await readWorkspaceDeps(model.root);
      const workspaceDecl = workspaceDecls.find((d) => d.name === declaration.packageName);
      if (!workspaceDecl) {
        notes.push(t('{0} is not declared in [workspace.dependencies]; skipped.', declaration.packageName));
        continue;
      }
      edits.push({
        manifestPath: model.manifestPath,
        declaration: {
          ...declaration,
          key: workspaceDecl.name,
          version: workspaceDecl.version,
          rawValue: workspaceDecl.rawValue,
          table: 'dependencies',
        },
        newRequirement: upgrade.newRequirement ?? declaration.version ?? '*',
        targetVersion: target,
        workspaceDependency: true,
      });
      continue;
    }

    const file = declaration.manifestPath;
    if (!texts.has(file)) texts.set(file, await readTextFile(file));
    edits.push({
      manifestPath: file,
      declaration,
      newRequirement: upgrade.newRequirement ?? declaration.version ?? '*',
      targetVersion: target,
    });
  }

  if (!edits.length) {
    host.toast(notes.join(' ') || t('Nothing to upgrade.'), 'warning');
    return;
  }

  // Show the planned manifest diffs before writing.
  const preview = planUpgrades(edits, texts);
  if (!preview.files.size) {
    host.toast(t('No manifest changes were necessary.'), 'warning');
    return;
  }

  const summary = [...preview.files.keys()].map((f) => vscode.workspace.asRelativePath(f)).join(', ');
  const approved = await vscode.window.showWarningMessage(
    t('Upgrade {0} dependency(ies)? These files change: {1}', edits.length, summary),
    { modal: true, detail: t('Manifests are rewritten, then cargo update and cargo check run.') },
    t('Upgrade'),
  );
  if (!approved) return;

  host.busy(true, t('Upgrading dependencies…'));
  const result = await writeFilesWithVerification({
    root: model.root,
    files: preview.files,
    cargo: services.cargo,
    verify: { metadata: true, check: true, workspace: model.kind === 'workspace' },
  });

  if (!result.ok) {
    host.busy(false);
    host.toast(t('Upgrade failed; review the Rust Forge output.'), 'error');
    await controller.refresh();
    return;
  }

  if (preview.updateSpecs.length) {
    const update = await services.cargo.update(model.root, preview.updateSpecs);
    if (update.code !== 0) {
      host.busy(false);
      host.toast(t('cargo update reported an error: {0}', update.stderr.trim().slice(0, 300)), 'warning');
      await controller.refresh();
      return;
    }
  }

  host.busy(false);
  await controller.refresh();
  await controller.syncContextKeys();
  host.toast(t('Upgraded {0} dependencies.', edits.length), 'success');
}

async function readWorkspaceDeps(root: string): Promise<import('../core/cargo/manifestDeps.js').WorkspaceDependencyDeclaration[]> {
  const { readWorkspaceDependencies } = require('../core/cargo/manifestDeps.js') as typeof import('../core/cargo/manifestDeps.js');
  return readWorkspaceDependencies(root);
}

/**
 * Open a crate's page either in the default browser or in VS Code's built-in
 * Simple Browser, according to `rustForge.crateDocsOpenMode`.
 */
export async function openCrateDocs(name: string | undefined, version?: string): Promise<void> {
  if (!name) return;
  const url = crateDocsUrl(name, version);
  if (readSettings().crateDocsOpenMode === 'webview') {
    try {
      await vscode.commands.executeCommand('simpleBrowser.show', url);
      return;
    } catch {
      // Older builds may not contribute Simple Browser; fall back to the OS.
    }
  }
  await vscode.env.openExternal(vscode.Uri.parse(url));
}

/**
 * Remove a dependency declaration from the manifest that declares it.
 *
 * Workspace-inheriting members only lose their `workspace = true` reference;
 * the `[workspace.dependencies]` entry stays so other members keep resolving.
 */
export async function removeDependencyCommand(
  controller: ProjectController,
  services: Services,
  node: DependencyNode | undefined,
): Promise<void> {
  const model = controller.project;
  const declaration = node?.declaration;
  if (!model || !declaration) return;

  const manifestLabel = vscode.workspace.asRelativePath(declaration.manifestPath);
  const inherited = declaration.kind === 'workspace';
  const confirm = await vscode.window.showWarningMessage(
    t('Remove {0} from {1}?', declaration.packageName, manifestLabel),
    {
      modal: true,
      detail: inherited
        ? t('The member reference is removed. If no other member inherits it, the [workspace.dependencies] entry is removed too.')
        : t('The declaration is removed from Cargo.toml, then cargo check runs.'),
    },
    t('Remove dependency'),
  );
  if (!confirm) return;

  const table = declarationTablePath(declaration);
  const text = await readTextFile(declaration.manifestPath);
  const editor = new TomlEditor(text);
  const updated = editor.apply(editor.removeKey(table, declaration.key, { dropEmptyTable: true }));
  if (updated === text) {
    void vscode.window.showInformationMessage(t('{0} is not declared in that table.', declaration.packageName));
    return;
  }

  const files = new Map([[declaration.manifestPath, updated]]);
  if (inherited && model.kind === 'workspace') {
    let usedElsewhere = false;
    for (const member of model.members) {
      if (member.manifestPath === declaration.manifestPath) continue;
      const deps = await readDependencies(member.manifestPath);
      if (deps.some((dep) => dep.kind === 'workspace' && dep.packageName === declaration.packageName)) {
        usedElsewhere = true;
        break;
      }
    }
    if (!usedElsewhere) {
      const rootText = await readTextFile(model.manifestPath);
      const rootEditor = new TomlEditor(rootText);
      const rootUpdated = rootEditor.apply(
        rootEditor.removeKey('workspace.dependencies', declaration.packageName, { dropEmptyTable: true }),
      );
      if (rootUpdated !== rootText) files.set(model.manifestPath, rootUpdated);
    }
  }

  const result = await writeFilesWithVerification({
    root: model.root,
    files,
    cargo: services.cargo,
    verify: { metadata: true, check: true, workspace: model.kind === 'workspace' },
  });
  if (!result.ok) return;

  await controller.refresh();
  await controller.syncContextKeys();
  void vscode.window.showInformationMessage(t('Removed {0} from {1}.', declaration.packageName, manifestLabel));
}

/** Reference a root workspace dependency from one or more members. */
export async function addWorkspaceDependencyToMemberCommand(
  controller: ProjectController,
  services: Services,
  node: DependencyNode | undefined,
): Promise<void> {
  const model = controller.project;
  const declaration = node?.declaration;
  if (!model || model.kind !== 'workspace' || !node?.workspaceRootDependency || !declaration) return;

  const key = declaration.key;
  const candidates: { label: string; description: string; member: (typeof model.members)[number] }[] = [];
  for (const member of model.members) {
    const text = await readTextFile(member.manifestPath).catch(() => '');
    if (!text) continue;
    const already = parseDependencies(text, member.manifestPath).some(
      (dep) => dep.key === key || dep.packageName === declaration.packageName,
    );
    if (already) continue;
    candidates.push({
      label: member.name,
      description: vscode.workspace.asRelativePath(member.manifestPath),
      member,
    });
  }

  if (!candidates.length) {
    void vscode.window.showInformationMessage(
      t('{0} is already declared in every member.', declaration.packageName),
    );
    return;
  }

  const picks = await vscode.window.showQuickPick(candidates, {
    canPickMany: true,
    title: t('Add {0} to members', declaration.packageName),
    placeHolder: t('Select one or more members'),
  });
  if (!picks?.length) return;

  const files = new Map<string, string>();
  for (const pick of picks) {
    const text = await readTextFile(pick.member.manifestPath);
    const editor = new TomlEditor(text);
    files.set(
      pick.member.manifestPath,
      editor.apply(editor.setKey('dependencies', key, workspaceReferenceValue())),
    );
  }

  const result = await writeFilesWithVerification({
    root: model.root,
    files,
    cargo: services.cargo,
    verify: { metadata: true, check: true, workspace: true },
  });
  if (!result.ok) return;

  await controller.refresh();
  await controller.syncContextKeys();
  void vscode.window.showInformationMessage(
    t('Referenced {0} in {1} member(s).', declaration.packageName, picks.length),
  );
}

export { CrateDetailData };

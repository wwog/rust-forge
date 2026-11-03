/**
 * Workspace topology panel and member move/rename command.
 *
 * The panel edits `workspace.default-members` / `workspace.exclude` through the
 * pure planner in `core/topology/model.ts`. Moving a member is a destructive
 * operation: the plan is computed in memory, shown as diffs, snapshotted, and
 * only then applied to disk.
 */
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import type { ProjectModel } from '../core/cargo/project.js';
import { planTopologyEdit, buildTopologySnapshot } from '../core/topology/model.js';
import { planMemberMove, validateMemberTarget } from '../core/topology/move.js';
import { workspaceContainers } from '../core/files.js';
import { isInside, readTextFile, relativePath } from '../core/process.js';
import { t } from '../core/i18n.js';
import { confirmWithDiffs, getOutput, writeFilesWithVerification } from './shared.js';
import { WebviewPanelHost } from '../webviews/host.js';
import type { TopologyPanelData, WebviewMessage } from '../webviews/protocol.js';

/** Open (or reveal) the pinned workspace topology panel. */
export async function workspaceTopologyCommand(
  controller: ProjectController,
  services: Services,
  extensionUri: vscode.Uri,
): Promise<void> {
  const initial = controller.project;
  if (!initial) {
    void vscode.window.showInformationMessage(t('Open a Rust project first.'));
    return;
  }

  const build = async (): Promise<TopologyPanelData> => {
    const model = controller.project ?? initial;
    return buildTopologyData(model);
  };

  const host = WebviewPanelHost.create({
    extensionUri,
    id: 'topology',
    title: t('Workspace Topology'),
    data: await build(),
    // Member manifests drive membership and path-dependency edits made outside
    // this panel; the root manifest owns members/default-members/exclude.
    watch: [
      ...new Set([initial.manifestPath, ...initial.members.map((member) => member.manifestPath)]),
    ],
    reload: async (current) => {
      await controller.refresh();
      if (!controller.project) return current ?? (await build());
      return build();
    },
    handlers: async (message: WebviewMessage) => {
      switch (message.type) {
        case 'saveTopology':
          await saveTopology(controller, services, host, build, message.defaultMembers, message.exclude);
          break;
        case 'moveMember':
          await moveMemberCommand(controller, services, message.member);
          host.setData(await build());
          break;
        case 'runCommand':
          await vscode.commands.executeCommand(message.command, ...(message.args ?? []));
          host.setData(await build());
          break;
        default:
          break;
      }
    },
  });
}

async function buildTopologyData(model: ProjectModel): Promise<TopologyPanelData> {
  let rootText = '';
  try {
    rootText = await readTextFile(model.manifestPath);
  } catch {
    // The snapshot reports missing/parsed manifests; an unreadable root renders
    // as an empty topology with whatever members the model already has.
  }
  const snapshot = buildTopologySnapshot({
    model,
    rootText,
    containerStrayEntries: await containerStrayEntries(model),
  });
  return {
    kind: 'topology-panel',
    workspace: model.kind === 'workspace',
    root: model.root,
    members: snapshot.members,
    patterns: snapshot.patterns,
    defaultMembers: snapshot.defaultMembers,
    exclude: snapshot.exclude,
    issues: snapshot.issues,
    hasDefaultMembers: snapshot.hasDefaultMembers,
  };
}

/** Root-level grouping directories such as `crates` with entries no member accounts for. */
async function containerStrayEntries(model: ProjectModel): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  if (model.kind !== 'workspace') return result;
  for (const container of workspaceContainers(model.root, model.members.map((member) => member.dir))) {
    try {
      const entries = await fs.readdir(container.dir);
      const stray = entries
        .filter((name) => !container.memberChildren.has(name) && !name.startsWith('.'))
        .sort((a, b) => a.localeCompare(b));
      if (stray.length) result[container.name] = stray;
    } catch {
      // A container that cannot be read is not a topology issue.
    }
  }
  return result;
}

async function saveTopology(
  controller: ProjectController,
  services: Services,
  host: WebviewPanelHost,
  build: () => Promise<TopologyPanelData>,
  defaultMembers: string[],
  exclude: string[],
): Promise<void> {
  const model = controller.project;
  if (!model || model.kind !== 'workspace') {
    host.toast(t('Open a workspace project first.'), 'warning');
    host.setData(await build());
    return;
  }

  let text: string;
  try {
    text = await readTextFile(model.manifestPath);
  } catch (error) {
    host.toast(t('Could not read the workspace manifest.'), 'error');
    getOutput().appendLine((error as Error).message);
    return;
  }

  const plan = planTopologyEdit(text, { defaultMembers, exclude }, {
    members: model.members.map((member) => ({
      name: member.name,
      relative: relativePath(model.root, member.dir) || '.',
    })),
  });

  const error = plan.issues.find((issue) => issue.severity === 'error');
  if (error) {
    host.toast(error.message, 'error');
    host.setData(await build());
    return;
  }
  if (!plan.changed) {
    host.toast(t('No topology changes to apply.'), 'info');
    host.setData(await build());
    return;
  }

  const approved = await confirmWithDiffs(
    [{ path: model.manifestPath, original: text, updated: plan.text }],
    t('Workspace topology'),
  );
  if (!approved) {
    // The panel is stateless: redraw from disk so an abandoned edit disappears.
    host.setData(await build());
    return;
  }

  const result = await writeFilesWithVerification({
    root: model.root,
    files: new Map([[model.manifestPath, plan.text]]),
    cargo: services.cargo,
    verify: { metadata: true, check: true, workspace: true },
  });

  await controller.refresh();
  await controller.syncContextKeys();
  // Always reflect what is on disk, even when verification failed.
  host.setData(await build());
  if (result.ok) {
    host.toast(t('Workspace topology updated.'), 'success');
    const warning = plan.issues.find((issue) => issue.severity === 'warning' && issue.id.startsWith('default-excluded:'));
    if (warning) host.toast(warning.message, 'info');
  }
}

/** Move or rename a workspace member directory and rewrite every path reference. */
export async function moveMemberCommand(
  controller: ProjectController,
  services: Services,
  memberName?: string,
): Promise<void> {
  const model = controller.project;
  if (!model || model.kind !== 'workspace') {
    void vscode.window.showInformationMessage(t('Open a workspace project first.'));
    return;
  }

  // The root package is represented by the workspace root itself.
  const candidates = model.members.filter((member) => path.resolve(member.dir) !== path.resolve(model.root));
  let member = memberName ? model.members.find((candidate) => candidate.name === memberName) : undefined;
  if (!member) {
    if (memberName) {
      void vscode.window.showErrorMessage(t('"{0}" is not a workspace member.', memberName));
      return;
    }
    const pick = await vscode.window.showQuickPick(
      candidates.map((candidate) => ({
        label: candidate.name,
        description: relativePath(model.root, candidate.dir),
        value: candidate,
      })),
      { title: t('Move workspace member') },
    );
    if (!pick) return;
    member = pick.value;
  }

  if (path.resolve(member.dir) === path.resolve(model.root)) {
    void vscode.window.showErrorMessage(t('The workspace root package cannot be moved.'));
    return;
  }

  const currentRelative = relativePath(model.root, member.dir);
  const target = await vscode.window.showInputBox({
    title: t('Move workspace member'),
    prompt: t('New directory for {0}', member.name),
    value: currentRelative,
    validateInput: (value) => validateMoveInput(model, member!.name, value),
  });
  if (!target) return;

  const rootText = await readTextFile(model.manifestPath);
  const memberTexts: Record<string, string> = {};
  for (const candidate of model.members) {
    if (path.resolve(candidate.dir) === path.resolve(model.root)) continue;
    try {
      memberTexts[candidate.name] = await readTextFile(candidate.manifestPath);
    } catch {
      // planMemberMove reports unreadable moved manifests; other members are skipped.
    }
  }

  const preview = validateMemberTarget({ model, member: member.name, targetRelative: target });
  let destinationExists = false;
  if (preview.targetDir) {
    try {
      await fs.access(preview.targetDir);
      destinationExists = true;
    } catch {
      destinationExists = false;
    }
  }

  const plan = planMemberMove({
    model,
    member: member.name,
    targetRelative: target,
    rootText,
    memberTexts,
    destinationExists,
  });

  if (plan.errors.length) {
    void vscode.window.showErrorMessage(plan.errors.join('\n'));
    return;
  }

  const changes = Object.entries(plan.files).map(([file, updated]) => ({
    path: file,
    original: plan.originals[file] ?? '',
    updated,
  }));

  const layout = [
    `${t('From: {0}', plan.fromRelative)}`,
    `${t('To: {0}', plan.toRelative)}`,
    '',
    t('Member manifests are rewritten so relative path dependencies keep working.'),
    t('Non-manifest files are not rewritten; review scripts and configuration that reference the old directory.'),
    ...(plan.notes.length ? ['', ...new Set(plan.notes)] : []),
  ].join('\n');

  const proceed = await vscode.window.showWarningMessage(
    t('Move {0} to {1}', member.name, plan.toRelative),
    { modal: true, detail: layout },
    t('Continue'),
  );
  if (!proceed) return;

  // A move with no manifest changes still needs an explicit confirmation (the
  // layout prompt above); otherwise every edited manifest is diffed.
  if (changes.length && !(await confirmWithDiffs(changes, t('Move workspace member')))) return;

  const oldDir = path.resolve(member.dir);
  const newDir = path.resolve(model.root, plan.toRelative);
  if (!isInside(model.root, newDir) || newDir === path.resolve(model.root)) {
    void vscode.window.showErrorMessage(t('The destination must be a relative directory inside the workspace.'));
    return;
  }

  const store = services.snapshotStore(model.root);
  const snapshot = await store.begin('move-member');
  try {
    await store.record(snapshot, model.manifestPath);
    for (const file of Object.keys(plan.files)) {
      if (path.resolve(file) === path.resolve(model.manifestPath)) continue;
      await store.record(snapshot, file);
    }
    await store.backupDirectory(snapshot, oldDir);
    store.recordMove(snapshot, { from: oldDir, to: newDir, kind: 'dir' });

    for (const dir of await missingDirectories(newDir, model.root)) {
      store.recordCreatedDir(snapshot, dir);
    }
    await fs.mkdir(path.dirname(newDir), { recursive: true });
    await fs.rename(oldDir, newDir);

    const result = await writeFilesWithVerification({
      root: model.root,
      files: new Map(Object.entries(plan.files)),
      cargo: services.cargo,
      verify: { metadata: true, check: true, workspace: true },
    });

    if (result.error) {
      // A write failure is a mid-operation failure: restore the snapshot and
      // report. Rollback is internal; there is no user-facing undo UI.
      throw new Error(result.error);
    }

    if (result.ok) {
      await store.commit(snapshot);
      await controller.refresh();
      await controller.syncContextKeys();
      void vscode.window.showInformationMessage(t('Moved {0} to {1}.', member.name, plan.toRelative));
    } else {
      // Verification failed after the move: keep the new layout so the user can
      // inspect it, but do not leave a stale snapshot for a later operation.
      await store.discard(snapshot);
      await controller.refresh();
      await controller.syncContextKeys();
      getOutput().appendLine(t('The member was moved but verification failed. See the output channel.'));
    }
  } catch (error) {
    const rollback = await store.rollback(snapshot);
    getOutput().appendLine((error as Error).message);
    if (rollback.warnings.length) getOutput().appendLine(rollback.warnings.join('\n'));
    void vscode.window.showErrorMessage(t('Moving the member failed: {0}', (error as Error).message));
  }
}

function validateMoveInput(model: ProjectModel, memberName: string, value: string): string | undefined {
  const validation = validateMemberTarget({ model, member: memberName, targetRelative: value });
  if (validation.errors.length) return validation.errors[0];
  if (validation.targetDir && existsSync(validation.targetDir)) {
    const caseOnly =
      (process.platform === 'darwin' || process.platform === 'win32') &&
      validation.fromRelative.toLowerCase() === validation.toRelative.toLowerCase();
    if (!caseOnly) return t('"{0}" already exists.', validation.toRelative);
  }
  return undefined;
}

/** Ancestors of `dir` that do not exist yet, outermost first. */
async function missingDirectories(dir: string, root: string): Promise<string[]> {
  const missing: string[] = [];
  let current = path.resolve(dir);
  const stop = path.resolve(root);
  while (current !== stop && isInside(stop, current)) {
    try {
      await fs.access(current);
      break;
    } catch {
      missing.push(current);
      current = path.dirname(current);
    }
  }
  return missing.reverse();
}

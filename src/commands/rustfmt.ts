/** rustfmt configuration panel command. */
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import {
  applyRustfmtEdits,
  discoverRustfmtChain,
  generateRustfmtToml,
  readRustfmtConfig,
  RUSTFMT_OPTIONS,
  unstableOptionsWithoutFlag,
  type RustfmtEdit,
} from '../core/rustfmt.js';
import { readTextFile } from '../core/process.js';
import { resolveRustfmtTarget, type RustfmtScope } from '../core/rustfmtTarget.js';
import { t } from '../core/i18n.js';
import { writeFilesWithVerification, getOutput } from './shared.js';
import { WebviewPanelHost } from '../webviews/host.js';
import type { RustfmtPanelData, WebviewMessage } from '../webviews/protocol.js';

const KEY = 'rustfmt';

export async function editRustfmtCommand(
  controller: ProjectController,
  services: Services,
  extensionUri: vscode.Uri,
  memberName?: string,
): Promise<void> {
  const snapshot = controller.snapshot;
  if (!snapshot) {
    void vscode.window.showInformationMessage(t('Open a Rust project first.'));
    return;
  }

  const model = snapshot.model;
  let scope: RustfmtScope = memberName ? 'member' : 'workspace';
  // The member the panel edits in member scope. Resolved lazily so members
  // loaded after the panel opens (or a renamed member) are honoured.
  let activeMemberName: string | undefined = memberName;

  const buildData = async (scopeOverride?: RustfmtScope, memberOverride?: string): Promise<RustfmtPanelData> => {
    const activeScope = scopeOverride ?? scope;
    const target = resolveRustfmtTarget(model, activeScope, memberOverride ?? activeMemberName);
    const workspaceConfig = await readRustfmtConfig(model.root);
    const memberConfig = target.scope === 'member' && target.member ? await readRustfmtConfig(target.member.dir) : undefined;
    const active = target.scope === 'member' ? memberConfig : workspaceConfig;
    const values = active?.values ?? {};
    const warnings = unstableOptionsWithoutFlag(values);
    const zh = vscode.env.language.toLowerCase().startsWith('zh');

    return {
      kind: 'rustfmt-panel',
      workspace: model.kind === 'workspace',
      scope: activeScope,
      filePath: active?.path ?? path.join(target.dir, 'rustfmt.toml'),
      fileExists: !!active,
      values,
      options: RUSTFMT_OPTIONS.map((option) => ({
        key: option.key,
        label: zh && option.labelZh ? option.labelZh : option.label,
        description: zh && option.descriptionZh ? option.descriptionZh : option.description,
        type: option.type,
        value: values[option.key],
        default: option.default,
        values: option.values,
        stable: option.stable,
        min: option.min,
        max: option.max,
        category: option.category,
      })),
      memberScopeAvailable: model.kind === 'workspace' && model.members.length > 0,
      members: model.members.map((entry) => ({ name: entry.name })),
      activeMember: target.member?.name,
      warning: warnings.length
        ? t('These unstable options have no effect on stable rustfmt: {0}', warnings.join(', '))
        : undefined,
    };
  };

  const host = WebviewPanelHost.create({
    extensionUri,
    id: KEY,
    title: t('rustfmt configuration'),
    data: await buildData(),
    // rustfmt only cares about rustfmt files (both accepted spellings), at the
    // project root and in every member directory.
    watch: [model.root, ...model.members.map((m) => m.dir)].flatMap((dir) => [
      path.join(dir, 'rustfmt.toml'),
      path.join(dir, '.rustfmt.toml'),
    ]),
    reload: async (current) =>
      // Keep the scope and member the user picked inside the panel.
      buildData(
        current?.kind === 'rustfmt-panel' ? current.scope : scope,
        current?.kind === 'rustfmt-panel' ? current.activeMember : activeMemberName,
      ),
    handlers: async (message: WebviewMessage) => {
      if (message.type === 'saveRustfmt') {
        await save(host, controller, services, message.edits, message.scope, message.member);
      } else if (message.type === 'generateRustfmt') {
        await generate(host, controller, services, message.scope, message.member);
      } else if (message.type === 'openFile') {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(message.path));
        await vscode.window.showTextDocument(doc, { preview: true });
      } else if (message.type === 'refresh') {
        // The dropdowns send the authoritative scope/member; never rebuild
        // from the stale closure values.
        if (message.scope) scope = message.scope;
        if (message.member) activeMemberName = message.member;
        const resolved = resolveRustfmtTarget(model, scope, activeMemberName);
        if (resolved.member) activeMemberName = resolved.member.name;
        host.setData(await buildData(scope, activeMemberName));
      }
    },
  });

  async function save(
    panel: WebviewPanelHost,
    ctrl: ProjectController,
    svc: Services,
    edits: { key: string; value: string | number | boolean | string[] | undefined }[],
    targetScope: RustfmtScope,
    memberName?: string,
  ): Promise<void> {
    const projectSnapshot = ctrl.snapshot;
    if (!projectSnapshot) return;
    const target = resolveRustfmtTarget(projectSnapshot.model, targetScope, memberName ?? activeMemberName);
    if (targetScope === 'member' && target.missingMember) {
      panel.toast(t('No workspace member selected.'), 'error');
      return;
    }
    scope = target.scope;
    activeMemberName = target.member?.name;
    const targetDir = target.dir;
    const existing = await readRustfmtConfig(targetDir);
    const file = existing?.path ?? path.join(targetDir, 'rustfmt.toml');
    const original = existing?.path ? await readTextFile(existing.path) : undefined;

    for (const edit of edits) {
      const option = RUSTFMT_OPTIONS.find((o) => o.key === edit.key);
      if (!option) continue;
      if (option.type === 'number' && edit.value !== undefined) {
        const num = Number(edit.value);
        if (!Number.isFinite(num)) {
          panel.toast(t('{0} must be a number.', edit.key), 'error');
          return;
        }
        if (option.min !== undefined && num < option.min) {
          panel.toast(t('{0} must be at least {1}.', edit.key, option.min), 'error');
          return;
        }
        if (option.max !== undefined && num > option.max) {
          panel.toast(t('{0} must be at most {1}.', edit.key, option.max), 'error');
          return;
        }
      }
      if (option.type === 'enum' && edit.value !== undefined && option.values && !option.values.includes(String(edit.value))) {
        panel.toast(t('{0} must be one of {1}.', edit.key, option.values.join(', ')), 'error');
        return;
      }
    }

    const updates: RustfmtEdit[] = edits.map((edit) => ({ key: edit.key, value: edit.value ?? undefined }));
    const updated = applyRustfmtEdits(original, updates, vscode.env.language.toLowerCase().startsWith('zh') ? 'zh-cn' : 'en');

    const files = new Map<string, string>([[file, updated]]);
    const result = await writeFilesWithVerification({
      root: projectSnapshot.model.root,
      files,
      cargo: svc.cargo,
      verify: { metadata: true, fmtCheck: true },
    });

    if (result.ok) {
      panel.toast(t('rustfmt.toml saved and cargo fmt --check passed.'), 'success');
      await ctrl.refresh();
      panel.setData(await buildData(target.scope, target.member?.name));
    } else if (result.report) {
      const failed = result.report.steps.find((s) => !s.ok);
      if (failed?.name.includes('fmt')) {
        panel.toast(
          t('The configuration was saved, but cargo fmt --check reports formatting differences. Run Format Document to apply it.'),
          'warning',
        );
      } else {
        panel.toast(t('{0} failed. See the Rust Forge output.', failed?.name ?? 'Verification'), 'error');
      }
    } else {
      panel.toast(result.error ?? t('Save failed.'), 'error');
    }
  }

  async function generate(
    panel: WebviewPanelHost,
    ctrl: ProjectController,
    svc: Services,
    targetScope: RustfmtScope,
    memberName?: string,
  ): Promise<void> {
    const projectSnapshot = ctrl.snapshot;
    if (!projectSnapshot) return;
    const target = resolveRustfmtTarget(projectSnapshot.model, targetScope, memberName ?? activeMemberName);
    if (targetScope === 'member' && target.missingMember) {
      panel.toast(t('No workspace member selected.'), 'error');
      return;
    }
    scope = target.scope;
    activeMemberName = target.member?.name;
    const targetDir = target.dir;
    const existing = await readRustfmtConfig(targetDir);
    if (existing) {
      const replace = await vscode.window.showWarningMessage(
        t('{0} already exists. Replace it with the recommended configuration?', vscode.workspace.asRelativePath(existing.path ?? targetDir)),
        { modal: true },
        t('Replace'),
      );
      if (!replace) return;
    }

    const defaultEdition = projectSnapshot.properties.edition;
    const content = generateRustfmtToml({
      edition: defaultEdition,
      includeImportsGranularity: true,
      language: vscode.env.language.toLowerCase().startsWith('zh') ? 'zh-cn' : 'en',
    });
    const file = existing?.path ?? path.join(targetDir, 'rustfmt.toml');

    const result = await writeFilesWithVerification({
      root: projectSnapshot.model.root,
      files: new Map([[file, content]]),
      cargo: svc.cargo,
      verify: { metadata: true, fmtCheck: true },
    });

    if (result.ok) {
      panel.toast(t('Recommended rustfmt.toml created.'), 'success');
      panel.setData(await buildData(target.scope, target.member?.name));
      await ctrl.refresh();
    } else {
      panel.toast(t('cargo fmt --check reported differences; the file was written. See the output for details.'), 'warning');
      getOutput().show();
    }
  }
}

/** Quick pick flow used from the command palette when no panel is needed. */
export async function editRustfmtQuickPick(
  controller: ProjectController,
  services: Services,
): Promise<void> {
  const snapshot = controller.snapshot;
  if (!snapshot) return;
  const chain = await discoverRustfmtChain(snapshot.model.root, snapshot.model.root);
  const items = [
    { label: t('Workspace root configuration'), description: vscode.workspace.asRelativePath(snapshot.model.root), value: 'workspace' },
    ...(snapshot.model.kind === 'workspace'
      ? snapshot.model.members.map((m) => ({
          label: t('Member: {0}', m.name),
          description: vscode.workspace.asRelativePath(m.dir),
          value: `member:${m.name}`,
        }))
      : []),
  ];
  const choice = await vscode.window.showQuickPick(items, { title: t('rustfmt scope') });
  if (!choice) return;
  void chain;
  await vscode.commands.executeCommand('rustForge.editRustfmt', choice.value.startsWith('member:') ? choice.value.slice(7) : undefined);
}

/** Project standardization command. */
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import { analyzeStandardization, previewStandardization, type StandardizeFinding } from '../core/standardize.js';
import { buildModel } from '../core/cargo/project.js';
import { t } from '../core/i18n.js';
import { getOutput, writeFilesWithVerification } from './shared.js';
import { WebviewPanelHost } from '../webviews/host.js';
import type { StandardizePanelData, WebviewMessage } from '../webviews/protocol.js';

const KEY = 'standardize';

export async function standardizeCommand(
  controller: ProjectController,
  services: Services,
  extensionUri: vscode.Uri,
): Promise<void> {
  const snapshot = controller.snapshot;
  if (!snapshot) {
    void vscode.window.showInformationMessage(t('Open a Rust project first.'));
    return;
  }
  const initial = snapshot;
  const root = initial.model.root;

  /** Re-analyze from disk; also picks up files a previous apply just created. */
  async function buildState(): Promise<{ data: StandardizePanelData; findings: Map<string, StandardizeFinding> }> {
    const built = await buildModel(root);
    const model = built.model ?? controller.project ?? initial.model;
    const plan = await analyzeStandardization(model);
    return {
      data: {
        kind: 'standardize-panel',
        workspace: model.kind === 'workspace',
        findings: plan.findings.map((finding) => ({
          id: finding.id,
          title: finding.title,
          description: finding.description,
          fixable: finding.fixable,
          diffs: finding.changes.map((change) => ({
            path: vscode.workspace.asRelativePath(change.path),
            diff: previewStandardization(model.root, [finding]).find((c) => c.path === change.path)?.diff ?? '',
            newContent: change.content,
            original: change.original,
          })),
        })),
      },
      findings: new Map(plan.findings.map((finding) => [finding.id, finding])),
    };
  }

  let state = await buildState();

  const host = WebviewPanelHost.create({
    extensionUri,
    id: KEY,
    title: t('Standardize project'),
    data: state.data,
    // Findings come from the root manifest plus the config files they would move.
    watch: [
      initial.model.manifestPath,
      path.join(root, 'rustfmt.toml'),
      path.join(root, '.rustfmt.toml'),
      path.join(root, 'clippy.toml'),
    ],
    reload: async () => (state = await buildState()).data,
    handlers: async (message: WebviewMessage) => {
      if (message.type === 'applyStandardization') {
        await apply(
          controller,
          services,
          message.ids,
          () => state.findings,
          async () => {
            state = await buildState();
            host.setData(state.data);
          },
        );
      } else if (message.type === 'previewStandardization') {
        const selected = message.ids
          .map((id) => state.findings.get(id))
          .filter((finding): finding is StandardizeFinding => !!finding);
        const previews = previewStandardization(root, selected);
        for (const preview of previews.slice(0, 3)) {
          const left = await vscode.workspace.openTextDocument({ content: preview.original ?? '', language: inferLanguage(preview.path) });
          const right = await vscode.workspace.openTextDocument({ content: preview.newContent, language: inferLanguage(preview.path) });
          await vscode.commands.executeCommand(
            'vscode.diff',
            left.uri,
            right.uri,
            t('Standardize: {0}', vscode.workspace.asRelativePath(preview.path)),
          );
        }
      }
    },
  });
}

let applying = false;

async function apply(
  controller: ProjectController,
  services: Services,
  ids: string[],
  currentFindings: () => Map<string, StandardizeFinding>,
  refreshPanel: () => Promise<void>,
): Promise<void> {
  if (applying) {
    void vscode.window.showInformationMessage(t('Standardization is already running.'));
    return;
  }
  const snapshot = controller.snapshot;
  if (!snapshot) return;
  const findingsById = currentFindings();
  const selected = ids.map((id) => findingsById.get(id)).filter((finding): finding is StandardizeFinding => !!finding);
  if (!selected.length) {
    void vscode.window.showInformationMessage(t('Select at least one item.'));
    return;
  }

  applying = true;
  try {
    const previews = previewStandardization(snapshot.model.root, selected);
    // Show every diff before applying.
    for (const preview of previews) {
      const left = await vscode.workspace.openTextDocument({ content: preview.original ?? '', language: inferLanguage(preview.path) });
      const right = await vscode.workspace.openTextDocument({ content: preview.newContent, language: inferLanguage(preview.path) });
      await vscode.commands.executeCommand(
        'vscode.diff',
        left.uri,
        right.uri,
        t('Standardize: {0}', vscode.workspace.asRelativePath(preview.path)),
      );
    }

    const labels = selected.map((finding) => finding.title).join(', ');
    const approved = await vscode.window.showWarningMessage(
      t('Apply {0} standardized configuration item(s)?', selected.length),
      { modal: true, detail: labels },
      t('Apply'),
    );
    if (!approved) return;

    // Build the final content per file, preserving later-writer wins. The write
    // helper owns the write so failure recovery and verification stay in one place.
    const files = new Map<string, string>();
    for (const finding of selected) {
      for (const change of finding.changes) files.set(change.path, change.content);
    }

    const result = await writeFilesWithVerification({
      root: snapshot.model.root,
      files,
      cargo: services.cargo,
      verify: { metadata: true, fmtCheck: true, clippy: true, workspace: snapshot.model.kind === 'workspace' },
    });

    if (result.ok) {
      void vscode.window.showInformationMessage(t('Standardization applied; cargo fmt --check and cargo clippy passed.'));
      await controller.refresh();
      await controller.syncContextKeys();
    }
    // Failure and cancellation are already reported by the write helper.
    // Either way the panel must show what is now on disk.
    await refreshPanel();
  } finally {
    applying = false;
  }
}

function inferLanguage(file: string): string {
  if (file.endsWith('.rs')) return 'rust';
  if (file.endsWith('.toml')) return 'toml';
  return 'plaintext';
}

/** Standalone clippy run used by the standardization smoke test. */
export async function runClippyCommand(controller: ProjectController, services: Services): Promise<void> {
  const snapshot = controller.snapshot;
  if (!snapshot) return;
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: t('Running cargo clippy --all-targets…'), cancellable: true },
    (_progress, token) =>
      services.cargo.clippy(snapshot.model.root, { allTargets: true, workspace: snapshot.model.kind === 'workspace' }, { token }),
  );
  getOutput().appendLine(result.stderr || result.stdout);
  if (result.code === 0) {
    void vscode.window.showInformationMessage(t('cargo clippy passed.'));
  } else {
    void vscode.window.showWarningMessage(t('cargo clippy reported findings.'), t('Show output')).then((choice) => {
      if (choice === t('Show output')) getOutput().show();
    });
  }
}

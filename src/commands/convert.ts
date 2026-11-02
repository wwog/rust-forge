/** Single-package to workspace conversion command with dry-run preview. */
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import { applyConversion, planConversion } from '../core/migration/execute.js';
import { INHERITABLE_FIELDS } from '../core/migration/plan.js';
import { parseManifestFile } from '../core/cargo/project.js';
import { formatReport } from '../core/verify.js';
import { t } from '../core/i18n.js';
import { getOutput } from './shared.js';
import { WebviewPanelHost } from '../webviews/host.js';
import type { ConvertPanelData, WebviewMessage } from '../webviews/protocol.js';

const KEY = 'convert';

export async function convertToWorkspaceCommand(
  controller: ProjectController,
  services: Services,
  extensionUri: vscode.Uri,
): Promise<void> {
  const snapshot = controller.snapshot;
  if (!snapshot) {
    void vscode.window.showInformationMessage(t('Open a Rust project first.'));
    return;
  }
  if (snapshot.model.kind === 'workspace') {
    void vscode.window.showInformationMessage(t('This project is already a workspace.'));
    return;
  }

  const root = snapshot.model.root;
  let plan = await planConversion({ root, dryRun: true });

  const buildData = async (): Promise<ConvertPanelData> => {
    const manifest = (await parseManifestFile(snapshot.model.manifestPath)).data ?? {};
    const pkg = (manifest.package ?? {}) as Record<string, unknown>;
    const current = plan;
    return {
      kind: 'convert-panel',
      packageName: current.packageName ?? pkg.name?.toString() ?? '',
      targetDir: current.targetDir ?? path.join(root, 'crates', String(pkg.name ?? 'crate')),
      issues: current.issues,
      extractableFields: INHERITABLE_FIELDS.map((field) => ({
        key: field.key,
        value: pkg[field.key] !== undefined ? String(pkg[field.key]) : '',
        defaultExtract: field.defaultExtract,
        present: pkg[field.key] !== undefined,
      })),
      operations: current.operations.map((operation) => ({
        kind: operation.kind,
        path: operation.path,
        // Show workspace-relative destinations so the move target is obvious.
        to: operation.to ? vscode.workspace.asRelativePath(operation.to, false) : undefined,
        diff: operation.diff,
      })),
      promoted: current.plan?.promoted.map((dep) => ({
        name: dep.name,
        workspaceValue: dep.workspaceValue,
        memberValue: dep.memberValue,
        features: dep.features,
      })) ?? [],
      kept: current.plan?.kept ?? [],
      hardCodedReferences: current.hardCodedReferences,
      gitDirty: current.gitDirty,
      readmeHandling: 'keep',
      canApply: current.ok,
    };
  };

  const host = WebviewPanelHost.create({
    extensionUri,
    id: KEY,
    title: t('Convert to workspace'),
    data: await buildData(),
    watch: [snapshot.model.manifestPath],
    reload: async () => {
      plan = await planConversion({ root, dryRun: true });
      return buildData();
    },
    handlers: async (message: WebviewMessage) => {
      switch (message.type) {
        case 'convert':
          await runConversion(controller, services, message.options);
          break;
        case 'refresh':
          plan = await planConversion({ root, dryRun: true });
          host.setData(await buildData());
          break;
        default:
          break;
      }
    },
  });
}

async function runConversion(
  controller: ProjectController,
  services: Services,
  options: { extractFields: string[]; readmeHandling: 'keep' | 'copy'; targetDirName?: string },
): Promise<void> {
  const snapshot = controller.snapshot;
  if (!snapshot) return;
  const root = snapshot.model.root;

  const approved = await vscode.window.showWarningMessage(
    t('Convert this package into a workspace?'),
    {
      modal: true,
      detail: t(
        'The package moves under crates/{0}. A safety snapshot is taken first.',
        options.targetDirName ?? snapshot.model.rootPackage?.name ?? 'crate',
      ),
    },
    t('Convert'),
  );
  if (!approved) return;

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: t('Converting to workspace…'), cancellable: true },
    async (progress, token) => {
      progress.report({ message: t('Moving files and writing manifests') });
      return applyConversion(
        {
          root,
          extractFields: options.extractFields,
          readmeHandling: options.readmeHandling,
          targetDirName: options.targetDirName,
          dryRun: false,
          token,
        },
        services.cargo,
        services.snapshotStore(root),
      );
    },
  );

  if (result.report) {
    getOutput().appendLine(formatReport(result.report));
  }

  if (result.ok) {
    const choice = await vscode.window.showInformationMessage(
      t('Workspace conversion finished and verification passed.'),
      t('Show migration report'),
    );
    if (choice === t('Show migration report')) {
      await showMigrationReport(result, root);
    }
    await reloadAfterMove(controller, root);
    await controller.syncContextKeys();
    return;
  }

  if (result.error) {
    void vscode.window.showErrorMessage(result.error);
    getOutput().show();
    return;
  }

  void vscode.window
    .showWarningMessage(t('Conversion completed but verification failed. Review the output.'), t('Show output'))
    .then((choice) => {
      if (choice === t('Show output')) getOutput().show();
    });
  await reloadAfterMove(controller, root);
}

async function reloadAfterMove(controller: ProjectController, root: string): Promise<void> {
  await controller.load(root);
}

async function showMigrationReport(result: import('../core/migration/execute.js').ApplyResult, root: string): Promise<void> {
  const plan = result.plan;
  const lines: string[] = [`# ${t('Migration report')}`, ''];

  lines.push(`- ${t('Root')}: \`${root}\``);
  lines.push(`- ${t('Member directory')}: \`${vscode.workspace.asRelativePath(result.targetDir ?? '')}\``);
  lines.push('');

  if (result.moves?.length) {
    lines.push(`## ${t('Moved files')}`, '');
    for (const move of result.moves) {
      lines.push(`- \`${vscode.workspace.asRelativePath(move.from)}\` → \`${vscode.workspace.asRelativePath(move.to)}\``);
    }
    lines.push('');
  }

  if (plan?.extractedFields.length) {
    lines.push(`## ${t('Extracted package fields')}`, '');
    for (const field of plan.extractedFields) lines.push(`- \`${field}\``);
    lines.push('');
  }

  if (plan?.promoted.length) {
    lines.push(`## ${t('Promoted to [workspace.dependencies]')}`, '');
    for (const dep of plan.promoted) {
      lines.push(`- \`${dep.name}\` → \`${dep.workspaceValue}\` (${t('member')}: \`${dep.memberValue}\`)`);
    }
    lines.push('');
  }

  if (plan?.kept.length) {
    lines.push(`## ${t('Kept in the member')}`, '');
    for (const dep of plan.kept) {
      lines.push(`- \`${dep.name}\` [${dep.table}] — ${dep.reason}`);
    }
    lines.push('');
  }

  if (plan?.notes.length) {
    lines.push(`## ${t('Notes')}`, '');
    for (const note of plan.notes) lines.push(`- ${note}`);
    lines.push('');
  }

  if (result.report) {
    lines.push(`## ${t('Verification')}`, '');
    for (const step of result.report.steps) {
      lines.push(`- ${step.ok ? '✅' : '❌'} ${step.name}${step.durationMs ? ` (${(step.durationMs / 1000).toFixed(1)}s)` : ''}`);
    }
  }

  const doc = await vscode.workspace.openTextDocument({ content: lines.join('\n'), language: 'markdown' });
  await vscode.window.showTextDocument(doc, { preview: true });
}

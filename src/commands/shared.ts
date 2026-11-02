/** Shared command helpers: verification feedback, diff previews, prompts. */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { formatReport, verify, type VerificationReport } from '../core/verify.js';
import type { CargoService } from '../core/cargo/cargo.js';
import { readTextFile, writeTextFile } from '../core/process.js';
import { t } from '../core/i18n.js';

let outputChannel: vscode.OutputChannel | undefined;

export function getOutput(): vscode.OutputChannel {
  if (!outputChannel) outputChannel = vscode.window.createOutputChannel('Rust Forge');
  return outputChannel;
}

export function log(message: string): void {
  getOutput().appendLine(message);
}

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

export interface WriteOptions {
  root: string;
  /** file path -> new content */
  files: Map<string, string>;
  cargo: CargoService;
  verify: { metadata?: boolean; check?: boolean; workspace?: boolean; fmtCheck?: boolean; clippy?: boolean; package?: string };
  token?: vscode.CancellationToken;
}

export interface WriteResult {
  ok: boolean;
  report?: VerificationReport;
  error?: string;
}

/**
 * Write a set of manifest changes atomically from the user's perspective:
 * write -> verify -> report, restoring already written files on write failure.
 */
export async function writeFilesWithVerification(options: WriteOptions): Promise<WriteResult> {
  const written: { path: string; original: string | undefined }[] = [];

  try {
    for (const [file, content] of options.files) {
      let original: string | undefined;
      try {
        original = await readTextFile(file);
      } catch {
        original = undefined;
      }
      written.push({ path: file, original });
      await writeTextFile(file, content);
      log(`wrote ${path.relative(options.root, file)}`);
    }
  } catch (err) {
    // Restore what we already wrote before surfacing the error.
    for (const entry of written.reverse()) {
      try {
        if (entry.original === undefined) {
          await vscode.workspace.fs.delete(vscode.Uri.file(entry.path));
        } else {
          await writeTextFile(entry.path, entry.original);
        }
      } catch {
        // Best effort.
      }
    }
    return { ok: false, error: `Failed to write manifests: ${(err as Error).message}` };
  }

  const report = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: t('Verifying changes…'), cancellable: true },
    async (progress, token): Promise<VerificationReport> => {
      const cancellation = {
        get isCancellationRequested() {
          return token.isCancellationRequested || !!options.token?.isCancellationRequested;
        },
      };
      try {
        return await verify(options.cargo, {
          cwd: options.root,
          token: cancellation,
          onStepStart: (name) => progress.report({ message: name }),
          ...options.verify,
        });
      } catch (err) {
        // A rejected task can leave the notification spinning; always hand back
        // a report so the pipeline finishes and the result is logged.
        return {
          ok: false,
          cancelled: cancellation.isCancellationRequested,
          steps: [{ name: t('Verification'), ok: false, output: (err as Error).message }],
        };
      }
    },
  );

  log(formatReport(report));

  if (report.ok) {
    return { ok: true, report };
  }

  // Cancelling verification is not a failure: the writes stand as they are.
  if (report.cancelled) {
    void vscode.window.showInformationMessage(t('Verification was cancelled; the changes were kept.'));
    return { ok: false, report };
  }

  void vscode.window
    .showErrorMessage(t('Verification failed after writing the manifest.'), t('Show output'))
    .then((action) => {
      if (action === t('Show output')) getOutput().show();
    });
  return { ok: false, report };
}

/** Show a native diff of two texts before they are written. */
export async function showDiffPreview(title: string, left: string, right: string, language = 'toml'): Promise<void> {
  const leftDoc = await vscode.workspace.openTextDocument({ content: left, language });
  const rightDoc = await vscode.workspace.openTextDocument({ content: right, language });
  await vscode.commands.executeCommand('vscode.diff', leftDoc.uri, rightDoc.uri, title);
}

/** Multi-file diff approval flow. */
export async function confirmWithDiffs(
  changes: { path: string; original?: string; updated: string }[],
  title: string,
  token?: vscode.CancellationToken,
): Promise<boolean> {
  if (!changes.length) {
    void vscode.window.showInformationMessage(t('Nothing to change.'));
    return false;
  }

  for (const change of changes.slice(0, 3)) {
    await showDiffPreview(
      `${title}: ${path.basename(change.path)}`,
      change.original ?? '',
      change.updated,
    );
  }
  if (changes.length > 3) {
    void vscode.window.showInformationMessage(t('{0} more file(s) will also change.', changes.length - 3));
  }

  if (token?.isCancellationRequested) return false;
  const answer = await vscode.window.showWarningMessage(
    t('{0} file(s) will be modified. Review the diffs before continuing.', changes.length),
    { modal: true },
    t('Apply changes'),
  );
  return answer === t('Apply changes');
}

/** Ask for confirmation with a preview of the command about to run. */
export async function confirmCommand(preview: string, message: string): Promise<boolean> {
  const answer = await vscode.window.showWarningMessage(
    message,
    { modal: true, detail: `${t('Command to run')}:\n${preview}` },
    t('Run'),
  );
  return answer === t('Run');
}

export function cancelTokenSource(): { token: vscode.CancellationToken; cancel(): void } {
  const source = new vscode.CancellationTokenSource();
  return { token: source.token, cancel: () => source.dispose() };
}

export function showReport(report: VerificationReport): void {
  if (report.ok) {
    void vscode.window.showInformationMessage(t('Verification passed: {0}', report.steps.map((s) => s.name).join(', ')));
    return;
  }
  const failed = report.steps.find((s) => !s.ok);
  void vscode.window
    .showErrorMessage(t('{0} failed.', failed?.name ?? 'Verification'), t('Show output'))
    .then((choice) => {
      if (choice === t('Show output')) getOutput().show();
    });
}

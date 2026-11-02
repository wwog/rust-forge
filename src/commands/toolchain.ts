/** Toolchain detection, install and update commands. */
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import { ToolchainService } from '../core/toolchain.js';
import { t } from '../core/i18n.js';
import { confirmCommand, getOutput } from './shared.js';

export async function updateToolchainCommand(
  controller: ProjectController,
  services: Services,
  channel?: string,
): Promise<void> {
  const snapshot = controller.snapshot;
  if (!snapshot) return;

  const target = channel ?? snapshot.toolchain.activeToolchain;
  const preview = target ? `rustup update ${target}` : 'rustup update';

  if (!(await confirmCommand(preview, t('Update the Rust toolchain?')))) return;

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: t('Updating toolchain…'), cancellable: true },
    () => services.toolchain.update(snapshot.model.root, target),
  );

  if (!result) {
    void vscode.window.showErrorMessage(t('rustup was not found. Install rustup first.'));
    return;
  }

  getOutput().appendLine(result.stdout);
  getOutput().appendLine(result.stderr);

  if (result.code === 0) {
    void vscode.window.showInformationMessage(t('Toolchain updated.'));
    await controller.refresh();
  } else {
    void vscode.window.showErrorMessage(t('rustup update failed. See the Rust Forge output.'));
    getOutput().show();
  }
}

export async function installToolchainCommand(
  controller: ProjectController,
  services: Services,
): Promise<void> {
  const snapshot = controller.snapshot;
  if (!snapshot) return;

  const channel = await vscode.window.showInputBox({
    title: t('Install toolchain'),
    prompt: t('Channel or version, e.g. stable, beta, nightly, 1.75'),
    value: snapshot.toolchain.msrv ?? 'stable',
    validateInput: (value) =>
      /^[\w.\-]+$/.test(value.trim()) ? undefined : t('Use a channel name such as stable, nightly or 1.75'),
  });
  if (!channel) return;

  const componentsPick = await vscode.window.showQuickPick(
    [
      { label: 'rustfmt', description: t('Formatting'), picked: true },
      { label: 'clippy', description: t('Lints'), picked: true },
      { label: 'rust-src', description: t('Standard library sources') },
      { label: 'llvm-tools-preview', description: t('LLVM tools') },
    ],
    { title: t('Additional components'), canPickMany: true },
  );
  if (!componentsPick) return;

  const preview = `rustup toolchain install ${channel.trim()}${
    componentsPick.length ? ` --component ${componentsPick.map((c) => c.label).join(',')}` : ''
  }`;
  if (!(await confirmCommand(preview, t('Install this toolchain?')))) return;

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: t('Installing toolchain…'), cancellable: true },
    () => services.toolchain.install(snapshot.model.root, channel.trim(), { components: componentsPick.map((c) => c.label) }),
  );

  if (!result) {
    void vscode.window.showErrorMessage(t('rustup was not found. Install rustup first.'));
    return;
  }
  getOutput().appendLine(result.stdout);
  getOutput().appendLine(result.stderr);

  if (result.code === 0) {
    const writeFile = await vscode.window.showInformationMessage(
      t('Toolchain {0} installed.', channel.trim()),
      t('Create rust-toolchain.toml'),
    );
    if (writeFile === t('Create rust-toolchain.toml')) {
      await writeToolchainFile(snapshot.model.root, channel.trim(), componentsPick.map((c) => c.label));
    }
    await controller.refresh();
  } else {
    void vscode.window.showErrorMessage(t('Toolchain installation failed. See the Rust Forge output.'));
    getOutput().show();
  }
}

async function writeToolchainFile(root: string, channel: string, components: string[]): Promise<void> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const file = path.join(root, 'rust-toolchain.toml');
  const lines = ['[toolchain]', `channel = ${JSON.stringify(channel)}`];
  if (components.length) lines.push(`components = [${components.map((c) => JSON.stringify(c)).join(', ')}]`);
  lines.push('profile = "default"', '');
  await fs.writeFile(file, lines.join('\n'), 'utf8');
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  await vscode.window.showTextDocument(doc, { preview: true });
}

/** Guidance + assisted install when rustup or cargo is missing. */
export async function installRustupCommand(services: Services): Promise<void> {
  const cargo = await services.cargo.resolve();
  const rustup = await services.toolchain.rustup();

  const lines: string[] = [];
  if (!cargo) lines.push(t('cargo was not found on PATH.'));
  if (!rustup) lines.push(t('rustup was not found on PATH.'));

  const preview =
    process.platform === 'win32'
      ? 'winget install Rustlang.Rustup'
      : process.platform === 'darwin'
        ? 'brew install rustup && rustup-init'
        : 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh';

  const choice = await vscode.window.showWarningMessage(
    lines.join(' ') || t('Rust tooling looks incomplete.'),
    { modal: true, detail: `${t('Suggested command')}:\n${preview}\n\n${t('After installing, reload the window and refresh.')}` },
    t('Copy install command'),
    t('Open rustup.rs'),
  );

  if (choice === t('Copy install command')) {
    await vscode.env.clipboard.writeText(preview);
    void vscode.window.showInformationMessage(t('Install command copied to the clipboard.'));
  } else if (choice === t('Open rustup.rs')) {
    await vscode.env.openExternal(vscode.Uri.parse('https://rustup.rs'));
  }
}

export { ToolchainService };

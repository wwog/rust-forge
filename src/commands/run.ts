/**
 * Run/Run Tests commands for project-view crate nodes.
 *
 * Commands execute in a reusable integrated terminal so output stays visible
 * and the user can rerun after editing. "Run" is only offered when the crate
 * actually has a binary target; library crates still offer tests.
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import type { CargoPackage } from '../core/cargo/types.js';
import { detectCrateTargets } from '../core/crateTarget.js';
import { t } from '../core/i18n.js';
import { log } from './shared.js';

interface CrateNodeLike {
  resourceUri?: vscode.Uri;
  manifestPath?: string;
  memberName?: string;
}

interface TerminalEntry {
  terminal: vscode.Terminal;
}

const terminals = new Map<string, TerminalEntry>();

function crateDir(item: unknown): string | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const node = item as CrateNodeLike;
  if (node.resourceUri?.scheme === 'file') return node.resourceUri.fsPath;
  if (node.manifestPath) return path.dirname(node.manifestPath);
  return undefined;
}

function memberName(item: unknown): string | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const name = (item as CrateNodeLike).memberName;
  return typeof name === 'string' ? name : undefined;
}

function metadataPackage(controller: ProjectController, name: string | undefined): CargoPackage | undefined {
  if (!name) return undefined;
  return controller.snapshot?.metadata?.packages.find((pkg) => pkg.name === name);
}

/** Run the tests of the crate or of the whole workspace root. */
export async function runTestsCommand(
  controller: ProjectController,
  services: Services,
  item?: unknown,
): Promise<void> {
  const model = controller.project;
  const dir = crateDir(item);
  if (!model || !dir) return;

  const atWorkspaceRoot = path.resolve(dir) === path.resolve(model.root) && model.kind === 'workspace';
  const args = atWorkspaceRoot ? ['test', '--workspace'] : ['test'];
  const label = atWorkspaceRoot ? 'cargo test --workspace' : 'cargo test';
  await launchTerminal(services, dir, args, label, 'test');
}

/** Run a binary target of the crate. */
export async function runCrateCommand(
  controller: ProjectController,
  services: Services,
  item?: unknown,
): Promise<void> {
  const dir = crateDir(item);
  if (!dir) return;

  const info = await detectCrateTargets(dir, { metadataPackage: metadataPackage(controller, memberName(item)) });
  if (!info.isBinary) {
    void vscode.window.showInformationMessage(
      t('{0} has no binary target. Add src/main.rs or a [[bin]] entry.', info.packageName ?? path.basename(dir)),
    );
    return;
  }

  let binary = info.defaultRun && info.binaries.some((target) => target.name === info.defaultRun)
    ? info.defaultRun
    : info.binaries.length === 1
      ? info.binaries[0].name
      : undefined;

  if (!binary) {
    const picked = await vscode.window.showQuickPick(
      info.binaries.map((target) => ({
        label: target.name,
        description: target.path ? vscode.workspace.asRelativePath(target.path, false) : undefined,
        value: target.name,
      })),
      { title: t('Run binary'), placeHolder: t('Select the binary target to run') },
    );
    if (!picked) return;
    binary = picked.value;
  }

  await launchTerminal(services, dir, ['run', '--bin', binary], `cargo run --bin ${binary}`, 'run');
}

async function launchTerminal(
  services: Services,
  cwd: string,
  args: string[],
  label: string,
  keyPrefix: 'run' | 'test',
): Promise<void> {
  const cargo = await services.cargo.resolve();
  if (!cargo) {
    void vscode.window.showErrorMessage(t('cargo was not found on PATH.'));
    return;
  }

  const command = shellCommand(cargo, args);
  const key = `${keyPrefix}:${cwd}`;
  let entry = terminals.get(key);
  if (entry && (!vscode.window.terminals.includes(entry.terminal) || entry.terminal.exitStatus !== undefined)) {
    entry.terminal.dispose();
    entry = undefined;
  }
  if (!entry) {
    entry = {
      terminal: vscode.window.createTerminal({
        name: t('Rust Forge: {0}', label),
        cwd,
      }),
    };
    terminals.set(key, entry);
  }

  log(`run (${cwd}): ${command}`);
  entry.terminal.show();
  entry.terminal.sendText(command, true);
}

/** Quote a command for the integrated terminal's shell. */
function shellCommand(command: string, args: string[]): string {
  return [command, ...args].map(quoteArgument).join(' ');
}

function quoteArgument(value: string): string {
  if (!/[\s"'`$\\!&|<>()[\]{};*?~#%]/.test(value)) return value;
  if (process.platform === 'win32') return `"${value.replace(/"/g, '""')}"`;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

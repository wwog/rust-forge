/**
 * Rust Forge extension entry point.
 *
 * Wires services, the project controller, tree views and commands together.
 * The extension activates lazily: only when a Cargo.toml exists or a Rust Forge
 * view is opened.
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { ProjectController } from './projectController.js';
import { Services } from './services.js';
import { ProjectTreeProvider } from './views/projectTree.js';
import { DependencyTreeProvider, type DependencyTreeElement } from './views/dependencyTree.js';
import { ToolchainTreeProvider } from './views/toolchainTree.js';
import { SettingsTreeProvider } from './views/settingsTree.js';
import { openFile } from './views/shared.js';
import { t } from './core/i18n.js';
import { createProjectWizard, openProjectWizard, addWorkspaceMember, removeWorkspaceMember } from './commands/project.js';
import {
  copyPathCommand,
  copyRelativePathCommand,
  deleteFileCommand,
  newFileCommand,
  newFolderCommand,
  openToSideCommand,
  refreshFilesCommand,
  renameFileCommand,
  revealInOSCommand,
} from './commands/files.js';
import {
  installDependencyCommand,
  upgradeDependenciesCommand,
  openCrateDocs,
  removeDependencyCommand,
  addWorkspaceDependencyToMemberCommand,
} from './commands/dependencies.js';
import { editPropertiesCommand } from './commands/properties.js';
import { editRustfmtCommand } from './commands/rustfmt.js';
import { standardizeCommand, runClippyCommand } from './commands/standardize.js';
import { convertToWorkspaceCommand } from './commands/convert.js';
import { updateToolchainCommand, installToolchainCommand, installRustupCommand } from './commands/toolchain.js';
import { getOutput, log } from './commands/shared.js';

export function activate(context: vscode.ExtensionContext): void {
  log(`Rust Forge activated (${context.extension.packageJSON.version as string})`);

  const services = new Services(context);
  const controller = new ProjectController(services, context);

  const projectTree = new ProjectTreeProvider(controller);
  const dependencyTree = new DependencyTreeProvider(controller);
  const toolchainTree = new ToolchainTreeProvider(controller);
  const settingsTree = new SettingsTreeProvider();

  context.subscriptions.push(
    services,
    controller,
    projectTree,
    vscode.window.createTreeView('rustForge.project', {
      treeDataProvider: projectTree,
      showCollapseAll: true,
    }),
    vscode.window.createTreeView('rustForge.dependencies', {
      treeDataProvider: dependencyTree,
      showCollapseAll: true,
    }),
    vscode.window.createTreeView('rustForge.toolchain', {
      treeDataProvider: toolchainTree,
      showCollapseAll: false,
    }),
    vscode.window.createTreeView('rustForge.settings', {
      treeDataProvider: settingsTree,
      showCollapseAll: false,
    }),
  );

  const refreshAll = () => {
    projectTree.refresh();
    dependencyTree.refresh();
    toolchainTree.refresh();
  };
  context.subscriptions.push(controller.onDidChange(refreshAll));

  // ------------------------------------------------------------- commands

  const register = (id: string, handler: (...args: never[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, handler as (...args: unknown[]) => unknown));

  register('rustForge.createProject', () => createProjectWizard(controller, services));
  register('rustForge.openProject', () => openProjectWizard(controller));
  register('rustForge.refresh', async () => {
    await controller.refresh();
    refreshAll();
  });
  register('rustForge.openManifest', async (file?: unknown) => {
    const target = typeof file === 'string' ? file : controller.project?.manifestPath;
    if (!target) return;
    await openFile(target);
  });
  register('rustForge.files.newFile', (item?: unknown) => newFileCommand(projectTree, item));
  register('rustForge.files.newFolder', (item?: unknown) => newFolderCommand(projectTree, item));
  register('rustForge.files.rename', (item?: unknown) => renameFileCommand(projectTree, item));
  register('rustForge.files.delete', (item?: unknown) => deleteFileCommand(projectTree, item));
  register('rustForge.files.copyPath', (item?: unknown) => copyPathCommand(projectTree, item));
  register('rustForge.files.copyRelativePath', (item?: unknown) => copyRelativePathCommand(projectTree, item));
  register('rustForge.files.revealInOS', (item?: unknown) => revealInOSCommand(projectTree, item));
  register('rustForge.files.openToSide', (item?: unknown) => openToSideCommand(projectTree, item));
  register('rustForge.files.refresh', () => refreshFilesCommand(projectTree));
  register('rustForge.addMember', () => addWorkspaceMember(controller, services));
  register('rustForge.removeMember', async (item?: unknown) => {
    const name =
      item && typeof item === 'object' && 'memberName' in item
        ? String((item as { memberName?: string }).memberName ?? '')
        : undefined;
    await removeWorkspaceMember(controller, services, name || undefined);
  });
  register('rustForge.installDependency', async (item?: unknown) => {
    const member =
      item && typeof item === 'object' && 'node' in item
        ? (item as DependencyTreeElement).node.memberName
        : undefined;
    await installDependencyCommand(controller, services, context.extensionUri, member);
  });
  register('rustForge.upgradeDependencies', () => upgradeDependenciesCommand(controller, services, context.extensionUri));
  register('rustForge.upgradeDependency', async () => {
    await upgradeDependenciesCommand(controller, services, context.extensionUri);
  });
  register('rustForge.openCrateDocs', async (item?: unknown, version?: unknown) => {
    if (item && typeof item === 'object' && 'node' in item) {
      const node = (item as DependencyTreeElement).node;
      await openCrateDocs(node.declaration?.packageName ?? node.label, node.lockedVersion ?? node.latestVersion);
      return;
    }
    if (typeof item === 'string') await openCrateDocs(item, typeof version === 'string' ? version : undefined);
  });
  register('rustForge.removeDependency', async (item?: unknown) => {
    if (item && typeof item === 'object' && 'node' in item) {
      await removeDependencyCommand(controller, services, (item as DependencyTreeElement).node);
    }
  });
  register('rustForge.addWorkspaceDependencyToMember', async (item?: unknown) => {
    if (item && typeof item === 'object' && 'node' in item) {
      await addWorkspaceDependencyToMemberCommand(controller, services, (item as DependencyTreeElement).node);
    }
  });
  register('rustForge.openDependencyManifest', async (item?: unknown) => {
    if (item && typeof item === 'object' && 'node' in item) {
      const node = (item as DependencyTreeElement).node;
      if (node.manifestPath) await openFile(node.manifestPath, node.declaration?.line);
    }
  });
  register('rustForge.editProperties', () => editPropertiesCommand(controller, services, context.extensionUri));
  register('rustForge.editRustfmt', async (member?: unknown) => {
    await editRustfmtCommand(controller, services, context.extensionUri, typeof member === 'string' ? member : undefined);
  });
  register('rustForge.standardize', () => standardizeCommand(controller, services, context.extensionUri));
  register('rustForge.convertToWorkspace', () => convertToWorkspaceCommand(controller, services, context.extensionUri));
  register('rustForge.updateToolchain', async (channel?: unknown) =>
    updateToolchainCommand(controller, services, typeof channel === 'string' ? channel : undefined),
  );
  register('rustForge.installToolchain', () => installToolchainCommand(controller, services));
  register('rustForge.installRustup', () => installRustupCommand(services));
  register('rustForge.refreshAudit', async () => {
    await controller.refreshAudit();
    refreshAll();
    void vscode.window.showInformationMessage(t('Security advisories refreshed.'));
  });
  register('rustForge.installCargoAudit', async () => {
    const root = controller.root;
    if (!root) return;
    const choice = await vscode.window.showWarningMessage(
      t('Install cargo-audit with `cargo install cargo-audit`?'),
      { modal: true, detail: 'cargo install cargo-audit' },
      t('Install'),
    );
    if (!choice) return;
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: t('Installing cargo-audit…'), cancellable: true },
      (_progress, token) => services.cargo.exec(['install', 'cargo-audit'], root, { token, timeoutMs: 1_800_000 }),
    );
    if (result.code === 0) {
      void vscode.window.showInformationMessage(t('cargo-audit installed. Refresh the security audit to use it.'));
      await controller.refreshAudit();
    } else {
      void vscode.window.showErrorMessage(t('cargo install cargo-audit failed.'));
      getOutput().show();
    }
  });
  register('rustForge.runClippy', () => runClippyCommand(controller, services));

  // ------------------------------------------------------------- workspace

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await controller.initialize();
      refreshAll();
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      const active = controller.project;
      if (!active) return;
      if (path.basename(document.fileName) !== 'Cargo.toml') return;
      // Debounce reloads triggered by our own writes.
      await new Promise((resolve) => setTimeout(resolve, 400));
      await controller.refresh();
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('rustForge.offline') || event.affectsConfiguration('rustForge.cargoPath')) {
        await controller.refresh();
      }
    }),
  );

  void controller.initialize().then(refreshAll);

  maybeShowMissingToolchain(controller, services);
}

async function maybeShowMissingToolchain(controller: ProjectController, services: Services): Promise<void> {
  const cargo = await services.cargo.resolve();
  if (cargo) return;
  if (!vscode.workspace.workspaceFolders?.length) return;
  void vscode.window
    .showWarningMessage(
      t('cargo was not found on PATH. Rust Forge needs it for project operations.'),
      t('Install rustup'),
      t('Open settings'),
    )
    .then((choice) => {
      if (choice === t('Install rustup')) {
        void vscode.commands.executeCommand('rustForge.installRustup');
      } else if (choice === t('Open settings')) {
        void vscode.commands.executeCommand('workbench.action.openSettings', 'rustForge.cargoPath');
      }
    });
}

export function deactivate(): void {
  // Disposables are owned by the extension context.
}

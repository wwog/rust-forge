/** Project creation, opening and workspace member management. */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import { discoverProject, parseManifestFile, planMemberAddition, planMemberRemoval, workspaceTable } from '../core/cargo/project.js';
import { defaultCrateName, writeWorkspaceSkeleton } from '../core/cargo/scaffold.js';
import { readTextFile, writeTextFile, relativePath } from '../core/process.js';
import { generateRustfmtToml } from '../core/rustfmt.js';
import { t } from '../core/i18n.js';
import { log, getOutput, writeFilesWithVerification } from './shared.js';

export type CreateProjectPreset = 'package' | 'workspace';

/**
 * `preset` skips the kind question for the empty-folder initialization links:
 * `package` still asks binary vs library, `workspace` goes straight to naming.
 */
export async function createProjectWizard(
  controller: ProjectController,
  services: Services,
  preset?: CreateProjectPreset,
): Promise<void> {
  if (preset) {
    const folder = controller.workspaceFolder;
    // The empty-folder links initialize the open folder itself; never create a
    // child directory in that case.
    if (folder && controller.folderState === 'empty') {
      await initializeFolder(controller, services, folder, preset);
      return;
    }
  }

  let kind: 'bin' | 'lib' | 'workspace';
  if (preset === 'workspace') {
    kind = 'workspace';
  } else {
    const picked = await promptProjectKind(preset !== 'package');
    if (!picked) return;
    kind = picked;
  }

  const name = await promptProjectName('my-rust-project');
  if (!name) return;

  const folders = vscode.workspace.workspaceFolders ?? [];
  const parentPick = folders.length
    ? await vscode.window.showQuickPick(
        [
          ...folders.map((folder) => ({
            label: path.basename(folder.uri.fsPath),
            description: folder.uri.fsPath,
            value: folder.uri.fsPath,
          })),
          { label: t('Choose another folder…'), description: '', value: '__browse__' },
        ],
        { title: t('Select the parent folder') },
      )
    : { value: '__browse__' as string };
  if (!parentPick) return;

  let parentDir = parentPick.value;
  if (parentDir === '__browse__') {
    const picked = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: t('Create here'),
    });
    if (!picked?.length) return;
    parentDir = picked[0].fsPath;
  }

  const targetDir = path.join(parentDir, name);
  if (await exists(targetDir)) {
    await vscode.window.showWarningMessage(t('{0} already exists. Choose a different name or folder.', targetDir));
    return;
  }

  const vcs = await promptVcs();
  if (!vcs) return;

  const generateRustfmt = await promptRustfmt();
  if (generateRustfmt === undefined) return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: t('Creating Rust project…'), cancellable: false },
    async (progress) => {
      progress.report({ message: kind === 'workspace' ? t('Generating workspace manifest') : t('Running cargo new') });

      if (kind === 'workspace') {
        await writeWorkspaceSkeleton(targetDir, {
          name,
          vcs,
          generateRustfmt,
          language: currentLanguage(),
        });
      } else {
        const result = await services.cargo.new(parentDir, name, kind, vcs);
        if (result.code !== 0) {
          const message = result.missingBinary
            ? t('cargo was not found on PATH. Install rustup first.')
            : result.stderr.trim() || t('cargo new failed');
          void vscode.window.showErrorMessage(message);
          return;
        }
        if (generateRustfmt) {
          await writeTextFile(path.join(targetDir, 'rustfmt.toml'), generateRustfmtToml({ language: currentLanguage() }));
        }
      }

      await openFolder(targetDir);
      await controller.load(targetDir);
    },
  );
}

/**
 * Initialize the open empty folder as the project root. This is deliberately
 * different from the create wizard: no parent-folder picker and no child
 * directory, so `Cargo.toml` lands exactly where the user opened the folder.
 */
async function initializeFolder(
  controller: ProjectController,
  services: Services,
  folder: vscode.WorkspaceFolder,
  preset: CreateProjectPreset,
): Promise<void> {
  const root = folder.uri.fsPath;
  // The folder state can be stale between the welcome render and the click;
  // never overwrite a manifest that appeared in the meantime.
  if (await exists(path.join(root, 'Cargo.toml'))) {
    void vscode.window.showWarningMessage(t('{0} already contains Cargo.toml. Refresh the project view first.', root));
    return;
  }

  let kind: 'bin' | 'lib' | 'workspace';
  if (preset === 'workspace') {
    kind = 'workspace';
  } else {
    const picked = await promptProjectKind(false);
    if (!picked) return;
    kind = picked;
  }

  const name = await promptProjectName(defaultCrateName(root));
  if (!name) return;

  const vcs = await promptVcs();
  if (!vcs) return;

  const generateRustfmt = await promptRustfmt();
  if (generateRustfmt === undefined) return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: t('Initializing Rust project…'), cancellable: false },
    async (progress) => {
      progress.report({ message: kind === 'workspace' ? t('Generating workspace manifest') : t('Running cargo init') });

      if (kind === 'workspace') {
        await writeWorkspaceSkeleton(root, { name, vcs, generateRustfmt, language: currentLanguage() });
      } else {
        const result = await services.cargo.init(root, name, kind, vcs);
        if (result.code !== 0) {
          const message = result.missingBinary
            ? t('cargo was not found on PATH. Install rustup first.')
            : result.stderr.trim() || t('cargo init failed');
          void vscode.window.showErrorMessage(message);
          return;
        }
        if (generateRustfmt) {
          await writeTextFile(path.join(root, 'rustfmt.toml'), generateRustfmtToml({ language: currentLanguage() }));
        }
      }

      await controller.load(root);
    },
  );
}

async function promptProjectKind(includeWorkspace: boolean): Promise<'bin' | 'lib' | 'workspace' | undefined> {
  const kinds = [
    { label: t('Binary application'), description: t('Creates src/main.rs'), value: 'bin' as const },
    { label: t('Library'), description: t('Creates src/lib.rs'), value: 'lib' as const },
    ...(includeWorkspace
      ? [{ label: t('Workspace root'), description: t('Creates a [workspace] manifest with crates/'), value: 'workspace' as const }]
      : []),
  ];
  const picked = await vscode.window.showQuickPick(kinds, {
    title: t('Create Rust project'),
    placeHolder: t('Choose the project kind'),
  });
  return picked?.value;
}

async function promptProjectName(defaultValue: string): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    title: t('Create Rust project'),
    prompt: t('Crate or workspace name'),
    value: defaultValue,
    validateInput: (input) => {
      if (!input.trim()) return t('A name is required');
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(input.trim())) return t('Use letters, digits, - and _, starting with a letter');
      return undefined;
    },
  });
  return value?.trim();
}

async function promptVcs(): Promise<'git' | 'none' | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: t('Initialize a git repository'), value: 'git' as const },
      { label: t('No version control'), value: 'none' as const },
    ],
    { title: t('Version control') },
  );
  return picked?.value;
}

async function promptRustfmt(): Promise<boolean | undefined> {
  const extras = await vscode.window.showQuickPick(
    [{ label: t('Generate a recommended rustfmt.toml'), value: 'rustfmt', picked: true }],
    { title: t('Additional setup'), canPickMany: true },
  );
  return extras === undefined ? undefined : extras.some((extra) => extra.value === 'rustfmt');
}

export async function openProjectWizard(controller: ProjectController): Promise<void> {
  const picked = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: t('Open Rust project'),
    title: t('Select a folder containing Cargo.toml'),
  });
  if (!picked?.length) return;
  const dir = picked[0].fsPath;

  const discovered = await discoverProject(dir, { respectMembership: true });
  if (discovered.error || !discovered.model) {
    void vscode.window.showErrorMessage(t('No readable Cargo.toml found in {0}.', dir));
    return;
  }

  if (discovered.memberOfWorkspace) {
    const root = discovered.memberOfWorkspace;
    const choice = await vscode.window.showInformationMessage(
      t('This directory belongs to the workspace at {0}. Open it in workspace mode?', root),
      t('Open as workspace'),
      t('Open this package only'),
    );
    if (!choice) return;
    if (choice === t('Open as workspace')) {
      await openFolder(root);
      await controller.load(root);
      return;
    }
    await openFolder(dir);
    await controller.load(dir);
    return;
  }

  await openFolder(dir);
  await controller.load(dir);
}

/** Add a crate to the workspace, optionally running cargo new. */
export async function addWorkspaceMember(controller: ProjectController, services: Services): Promise<void> {
  const model = controller.project;
  if (!model || model.kind !== 'workspace') {
    void vscode.window.showInformationMessage(t('Open a workspace project first.'));
    return;
  }

  const kindPick = await vscode.window.showQuickPick(
    [
      { label: t('New binary crate'), value: 'bin' as const },
      { label: t('New library crate'), value: 'lib' as const },
      { label: t('Existing directory'), value: 'existing' as const },
    ],
    { title: t('Add workspace member') },
  );
  if (!kindPick) return;

  if (kindPick.value === 'existing') {
    const picked = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      defaultUri: vscode.Uri.file(model.root),
      openLabel: t('Add as member'),
    });
    if (!picked?.length) return;
    const relative = relativePath(model.root, picked[0].fsPath);
    if (relative.startsWith('..')) {
      void vscode.window.showErrorMessage(t('The member must live inside the workspace root.'));
      return;
    }
    if (!(await exists(path.join(picked[0].fsPath, 'Cargo.toml')))) {
      void vscode.window.showErrorMessage(t('That directory has no Cargo.toml.'));
      return;
    }
    const added = await addMemberPattern(controller, services, relative);
    if (added) {
      void vscode.window.showInformationMessage(t('Added {0} to the workspace.', path.basename(picked[0].fsPath)));
    }
    return;
  }

  const name = await vscode.window.showInputBox({
    title: t('Add workspace member'),
    prompt: t('Crate name'),
    value: 'my-crate',
    validateInput: (value) => (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value.trim()) ? undefined : t('Invalid crate name')),
  });
  if (!name) return;

  const cratesDir = path.join(model.root, 'crates');
  await fs.mkdir(cratesDir, { recursive: true });
  const result = await services.cargo.new(cratesDir, name.trim(), kindPick.value, 'none');
  if (result.code !== 0) {
    void vscode.window.showErrorMessage(result.stderr.trim() || t('cargo new failed'));
    return;
  }

  const added = await addMemberPattern(controller, services, `crates/${name.trim()}`);
  if (added) {
    void vscode.window.showInformationMessage(t('Added {0} to the workspace.', name.trim()));
  }
}

async function addMemberPattern(controller: ProjectController, services: Services, memberPattern: string): Promise<boolean> {
  const model = controller.project!;
  const original = await readTextFile(model.manifestPath);
  const plan = planMemberAddition(original, memberPattern);
  if (!plan.changed) {
    // Already covered by members or an equivalent glob.
    await controller.refresh();
    return true;
  }

  const result = await writeFilesWithVerification({
    root: model.root,
    files: new Map([[model.manifestPath, plan.text]]),
    cargo: services.cargo,
    verify: { metadata: true, check: false, workspace: true },
  });

  if (!result.ok) return false;
  await controller.refresh();
  await controller.syncContextKeys();
  return true;
}

export async function removeWorkspaceMember(
  controller: ProjectController,
  services: Services,
  memberName?: string,
): Promise<void> {
  const model = controller.project;
  if (!model || model.kind !== 'workspace') return;

  // The root package of a workspace cannot be removed from the members list.
  const candidates = model.members.filter((m) => path.resolve(m.dir) !== path.resolve(model.root));
  const target = memberName ?? (await pickMember(candidates, t('Remove workspace member')));
  if (!target) return;

  const member = candidates.find((m) => m.name === target);
  if (!member) return;

  const confirm = await vscode.window.showWarningMessage(
    t('Remove {0} from the workspace? The directory is kept on disk; only the members list changes.', target),
    { modal: true },
    t('Remove member'),
  );
  if (!confirm) return;

  const relative = relativePath(model.root, member.dir);
  const original = await readTextFile(model.manifestPath);
  const plan = planMemberRemoval(original, relative);
  if (!plan.changed) {
    void vscode.window.showWarningMessage(
      t('This member is included automatically by Cargo or is not listed in workspace.members, so it cannot be removed with this action.'),
    );
    return;
  }

  const result = await writeFilesWithVerification({
    root: model.root,
    files: new Map([[model.manifestPath, plan.text]]),
    cargo: services.cargo,
    verify: { metadata: true, workspace: true },
  });
  if (!result.ok) return;
  await controller.refresh();
}

async function pickMember(members: { name: string; dir: string }[], title: string): Promise<string | undefined> {
  const pick = await vscode.window.showQuickPick(
    members.map((m) => ({ label: m.name, description: path.basename(m.dir), value: m.name })),
    { title },
  );
  return pick?.value;
}

export async function openFolder(dir: string): Promise<void> {
  const sameFolder = vscode.workspace.workspaceFolders?.length === 1 && vscode.workspace.workspaceFolders[0].uri.fsPath === dir;
  if (sameFolder) return;
  const answer = await vscode.window.showInformationMessage(
    t('Open {0} in this window?', dir),
    t('Open'),
    t('Open in new window'),
  );
  if (!answer) return;
  await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(dir), {
    forceNewWindow: answer === t('Open in new window'),
  });
}

async function exists(dir: string): Promise<boolean> {
  try {
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
}

function currentLanguage(): 'en' | 'zh-cn' {
  return vscode.env.language.toLowerCase().startsWith('zh') ? 'zh-cn' : 'en';
}

export { getOutput, log, parseManifestFile };

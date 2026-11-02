/** Project creation, opening and workspace member management. */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import { discoverProject, parseManifestFile, workspaceTable } from '../core/cargo/project.js';
import { readTextFile, writeTextFile, relativePath } from '../core/process.js';
import { generateRustfmtToml } from '../core/rustfmt.js';
import { TomlEditor } from '../core/toml/editor.js';
import { t } from '../core/i18n.js';
import { log, getOutput, writeFilesWithVerification } from './shared.js';

export interface CreateProjectOptions {
  parentDir: string;
  name: string;
  kind: 'bin' | 'lib' | 'workspace';
  vcs: 'git' | 'none';
  generateRustfmt: boolean;
  edition?: string;
}

export async function createProjectWizard(controller: ProjectController, services: Services): Promise<void> {
  const kindPick = await vscode.window.showQuickPick(
    [
      { label: t('Binary application'), description: t('cargo new --bin'), value: 'bin' as const },
      { label: t('Library'), description: t('cargo new --lib'), value: 'lib' as const },
      { label: t('Workspace root'), description: t('Creates a [workspace] manifest with crates/'), value: 'workspace' as const },
    ],
    { title: t('Create Rust project'), placeHolder: t('Choose the project kind') },
  );
  if (!kindPick) return;

  const name = await vscode.window.showInputBox({
    title: t('Create Rust project'),
    prompt: t('Crate or workspace name'),
    value: 'my-rust-project',
    validateInput: (value) => {
      if (!value.trim()) return t('A name is required');
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value.trim())) return t('Use letters, digits, - and _, starting with a letter');
      return undefined;
    },
  });
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

  const targetDir = path.join(parentDir, name.trim());
  if (await exists(targetDir)) {
    await vscode.window.showWarningMessage(t('{0} already exists. Choose a different name or folder.', targetDir));
    return;
  }

  const vcsPick = await vscode.window.showQuickPick(
    [
      { label: t('Initialize a git repository'), value: 'git' as const },
      { label: t('No version control'), value: 'none' as const },
    ],
    { title: t('Version control') },
  );
  if (!vcsPick) return;

  const extras = await vscode.window.showQuickPick(
    [
      { label: t('Generate a recommended rustfmt.toml'), value: 'rustfmt', picked: true },
    ],
    { title: t('Additional setup'), canPickMany: true },
  );
  if (!extras) return;

  const options: CreateProjectOptions = {
    parentDir,
    name: name.trim(),
    kind: kindPick.value,
    vcs: vcsPick.value,
    generateRustfmt: extras.some((e) => e.value === 'rustfmt'),
  };

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: t('Creating Rust project…'), cancellable: false },
    async (progress) => {
      progress.report({ message: kindPick.value === 'workspace' ? t('Generating workspace manifest') : t('Running cargo new') });

      if (kindPick.value === 'workspace') {
        await createWorkspaceSkeleton(options);
      } else {
        const result = await services.cargo.new(parentDir, options.name, kindPick.value, options.vcs);
        if (result.code !== 0) {
          const message = result.missingBinary
            ? t('cargo was not found on PATH. Install rustup first.')
            : result.stderr.trim() || t('cargo new failed');
          void vscode.window.showErrorMessage(message);
          return;
        }
        if (options.generateRustfmt) {
          await writeTextFile(path.join(targetDir, 'rustfmt.toml'), generateRustfmtToml({ language: currentLanguage() }));
        }
      }

      await openFolder(targetDir);
      await controller.load(targetDir);
    },
  );
}

async function createWorkspaceSkeleton(options: CreateProjectOptions): Promise<void> {
  const targetDir = path.join(options.parentDir, options.name);
  await fs.mkdir(targetDir, { recursive: true });
  const manifest = [
    '[workspace]',
    'members = []',
    'resolver = "3"',
    '',
    '[workspace.package]',
    'version = "0.1.0"',
    'edition = "2024"',
    '',
  ].join('\n');
  await writeTextFile(path.join(targetDir, 'Cargo.toml'), manifest);
  await fs.mkdir(path.join(targetDir, 'crates'), { recursive: true });
  await writeTextFile(
    path.join(targetDir, 'README.md'),
    `# ${options.name}\n\nA Cargo workspace.\n\n## Members\n\nAdd crates under \`crates/\`, then run \`cargo metadata\`.\n`,
  );
  if (options.vcs === 'git') {
    await writeTextFile(path.join(targetDir, '.gitignore'), '/target\n');
  }
  if (options.generateRustfmt) {
    await writeTextFile(path.join(targetDir, 'rustfmt.toml'), generateRustfmtToml({ language: currentLanguage() }));
  }
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
    await addMemberPattern(controller, services, relative);
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

  const members = readMembers(await readTextFile(model.manifestPath));
  if (!members.some((m) => m.includes('*'))) {
    await addMemberPattern(controller, services, `crates/${name.trim()}`);
  } else {
    await controller.refresh();
  }
  void vscode.window.showInformationMessage(t('Added {0} to the workspace.', name.trim()));
}

function readMembers(manifestText: string): string[] {
  try {
    const parsed = JSON.parse(JSON.stringify(require('smol-toml').parse(manifestText))) as Record<string, unknown>;
    const ws = workspaceTable(parsed);
    return Array.isArray(ws?.members) ? (ws!.members as string[]) : [];
  } catch {
    return [];
  }
}

async function addMemberPattern(controller: ProjectController, services: Services, memberPattern: string): Promise<void> {
  const model = controller.project!;
  const original = await readTextFile(model.manifestPath);
  const editor = new TomlEditor(original);
  const members = readMembers(original);
  if (members.includes(memberPattern)) {
    await controller.refresh();
    return;
  }
  const updated = [...members, memberPattern];
  const value = `[${updated.map((m) => JSON.stringify(m)).join(', ')}]`;
  const newText = editor.apply(editor.setKey('workspace', 'members', value));

  const result = await writeFilesWithVerification({
    root: model.root,
    files: new Map([[model.manifestPath, newText]]),
    cargo: services.cargo,
    verify: { metadata: true, check: false, workspace: true },
  });

  if (!result.ok) return;
  await controller.refresh();
  await controller.syncContextKeys();
}

export async function removeWorkspaceMember(
  controller: ProjectController,
  services: Services,
  memberName?: string,
): Promise<void> {
  const model = controller.project;
  if (!model || model.kind !== 'workspace') return;

  const target = memberName ?? (await pickMember(model.members, t('Remove workspace member')));
  if (!target) return;

  const member = model.members.find((m) => m.name === target);
  if (!member) return;

  const confirm = await vscode.window.showWarningMessage(
    t('Remove {0} from the workspace? The directory is kept on disk; only the members list changes.', target),
    { modal: true },
    t('Remove member'),
  );
  if (!confirm) return;

  const relative = relativePath(model.root, member.dir);
  const original = await readTextFile(model.manifestPath);
  const members = readMembers(original);
  const remaining = members.filter((m) => m !== relative && !(m.includes('*') && member.dir.includes(path.sep + 'crates' + path.sep)));

  const editor = new TomlEditor(original);
  const value = `[${remaining.map((m) => JSON.stringify(m)).join(', ')}]`;
  const newText = editor.apply(editor.setKey('workspace', 'members', value));

  const result = await writeFilesWithVerification({
    root: model.root,
    files: new Map([[model.manifestPath, newText]]),
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

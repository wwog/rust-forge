/**
 * Commands backing the Files view. They operate on the TreeItem passed by the
 * context menu (or its `resourceUri`) and reuse VS Code's own file APIs and
 * dialogs, so behaviour matches the built-in Explorer as closely as possible.
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { FileTreeHost } from '../views/shared.js';
import { t } from '../core/i18n.js';

export async function newFileCommand(provider: FileTreeHost, item?: unknown): Promise<void> {
  const directory = await resolveDirectory(provider, item);
  if (!directory) {
    void vscode.window.showInformationMessage(t('Open a folder first.'));
    return;
  }

  const value = await vscode.window.showInputBox({
    title: t('New File'),
    prompt: t('Enter a file name'),
    placeHolder: 'main.rs',
    validateInput: async (input) => {
      const invalid = validateNewName(input);
      if (invalid) return invalid;
      const target = resolveChild(directory, input.trim());
      return (await pathExists(target)) ? t('{0} already exists.', input.trim()) : undefined;
    },
  });
  if (value === undefined) return;

  const target = resolveChild(directory, value.trim());
  try {
    await ensureDirectory(provider, parentOf(target));
    await vscode.workspace.fs.writeFile(target, new Uint8Array());
  } catch (error) {
    showFileError(t('Could not create {0}.', value.trim()), error);
    return;
  }

  provider.refresh();
  try {
    await vscode.window.showTextDocument(target, { preview: true });
  } catch {
    // The file exists even when VS Code has no editor for it.
  }
}

export async function newFolderCommand(provider: FileTreeHost, item?: unknown): Promise<void> {
  const directory = await resolveDirectory(provider, item);
  if (!directory) {
    void vscode.window.showInformationMessage(t('Open a folder first.'));
    return;
  }

  const value = await vscode.window.showInputBox({
    title: t('New Folder'),
    prompt: t('Enter a folder name'),
    placeHolder: 'src',
    validateInput: async (input) => {
      const invalid = validateNewName(input);
      if (invalid) return invalid;
      const target = resolveChild(directory, input.trim());
      return (await pathExists(target)) ? t('{0} already exists.', input.trim()) : undefined;
    },
  });
  if (value === undefined) return;

  const target = resolveChild(directory, value.trim());
  try {
    await ensureDirectory(provider, target);
  } catch (error) {
    showFileError(t('Could not create {0}.', value.trim()), error);
    return;
  }
  provider.refresh();
}

export async function renameFileCommand(provider: FileTreeHost, item?: unknown): Promise<void> {
  const uri = treeUri(item);
  const root = provider.rootUri;
  if (!uri || !root) {
    void vscode.window.showInformationMessage(t('Select a file or folder first.'));
    return;
  }
  if (uri.path === root.path) {
    void vscode.window.showWarningMessage(t('Cannot rename the project root.'));
    return;
  }

  const current = baseName(uri);
  if (hasDirtyDocuments(uri)) {
    void vscode.window.showWarningMessage(t('{0} has unsaved changes. Save or close it first.', current));
    return;
  }
  const value = await vscode.window.showInputBox({
    title: t('Rename'),
    prompt: t('Enter a new name'),
    value: current,
    validateInput: (input) => validateRenameName(input),
  });
  if (value === undefined || value.trim() === current) return;

  const target = vscode.Uri.joinPath(parentOf(uri), value.trim());
  const caseOnly = target.path.toLowerCase() === uri.path.toLowerCase();
  if (!caseOnly && (await pathExists(target))) {
    void vscode.window.showErrorMessage(t('{0} already exists.', value.trim()));
    return;
  }

  try {
    await vscode.workspace.fs.rename(uri, target, { overwrite: false });
  } catch (error) {
    showFileError(t('Could not rename {0}.', current), error);
    return;
  }
  provider.refresh();
}

export async function deleteFileCommand(provider: FileTreeHost, item?: unknown): Promise<void> {
  const uri = treeUri(item);
  const root = provider.rootUri;
  if (!uri || !root) {
    void vscode.window.showInformationMessage(t('Select a file or folder first.'));
    return;
  }
  if (uri.path === root.path) {
    void vscode.window.showWarningMessage(t('Cannot delete the project root.'));
    return;
  }

  const name = baseName(uri);
  if (hasDirtyDocuments(uri)) {
    void vscode.window.showWarningMessage(t('{0} has unsaved changes. Save or close it first.', name));
    return;
  }

  const useTrash = vscode.workspace.getConfiguration('files').get<boolean>('enableTrash', true);
  const confirmed = await vscode.window.showWarningMessage(
    t('Delete {0}?', name),
    { modal: true, detail: useTrash ? t('The item is moved to the trash.') : t('This action cannot be undone.') },
    t('Delete'),
  );
  if (confirmed !== t('Delete')) return;

  try {
    await vscode.workspace.fs.delete(uri, { recursive: true, useTrash });
  } catch (error) {
    showFileError(t('Could not delete {0}.', name), error);
    return;
  }
  provider.refresh();
}

export async function copyPathCommand(provider: FileTreeHost, item?: unknown): Promise<void> {
  await copyPath(provider, item, false);
}

export async function copyRelativePathCommand(provider: FileTreeHost, item?: unknown): Promise<void> {
  await copyPath(provider, item, true);
}

export async function revealInOSCommand(_provider: FileTreeHost, item?: unknown): Promise<void> {
  const uri = treeUri(item);
  if (!uri) return;
  try {
    await vscode.commands.executeCommand('revealFileInOS', uri);
  } catch (error) {
    showFileError(t('Could not reveal {0}.', baseName(uri)), error);
  }
}

export async function openToSideCommand(_provider: FileTreeHost, item?: unknown): Promise<void> {
  const uri = treeUri(item);
  if (!uri || treeIsDirectory(item) === true) return;
  await vscode.commands.executeCommand('vscode.open', uri, {
    viewColumn: vscode.ViewColumn.Beside,
    preview: true,
  });
}

export function refreshFilesCommand(provider: FileTreeHost): void {
  provider.refresh();
}

async function copyPath(provider: FileTreeHost, item: unknown, relative: boolean): Promise<void> {
  const uri = treeUri(item);
  if (!uri) return;
  const root = provider.rootUri;
  const text =
    relative && root
      ? relativePath(root, uri) || baseName(uri)
      : uri.fsPath;
  await vscode.env.clipboard.writeText(text);
  vscode.window.setStatusBarMessage(t(relative ? 'Copied relative path' : 'Copied path'), 2000);
}

async function resolveDirectory(provider: FileTreeHost, item: unknown): Promise<vscode.Uri | undefined> {
  const uri = treeUri(item);
  if (!uri) return provider.rootUri;

  const known = treeIsDirectory(item);
  if (known === true) return uri;
  if (known === false) return parentOf(uri);

  try {
    const stat = await vscode.workspace.fs.stat(uri);
    return (stat.type & vscode.FileType.Directory) !== 0 ? uri : parentOf(uri);
  } catch {
    return provider.rootUri;
  }
}

function treeUri(item: unknown): vscode.Uri | undefined {
  if (item instanceof vscode.Uri) return item;
  if (item && typeof item === 'object' && 'resourceUri' in item) {
    const uri = (item as { resourceUri?: vscode.Uri }).resourceUri;
    if (uri instanceof vscode.Uri) return uri;
  }
  return undefined;
}

function treeIsDirectory(item: unknown): boolean | undefined {
  if (!item || typeof item !== 'object' || !('contextValue' in item)) return undefined;
  const contextValue = (item as vscode.TreeItem).contextValue;
  if (
    contextValue === 'directory' ||
    contextValue === 'rootDirectory' ||
    contextValue === 'member' ||
    contextValue === 'workspaceRoot' ||
    contextValue === 'rootPackage'
  ) {
    return true;
  }
  if (contextValue === 'file') return false;
  return undefined;
}

function resolveChild(directory: vscode.Uri, value: string): vscode.Uri {
  return value
    .split(/[\\/]/)
    .filter(Boolean)
    .reduce((uri, segment) => vscode.Uri.joinPath(uri, segment), directory);
}

function parentOf(uri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(uri, '..');
}

async function ensureDirectory(provider: FileTreeHost, directory: vscode.Uri): Promise<void> {
  const root = provider.rootUri;
  if (!root) {
    await vscode.workspace.fs.createDirectory(directory);
    return;
  }

  // Create the missing ancestors one level at a time; createDirectory is
  // idempotent, and this also works on providers that are not recursive.
  const missing: vscode.Uri[] = [];
  let current = directory;
  while (current.path !== root.path && isInside(root, current)) {
    missing.unshift(current);
    current = parentOf(current);
  }
  for (const segment of missing) {
    try {
      await vscode.workspace.fs.createDirectory(segment);
    } catch (error) {
      // Ignore the expected "already exists" case, but surface permission
      // errors and other failures.
      if (!(await pathExists(segment))) throw error;
    }
  }
}

async function pathExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function validateNewName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return t('A name is required');
  if (/^[\\/]/.test(name) || /^[a-zA-Z]:[\\/]/.test(name)) return t('Enter a path inside the project');
  if (name.split(/[\\/]/).some((segment) => !segment || segment === '.' || segment === '..')) {
    return t('Enter a valid relative path inside the project');
  }
  return undefined;
}

function validateRenameName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return t('A name is required');
  if (/[\\/]/.test(name)) return t('The name cannot contain path separators');
  if (name === '.' || name === '..') return t('Enter a valid name');
  return undefined;
}

function hasDirtyDocuments(uri: vscode.Uri): boolean {
  const prefix = uri.path.replace(/\/$/, '');
  return vscode.workspace.textDocuments.some((document) => {
    if (!document.isDirty || document.uri.scheme !== uri.scheme) return false;
    return document.uri.path === uri.path || document.uri.path.startsWith(`${prefix}/`);
  });
}

function baseName(uri: vscode.Uri): string {
  return path.posix.basename(uri.path) || path.basename(uri.fsPath) || uri.path;
}

function relativePath(root: vscode.Uri, uri: vscode.Uri): string {
  if (root.scheme === 'file' && uri.scheme === 'file') return path.relative(root.fsPath, uri.fsPath);
  return path.posix.relative(root.path, uri.path);
}

function isInside(root: vscode.Uri, uri: vscode.Uri): boolean {
  if (uri.scheme !== root.scheme) return false;
  const rootPath = root.path.endsWith('/') ? root.path : `${root.path}/`;
  return uri.path === root.path || uri.path.startsWith(rootPath);
}

function showFileError(message: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  void vscode.window.showErrorMessage(`${message} ${detail}`);
}

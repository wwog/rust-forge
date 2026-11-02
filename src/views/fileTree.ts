/**
 * File-listing helpers for the merged project tree.
 *
 * The project view doubles as the Explorer-style file tree, so directory
 * contents load lazily with the same rules as VS Code's Explorer: `files.exclude`
 * is honoured and the configured sort order is applied.
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { isPathExcluded, sortEntries } from '../core/files.js';

export interface FileEntry {
  name: string;
  uri: vscode.Uri;
  isDirectory: boolean;
}

/** Read one directory level, filtered and sorted like the Explorer. */
export async function readDirectoryEntries(
  directory: vscode.Uri,
  root: vscode.Uri,
  hiddenNames: ReadonlySet<string> = new Set(),
): Promise<FileEntry[]> {
  const entries = await vscode.workspace.fs.readDirectory(directory);
  const patterns = excludePatterns();
  const parentRelative = relativeToRoot(root, directory);
  const visible = entries
    .filter(
      ([name, type]) =>
        !hiddenNames.has(name) &&
        !isPathExcluded(joinRelative(parentRelative, name), patterns),
    )
    .map(([name, type]) => ({
      name,
      isDirectory: (type & vscode.FileType.Directory) !== 0,
      uri: vscode.Uri.joinPath(directory, name),
    }));

  return sortEntries(visible, explorerSortOrder());
}

/** `files.exclude` patterns that the user actually enabled. */
export function excludePatterns(): string[] {
  const configured = vscode.workspace.getConfiguration('files').get<Record<string, boolean>>('exclude', {});
  return Object.entries(configured)
    .filter(([, enabled]) => enabled)
    .map(([pattern]) => pattern);
}

export function explorerSortOrder(): string {
  return vscode.workspace.getConfiguration('explorer').get<string>('sortOrder', 'default');
}

export function joinRelative(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

export function relativeToRoot(root: vscode.Uri, uri: vscode.Uri): string {
  if (uri.scheme !== root.scheme) return '';
  const rootPath = root.path.endsWith('/') ? root.path : `${root.path}/`;
  return uri.path === root.path ? '' : uri.path.startsWith(rootPath) ? uri.path.slice(rootPath.length) : '';
}

export function isInside(root: vscode.Uri, uri: vscode.Uri): boolean {
  if (uri.scheme !== root.scheme) return false;
  const rootPath = root.path.endsWith('/') ? root.path : `${root.path}/`;
  return uri.path === root.path || uri.path.startsWith(rootPath);
}

/** Display name for the tree root: the workspace folder name when available. */
export function rootName(root: vscode.Uri): string {
  const folder = vscode.workspace.workspaceFolders?.find((candidate) => candidate.uri.toString() === root.toString());
  return folder?.name || path.basename(root.fsPath) || path.posix.basename(root.path) || root.path;
}

/** Shared tree view plumbing. */
import * as vscode from 'vscode';
import { t } from '../core/i18n.js';

export type TreeElement = vscode.TreeItem;

/**
 * Minimal surface the file commands need from the merged project view. The
 * project tree owns both Cargo structure and the Explorer-style file list, so
 * the files commands are bound to it instead of a separate provider.
 */
export interface FileTreeHost {
  readonly rootUri: vscode.Uri | undefined;
  refresh(): void;
}

export function makeItem(
  label: string,
  collapsible: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
): vscode.TreeItem {
  return new vscode.TreeItem(label, collapsible);
}

/**
 * Transient tree row for a view that is loading, refreshing or failed to load.
 * Rendering a row (instead of nothing) also keeps VS Code from showing the
 * view's welcome content — the create-project call to action — mid-load.
 */
export interface StatusNode {
  readonly status: 'loading' | 'error';
  readonly label: string;
  readonly tooltip?: string;
  readonly command?: vscode.Command;
}

export function isStatusNode(value: unknown): value is StatusNode {
  return typeof value === 'object' && value !== null && 'status' in value;
}

export function statusTreeItem(node: StatusNode): vscode.TreeItem {
  const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon(node.status === 'loading' ? 'sync~spin' : 'error');
  item.tooltip = node.tooltip ?? node.label;
  item.contextValue = `status:${node.status}`;
  item.command = node.command;
  return item;
}

/** Status row for an error phase, with a retry affordance. */
export function errorStatus(label: string, tooltip?: string): StatusNode {
  return { status: 'error', label, tooltip, command: { command: 'rustForge.refresh', title: t('Retry') } };
}

export function relativePathLabel(folder: vscode.WorkspaceFolder, absolute: string): string {
  return vscode.workspace.asRelativePath(absolute, false);
}

/** Open a manifest at an optional line. */
export async function openFile(file: string, line?: number): Promise<void> {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  const editor = await vscode.window.showTextDocument(document, { preview: true });
  if (line !== undefined && line >= 0) {
    const position = new vscode.Position(line, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }
}

/** A tree provider whose contents derive from one snapshot getter. */
export abstract class SnapshotTreeProvider<T> implements vscode.TreeDataProvider<T> {
  private readonly emitter = new vscode.EventEmitter<T | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  refresh(): void {
    this.emitter.fire();
  }

  abstract getTreeItem(element: T): vscode.TreeItem;
  abstract getChildren(element?: T): vscode.ProviderResult<T[]>;

  getParent?(element: T): T | undefined {
    void element;
    return undefined;
  }
}

/**
 * Settings view: a single row at the bottom of the Rust Forge container that
 * jumps straight to this extension's section in VS Code Settings.
 */
import * as vscode from 'vscode';
import { t } from '../core/i18n.js';

export class SettingsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
    return item;
  }

  getChildren(): vscode.TreeItem[] {
    const item = new vscode.TreeItem(t('Extension settings'), vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('settings-gear');
    item.description = 'rustForge.*';
    item.tooltip = t('Open the Rust Forge settings in VS Code Settings.');
    item.command = {
      command: 'workbench.action.openSettings',
      title: t('Open settings'),
      arguments: ['@ext:rust-forge.rust-forge'],
    };
    return [item];
  }
}

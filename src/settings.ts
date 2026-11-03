/** Runtime configuration snapshot. */
import * as vscode from 'vscode';
import type { CustomCargoMirror } from './core/cargo/mirror.js';

export interface Settings {
  cargoPath: string;
  rustupPath: string;
  offline: boolean;
  auditEnabled: boolean;
  auditCacheHours: number;
  networkTimeoutMs: number;
  crateDocsOpenMode: 'browser' | 'webview';
  /** Selected cargo mirror id (`official`, a built-in id, or `custom:<name>`). */
  cargoMirror: string;
  /** User-added mirrors. */
  cargoMirrors: CustomCargoMirror[];
}

/**
 * Configuration used for the mirror settings. In a single-folder workspace a
 * folder-scoped override is the most specific value; in a multi-root workspace
 * the mirror stays a workspace/user setting.
 */
export function mirrorConfiguration(): vscode.WorkspaceConfiguration {
  const folders = vscode.workspace.workspaceFolders;
  const folder = folders && folders.length === 1 ? folders[0] : undefined;
  return vscode.workspace.getConfiguration('rustForge', folder?.uri);
}

export function readSettings(): Settings {
  const config = vscode.workspace.getConfiguration('rustForge');
  const mirrorConfig = mirrorConfiguration();
  const docsMode = config.get<string>('crateDocsOpenMode', 'browser');
  return {
    cargoPath: config.get<string>('cargoPath', '').trim(),
    rustupPath: config.get<string>('rustupPath', '').trim(),
    offline: config.get<boolean>('offline', false),
    auditEnabled: config.get<boolean>('auditEnabled', true),
    auditCacheHours: config.get<number>('auditCacheHours', 6),
    networkTimeoutMs: config.get<number>('networkTimeoutMs', 8000),
    crateDocsOpenMode: docsMode === 'webview' ? 'webview' : 'browser',
    cargoMirror: mirrorConfig.get<string>('cargoMirror', 'official').trim() || 'official',
    cargoMirrors: parseCustomMirrors(mirrorConfig.get<unknown>('cargoMirrors', [])),
  };
}

function parseCustomMirrors(value: unknown): CustomCargoMirror[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: CustomCargoMirror[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const name = typeof (entry as { name?: unknown }).name === 'string' ? (entry as { name: string }).name.trim() : '';
    const index =
      typeof (entry as { index?: unknown }).index === 'string' ? (entry as { index: string }).index.trim() : '';
    if (!name || !index || seen.has(name)) continue;
    seen.add(name);
    result.push({ name, index });
  }
  return result;
}

/** Runtime configuration snapshot. */
import * as vscode from 'vscode';

export interface Settings {
  cargoPath: string;
  rustupPath: string;
  offline: boolean;
  auditEnabled: boolean;
  auditCacheHours: number;
  networkTimeoutMs: number;
  crateDocsOpenMode: 'browser' | 'webview';
}

export function readSettings(): Settings {
  const config = vscode.workspace.getConfiguration('rustForge');
  const docsMode = config.get<string>('crateDocsOpenMode', 'browser');
  return {
    cargoPath: config.get<string>('cargoPath', '').trim(),
    rustupPath: config.get<string>('rustupPath', '').trim(),
    offline: config.get<boolean>('offline', false),
    auditEnabled: config.get<boolean>('auditEnabled', true),
    auditCacheHours: config.get<number>('auditCacheHours', 6),
    networkTimeoutMs: config.get<number>('networkTimeoutMs', 8000),
    crateDocsOpenMode: docsMode === 'webview' ? 'webview' : 'browser',
  };
}

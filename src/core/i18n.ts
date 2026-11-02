/**
 * Thin wrapper over VS Code's l10n with a graceful fallback so core modules
 * stay testable under plain Node (tsx).
 */
type L10nApi = { t(message: string, ...args: unknown[]): string };

function l10nApi(): L10nApi | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vscode = require('vscode') as { l10n?: L10nApi };
    return vscode?.l10n;
  } catch {
    return undefined;
  }
}

export function t(message: string, ...args: unknown[]): string {
  const api = l10nApi();
  return api ? api.t(message, ...args) : message;
}

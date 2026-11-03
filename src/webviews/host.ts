/**
 * Webview host shared by every panel.
 *
 * Handles CSP, the theme-aware shell, and the message bridge. Panels only
 * supply data and handlers.
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { HostMessage, PanelData, WebviewMessage } from './protocol.js';

export interface PanelHostOptions {
  extensionUri: vscode.Uri;
  id: string;
  title: string;
  data: PanelData;
  handlers: (message: WebviewMessage) => Promise<void> | void;
  iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri };
  /** Identity used to reuse an already open tab; defaults to `id`. */
  revealKey?: string;
  /**
   * Absolute files whose content this panel renders. Changes (including
   * create/delete) reload the panel; they are only watched while it is open.
   */
  watch?: string[];
  /** Recompute the payload; receives the currently displayed data. */
  reload?: (current: PanelData | undefined) => PanelData | Promise<PanelData>;
}

export class WebviewPanelHost implements vscode.Disposable {
  /** One live host per panel identity, so commands refocus instead of stacking tabs. */
  private static readonly live = new Map<string, WebviewPanelHost>();

  private readonly panel: vscode.WebviewPanel;
  private options: PanelHostOptions;
  private disposables: vscode.Disposable[] = [];
  private watchers: vscode.Disposable[] = [];
  private reloadTimer: NodeJS.Timeout | undefined;
  private lastData: PanelData | undefined;
  private ready = false;
  /** Set after the first `ready`; later ones mean the page was reloaded. */
  private readySeen = false;
  private disposed = false;
  private pending: HostMessage[] = [];

  static create(options: PanelHostOptions): WebviewPanelHost {
    const key = options.revealKey ?? options.id;
    const existing = WebviewPanelHost.live.get(key);
    if (existing?.isAlive) {
      // Reuse the tab: adopt the freshly computed payload and handlers, then
      // focus it. Never open a duplicate panel for the same identity.
      existing.adopt(options);
      existing.reveal();
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(
      `rustForge.${options.id}`,
      options.title,
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(options.extensionUri, 'dist'),
          vscode.Uri.joinPath(options.extensionUri, 'media'),
        ],
      },
    );
    const host = new WebviewPanelHost(panel, options);
    WebviewPanelHost.live.set(key, host);
    return host;
  }

  private constructor(panel: vscode.WebviewPanel, options: PanelHostOptions) {
    this.panel = panel;
    this.options = options;
    this.panel.iconPath = options.iconPath;
    // Register the listener before loading the page so an early `ready` from a
    // fast webview cannot be lost.
    this.panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        if (message.type === 'ready') {
          const reloaded = this.readySeen;
          this.ready = true;
          this.readySeen = true;
          this.flush();
          // A webview reload starts with an empty DOM. The pending queue was
          // drained on the first load, so replay the current payload.
          if (reloaded && this.lastData) {
            void this.panel.webview.postMessage({ type: 'setData', data: this.lastData });
          }
          return;
        }
        if (message.type === 'webviewError') {
          console.error('[Rust Forge webview]', message.message);
          return;
        }
        if (message.type === 'close') {
          this.panel.dispose();
          return;
        }
        try {
          await this.options.handlers(message);
        } catch (err) {
          this.post({ type: 'toast', level: 'error', message: (err as Error).message });
        }
      },
      undefined,
      this.disposables,
    );
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
    this.watchFiles();
    // Queue the initial payload; `flush` delivers it once the bundle signals
    // that its message listener is installed.
    this.setData(options.data);
    this.panel.webview.html = renderShell(this.panel.webview, options.extensionUri, options.title);
  }

  /** Take over an open tab with a new payload and handler set. */
  private adopt(options: PanelHostOptions): void {
    this.options = options;
    this.watchFiles();
    this.setData(options.data);
  }

  get viewColumn(): vscode.ViewColumn | undefined {
    return this.panel.viewColumn;
  }

  get isAlive(): boolean {
    return !this.disposed;
  }

  post(message: HostMessage): void {
    if (this.disposed) return;
    if (!this.ready) {
      this.pending.push(message);
      return;
    }
    void this.panel.webview.postMessage(message);
  }

  setData(data: PanelData): void {
    this.lastData = data;
    this.post({ type: 'setData', data });
  }

  setTitle(title: string): void {
    this.panel.title = title;
  }

  toast(message: string, level: 'info' | 'warning' | 'error' | 'success' = 'info'): void {
    this.post({ type: 'toast', level, message });
  }

  progress(active: boolean, message?: string): void {
    this.post({ type: 'progress', active, message });
  }

  busy(active: boolean, label?: string): void {
    this.post({ type: 'busy', active, label });
  }

  reveal(): void {
    if (!this.disposed) this.panel.reveal(undefined, false);
  }

  private flush(): void {
    for (const message of this.pending.splice(0)) {
      void this.panel.webview.postMessage(message);
    }
  }

  /** Rebuild the watcher set for the current options. */
  private watchFiles(): void {
    for (const disposable of this.watchers) disposable.dispose();
    this.watchers = [];
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = undefined;
    }

    const files = this.options.watch ?? [];
    if (!files.length || !this.options.reload) return;

    // Debounce bursts (a write batch touches several manifests).
    const schedule = () => {
      if (this.disposed) return;
      if (this.reloadTimer) clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => void this.reload(), 300);
    };

    for (const file of files) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(path.dirname(file)), path.basename(file)),
      );
      this.watchers.push(
        watcher,
        watcher.onDidChange(schedule),
        watcher.onDidCreate(schedule),
        watcher.onDidDelete(schedule),
      );
    }
  }

  private async reload(): Promise<void> {
    if (this.disposed || !this.options.reload) return;
    try {
      const data = await this.options.reload(this.lastData);
      if (!this.disposed) this.setData(data);
    } catch {
      // Refresh is best effort; keep the current content on failure.
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    for (const disposable of [...this.watchers, ...this.disposables]) disposable.dispose();
    this.watchers = [];
    this.disposables = [];
    const key = this.options.revealKey ?? this.options.id;
    if (WebviewPanelHost.live.get(key) === this) WebviewPanelHost.live.delete(key);
    this.panel.dispose();
  }
}

/** Build the panel HTML with a strict CSP and theme variables. */
export function renderShell(webview: vscode.Webview, extensionUri: vscode.Uri, title: string): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css'));
  const codiconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'codicon.css'));
  const fontUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'codicon.ttf'));
  const nonce = createNonce();
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  // The dictionary is serialized into the page so panels can translate before
  // the first message round-trip. The bridge is installed here because the
  // webview API object can only be acquired once, and inline scripts run
  // before the bundle.
  const dictionary = JSON.stringify(webviewDictionary()).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="${webviewLanguage()}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" id="vscode-codicon-stylesheet" href="${codiconUri}">
<style>
  @font-face {
    font-family: "codicon";
    font-display: block;
    src: url("${fontUri}") format("truetype");
  }
</style>
<link rel="stylesheet" href="${styleUri}">
<title>${escapeHtml(title)}</title>
</head>
<body>
<div id="root" class="root"><div class="loading"><vscode-progress-ring></vscode-progress-ring></div></div>
<script nonce="${nonce}">
  (function () {
    var api = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
    function report(text) {
      try { if (api) api.postMessage({ type: 'webviewError', message: text }); } catch (e) {}
      var root = document.getElementById('root');
      if (root && root.querySelector('.loading')) {
        root.textContent = 'Rust Forge webview failed to render:\\n' + text;
        root.style.cssText = 'padding:24px;white-space:pre-wrap;color:var(--vscode-errorForeground);font-family:var(--vscode-editor-font-family)';
      }
    }
    window.addEventListener('error', function (event) {
      report((event.message || 'script error') + (event.filename ? ' (' + event.filename + ':' + (event.lineno || 0) + ')' : ''));
    });
    window.addEventListener('unhandledrejection', function (event) {
      var reason = event.reason;
      report(String((reason && reason.stack) || reason));
    });
    window.rustForge = {
      i18n: ${dictionary},
      post: api ? function (message) { api.postMessage(message); } : undefined
    };
  })();
</script>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

/** Webview strings. English is the source; zh-cn mirrors the extension bundle. */
let cachedDictionary: Record<string, string> | undefined;

export function webviewDictionary(): Record<string, string> {
  if (cachedDictionary) return cachedDictionary;
  cachedDictionary = webviewLanguage() === 'zh-cn' ? loadChineseStrings() : {};
  return cachedDictionary!;
}

function loadChineseStrings(): Record<string, string> {
  try {
    // Bundled JSON import keeps the webview dictionary in sync with the package.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./client/strings.zh-cn.json') as Record<string, string>;
  } catch {
    return {};
  }
}

export function webviewLanguage(): string {
  return vscode.env.language.toLowerCase().startsWith('zh') ? 'zh-cn' : 'en';
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

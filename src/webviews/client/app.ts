/**
 * Webview client entry point. Uses plain DOM with VS Code web components so
 * there are no runtime framework dependencies in the bundle.
 */
import '@vscode-elements/elements/dist/bundled.js';
import type {
  CrateDetailData,
  CrateSearchResult,
  HostMessage,
  InstallRequestPayload,
  PanelData,
  PropertyEditPayload,
  RustfmtPanelData,
  StandardizePanelData,
  UpgradePanelData,
  WebviewMessage,
  ConvertPanelData,
  InstallPanelData,
  PropertiesPanelData,
} from '../protocol.js';
import { renderInstall, applySearchResults, applyCrateDetail, applyCrateDetailFailed } from './panels/install.js';
import { renderUpgrade } from './panels/upgrade.js';
import { renderProperties } from './panels/properties.js';
import { renderRustfmt } from './panels/rustfmt.js';
import { renderStandardize } from './panels/standardize.js';
import { renderConvert } from './panels/convert.js';
import { renderWizard } from './panels/wizard.js';
import { registerI18n, t } from './i18n.js';
import { send, setSender } from './bridge.js';

interface Api {
  post?: (message: WebviewMessage) => void;
  i18n: Record<string, string>;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => { postMessage(message: unknown): void };
    rustForge?: Api;
  }
}

let currentData: PanelData | undefined;
let busyEl: HTMLElement | undefined;
let fallbackApi: { postMessage(message: unknown): void } | undefined;

const root = document.getElementById('root')!;

function vscodeApiPost(message: WebviewMessage): void {
  const api = window.rustForge;
  if (api?.post) {
    api.post(message);
    return;
  }
  // Standalone webview previews do not get the injected bridge; VS Code itself
  // exposes `acquireVsCodeApi`, which may only be called once.
  if (!fallbackApi) fallbackApi = window.acquireVsCodeApi?.();
  fallbackApi?.postMessage(message);
}

setSender(vscodeApiPost);

window.addEventListener('message', (event: MessageEvent<HostMessage>) => {
  const message = event.data;
  handle(message);
});

function handle(message: HostMessage): void {
  switch (message.type) {
    case 'setData':
      currentData = message.data;
      render(message.data);
      break;
    case 'toast':
      showToast(message.message, message.level);
      break;
    case 'busy':
      toggleBusy(message.active, message.label);
      break;
    case 'progress':
      // Progress is rendered inline by panels that opt in.
      break;
    case 'diff':
      showDiff(message.title, message.body);
      break;
    case 'searchResults':
      applySearchResults(message.results);
      break;
    case 'crateDetail':
      applyCrateDetail(message.detail);
      break;
    case 'crateDetailFailed':
      applyCrateDetailFailed(message.name);
      break;
    case 'error':
      showToast(message.message, 'error');
      break;
    default:
      break;
  }
}

function render(data: PanelData): void {
  root.innerHTML = '';
  const fragment = document.createDocumentFragment();
  switch (data.kind) {
    case 'install-panel':
      fragment.appendChild(renderInstall(data));
      break;
    case 'upgrade-panel':
      fragment.appendChild(renderUpgrade(data));
      break;
    case 'properties-panel':
      fragment.appendChild(renderProperties(data));
      break;
    case 'rustfmt-panel':
      fragment.appendChild(renderRustfmt(data));
      break;
    case 'standardize-panel':
      fragment.appendChild(renderStandardize(data));
      break;
    case 'convert-panel':
      fragment.appendChild(renderConvert(data));
      break;
    case 'wizard-panel':
      fragment.appendChild(renderWizard(data));
      break;
    default:
      break;
  }
  root.appendChild(fragment);
}

function showToast(message: string, level: 'info' | 'warning' | 'error' | 'success'): void {
  let container = document.querySelector<HTMLElement>('.toasts');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toasts';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${level}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), level === 'error' ? 9000 : 5000);
}

function toggleBusy(active: boolean, label?: string): void {
  if (!active) {
    busyEl?.remove();
    busyEl = undefined;
    return;
  }
  if (busyEl) {
    const labelEl = busyEl.querySelector('.busy-label');
    if (labelEl && label) labelEl.textContent = label;
    return;
  }
  busyEl = document.createElement('div');
  busyEl.className = 'busy-overlay';
  busyEl.innerHTML = `<div class="busy-box">
    <vscode-progress-ring></vscode-progress-ring>
    <div class="busy-label" style="margin-top:12px">${escapeHtml(label ?? t('Working…'))}</div>
  </div>`;
  document.body.appendChild(busyEl);
}

function showDiff(title: string, body: string): void {
  const dialog = document.createElement('div');
  dialog.className = 'busy-overlay';
  dialog.innerHTML = `<div class="busy-box" style="max-width:min(900px,90vw);text-align:left">
    <h2 style="margin-top:0">${escapeHtml(title)}</h2>
    <div class="diff" style="max-height:60vh">${diffLines(body)}</div>
    <div class="footer" style="margin-top:12px;border:none;position:static">
      <vscode-button data-close>${escapeHtml(t('Close'))}</vscode-button>
    </div>
  </div>`;
  dialog.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target === dialog || target.hasAttribute('data-close') || target.closest('[data-close]')) dialog.remove();
  });
  document.body.appendChild(dialog);
}

export function diffLines(patch: string): string {
  return patch
    .split('\n')
    .map((line) => {
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@') || line.startsWith('Index:')) {
        return `<span class="meta">${escapeHtml(line)}</span>`;
      }
      if (line.startsWith('+')) return `<span class="add">${escapeHtml(line)}</span>`;
      if (line.startsWith('-')) return `<span class="del">${escapeHtml(line)}</span>`;
      return `<span class="ctx">${escapeHtml(line)}</span>`;
    })
    .join('');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ------------------------------------------------------------------ bootstrap

function bootstrap(): void {
  const api = window.rustForge;
  if (api?.i18n) registerI18n(api.i18n);
  send({ type: 'ready' });
}

bootstrap();

export type {
  CrateDetailData,
  CrateSearchResult,
  InstallPanelData,
  PropertiesPanelData,
  RustfmtPanelData,
  StandardizePanelData,
  UpgradePanelData,
  ConvertPanelData,
  InstallRequestPayload,
  PropertyEditPayload,
};

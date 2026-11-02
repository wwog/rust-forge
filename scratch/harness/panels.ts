import '@vscode-elements/elements/dist/bundled.js';
import fixtures from '/tmp/rf-fixtures.json';
import { renderUpgrade } from '../../src/webviews/client/panels/upgrade.js';
import { renderInstall, applySearchResults, applyCrateDetail } from '../../src/webviews/client/panels/install.js';
import { renderProperties } from '../../src/webviews/client/panels/properties.js';
import { renderRustfmt } from '../../src/webviews/client/panels/rustfmt.js';
import { renderStandardize } from '../../src/webviews/client/panels/standardize.js';
import { renderConvert } from '../../src/webviews/client/panels/convert.js';
import { renderRollback } from '../../src/webviews/client/panels/rollback.js';
import { registerI18n } from '../../src/webviews/client/i18n.js';

registerI18n(((window as any).rustForge?.i18n ?? {}) as Record<string,string>);
const root = document.getElementById('root')!;
const which = new URLSearchParams(location.search).get('panel') ?? 'upgrade';
const f = fixtures as any;
const renderers: Record<string, (d:any)=>HTMLElement> = {
  upgrade: renderUpgrade, install: renderInstall, properties: renderProperties,
  rustfmt: renderRustfmt, standardize: renderStandardize, convert: renderConvert, rollback: renderRollback,
};
root.appendChild(renderers[which](f[which]));
(window as any).__rfInstall = { applySearchResults, applyCrateDetail };
// The host normally injects the dictionary; provide an empty one here.
window.addEventListener('message', () => {});

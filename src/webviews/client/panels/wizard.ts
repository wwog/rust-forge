/** Creation / open wizard. Native input + quick picks are used on the host
 * side for the actual flow; this panel renders the interactive summary. */
import type { WizardPanelData } from '../../protocol.js';
import { button, el, footer } from '../dom.js';
import { t } from '../i18n.js';
import { send } from '../bridge.js';

export function renderWizard(data: WizardPanelData): HTMLElement {
  const root = el('div');
  root.appendChild(el('h1', {}, data.mode === 'create' ? t('Create Rust project') : t('Open Rust project')));
  root.appendChild(
    el('p', { class: 'subtitle' }, t('The wizard runs in native VS Code quick picks so it matches the rest of the workbench.')),
  );

  root.appendChild(
    el('div', { class: 'banner info' },
      el('span', { class: 'codicon codicon-info' }),
      el('div', {}, t('Use the command palette entry to start the wizard.'))),
  );

  root.appendChild(
    footer(
      el('div', { class: 'spacer' }),
      button(t('Create project'), () => send({ type: 'runCommand', command: 'rustForge.createProject' }), { icon: 'add' }),
      button(t('Open project'), () => send({ type: 'runCommand', command: 'rustForge.openProject' }), { secondary: true, icon: 'folder-opened' }),
    ),
  );
  return root;
}

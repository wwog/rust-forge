/** Standardization panel: pick migration items, review diffs, apply. */
import type { StandardizePanelData } from '../../protocol.js';
import { send } from '../bridge.js';
import { badge, banner, button, diffBlock, el, emptyState, footer, section } from '../dom.js';
import { t } from '../i18n.js';

export function renderStandardize(data: StandardizePanelData): HTMLElement {
  const root = el('div');
  const selected = new Set(data.findings.filter((f) => f.fixable).map((f) => f.id));

  root.appendChild(el('h1', {}, t('Standardize project')));
  root.appendChild(
    el('p', { class: 'subtitle' }, t('Move configuration out of Cargo.toml into dedicated files. Diffs are shown before anything is written, and formatting plus clippy are checked afterwards.')),
  );

  if (!data.findings.length) {
    root.appendChild(
      emptyState('pass-filled', t('Nothing to standardize'), el('div', {}, t('rustfmt, clippy and lint configuration already live in dedicated files.'))),
    );
    root.appendChild(footer(...[button(t('Close'), () => send({ type: 'close' }), { secondary: true })]));
    return root;
  }

  const previewHost = el('div', { style: 'margin-top:12px' });

  for (const finding of data.findings) {
    // Non-fixable findings are informational notices; they have no checkbox
    // and are never part of the applied batch.
    const card = el('div', { class: finding.fixable ? 'card selectable' : 'card' });
    const head = el('div', { class: 'card-title' });
    if (finding.fixable) {
      const box = el('vscode-checkbox', selected.has(finding.id) ? { checked: true } : {}) as unknown as HTMLElement;
      box.addEventListener('click', (event) => event.stopPropagation());
      box.addEventListener('change', (event) => {
        const checked = (event.target as unknown as { checked: boolean }).checked;
        if (checked) selected.add(finding.id);
        else selected.delete(finding.id);
        card.classList.toggle('selected', checked);
        updateHint();
      });
      head.appendChild(box);
    } else {
      head.appendChild(badge(t('No automatic fix'), 'none'));
    }
    head.appendChild(el('span', {}, finding.title));
    card.appendChild(head);
    card.appendChild(el('div', { class: 'field-desc' }, finding.description));

    const files = el('div', { class: 'card-meta' });
    for (const change of finding.diffs) {
      files.appendChild(el('span', { class: 'mono' }, change.path));
    }
    if (files.childElementCount) card.appendChild(files);

    if (finding.fixable) {
      const box = head.querySelector('vscode-checkbox') as unknown as { checked: boolean } | null;
      card.addEventListener('click', () => {
        if (selected.has(finding.id)) selected.delete(finding.id);
        else selected.add(finding.id);
        const now = selected.has(finding.id);
        card.classList.toggle('selected', now);
        if (box) box.checked = now;
        updateHint();
      });
    }
    root.appendChild(card);
  }

  if (!data.findings.some((finding) => finding.fixable)) {
    root.appendChild(footer(...[el('div', { class: 'spacer' }), button(t('Close'), () => send({ type: 'close' }), { secondary: true })]));
    return root;
  }

  root.appendChild(section(t('Preview'), previewHost));

  const foot = footer();
  const hint = el('span', { class: 'hint' }, '');
  foot.appendChild(hint);
  foot.appendChild(el('div', { class: 'spacer' }));
  foot.appendChild(button(t('Preview diff'), () => {
    previewHost.replaceChildren();
    const chosen = data.findings.filter((f) => selected.has(f.id));
    for (const finding of chosen) {
      const block = el('div', { class: 'section' });
      block.appendChild(el('h3', {}, finding.title));
      for (const change of finding.diffs) {
        block.appendChild(el('div', { class: 'mono muted', style: 'margin-bottom:4px' }, change.path));
        block.appendChild(diffBlock(change.diff));
      }
      previewHost.appendChild(block);
    }
  }, { secondary: true, icon: 'diff' }));
  foot.appendChild(button(t('Apply selected'), () => {
    send({ type: 'applyStandardization', ids: [...selected] });
  }, { icon: 'check' }));
  root.appendChild(foot);

  function updateHint(): void {
    hint.textContent = selected.size
      ? t('{0} item(s) selected · cargo fmt --check and cargo clippy will run afterwards', selected.size)
      : t('Select at least one item.');
  }
  updateHint();

  for (const finding of data.findings) {
    previewHost.appendChild(banner('info', el('div', {}, t('Preview shows the exact file changes; nothing is written until you apply.'))));
    break;
  }

  return root;
}

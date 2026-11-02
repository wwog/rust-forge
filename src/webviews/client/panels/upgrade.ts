/** Upgrade review panel: safe items preselected, majors require explicit opt-in. */
import type { DependencyRow, UpgradePanelData } from '../../protocol.js';
import { send } from '../bridge.js';
import { badge, banner, button, el, emptyState, footer, section } from '../dom.js';
import { t } from '../i18n.js';

export function renderUpgrade(data: UpgradePanelData): HTMLElement {
  const root = el('div');
  const selected = new Set<string>();

  root.appendChild(el('h1', {}, t('Review safe upgrades')));
  root.appendChild(
    el('p', { class: 'subtitle' }, t('Safe updates stay within the declared requirement without changing features. Major versions are listed separately and are not selected.')),
  );

  if (data.registryDegraded) {
    root.appendChild(
      banner('warning', el('div', {}, t('crates.io is unreachable, so latest versions are unavailable. Only the currently declared versions are shown.'))),
    );
  }

  const safe = data.rows.filter((row) => row.classification === 'safe' && row.latest);
  const major = data.rows.filter((row) => row.classification === 'major');
  const blocked = data.rows.filter((row) => row.classification === 'unknown');
  const current = data.rows.filter((row) => row.classification === 'not-applicable');

  for (const row of safe) selected.add(row.id);

  if (!data.rows.length) {
    root.appendChild(emptyState('check', t('Nothing to review'), el('div', {}, t('No declared registry dependencies were found.'))));
    root.appendChild(footer(...back()));
    return root;
  }

  const summary = el('div', { class: 'row', style: 'margin-bottom:12px' });
  summary.appendChild(badge(t('{0} safe', safe.length), safe.length ? 'safe' : 'none'));
  if (major.length) summary.appendChild(badge(t('{0} major', major.length), 'major'));
  if (blocked.length) summary.appendChild(badge(t('{0} need review', blocked.length), 'unknown'));
  if (current.length) summary.appendChild(badge(t('{0} up to date', current.length), 'none'));
  root.appendChild(summary);

  let body: HTMLElement;

  const render = () => {
    body.replaceChildren();
    body.appendChild(renderSection(t('Safe updates'), safe));
    if (major.length) {
      body.appendChild(
        renderSection(t('Major versions — require confirmation'), major, t('Major releases can break APIs. Review the documentation before selecting.')),
      );
    }
    if (blocked.length) {
      body.appendChild(
        renderSection(t('Needs manual review'), blocked, t('These updates could change the feature set or fall outside the declared requirement.')),
      );
    }
    if (current.length) body.appendChild(renderCollapsed(t('Up to date'), current));
  };
  body = el('div');
  render();
  root.appendChild(body);

  const foot = footer(el('span', { class: 'hint', id: 'upgrade-hint' }, ''));
  foot.appendChild(el('div', { class: 'spacer' }));
  foot.appendChild(button(t('Select all safe'), () => {
    for (const row of safe) selected.add(row.id);
    render();
  }, { secondary: true }));
  foot.appendChild(button(t('Clear selection'), () => {
    selected.clear();
    render();
  }, { secondary: true }));
  foot.appendChild(button(t('Apply selected'), () => {
    if (!selected.size) {
      return;
    }
    send({ type: 'upgradeSelected', ids: [...selected] });
  }, { icon: 'arrow-up' }));
  root.appendChild(foot);

  const hint = foot.querySelector<HTMLElement>('#upgrade-hint')!;
  const updateHint = () => {
    const count = [...selected].length;
    if (!count) {
      hint.textContent = t('Select at least one dependency.');
      return;
    }
    const members = new Set([...selected].map((id) => safe.find((row) => row.id === id)?.member ?? major.find((row) => row.id === id)?.member ?? blocked.find((row) => row.id === id)?.member).filter(Boolean));
    hint.textContent = t('{0} selected · writes {1} and runs cargo update', count, [...members].join(', '));
  };

  function renderSection(title: string, rows: DependencyRow[], note?: string): HTMLElement {
    const wrap = section(title, el('div', { class: 'muted', style: 'margin-bottom:8px' }, t('{0} entries', rows.length)));
    if (note) wrap.insertBefore(banner('warning', el('div', {}, note)), wrap.children[1] ?? null);
    for (const row of rows) wrap.appendChild(card(row));
    return wrap;
  }

  function renderCollapsed(title: string, rows: DependencyRow[]): HTMLElement {
    const wrap = section(title);
    const list = el('div', { class: 'list' });
    for (const row of rows) {
      list.appendChild(
        el('div', { class: 'list-item' },
          el('span', { class: 'name' }, row.label),
          el('span', { class: 'muted' }, row.member),
          el('span', { class: 'mono muted' }, row.requirement ?? ''),
          el('span', { class: 'spacer' }),
          el('span', { class: 'mono' }, row.locked ?? ''),
        ),
      );
    }
    wrap.appendChild(list);
    return wrap;
  }

  function card(row: DependencyRow): HTMLElement {
    const cardEl = el('div', { class: `card selectable${selected.has(row.id) ? ' selected' : ''}` });
    const head = el('div', { class: 'card-title' });
    const box = el('vscode-checkbox', selected.has(row.id) ? { checked: true } : {}) as unknown as HTMLElement;
    box.addEventListener('click', (event) => event.stopPropagation());
    box.addEventListener('change', (event) => {
      const checked = (event.target as unknown as { checked: boolean }).checked;
      if (checked) selected.add(row.id);
      else selected.delete(row.id);
      cardEl.classList.toggle('selected', checked);
      syncAll();
    });
    head.appendChild(box);
    head.appendChild(el('span', {}, row.label));
    head.appendChild(badge(classificationLabel(row.classification), row.classification === 'safe' ? 'safe' : row.classification === 'major' ? 'major' : 'unknown'));
    if (row.optional) head.appendChild(badge(t('optional'), 'none'));
    if (row.isWorkspaceDependency) head.appendChild(badge(t('workspace'), 'accent'));
    if (row.advisories.length) {
      head.appendChild(badge(t('⚠ {0} advisory', row.advisories.length), 'danger'));
    }
    cardEl.appendChild(head);

    const meta = el('div', { class: 'card-meta' });
    meta.appendChild(el('span', { class: 'mono' }, row.requirement ?? t('any')));
    if (row.locked) meta.appendChild(el('span', {}, '→', el('span', { class: 'mono' }, row.locked)));
    if (row.latest) meta.appendChild(el('span', {}, '↑', el('span', { class: 'mono' }, row.latest)));
    meta.appendChild(el('span', {}, row.member));
    meta.appendChild(el('span', { class: 'mono muted' }, shortPath(row.table)));
    if (row.features.length) meta.appendChild(el('span', {}, t('features: {0}', row.features.join(', '))));
    cardEl.appendChild(meta);

    if (row.reason === 'features-changed') {
      cardEl.appendChild(el('div', { class: 'field-desc' }, t('The newer version changes its default feature set; enabling it could alter the build.')));
    }
    if (row.registryUnavailable) {
      cardEl.appendChild(el('div', { class: 'field-desc' }, t('Latest version unavailable — crates.io could not be reached.')));
    }

    for (const advisory of row.advisories) {
      const line = el('div', { class: 'field-desc' });
      line.appendChild(el('span', { class: 'codicon codicon-shield' }));
      line.appendChild(document.createTextNode(` ${advisory.id}: ${advisory.title}`));
      if (advisory.fixed) line.appendChild(el('span', { class: 'muted' }, ` · ${t('fixed in {0}', advisory.fixed)}`));
      if (advisory.url) {
        const link = el('a', { href: '#', style: 'margin-left:8px' }, t('details'));
        link.addEventListener('click', (event) => {
          event.preventDefault();
          send({ type: 'openUrl', url: advisory.url! });
        });
        line.appendChild(link);
      }
      cardEl.appendChild(line);
    }

    if (row.classification === 'major') {
      const row2 = el('div', { class: 'row tight', style: 'margin-top:8px' });
      row2.appendChild(
        button(t('Open documentation'), () => send({ type: 'runCommand', command: 'rustForge.openCrateDocs', args: [row.packageName, row.latest ?? row.locked] }), {
          secondary: true,
          icon: 'book',
        }),
      );
      cardEl.appendChild(row2);
    }

    cardEl.addEventListener('click', () => {
      if (selected.has(row.id)) selected.delete(row.id);
      else selected.add(row.id);
      const nowChecked = selected.has(row.id);
      cardEl.classList.toggle('selected', nowChecked);
      (box as unknown as { checked: boolean }).checked = nowChecked;
      syncAll();
    });
    return cardEl;
  }

  function syncAll(): void {
    updateHint();
  }

  updateHint();
  updateSelected = (ids: string[]) => {
    selected.clear();
    for (const id of ids) selected.add(id);
    render();
  };

  return root;
}

let updateSelected: ((ids: string[]) => void) | undefined;

export function applyUpgradeSelection(ids: string[]): void {
  updateSelected?.(ids);
}

function classificationLabel(value: DependencyRow['classification']): string {
  switch (value) {
    case 'safe':
      return t('safe');
    case 'major':
      return t('major');
    case 'unknown':
      return t('review');
    default:
      return t('current');
  }
}

function shortPath(value: string): string {
  return value.replace(/^.*[\\/]/, '');
}

function back(): HTMLElement[] {
  return [el('span', { class: 'hint' }, t('Writes manifests first, then runs cargo update and cargo check.'))];
}

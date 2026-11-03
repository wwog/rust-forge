/** rustfmt configuration panel. */
import type { RustfmtPanelData } from '../../protocol.js';
import { send } from '../bridge.js';
import { badge, banner, button, el, field, footer, section, select, textfield } from '../dom.js';
import { t } from '../i18n.js';

export function renderRustfmt(data: RustfmtPanelData): HTMLElement {
  const edits = new Map<string, string | number | boolean | string[] | undefined>();
  const root = el('div');
  let scope = data.scope;
  let activeMember = data.activeMember;
  const members = data.members ?? [];

  root.appendChild(el('h1', {}, t('rustfmt configuration')));
  root.appendChild(
    el('p', { class: 'subtitle' }, t('Form-based editing of rustfmt.toml. Every option explains its effect; unstable options require nightly rustfmt.')),
  );

  if (data.workspace) {
    const scopeSection = section(t('Scope'));
    const options = [
      { value: 'workspace', label: t('Workspace root'), description: t('Applies to every member.') },
      ...(data.memberScopeAvailable
        ? [{ value: 'member', label: t('Current member ({0})', data.activeMember ?? ''), description: t('Only affects this crate.') }]
        : []),
    ];
    scopeSection.appendChild(
      select(options, scope, (value) => {
        scope = value as 'workspace' | 'member';
        send({ type: 'refresh', scope });
      }),
    );
    if (scope === 'member' && members.length) {
      scopeSection.appendChild(
        field(
          t('Member'),
          select(
            members.map((member) => ({ value: member.name, label: member.name })),
            activeMember,
            (value) => {
              activeMember = value;
              send({ type: 'refresh', scope: 'member', member: value });
            },
          ),
        ),
      );
    }
    scopeSection.appendChild(
      banner('info', el('div', {}, scope === 'workspace'
        ? t('This configuration affects the entire workspace.')
        : t('This configuration only affects the current crate.'))),
    );
    root.appendChild(scopeSection);
  }

  if (data.warning) {
    root.appendChild(banner('warning', el('div', {}, data.warning)));
  }

  if (!data.fileExists) {
    root.appendChild(
      banner('info', el('div', {}, t('No rustfmt.toml yet. Generate a conservative recommended file, then adjust individual options.'))),
    );
  }

  root.appendChild(
    el('div', { class: 'row tight', style: 'margin:12px 0' },
      button(t('Generate recommended config'), () => send({ type: 'generateRustfmt', scope, member: activeMember }), { secondary: true, icon: 'file-add' }),
      data.filePath
        ? button(t('Open file'), () => send({ type: 'openFile', path: data.filePath! }), { secondary: true, icon: 'go-to-file' })
        : el('span'),
    ),
  );

  const filterable: { section: HTMLElement; cards: HTMLElement[] }[] = [];
  const empty = el('div', { class: 'empty hidden' }, t('No options match the filter.'));
  root.appendChild(
    el('div', { class: 'toolbar' },
      textfield('', {
        placeholder: t('Filter options…'),
        onInput: (value) => applyFilter(value),
      }),
    ),
  );
  root.appendChild(empty);

  const categories = groupByCategory(data.options);
  for (const [category, options] of categories) {
    const wrap = section(categoryTitle(category));
    if (category === 'unstable') {
      wrap.appendChild(
        banner('warning', el('div', {}, t('These options are ignored by stable rustfmt. They only take effect on a nightly toolchain with unstable_features enabled.'))),
      );
    }
    const cards = options.map((option) => renderOption(option));
    for (const card of cards) wrap.appendChild(card);
    filterable.push({ section: wrap, cards });
    root.appendChild(wrap);
  }

  function applyFilter(query: string): void {
    const needle = query.trim().toLowerCase();
    let total = 0;
    for (const { section: group, cards } of filterable) {
      let visible = 0;
      for (const card of cards) {
        const match = !needle || (card.dataset.search ?? '').includes(needle);
        card.classList.toggle('hidden', !match);
        if (match) visible++;
      }
      group.classList.toggle('hidden', visible === 0);
      total += visible;
    }
    empty.classList.toggle('hidden', total > 0);
  }

  const foot = footer();
  const hint = el('span', { class: 'hint' }, t('Writes {0}', data.filePath ? shortPath(data.filePath) : 'rustfmt.toml'));
  foot.appendChild(hint);
  foot.appendChild(el('div', { class: 'spacer' }));
  foot.appendChild(button(t('Cancel'), () => send({ type: 'close' }), { secondary: true }));
  foot.appendChild(button(t('Save'), () => {
    send({
      type: 'saveRustfmt',
      edits: [...edits.entries()].map(([key, value]) => ({ key, value })),
      scope,
      member: activeMember,
    });
  }, { icon: 'check' }));
  root.appendChild(foot);

  function renderOption(option: RustfmtPanelData['options'][number]): HTMLElement {
    const wrap = el('div', { class: 'card' });
    wrap.dataset.search = `${option.key} ${option.label} ${option.description}`.toLowerCase();
    const head = el('div', { class: 'card-title' });
    head.appendChild(el('span', {}, option.label));
    head.appendChild(el('span', { class: 'mono muted' }, option.key));
    if (!option.stable) head.appendChild(badge(t('nightly'), 'unknown'));
    if (option.value !== undefined) head.appendChild(badge(t('set'), 'accent'));
    wrap.appendChild(head);
    wrap.appendChild(el('div', { class: 'field-desc', style: 'margin-bottom:8px' }, option.description));

    switch (option.type) {
      case 'boolean': {
        const isSet = option.value !== undefined;
        const effective = isSet ? option.value === true : option.default === true;
        const row = el('div', { class: 'switch-row', style: 'border:none;padding:0' });
        const box = el('vscode-checkbox', effective ? { checked: true } : {}) as unknown as HTMLElement;
        box.addEventListener('change', (event) => {
          edits.set(option.key, !!(event.target as unknown as { checked: boolean }).checked);
          markSet();
        });
        row.appendChild(box);
        // Show the effective value, and mark defaults so "unset" is unambiguous.
        row.appendChild(el('span', {}, effective ? t('Enabled') : t('Disabled')));
        if (!isSet) row.appendChild(el('span', { class: 'muted', style: 'font-size:0.85em' }, t('default')));
        wrap.appendChild(row);
        break;
      }
      case 'number':
        wrap.appendChild(
          textfield(option.value !== undefined ? String(option.value) : '', {
            type: 'number',
            placeholder: option.default !== undefined ? String(option.default) : undefined,
            onInput: (value) => {
              const parsed = value === '' ? undefined : Number(value);
              edits.set(option.key, Number.isFinite(parsed) ? (parsed as number) : undefined);
              markSet();
            },
          }),
        );
        if (option.min !== undefined || option.max !== undefined) {
          wrap.appendChild(el('div', { class: 'field-desc' }, t('Allowed range: {0}–{1}', option.min ?? 0, option.max ?? '∞')));
        }
        break;
      case 'enum':
        wrap.appendChild(
          select(
            [{ value: '', label: t('(unset)') }, ...(option.values ?? []).map((value) => ({ value, label: value }))],
            option.value !== undefined ? String(option.value) : '',
            (value) => {
              edits.set(option.key, value === '' ? undefined : value);
              markSet();
            },
          ),
        );
        break;
      case 'array': {
        const current = Array.isArray(option.value)
          ? option.value.join(', ')
          : option.value !== undefined
            ? String(option.value)
            : '';
        wrap.appendChild(
          textfield(current, {
            placeholder: Array.isArray(option.default) ? option.default.join(', ') : undefined,
            onInput: (value) => {
              const entries = value.split(',').map((entry) => entry.trim()).filter(Boolean);
              edits.set(option.key, entries.length ? entries : undefined);
              markSet();
            },
          }),
        );
        wrap.appendChild(el('div', { class: 'field-desc' }, t('Comma-separated values')));
        break;
      }
      default:
        wrap.appendChild(
          textfield(option.value !== undefined ? String(option.value) : '', {
            placeholder: option.default !== undefined ? String(option.default) : undefined,
            onInput: (value) => {
              edits.set(option.key, value === '' ? undefined : value);
              markSet();
            },
          }),
        );
    }

    function markSet(): void {
      hint.textContent = t('{0} option(s) changed', edits.size);
    }
    return wrap;
  }

  return root;
}

function groupByCategory(options: RustfmtPanelData['options']): [string, RustfmtPanelData['options']][] {
  const order = ['layout', 'comments', 'heuristics', 'imports', 'style', 'unstable'];
  const groups = new Map<string, RustfmtPanelData['options']>();
  for (const option of options) {
    const list = groups.get(option.category) ?? [];
    list.push(option);
    groups.set(option.category, list);
  }
  return [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
}

function categoryTitle(category: string): string {
  switch (category) {
    case 'layout':
      return t('Layout');
    case 'comments':
      return t('Comments');
    case 'heuristics':
      return t('Line-breaking heuristics');
    case 'imports':
      return t('Imports');
    case 'style':
      return t('Style');
    case 'unstable':
      return t('Unstable options');
    default:
      return category;
  }
}

function shortPath(value: string): string {
  return value.replace(/^.*[\\/]/, '');
}

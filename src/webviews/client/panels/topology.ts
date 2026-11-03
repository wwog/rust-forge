/**
 * Workspace topology panel: members, default-members, exclude and patterns.
 *
 * The panel is stateless with respect to the manifest: edits are held in local
 * state, Apply sends the full selection to the host, and the host always
 * re-renders from a fresh payload (including after a cancelled confirmation).
 */
import type { TopologyPanelData } from '../../protocol.js';
import { send } from '../bridge.js';
import { badge, banner, button, checkbox, el, emptyState, footer, section } from '../dom.js';
import { t } from '../i18n.js';

interface TopologyState {
  /** Workspace-relative directories currently selected as default members. */
  defaults: Set<string>;
  exclude: string[];
  draft: string;
}

function createState(data: TopologyPanelData): TopologyState {
  return {
    defaults: new Set(data.members.filter((member) => member.isDefault).map((member) => member.relative)),
    exclude: [...data.exclude],
    draft: '',
  };
}

export function renderTopology(data: TopologyPanelData): HTMLElement {
  const root = el('div');
  let state = createState(data);

  // `fresh` rebuilds local state from the payload (Reset and the first render).
  // Ordinary redraws keep the user's in-progress edits.
  const draw = (fresh: boolean) => {
    if (fresh) state = createState(data);
    root.innerHTML = '';
    root.appendChild(buildPanel(data, state, () => draw(false), () => draw(true)));
  };

  draw(true);
  return root;
}

function buildPanel(
  data: TopologyPanelData,
  state: TopologyState,
  redraw: () => void,
  reset: () => void,
): HTMLElement {
  const root = el('div');

  root.appendChild(el('h1', {}, t('Workspace topology')));
  root.appendChild(
    el('p', { class: 'subtitle' }, t('Choose default members, exclude directories and reorganize workspace members.')),
  );

  if (!data.workspace) {
    root.appendChild(
      emptyState('root-folder', t('Not a workspace'), t('Open a Cargo workspace root to manage its members.')),
    );
    root.appendChild(footer(el('div', { class: 'spacer' }), button(t('Close'), () => send({ type: 'close' }), { secondary: true })));
    return root;
  }

  const errorCount = data.issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = data.issues.filter((issue) => issue.severity === 'warning').length;
  const orderedDefaults = data.members
    .filter((member) => state.defaults.has(member.relative))
    .map((member) => member.relative);
  const defaultsShown = data.hasDefaultMembers ? orderedDefaults.length : data.members.length;

  const summary = el('div', { class: 'row', style: 'margin-bottom:12px' });
  summary.appendChild(badge(t('{0} members', data.members.length), 'accent'));
  summary.appendChild(
    badge(
      data.hasDefaultMembers ? t('{0} default members', defaultsShown) : t('all members are default'),
      data.hasDefaultMembers ? 'safe' : 'unknown',
    ),
  );
  summary.appendChild(badge(t('{0} excluded', state.exclude.length), state.exclude.length ? 'unknown' : 'none'));
  summary.appendChild(
    badge(
      t('{0} issues', data.issues.length),
      errorCount ? 'danger' : warningCount ? 'major' : data.issues.length ? 'unknown' : 'safe',
    ),
  );
  root.appendChild(summary);

  for (const issue of data.issues) {
    root.appendChild(
      banner(
        issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info',
        el('div', {}, issue.message),
      ),
    );
  }

  root.appendChild(renderMembers(data, state, redraw));
  root.appendChild(renderExclude(data, state, redraw));

  // If any members glob loses crates to exclude, say so once near the editor.
  if (data.patterns.some((pattern) => pattern.glob && pattern.excluded.length)) {
    root.appendChild(
      banner('warning', el('div', {}, t('Some member globs resolve to fewer crates because of exclude entries.'))),
    );
  }

  root.appendChild(renderPatterns(data));

  const dirty = computeDirty(data, state);
  // Existing manifest errors must not lock the editor: the host re-plans the
  // proposed state and rejects it when it is invalid. This also lets the user
  // repair an invalid default-members entry through this panel.
  const foot = footer(
    el('span', { class: 'hint' }, t('Changes are written to the root Cargo.toml after a diff confirmation.')),
  );
  foot.appendChild(el('div', { class: 'spacer' }));
  foot.appendChild(button(t('Reset'), reset, { secondary: true, icon: 'discard' }));
  foot.appendChild(button(t('Close'), () => send({ type: 'close' }), { secondary: true }));
  foot.appendChild(
    button(
      t('Apply'),
      () => send({ type: 'saveTopology', defaultMembers: orderedDefaults, exclude: [...state.exclude] }),
      { disabled: !dirty, icon: 'check' },
    ),
  );
  root.appendChild(foot);

  return root;
}

// ------------------------------------------------------------------ members

function renderMembers(data: TopologyPanelData, state: TopologyState, redraw: () => void): HTMLElement {
  const wrap = section(t('Members'));
  const actions = el('div', { class: 'row', style: 'margin-bottom:8px' });
  actions.appendChild(
    el(
      'span',
      { class: 'muted' },
      t('Default members are the packages built when no -p/--workspace is passed.'),
    ),
  );
  actions.appendChild(el('div', { class: 'spacer' }));
  actions.appendChild(
    button(t('Add member'), () => send({ type: 'runCommand', command: 'rustForge.addMember' }), {
      secondary: true,
      icon: 'add',
    }),
  );
  wrap.appendChild(actions);

  if (!data.hasDefaultMembers) {
    wrap.appendChild(
      banner(
        'info',
        el('div', {}, t('No default-members key: every member is a default member. Toggling a member writes an explicit list.')),
      ),
    );
  }

  if (!data.members.length) {
    wrap.appendChild(emptyState('package', t('No members'), t('Add a crate under the workspace root.')));
    return wrap;
  }

  for (const member of data.members) {
    const card = el('div', { class: 'card' });
    const head = el('div', { class: 'card-title', style: 'gap:8px' });
    head.appendChild(
      checkbox(t('Default member'), state.defaults.has(member.relative), (checked) => {
        if (checked) state.defaults.add(member.relative);
        else state.defaults.delete(member.relative);
        redraw();
      }),
    );
    head.appendChild(el('span', {}, member.name));
    head.appendChild(el('span', { class: 'mono muted', title: member.manifestPath }, member.relative));
    head.appendChild(el('div', { class: 'spacer' }));
    if (member.isRootPackage) head.appendChild(badge(t('root package'), 'accent'));
    if (member.coveredByGlob && member.memberPattern) head.appendChild(badge(t('glob'), 'none'));
    if (state.defaults.has(member.relative) || !data.hasDefaultMembers) head.appendChild(badge(t('default'), 'safe'));
    if (member.excluded) head.appendChild(badge(t('excluded'), 'danger'));
    card.appendChild(head);

    const meta = el('div', { class: 'card-meta' });
    if (member.memberPattern) {
      meta.appendChild(el('span', { class: 'muted' }, t('Member pattern: {0}', member.memberPattern)));
    }
    card.appendChild(meta);

    const row = el('div', { class: 'row', style: 'margin-top:8px' });
    row.appendChild(el('div', { class: 'spacer' }));
    row.appendChild(
      button(
        t('Move member…'),
        () => send({ type: 'moveMember', member: member.name }),
        {
          secondary: true,
          disabled: member.isRootPackage,
          icon: 'arrow-right',
          title: member.isRootPackage ? t('The root package cannot be moved.') : undefined,
        },
      ),
    );
    card.appendChild(row);
    wrap.appendChild(card);
  }

  return wrap;
}

// ------------------------------------------------------------------ exclude

function renderExclude(data: TopologyPanelData, state: TopologyState, redraw: () => void): HTMLElement {
  const wrap = section(t('Excluded directories'));
  wrap.appendChild(
    el(
      'div',
      { class: 'muted', style: 'margin-bottom:8px' },
      t('Directories matched by workspace.exclude, such as vendor or generated output.'),
    ),
  );

  if (!state.exclude.length) {
    wrap.appendChild(emptyState('circle-slash', t('Nothing excluded'), t('Every directory under the member patterns is included.')));
  }

  for (let index = 0; index < state.exclude.length; index++) {
    const entry = state.exclude[index]!;
    const row = el('div', { class: 'list-item' });
    row.appendChild(el('span', { class: 'mono' }, entry));

    const affected = affectedGlobPatterns(entry, data);
    if (affected.length) {
      row.appendChild(
        el(
          'span',
          { class: 'muted' },
          t('Removes crates matched by {0} from the workspace.', affected.join(', ')),
        ),
      );
    }
    row.appendChild(el('div', { class: 'spacer' }));
    row.appendChild(
      button(
        '',
        () => {
          state.exclude.splice(index, 1);
          redraw();
        },
        { secondary: true, icon: 'trash', title: t('Remove {0}', entry) },
      ),
    );
    wrap.appendChild(row);
  }

  const editor = el('div', { class: 'row', style: 'margin-top:10px' });
  const field = el('vscode-textfield', {
    placeholder: t('Directory to exclude, e.g. vendor'),
  }) as unknown as HTMLElement;
  (field as unknown as { value: string }).value = state.draft;
  field.addEventListener('input', (event) => {
    state.draft = (event.target as unknown as { value: string }).value;
  });
  const addEntry = () => {
    const normalized = normalizeEntry(state.draft);
    if (!normalized) return;
    if (!state.exclude.some((entry) => normalizeEntry(entry) === normalized)) {
      state.exclude.push(normalized);
    }
    state.draft = '';
    redraw();
  };
  field.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter') {
      event.preventDefault();
      addEntry();
    }
  });
  editor.appendChild(field);
  editor.appendChild(button(t('Add'), addEntry, { icon: 'add' }));
  wrap.appendChild(editor);

  const suggestions = containerSuggestions(data);
  if (suggestions.length) {
    const row = el('div', { class: 'row tight', style: 'margin-top:8px;flex-wrap:wrap' });
    row.appendChild(el('span', { class: 'muted' }, t('Suggestions:')));
    for (const suggestion of suggestions) {
      row.appendChild(
        button(suggestion, () => {
          state.draft = suggestion;
          redraw();
        }, { secondary: true }),
      );
    }
    wrap.appendChild(row);
  }

  return wrap;
}

/** Glob patterns whose resolved crates this exclude entry would remove. */
function affectedGlobPatterns(entry: string, data: TopologyPanelData): string[] {
  const normalized = normalizeEntry(entry);
  if (!normalized) return [];
  return data.patterns
    .filter((pattern) => {
      if (!pattern.glob) return false;
      if (hasGlob(normalized)) {
        return patternMatches(normalized, pattern.pattern) || patternMatches(pattern.pattern, normalized);
      }
      return (
        patternMatches(normalized, pattern.pattern) ||
        pattern.pattern.startsWith(`${normalized}/`) ||
        pattern.resolved.some((relative) => relative === normalized || relative.startsWith(`${normalized}/`))
      );
    })
    .map((pattern) => pattern.pattern);
}

function containerSuggestions(data: TopologyPanelData): string[] {
  const suggestions = new Set<string>();
  for (const member of data.members) {
    const parts = member.relative.split('/');
    if (parts.length > 1 && parts[0] && parts[0] !== '.') suggestions.add(parts[0]);
  }
  for (const pattern of data.patterns) {
    const parts = pattern.pattern.split('/');
    if (parts.length > 1 && parts[0] && !hasGlob(parts[0])) suggestions.add(parts[0]);
  }
  return [...suggestions].sort((a, b) => a.localeCompare(b));
}

// ----------------------------------------------------------------- patterns

function renderPatterns(data: TopologyPanelData): HTMLElement {
  const wrap = section(t('Member patterns'));
  if (!data.patterns.length) {
    wrap.appendChild(emptyState('list-tree', t('No member patterns'), t('workspace.members is empty.')));
    return wrap;
  }

  for (const pattern of data.patterns) {
    const card = el('div', { class: 'card' });
    const head = el('div', { class: 'card-title', style: 'gap:8px' });
    head.appendChild(el('span', { class: 'mono' }, pattern.pattern));
    head.appendChild(badge(pattern.glob ? t('glob') : t('path'), pattern.glob ? 'accent' : 'none'));
    head.appendChild(badge(t('{0} resolved', pattern.resolved.length), pattern.resolved.length ? 'safe' : 'unknown'));
    if (pattern.excluded.length) head.appendChild(badge(t('{0} excluded', pattern.excluded.length), 'danger'));
    card.appendChild(head);

    if (pattern.resolved.length) {
      card.appendChild(el('div', { class: 'mono muted' }, pattern.resolved.join(', ')));
    }
    if (pattern.excluded.length) {
      card.appendChild(
        el('div', { class: 'field-desc' }, t('Removed by exclude: {0}', pattern.excluded.join(', '))),
      );
    }
    wrap.appendChild(card);
  }

  return wrap;
}

// ------------------------------------------------------------------ helpers

function computeDirty(data: TopologyPanelData, state: TopologyState): boolean {
  const selected = data.members
    .filter((member) => state.defaults.has(member.relative))
    .map((member) => member.relative)
    .sort();
  const current = data.members
    .filter((member) => member.isDefault)
    .map((member) => member.relative)
    .sort();
  const all = data.members.map((member) => member.relative).sort();
  const allSelected = data.members.length > 0 && sameList(selected, all);

  const defaultsDirty = data.hasDefaultMembers
    ? !sameList(selected, current) || allSelected
    : !sameList(selected, all);

  const excludeDirty = !sameList(state.exclude.map(normalizeEntry), data.exclude.map(normalizeEntry));
  return defaultsDirty || excludeDirty;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function normalizeEntry(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function hasGlob(value: string): boolean {
  return /[*?\[]/.test(value);
}

/** Segment-aware matcher mirroring cargo's member glob semantics. */
function patternMatches(relative: string, pattern: string): boolean {
  const parts = normalizeEntry(relative).split('/').filter(Boolean);
  const patternParts = normalizeEntry(pattern).split('/').filter(Boolean);
  return matchSegments(patternParts, 0, parts, 0);
}

function matchSegments(pattern: string[], index: number, parts: string[], partIndex: number): boolean {
  if (index === pattern.length) return partIndex === parts.length;
  const segment = pattern[index]!;
  if (segment === '**') {
    if (matchSegments(pattern, index + 1, parts, partIndex)) return true;
    return partIndex < parts.length && matchSegments(pattern, index, parts, partIndex + 1);
  }
  if (partIndex >= parts.length) return false;
  return segmentMatches(segment, parts[partIndex]!) && matchSegments(pattern, index + 1, parts, partIndex + 1);
}

function segmentMatches(segment: string, value: string): boolean {
  let source = '^';
  for (let i = 0; i < segment.length; i++) {
    const char = segment[i]!;
    if (char === '*') {
      source += '.*';
    } else if (char === '?') {
      source += '.';
    } else if (char === '[') {
      const close = segment.indexOf(']', i + 1);
      if (close < 0) {
        source += '\\[';
      } else {
        let body = segment.slice(i + 1, close);
        if (body.startsWith('!')) body = `^${body.slice(1)}`;
        source += `[${body.replace(/\\/g, '\\\\')}]`;
        i = close;
      }
    } else {
      source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  source += '$';
  try {
    return new RegExp(source).test(value);
  } catch {
    return segment === value;
  }
}

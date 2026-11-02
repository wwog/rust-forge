/** Install dependency panel: search on the left, crate setup in a right-hand drawer. */
import type { CrateDetailData, CrateSearchResult, InstallPanelData } from '../../protocol.js';
import { send } from '../bridge.js';
import { badge, banner, button, el, emptyState, field, section, select, textfield } from '../dom.js';
import { t } from '../i18n.js';
import type { DependencyTable } from '../../../core/cargo/types.js';

interface State {
  query: string;
  results: CrateSearchResult[];
  selected?: CrateDetailData;
  /** Crate chosen from the list whose details are still loading. */
  pendingName?: string;
  loadingSearch: boolean;
  versionReq: string;
  table: DependencyTable;
  members: string[];
  features: string[];
  optional: boolean;
  noDefaultFeatures: boolean;
  workspaceMode: boolean;
  manualName: string;
  manualMode: boolean;
}

let state: State | undefined;

export function renderInstall(data: InstallPanelData): HTMLElement {
  const workspace = data.workspace;
  state = {
    query: data.initialQuery ?? '',
    results: [],
    loadingSearch: false,
    versionReq: '^latest',
    table: data.defaultTable,
    members: [...data.defaultMembers],
    features: [],
    optional: false,
    noDefaultFeatures: false,
    workspaceMode: workspace,
    manualName: '',
    manualMode: false,
  };

  const root = el('div');
  root.appendChild(el('h1', {}, t('Install dependency')));
  root.appendChild(
    el('p', { class: 'subtitle' }, workspace
      ? t('Search crates.io, then declare it in [workspace.dependencies] and reference it from one or more members.')
      : t('Search crates.io, choose a version constraint, then write it into the manifest.')),
  );

  const layout = el('div', { class: 'install-layout' });
  const main = el('div', { class: 'install-main' });

  const searchBar = el('div', { class: 'toolbar' });
  const input = textfield(state.query, {
    placeholder: t('Search crates.io…'),
    onInput: (value) => {
      state!.query = value;
    },
  });
  input.classList.add('search-input');
  input.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter') runSearch();
  });
  searchBar.appendChild(input);
  searchBar.appendChild(button(t('Search'), runSearch, { icon: 'search' }));
  searchBar.appendChild(
    button(t('Enter name manually'), () => {
      state!.manualMode = !state!.manualMode;
      if (state!.manualMode) {
        state!.selected = undefined;
        state!.pendingName = undefined;
        state!.features = [];
      }
      renderResults();
    }, { secondary: true }),
  );
  main.appendChild(searchBar);

  const resultsHost = el('div');
  main.appendChild(resultsHost);
  layout.appendChild(main);

  // The secondary view slides in from the right; the install action only
  // exists in this drawer, never in the initial search view.
  const drawer = el('aside', { class: 'install-drawer', 'aria-hidden': 'true' });
  const drawerHeader = el('div', { class: 'install-drawer-header' });
  const drawerBody = el('div', { class: 'install-drawer-body' });
  const drawerFooter = el('div', { class: 'install-drawer-footer' });
  drawer.appendChild(drawerHeader);
  drawer.appendChild(drawerBody);
  drawer.appendChild(drawerFooter);
  layout.appendChild(drawer);

  root.appendChild(layout);

  function drawerOpen(): boolean {
    return !!(state!.selected || state!.pendingName || state!.manualMode);
  }

  function closeDrawer(): void {
    state!.selected = undefined;
    state!.pendingName = undefined;
    state!.manualMode = false;
    state!.features = [];
    renderResults();
  }

  function renderResults(): void {
    resultsHost.innerHTML = '';
    if (state!.manualMode) {
      renderDrawer();
      return;
    }

    if (state!.loadingSearch) {
      resultsHost.appendChild(el('div', { class: 'progress-line' }, el('vscode-progress-ring'), t('Searching crates.io…')));
      renderDrawer();
      return;
    }

    if (!state!.results.length) {
      if (state!.query.trim()) {
        resultsHost.appendChild(
          emptyState('info', t('No results'), el('div', {}, t('Try a different search term, or enter the crate name manually.'))),
        );
      }
      renderDrawer();
      return;
    }

    const list = el('div', { class: 'list' });
    for (const result of state!.results) {
      const active = state!.selected?.name === result.name || state!.pendingName === result.name;
      const row = el('div', { class: `search-result${active ? ' selected' : ''}` });
      row.appendChild(el('span', { class: 'name' }, result.name));
      row.appendChild(el('span', { class: 'desc' }, result.description ?? ''));
      row.appendChild(badge(result.version, 'accent'));
      row.addEventListener('click', () => {
        state!.selected = undefined;
        state!.pendingName = result.name;
        state!.features = [];
        renderResults();
        send({ type: 'selectCrate', name: result.name, member: state!.members[0] || undefined });
      });
      list.appendChild(row);
    }
    resultsHost.appendChild(list);
    renderDrawer();
  }

  function renderDrawer(): void {
    const open = drawerOpen();
    drawer.classList.toggle('open', open);
    layout.classList.toggle('drawer-open', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    drawerHeader.replaceChildren();
    drawerBody.replaceChildren();
    drawerFooter.replaceChildren();
    if (!open) return;

    const detail = state!.selected;
    const name = detail?.name ?? state!.pendingName ?? state!.manualName.trim();

    const titleWrap = el('div', { style: 'flex:1;min-width:0' });
    const title = el('div', { class: 'drawer-title' }, name || t('Manual dependency'));
    if (detail?.latest) title.appendChild(badge(detail.latest, 'accent'));
    titleWrap.appendChild(title);
    drawerHeader.appendChild(titleWrap);
    const close = el('button', { class: 'icon-button', title: t('Close'), 'aria-label': t('Close') },
      el('span', { class: 'codicon codicon-close' }));
    close.addEventListener('click', closeDrawer);
    drawerHeader.appendChild(close);

    if (state!.pendingName && !detail) {
      drawerBody.appendChild(
        el('div', { class: 'progress-line' }, el('vscode-progress-ring'), t('Loading {0}…', state!.pendingName)),
      );
      return;
    }

    if (state!.manualMode && !detail) {
      const manual = el('div', { class: 'card' });
      manual.appendChild(
        field(
          t('Name'),
          textfield(state!.manualName, {
            placeholder: 'serde',
            onInput: (value) => {
              state!.manualName = value;
              updateHint();
            },
          }),
          t('Declares the dependency without verifying it exists on crates.io.'),
        ),
      );
      drawerBody.appendChild(manual);
    }

    if (detail) {
      const info = el('div', { class: 'card' });
      if (detail.description) info.appendChild(el('div', { class: 'card-meta' }, detail.description));
      const links = el('div', { class: 'row tight', style: 'margin-top:8px' });
      if (detail.repository) {
        links.appendChild(button(t('Repository'), () => send({ type: 'openUrl', url: detail.repository! }), { secondary: true, icon: 'github' }));
      }
      if (detail.documentation) {
        links.appendChild(button(t('Documentation'), () => send({ type: 'openUrl', url: detail.documentation! }), { secondary: true, icon: 'book' }));
      }
      if (links.childElementCount) info.appendChild(links);
      drawerBody.appendChild(info);

      if (detail.lockState === 'resolved-not-cached') {
        drawerBody.appendChild(banner('info', el('div', {}, detail.lockMessage ?? '')));
      } else if (detail.lockState === 'constraint-unsatisfied') {
        drawerBody.appendChild(banner('warning', el('div', {}, detail.lockMessage ?? '')));
      }
    }

    const form = el('div', { class: 'section' });
    form.appendChild(el('h2', {}, t('Configuration')));
    const grid = el('div', { class: 'grid' });

    const versionOptions = buildVersionOptions(detail);
    grid.appendChild(
      field(
        t('Version constraint'),
        select(versionOptions, state!.versionReq, (value) => {
          state!.versionReq = value;
          updateHint();
          renderFeatures();
        }),
        t('Defaults to a caret requirement; exact pins are available from the version list.'),
      ),
    );

    grid.appendChild(
      field(
        t('Dependency kind'),
        select(
          [
            { value: 'dependencies', label: t('[dependencies] — normal') },
            { value: 'dev-dependencies', label: t('[dev-dependencies] — tests and examples') },
            { value: 'build-dependencies', label: t('[build-dependencies] — build scripts') },
          ],
          state!.table,
          (value) => {
            state!.table = value as DependencyTable;
            updateHint();
          },
        ),
      ),
    );

    form.appendChild(grid);

    if (workspace && data.members.length) {
      const membersCard = el('div', { class: 'card' });
      membersCard.appendChild(el('div', { class: 'card-title' }, t('Target members')));
      membersCard.appendChild(
        el('div', { class: 'field-desc' }, t('Select one or more members. Leave empty to declare only in [workspace.dependencies].')),
      );
      const memberList = el('div', { class: 'member-list' });
      for (const member of data.members) {
        const row = el('div', { class: 'member-row' });
        const box = el('vscode-checkbox', state!.members.includes(member.name) ? { checked: true } : {}) as unknown as HTMLElement;
        box.addEventListener('change', (event) => {
          const checked = !!(event.target as unknown as { checked: boolean }).checked;
          state!.members = checked
            ? [...new Set([...state!.members, member.name])]
            : state!.members.filter((name) => name !== member.name);
          updateHint();
        });
        row.appendChild(box);
        row.appendChild(el('span', { class: 'mono' }, member.name));
        memberList.appendChild(row);
      }
      membersCard.appendChild(memberList);
      form.appendChild(membersCard);
    }

    if (workspace) {
      const mode = el('div', { class: 'card' });
      mode.appendChild(
        switchRowLocal(
          t('Declare in [workspace.dependencies]'),
          t('Recommended: the root declares the version, and the selected members inherit it with `workspace = true`.'),
          state!.workspaceMode,
          (checked) => {
            state!.workspaceMode = checked;
            updateHint();
          },
        ),
      );
      form.appendChild(mode);
    }

    const options = el('div', { class: 'card' });
    options.appendChild(
      switchRowLocal(
        t('Optional dependency'),
        t('Adds the dependency behind a feature of this crate.'),
        state!.optional,
        (checked) => {
          state!.optional = checked;
        },
      ),
    );
    options.appendChild(
      switchRowLocal(
        t('Disable default features'),
        t('Only enable the features you list explicitly.'),
        state!.noDefaultFeatures,
        (checked) => {
          state!.noDefaultFeatures = checked;
        },
      ),
    );
    form.appendChild(options);

    const featureHost = el('div', { class: 'section' });
    form.appendChild(featureHost);
    drawerBody.appendChild(form);

    function renderFeatures(): void {
      featureHost.innerHTML = '';
      if (!detail) return;
      const version = pickVersion(detail, state!.versionReq);
      const features = version?.features ?? [];
      if (!features.length) return;
      featureHost.appendChild(el('h2', {}, t('Features')));
      const chips = el('div', { class: 'chip-list' });
      for (const feature of features) {
        const active = state!.features.includes(feature);
        const chip = el('button', { class: `chip${active ? ' active' : ''}` }, feature);
        chip.addEventListener('click', () => {
          state!.features = active ? state!.features.filter((f) => f !== feature) : [...state!.features, feature];
          renderFeatures();
        });
        chips.appendChild(chip);
      }
      featureHost.appendChild(chips);
      featureHost.appendChild(el('div', { class: 'field-desc' }, t('Default features: {0}', version?.defaultFeatures.join(', ') || '—')));
      featureHost.appendChild(el('div', { class: 'row tight', style: 'margin-top:8px' }, button(t('Select all'), () => {
        state!.features = [...features];
        renderFeatures();
      }, { secondary: true }), button(t('Clear'), () => {
        state!.features = [];
        renderFeatures();
      }, { secondary: true })));
    }
    renderFeatures();

    const hint = el('span', { class: 'hint', id: 'install-hint' }, '');
    drawerFooter.appendChild(hint);
    drawerFooter.appendChild(el('div', { class: 'spacer' }));
    const submitButton = button(t('Install'), submit, { icon: 'cloud-download' });
    submitButton.id = 'install-submit';
    drawerFooter.appendChild(submitButton);
    updateHint();
  }

  function runSearch(): void {
    const query = state!.query.trim();
    if (!query) return;
    state!.loadingSearch = true;
    renderResults();
    send({ type: 'searchCrates', query });
  }

  function updateHint(): void {
    const hint = drawer.querySelector<HTMLElement>('#install-hint');
    if (!hint) return;
    const name = state!.selected?.name ?? state!.manualName.trim();
    const membersNeeded = workspace && !state!.workspaceMode && state!.members.length === 0;
    const submitButton = drawer.querySelector<HTMLElement>('#install-submit');
    if (submitButton) {
      if (name && !membersNeeded) submitButton.removeAttribute('disabled');
      else submitButton.setAttribute('disabled', '');
    }
    if (!name) {
      hint.textContent = t('Choose a crate to continue.');
      return;
    }
    if (membersNeeded) {
      hint.textContent = t('Select at least one target member.');
      return;
    }
    const members = state!.members.join(', ');
    const target = !workspace
      ? t('Writes {0} into Cargo.toml.', name)
      : state!.workspaceMode
        ? members
          ? t('Writes [workspace.dependencies] and workspace = true in {0}.', members)
          : t('Writes [workspace.dependencies] only.')
        : t('Writes {0} into {1}.', name, members);
    hint.textContent = `${target} · ${t('then runs cargo check')}`;
  }

  function submit(): void {
    const name = state!.selected?.name ?? state!.manualName.trim();
    if (!name) return;
    send({
      type: 'install',
      request: {
        packageName: name,
        versionReq: state!.versionReq,
        table: state!.table,
        features: state!.features,
        optional: state!.optional,
        noDefaultFeatures: state!.noDefaultFeatures,
        workspaceMode: workspace && state!.workspaceMode,
        memberNames: workspace ? state!.members : undefined,
      },
    });
  }

  renderResults();
  updateSearchResults = (results) => {
    state!.loadingSearch = false;
    state!.results = results;
    renderResults();
  };
  updateDetail = (detail) => {
    if (state!.pendingName && state!.pendingName !== detail.name) return;
    state!.selected = detail;
    state!.pendingName = undefined;
    state!.features = [];
    renderResults();
  };
  clearPending = (name) => {
    if (state!.pendingName !== name) return;
    state!.pendingName = undefined;
    state!.selected = undefined;
    renderResults();
  };
  return root;
}

let updateSearchResults: ((results: CrateSearchResult[]) => void) | undefined;
let updateDetail: ((detail: CrateDetailData) => void) | undefined;
let clearPending: ((name: string) => void) | undefined;

/** Called by the host bridge when search results arrive. */
export function applySearchResults(results: CrateSearchResult[]): void {
  updateSearchResults?.(results);
}

export function applyCrateDetail(detail: CrateDetailData): void {
  updateDetail?.(detail);
}

export function applyCrateDetailFailed(name: string): void {
  clearPending?.(name);
}

function switchRowLocal(title: string, description: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
  const row = el('div', { class: 'switch-row' });
  const box = el('vscode-checkbox', checked ? { checked: true } : {}) as unknown as HTMLElement;
  box.addEventListener('change', (event) => onChange(!!(event.target as unknown as { checked: boolean }).checked));
  row.appendChild(box);
  const text = el('div', { class: 'switch-text' });
  text.appendChild(el('div', { class: 'switch-title' }, title));
  if (description) text.appendChild(el('div', { class: 'field-desc' }, description));
  row.appendChild(text);
  return row;
}

function buildVersionOptions(detail: CrateDetailData | undefined): { value: string; label: string; description?: string }[] {
  const options: { value: string; label: string; description?: string }[] = [
    { value: '^latest', label: t('^latest — caret on the newest stable release'), description: t('default') },
  ];
  if (!detail) return options;
  options.push({ value: `^${detail.latest}`, label: `^${detail.latest}`, description: t('explicit caret') });
  options.push({ value: `=${detail.latest}`, label: `=${detail.latest}`, description: t('exact pin') });
  for (const version of detail.versions.slice(0, 12)) {
    if (version.version === detail.latest) continue;
    const label = version.yanked ? `${version.version} (${t('yanked')})` : version.version;
    options.push({
      value: `=${version.version}`,
      label,
      description: version.rustVersion ? `MSRV ${version.rustVersion}` : undefined,
    });
  }
  return options;
}

function pickVersion(detail: CrateDetailData, req: string): CrateDetailData['versions'][number] | undefined {
  if (req === '^latest') return detail.versions.find((v) => v.version === detail.latest) ?? detail.versions[0];
  const exact = req.replace(/^[=^~]/, '');
  return detail.versions.find((v) => v.version === exact) ?? detail.versions[0];
}

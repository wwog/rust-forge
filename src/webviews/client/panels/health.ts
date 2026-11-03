/** Dependency health panel: duplicates, unused declarations and inheritance. */
import type { HealthPanelData } from '../../protocol.js';
import { send } from '../bridge.js';
import { badge, banner, button, el, emptyState, footer, section } from '../dom.js';
import { t } from '../i18n.js';

export function renderHealth(data: HealthPanelData): HTMLElement {
  const root = el('div');
  root.appendChild(el('h1', {}, t('Dependency health')));
  root.appendChild(
    el('p', { class: 'subtitle' }, t('Inspect duplicate versions, unused declarations and workspace dependency inheritance.')),
  );

  const issueCount =
    data.duplicates.length + data.unused.length + data.workspaceDependencies.length + data.versionMismatches.length;
  const summary = el('div', { class: 'row', style: 'margin-bottom:12px' });
  summary.appendChild(
    badge(
      t('{0} duplicate package(s)', data.duplicates.length),
      data.duplicates.length ? 'major' : 'safe',
    ),
  );
  summary.appendChild(
    badge(t('{0} unused declaration(s)', data.unused.length), data.unused.length ? 'unknown' : 'safe'),
  );
  if (data.workspace) {
    summary.appendChild(
      badge(
        t('{0} inheritance issue(s)', data.workspaceDependencies.length),
        data.workspaceDependencies.length ? 'accent' : 'safe',
      ),
    );
  }
  summary.appendChild(
    badge(
      t('{0} version mismatch(es)', data.versionMismatches.length),
      data.versionMismatches.length ? 'danger' : 'safe',
    ),
  );
  root.appendChild(summary);

  if (issueCount === 0 && !data.analyzing && !data.duplicateError) {
    root.appendChild(banner('success', el('div', {}, t('No dependency health issues found.'))));
  }

  root.appendChild(renderDuplicates(data));
  root.appendChild(renderUnused(data));
  if (data.workspace) root.appendChild(renderWorkspaceDependencies(data));
  root.appendChild(renderMismatches(data));

  const foot = footer(
    el('span', { class: 'hint' }, t('Scanned {0} Rust source file(s). Unused results are heuristic.', data.scannedFiles)),
  );
  foot.appendChild(el('div', { class: 'spacer' }));
  foot.appendChild(button(t('Refresh'), () => send({ type: 'refreshHealth' }), { secondary: true, icon: 'refresh' }));
  root.appendChild(foot);

  return root;
}

function renderDuplicates(data: HealthPanelData): HTMLElement {
  const wrap = section(t('Duplicate versions'), el('div', { class: 'muted', style: 'margin-bottom:8px' }, t('Based on cargo tree -d.')));

  if (data.analyzing) {
    wrap.appendChild(banner('info', el('div', {}, t('Analyzing cargo tree -d…'))));
  }
  if (data.duplicateError) {
    wrap.appendChild(
      banner(
        'warning',
        el('div', {},
          el('div', {}, data.duplicateError),
          data.duplicateErrorDetail ? el('pre', { class: 'diff', style: 'margin-top:8px;max-height:180px' }, data.duplicateErrorDetail) : el('span'),
        ),
      ),
    );
  }

  if (!data.duplicates.length) {
    if (!data.analyzing && !data.duplicateError) {
      wrap.appendChild(
        emptyState('check', t('No duplicate versions'), t('Every package resolves to a single version.')),
      );
    }
    return wrap;
  }

  for (const group of data.duplicates) {
    const card = el('div', { class: 'card' });
    const head = el('div', { class: 'card-title' });
    head.appendChild(el('span', {}, group.name));
    head.appendChild(badge(t('{0} versions', group.versions.length), group.incompatible ? 'danger' : 'unknown'));
    if (group.versions.some((version) => version.direct)) head.appendChild(badge(t('direct'), 'accent'));
    card.appendChild(head);

    const meta = el('div', { class: 'card-meta' });
    for (const version of group.versions) {
      meta.appendChild(el('span', { class: 'mono' }, `v${version.version}`));
    }
    card.appendChild(meta);

    card.appendChild(
      el('div', { class: 'field-desc', style: 'margin:8px 0' }, duplicateReason(group)),
    );

    for (const version of group.versions) {
      const versionRow = el('div', { class: 'list-item', style: 'align-items:flex-start' });
      versionRow.appendChild(el('span', { class: 'mono', style: 'min-width:72px' }, `v${version.version}`));
      const sources = el('div', { style: 'flex:1;min-width:0' });
      if (!version.sources.length) {
        sources.appendChild(el('div', { class: 'muted' }, t('No dependent path was reported for this version.')));
      }
      for (const source of version.sources) {
        const line = el('div', { style: 'margin-bottom:4px' });
        line.appendChild(el('span', { class: 'mono' }, `${source.package} ${source.version}`));
        if (source.requirement) line.appendChild(el('span', { class: 'muted' }, ` → ${source.requirement}`));
        if (source.direct) line.appendChild(badge(t('direct'), 'accent'));
        sources.appendChild(line);
        sources.appendChild(
          el('div', { class: 'muted', style: 'font-size:0.85em;margin:-2px 0 6px 12px' },
            source.chain.map((node) => `${node.name} ${node.version}`).join(' → '),
          ),
        );
      }
      versionRow.appendChild(sources);
      card.appendChild(versionRow);
    }

    card.appendChild(el('div', { class: 'field-desc' }, duplicateSuggestion(group)));
    wrap.appendChild(card);
  }

  return wrap;
}

function duplicateReason(group: HealthPanelData['duplicates'][number]): string {
  if (group.reason === 'incompatible-requirements') {
    return t(
      'The declared requirements conflict, so Cargo cannot use one version: {0}.',
      formatRequirements(group),
    );
  }
  if (group.reason === 'overlapping-requirements') {
    return t(
      'The declared ranges overlap, so the duplicate usually comes from an exact pin or a stale Cargo.lock: {0}.',
      formatRequirements(group),
    );
  }
  return t('cargo tree reports multiple versions, but the dependent requirements could not be loaded.');
}

function duplicateSuggestion(group: HealthPanelData['duplicates'][number]): string {
  if (group.reason === 'unknown-requirements') {
    return t('Run cargo metadata online to see which requirement selects each version.');
  }
  return t(
    'Upgrade or align the dependents shown above, then run cargo update -p {0} to unify the lockfile.',
    group.name,
  );
}

function formatRequirements(group: HealthPanelData['duplicates'][number]): string {
  if (!group.requirements.length) return t('requirements unavailable');
  return group.requirements
    .map((requirement) => `${requirement.parent} ${requirement.parentVersion} → ${requirement.requirement}`)
    .join('; ');
}

function renderUnused(data: HealthPanelData): HTMLElement {
  const wrap = section(t('Unused dependencies'));
  wrap.appendChild(
    banner(
      'info',
      el('div', {}, t('Unused results come from scanning Rust source files; optional and derive-only crates may not be detected.')),
    ),
  );
  if (!data.unused.length) {
    wrap.appendChild(emptyState('check', t('No unused declarations'), t('Every non-optional declaration is referenced.')));
    return wrap;
  }

  const byMember = new Map<string, HealthPanelData['unused']>();
  for (const entry of data.unused) {
    const list = byMember.get(entry.member) ?? [];
    list.push(entry);
    byMember.set(entry.member, list);
  }

  for (const [member, entries] of byMember) {
    const group = el('div', { class: 'card' });
    group.appendChild(el('div', { class: 'card-title' }, el('span', {}, member)));
    const list = el('div', { class: 'list' });
    for (const entry of entries) {
      const row = el('div', { class: 'list-item' });
      row.appendChild(el('span', { class: 'name' }, entry.packageName));
      if (entry.requirement) row.appendChild(el('span', { class: 'mono muted' }, entry.requirement));
      row.appendChild(el('span', { class: 'mono muted' }, `[${entry.table}]`));
      if (entry.kind !== 'registry') row.appendChild(badge(entry.kind, 'none'));
      row.appendChild(el('span', { class: 'spacer' }));
      row.appendChild(openDeclaration(entry.manifestPath, entry.line));
      list.appendChild(row);
    }
    group.appendChild(list);
    wrap.appendChild(group);
  }
  return wrap;
}

function renderWorkspaceDependencies(data: HealthPanelData): HTMLElement {
  const wrap = section(t('Workspace dependencies'));
  if (!data.workspaceDependencies.length) {
    wrap.appendChild(
      emptyState(
        'check',
        t('No inheritance gaps'),
        t('Every [workspace.dependencies] entry is used and inherited by at least one member.'),
      ),
    );
    return wrap;
  }

  for (const issue of data.workspaceDependencies) {
    const card = el('div', { class: 'card' });
    const head = el('div', { class: 'card-title' });
    head.appendChild(el('span', {}, issue.name));
    if (issue.workspaceVersion) head.appendChild(el('span', { class: 'mono muted' }, issue.workspaceVersion));
    head.appendChild(
      badge(
        issue.kind === 'unused-entry' ? t('not inherited') : t('direct declaration'),
        issue.kind === 'unused-entry' ? 'unknown' : 'major',
      ),
    );
    card.appendChild(head);
    card.appendChild(
      el(
        'div',
        { class: 'field-desc' },
        issue.kind === 'unused-entry'
          ? t('Declared in [workspace.dependencies], but no member references it with workspace = true.')
          : t('These members declare the dependency directly instead of inheriting the workspace entry.'),
      ),
    );
    if (issue.members.length) {
      const list = el('div', { class: 'list' });
      for (const member of issue.members) {
        const row = el('div', { class: 'list-item' });
        row.appendChild(el('span', { class: 'name' }, member.member));
        if (member.requirement) row.appendChild(el('span', { class: 'mono muted' }, member.requirement));
        row.appendChild(el('span', { class: 'mono muted' }, member.kind));
        row.appendChild(el('span', { class: 'spacer' }));
        row.appendChild(openDeclaration(member.manifestPath, member.line));
        list.appendChild(row);
      }
      card.appendChild(list);
    }
    wrap.appendChild(card);
  }
  return wrap;
}

function renderMismatches(data: HealthPanelData): HTMLElement {
  const wrap = section(t('Version consistency'));
  if (!data.versionMismatches.length) {
    wrap.appendChild(
      emptyState('check', t('Versions are consistent'), t('Members agree on every shared version requirement.')),
    );
    return wrap;
  }

  for (const mismatch of data.versionMismatches) {
    const card = el('div', { class: 'card' });
    const head = el('div', { class: 'card-title' });
    head.appendChild(el('span', {}, mismatch.packageName));
    for (const requirement of mismatch.requirements) {
      head.appendChild(badge(requirement, 'unknown'));
    }
    card.appendChild(head);
    card.appendChild(
      el(
        'div',
        { class: 'field-desc' },
        t('Members declare different requirements. Cargo may resolve separate versions; align them or promote one requirement to [workspace.dependencies].'),
      ),
    );

    const list = el('div', { class: 'list' });
    for (const member of mismatch.members) {
      const row = el('div', { class: 'list-item' });
      row.appendChild(el('span', { class: 'name' }, member.member));
      row.appendChild(el('span', { class: 'mono' }, member.requirement));
      row.appendChild(badge(member.source === 'workspace' ? t('workspace') : t('direct'), member.source === 'workspace' ? 'accent' : 'none'));
      row.appendChild(el('span', { class: 'spacer' }));
      row.appendChild(openDeclaration(member.manifestPath, member.line, member.key));
      list.appendChild(row);
    }
    card.appendChild(list);
    wrap.appendChild(card);
  }
  return wrap;
}

function openDeclaration(manifestPath: string, line: number, label?: string): HTMLElement {
  const link = el('a', { href: '#', title: t('Open declaration') }, label ?? t('Open declaration'));
  link.addEventListener('click', (event) => {
    event.preventDefault();
    send({ type: 'openFile', path: manifestPath, line });
  });
  return link;
}

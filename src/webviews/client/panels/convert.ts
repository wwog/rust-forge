/** Workspace conversion panel: preflight, options, dry-run diff, apply. */
import type { ConvertPanelData } from '../../protocol.js';
import { send } from '../bridge.js';
import { badge, banner, button, diffBlock, el, footer, section } from '../dom.js';
import { t } from '../i18n.js';

export function renderConvert(data: ConvertPanelData): HTMLElement {
  const root = el('div');
  const selectedFields = new Set(data.extractableFields.filter((f) => f.present && f.defaultExtract).map((f) => f.key));
  let readmeHandling: 'keep' | 'copy' = data.readmeHandling === 'copy' ? 'copy' : 'keep';
  const targetDirName = basename(data.targetDir);
  let dirName = targetDirName;

  root.appendChild(el('h1', {}, t('Convert to workspace')));
  root.appendChild(
    el('p', { class: 'subtitle' }, t('Move this package into crates/{0}, lift shared configuration to the root, and verify the result with cargo check.', dirName)),
  );

  const blocking = data.issues.filter((i) => i.severity === 'blocking');
  for (const issue of data.issues) {
    root.appendChild(
      banner(issue.severity === 'blocking' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info', el('div', {}, issue.message)),
    );
  }

  if (blocking.length) {
    root.appendChild(footer(el('span', { class: 'hint' }, t('Resolve the blocking issues above to continue.')), el('div', { class: 'spacer' }), button(t('Close'), () => send({ type: 'close' }), { secondary: true })));
    return root;
  }

  // --- Layout
  const layout = section(t('Target layout'));
  const tree = el('pre', { class: 'diff' });
  // Plain text keeps the box-drawing alignment intact; the `.diff` spans use
  // display:block for patches, which would break this tree.
  tree.textContent = [
    'root/',
    `├── Cargo.toml                # [workspace] + [workspace.package] + [workspace.dependencies]`,
    '├── crates/',
    `│   └── ${dirName}/`,
    `│       ├── Cargo.toml        # member: inherits package fields and dependencies`,
    '│       └── src/ ...',
    '├── Cargo.lock                # regenerated at the root',
    '└── README / LICENSE / rustfmt.toml / CI   # stay at the root',
  ].join('\n');
  layout.appendChild(tree);

  const dirField = el('div', { class: 'card' });
  dirField.appendChild(el('div', { class: 'card-title' }, t('Directory name under crates/')));
  const dirInput = el('vscode-textfield', { value: dirName }) as unknown as HTMLElement;
  (dirInput as unknown as { value: string }).value = dirName;
  dirInput.addEventListener('input', (event) => {
    dirName = (event.target as unknown as { value: string }).value;
  });
  dirField.appendChild(dirInput);
  layout.appendChild(dirField);
  root.appendChild(layout);

  // --- Inherited fields
  const fields = section(t('Lift package fields to [workspace.package]'));
  fields.appendChild(el('div', { class: 'muted', style: 'margin-bottom:8px' }, t('Checked fields move to the workspace table and members use `.workspace = true`.')));
  for (const field of data.extractableFields) {
    if (!field.present) continue;
    const row = el('div', { class: 'switch-row' });
    const box = el('vscode-checkbox', selectedFields.has(field.key) ? { checked: true } : {}) as unknown as HTMLElement;
    box.addEventListener('change', (event) => {
      if ((event.target as unknown as { checked: boolean }).checked) selectedFields.add(field.key);
      else selectedFields.delete(field.key);
    });
    row.appendChild(box);
    const text = el('div', { class: 'switch-text' });
    text.appendChild(el('div', { class: 'switch-title' }, field.key, el('span', { class: 'mono muted' }, field.value)));
    row.appendChild(text);
    fields.appendChild(row);
  }
  root.appendChild(fields);

  // --- README handling
  const readme = section(t('README and LICENSE'));
  const radioWrap = el('div', { class: 'radio-group' });
  for (const [value, label, description] of [
    ['keep', t('Keep a single copy at the root'), t('Members reference ../../README.md and ../../LICENSE.')],
    ['copy', t('Copy into the member as well'), t('Each crate gets its own copy, useful for publishing.')],
  ] as const) {
    const row = el('div', { class: 'switch-row' });
    const box = el('vscode-checkbox', readmeHandling === value ? { checked: true } : {}) as unknown as HTMLElement;
    box.addEventListener('change', () => {
      readmeHandling = value;
      renderReadme();
    });
    row.appendChild(box);
    const text = el('div', { class: 'switch-text' });
    text.appendChild(el('div', { class: 'switch-title' }, label));
    text.appendChild(el('div', { class: 'field-desc' }, description));
    row.appendChild(text);
    radioWrap.appendChild(row);
  }
  const renderReadme = () => {
    for (let i = 0; i < radioWrap.children.length; i++) {
      const child = radioWrap.children[i] as HTMLElement;
      const box = child.querySelector('vscode-checkbox') as unknown as { checked: boolean } | null;
      if (box) box.checked = (i === 0 && readmeHandling === 'keep') || (i === 1 && readmeHandling === 'copy');
    }
  };
  readme.appendChild(radioWrap);
  root.appendChild(readme);

  // --- Dependency plan
  const deps = section(t('Dependency promotion'));
  deps.appendChild(el('div', { class: 'muted', style: 'margin-bottom:8px' }, t('Dependencies with a single consistent requirement move to [workspace.dependencies].')));
  if (data.promoted.length) {
    const table = el('table');
    table.innerHTML = `<thead><tr><th>${t('Dependency')}</th><th>${t('Workspace value')}</th><th>${t('Member reference')}</th></tr></thead>`;
    const tbody = el('tbody');
    for (const dep of data.promoted) {
      const tr = el('tr');
      tr.appendChild(el('td', {}, el('span', { class: 'mono' }, dep.name)));
      tr.appendChild(el('td', {}, el('span', { class: 'mono' }, dep.workspaceValue)));
      tr.appendChild(el('td', {}, el('span', { class: 'mono' }, dep.memberValue)));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    deps.appendChild(table);
  } else {
    deps.appendChild(el('div', { class: 'muted' }, t('No dependencies qualify for promotion.')));
  }

  if (data.kept.length) {
    const keptList = el('div', { class: 'list', style: 'margin-top:10px' });
    keptList.appendChild(el('div', { class: 'card-title' }, t('Kept in the member')));
    for (const kept of data.kept) {
      keptList.appendChild(
        el('div', { class: 'list-item' },
          el('span', { class: 'name' }, kept.name),
          el('span', { class: 'mono muted' }, `[${kept.table}]`),
          el('span', { class: 'muted' }, kept.reason)),
      );
    }
    deps.appendChild(keptList);
  }
  root.appendChild(deps);

  // --- Hardcoded refs
  if (data.hardCodedReferences.length) {
    const refs = section(t('Files that may reference the old path'));
    refs.appendChild(banner('warning', el('div', {}, t('These files mention paths that may need manual review after the move.'))));
    const list = el('div', { class: 'list' });
    for (const ref of data.hardCodedReferences) list.appendChild(el('div', { class: 'list-item' }, el('span', { class: 'mono' }, ref)));
    refs.appendChild(list);
    root.appendChild(refs);
  }

  if (data.gitDirty?.length) {
    const git = section(t('Uncommitted changes'));
    git.appendChild(banner('warning', el('div', {}, t('The working tree is not clean. Committing first is recommended.'))));
    git.appendChild(el('div', { class: 'mono muted', style: 'white-space:pre-wrap' }, data.gitDirty.slice(0, 12).join('\n')));
    root.appendChild(git);
  }

  // --- Dry-run preview
  const preview = section(t('Dry run'));
  preview.appendChild(el('div', { class: 'muted', style: 'margin-bottom:8px' }, t('File moves and manifest diffs below are exactly what will happen.')));
  for (const op of data.operations) {
    if (op.kind === 'move') {
      const row = el('div', { class: 'list-item' });
      row.appendChild(badge(t('move'), 'accent'));
      row.appendChild(el('span', { class: 'mono' }, shortPath(op.path)));
      row.appendChild(el('span', { class: 'muted' }, '→'));
      row.appendChild(el('span', { class: 'mono' }, op.to ?? ''));
      preview.appendChild(row);
    } else if (op.kind === 'create-dir') {
      const row = el('div', { class: 'list-item' });
      row.appendChild(badge(t('mkdir'), 'none'));
      row.appendChild(el('span', { class: 'mono' }, shortPath(op.path)));
      preview.appendChild(row);
    }
  }
  for (const op of data.operations) {
    if (!op.diff) continue;
    preview.appendChild(el('div', { class: 'mono muted', style: 'margin-top:10px' }, shortPath(op.path)));
    preview.appendChild(diffBlock(op.diff));
  }
  root.appendChild(preview);

  const foot = footer();
  foot.appendChild(el('span', { class: 'hint' }, t('Convert, run cargo metadata/check, and keep a safety snapshot.')));
  foot.appendChild(el('div', { class: 'spacer' }));
  foot.appendChild(button(t('Cancel'), () => send({ type: 'close' }), { secondary: true }));
  foot.appendChild(button(t('Convert workspace'), () => {
    send({
      type: 'convert',
      options: {
        extractFields: [...selectedFields],
        readmeHandling,
        targetDirName: dirName,
      },
    });
  }, { icon: 'type-hierarchy' }));
  root.appendChild(foot);

  return root;
}

function basename(value: string): string {
  return value.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? value;
}

function shortPath(value: string): string {
  return value.replace(/^.*[\\/]/, '');
}

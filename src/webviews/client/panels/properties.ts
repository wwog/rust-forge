/** Properties panel: form-based editing of the project root manifest. */
import type { PropertiesPanelData, PropertyEditPayload, PropertyPanelField } from '../../protocol.js';
import { send } from '../bridge.js';
import { badge, banner, button, el, footer, select, textfield } from '../dom.js';
import { t } from '../i18n.js';

const GROUP_ORDER = ['identity', 'metadata', 'publishing', 'build', 'workspace'];

export function renderProperties(data: PropertiesPanelData): HTMLElement {
  const root = el('div');
  const edits = new Map<string, PropertyEditPayload>();

  root.appendChild(el('h1', {}, t('Project properties')));
  root.appendChild(
    el('p', { class: 'subtitle' }, data.workspace
      ? t('Edit the workspace root manifest: [workspace] policy and the shared defaults in [workspace.package].')
      : t('Edit this package’s metadata in the root Cargo.toml.')),
  );

  const fieldsHost = el('div');
  root.appendChild(fieldsHost);

  const renderFields = () => {
    fieldsHost.replaceChildren();

    if (data.workspace) {
      const wsFields = el('div', { class: 'section' });
      wsFields.appendChild(el('h2', {}, t('Workspace')));
      wsFields.appendChild(
        el('div', { class: 'muted', style: 'margin-bottom:10px' }, t('Workspace-wide policy shared by every member.')),
      );
      for (const property of data.workspaceProperties) {
        wsFields.appendChild(renderWorkspaceField(property, 'workspace'));
      }
      fieldsHost.appendChild(wsFields);
    }

    if (data.hasRootPackage) {
      const packageFields = el('div', { class: 'section' });
      packageFields.appendChild(el('h2', {}, data.workspace ? t('Root package') : t('Package')));
      packageFields.appendChild(
        el('div', { class: 'muted', style: 'margin-bottom:10px' },
          data.workspace
            ? t('The [package] table declared in the workspace root manifest.')
            : t('The [package] table declared in Cargo.toml.')),
      );

      const inheritedNote = data.packageProperties.some((property) => property.inherited);
      if (inheritedNote) {
        packageFields.appendChild(
          banner('info', el('div', {}, t('Fields marked “inherited” take their value from [workspace.package]. Toggle inheritance to override them in the root manifest.'))),
        );
      }

      for (const [group, properties] of groupFields(data.packageProperties)) {
        packageFields.appendChild(el('h3', {}, groupTitle(group)));
        for (const property of properties) {
          packageFields.appendChild(renderPackageField(property));
        }
      }
      fieldsHost.appendChild(packageFields);
    }

    if (data.workspace && data.workspacePackageProperties.length) {
      const defaults = el('div', { class: 'section' });
      defaults.appendChild(el('h2', {}, t('Workspace package defaults')));
      defaults.appendChild(
        el('div', { class: 'muted', style: 'margin-bottom:10px' },
          t('Members using `key.workspace = true` inherit these values from [workspace.package].')),
      );
      for (const [group, properties] of groupFields(data.workspacePackageProperties)) {
        defaults.appendChild(el('h3', {}, groupTitle(group)));
        for (const property of properties) {
          defaults.appendChild(renderWorkspaceField(property, 'workspace.package'));
        }
      }
      fieldsHost.appendChild(defaults);
    }

    updateHint();
  };

  function renderPackageField(property: PropertyPanelField): HTMLElement {
    const wrap = el('div', { class: 'card' });
    const inherited = !!property.inherited;
    const effective = inherited ? property.workspaceValue : property.value;
    const isSet = !inherited && property.value !== undefined;

    const head = el('div', { class: 'card-title' });
    head.appendChild(el('span', {}, property.label));
    head.appendChild(el('span', { class: 'mono muted' }, property.key));
    if (property.risky) head.appendChild(badge(t('review'), 'unknown'));
    if (inherited) head.appendChild(badge(t('inherited'), 'accent'));
    if (effective === undefined && property.type !== 'boolean') head.appendChild(badge(t('not set'), 'none'));
    wrap.appendChild(head);
    if (property.description) wrap.appendChild(el('div', { class: 'field-desc', style: 'margin-bottom:8px' }, property.description));

    const control = renderControl(property, effective, (value) => record(property.key, value, false, 'package'), isSet);
    if (inherited) setDisabled(control, true);
    wrap.appendChild(control);

    if (property.inheritable && (property.workspaceValue !== undefined || inherited)) {
      const inheritRow = el('div', { class: 'switch-row' });
      const box = el('vscode-checkbox', inherited ? { checked: true } : {}) as unknown as HTMLElement;
      box.addEventListener('change', (event) => {
        const checked = (event.target as unknown as { checked: boolean }).checked;
        if (checked) {
          record(property.key, undefined, true, 'package');
          setDisabled(control, true);
        } else if (effective !== undefined) {
          // Write the inherited value as a literal so the root package stops inheriting.
          record(property.key, effective, false, 'package');
          setDisabled(control, false);
        } else {
          (box as unknown as { checked: boolean }).checked = true;
        }
        updateHint();
      });
      inheritRow.appendChild(box);
      const text = el('div', { class: 'switch-text' });
      text.appendChild(el('div', { class: 'switch-title' }, t('Inherit from [workspace.package]')));
      text.appendChild(el('div', { class: 'field-desc' }, t('Workspace value: {0}', property.workspaceValue ?? '—')));
      inheritRow.appendChild(text);
      wrap.appendChild(inheritRow);
    }

    return wrap;
  }

  function renderWorkspaceField(property: PropertyPanelField, target: 'workspace' | 'workspace.package'): HTMLElement {
    const wrap = el('div', { class: 'card' });
    const head = el('div', { class: 'card-title' });
    head.appendChild(el('span', {}, property.label));
    head.appendChild(el('span', { class: 'mono muted' }, property.key));
    if (property.risky) head.appendChild(badge(t('review'), 'unknown'));
    if (property.value === undefined && property.type !== 'boolean') head.appendChild(badge(t('not set'), 'none'));
    wrap.appendChild(head);
    if (property.description) wrap.appendChild(el('div', { class: 'field-desc', style: 'margin-bottom:8px' }, property.description));

    const control = renderControl(
      property,
      property.value,
      (value) => record(property.key, value, false, target),
      property.value !== undefined,
    );
    wrap.appendChild(control);

    if (target === 'workspace.package') {
      const members = property.memberValues ?? [];
      if (property.value === undefined) {
        // No shared default: surface what the members currently declare so the
        // panel still reflects the real values.
        const literals = members.filter((member) => !member.inherited && member.value !== undefined);
        if (literals.length) {
          wrap.appendChild(
            el('div', { class: 'field-desc' },
              t('Member values: {0}', literals.map((m) => `${m.member}=${m.value}`).join(', '))),
          );
        }
      } else {
        const overrides = members.filter((member) => !member.inherited && member.value !== property.value);
        if (overrides.length) {
          wrap.appendChild(
            el('div', { class: 'field-desc' },
              t('Members not using this default: {0}', overrides.map((m) => `${m.member}=${m.value ?? '—'}`).join(', '))),
          );
        }
      }
    }

    return wrap;
  }

  function renderControl(
    property: PropertyPanelField,
    value: string | undefined,
    onChange: (value: string | undefined) => void,
    isSet: boolean,
  ): HTMLElement {
    switch (property.type) {
      case 'enum':
        return select(
          (property.values ?? []).map((entry) => ({ value: entry, label: entry })),
          value,
          (next) => onChange(next),
        );
      case 'boolean': {
        const effective = value !== undefined ? value === 'true' : property.defaultValue === 'true';
        const row = el('div', { class: 'switch-row', style: 'border:none;padding:0' });
        const box = el('vscode-checkbox', effective ? { checked: true } : {}) as unknown as HTMLElement;
        box.addEventListener('change', (event) =>
          onChange((event.target as unknown as { checked: boolean }).checked ? 'true' : 'false'),
        );
        row.appendChild(box);
        row.appendChild(el('span', {}, effective ? t('Enabled') : t('Disabled')));
        if (!isSet) row.appendChild(el('span', { class: 'muted', style: 'font-size:0.85em' }, t('default')));
        return row;
      }
      case 'array': {
        const field = textfield(value ?? '', {
          placeholder: property.placeholder ?? t('Comma-separated values'),
          onInput: (next) => onChange(next),
        });
        const hint = el('div', { class: 'field-desc' }, t('Comma-separated values'));
        const wrap = el('div');
        wrap.appendChild(field);
        wrap.appendChild(hint);
        return wrap;
      }
      default:
        return textfield(value ?? '', {
          placeholder: property.placeholder,
          onInput: (next) => onChange(next),
        });
    }
  }

  function record(
    key: string,
    value: string | undefined,
    inherit: boolean,
    target: 'package' | 'workspace' | 'workspace.package',
  ): void {
    edits.set(`${target}:${key}`, { key, value, target, inherit });
    updateHint();
  }

  const foot = footer();
  const hint = el('span', { class: 'hint' }, '');
  foot.appendChild(hint);
  foot.appendChild(el('div', { class: 'spacer' }));
  foot.appendChild(button(t('Cancel'), () => send({ type: 'close' }), { secondary: true }));
  foot.appendChild(button(t('Save changes'), () => {
    if (!edits.size) {
      send({ type: 'close' });
      return;
    }
    send({ type: 'saveProperties', edits: [...edits.values()] });
  }, { icon: 'check' }));
  root.appendChild(foot);

  function updateHint(): void {
    const count = edits.size;
    hint.textContent = count
      ? t('{0} field(s) will be written and verified with cargo check.', count)
      : t('No changes yet.');
  }

  renderFields();
  updateHint();
  return root;
}

function groupFields(fields: PropertyPanelField[]): [string, PropertyPanelField[]][] {
  const groups = new Map<string, PropertyPanelField[]>();
  for (const field of fields) {
    const group = field.group ?? 'identity';
    const list = groups.get(group) ?? [];
    list.push(field);
    groups.set(group, list);
  }
  return [...groups.entries()].sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]));
}

function groupTitle(group: string): string {
  switch (group) {
    case 'identity':
      return t('Identity');
    case 'metadata':
      return t('Metadata');
    case 'publishing':
      return t('Publishing');
    case 'build':
      return t('Build');
    case 'workspace':
      return t('Workspace');
    default:
      return group;
  }
}

function setDisabled(control: HTMLElement, disabled: boolean): void {
  const inner = control.querySelector('vscode-textfield, vscode-checkbox, vscode-single-select') as HTMLElement | null;
  ((inner ?? control) as unknown as { disabled: boolean }).disabled = disabled;
}

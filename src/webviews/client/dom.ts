/** Small DOM helpers shared by panels. */

/** Any tag name, including fast-moving custom elements not in the DOM typings. */
export type Tag = keyof HTMLElementTagNameMap | (string & {});

export function el<K extends Tag>(
  tag: K,
  attrs: Record<string, string | boolean | number | undefined> = {},
  ...children: (Node | string | undefined | null)[]
): K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (value === true) {
      node.setAttribute(key, '');
      continue;
    }
    node.setAttribute(key, String(value));
  }
  append(node, children);
  return node as K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement;
}

export function append(parent: Node, children: (Node | string | undefined | null)[]): void {
  for (const child of children) {
    if (child === undefined || child === null) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function html(markup: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild as HTMLElement;
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function section(title: string, ...children: (Node | string)[]): HTMLElement {
  const wrap = el('section', { class: 'section' });
  wrap.appendChild(el('h2', {}, title));
  append(wrap, children);
  return wrap;
}

export function badge(label: string, variant: 'safe' | 'major' | 'unknown' | 'none' | 'danger' | 'accent'): HTMLElement {
  return el('span', { class: `badge ${variant}` }, label);
}

export function banner(level: 'info' | 'warning' | 'error' | 'success', ...children: (Node | string)[]): HTMLElement {
  const node = el('div', { class: `banner ${level}` });
  const icon = {
    info: 'info',
    warning: 'warning',
    error: 'error',
    success: 'pass',
  }[level];
  node.appendChild(el('span', { class: `codicon codicon-${icon}` }));
  const body = el('div', { style: 'flex:1;min-width:0' });
  append(body, children);
  node.appendChild(body);
  return node;
}

export function field(label: string, control: HTMLElement, description?: string): HTMLElement {
  const wrap = el('div', { class: 'field' });
  wrap.appendChild(el('label', {}, label));
  wrap.appendChild(control);
  if (description) wrap.appendChild(el('div', { class: 'field-desc' }, description));
  return wrap;
}

export function button(label: string, onClick: () => void, options: { secondary?: boolean; disabled?: boolean; icon?: string; title?: string } = {}): HTMLElement {
  const attrs: Record<string, string | boolean | undefined> = { title: options.title };
  if (options.secondary) attrs.secondary = true;
  if (options.disabled) attrs.disabled = true;
  // Render the codicon in the light DOM. `vscode-button`'s icon property relies
  // on a shadow stylesheet lookup and reserves blank space when it cannot load;
  // a slotted codicon uses the page-level stylesheet and never leaves a gap.
  const node = el('vscode-button', attrs) as unknown as HTMLElement;
  if (options.icon) {
    node.appendChild(
      el('span', {
        class: `codicon codicon-${options.icon}`,
        'aria-hidden': 'true',
        style: 'margin-right:6px;font-size:14px',
      }),
    );
  }
  if (label) node.appendChild(document.createTextNode(label));
  node.addEventListener('click', (event) => {
    event.preventDefault();
    if (!options.disabled) onClick();
  });
  return node;
}

export function textfield(value: string, options: { placeholder?: string; type?: string; onInput?: (value: string) => void } = {}): HTMLElement {
  const node = el('vscode-textfield', { placeholder: options.placeholder, type: options.type ?? 'text' }) as unknown as HTMLElement;
  (node as unknown as { value: string }).value = value;
  if (options.onInput) {
    node.addEventListener('input', (event) => options.onInput!((event.target as unknown as { value: string }).value));
  }
  return node;
}

export function checkbox(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
  const node = el('vscode-checkbox', { checked: checked ? true : undefined }) as unknown as HTMLElement;
  node.textContent = label;
  node.addEventListener('change', (event) => {
    const target = event.target as unknown as { checked: boolean };
    onChange(!!target.checked);
  });
  return node;
}

export function switchRow(title: string, description: string, checked: boolean, onChange: (checked: boolean) => void, key?: string): HTMLElement {
  const row = el('div', { class: 'switch-row' });
  row.appendChild(checkbox('', checked, onChange));
  const text = el('div', { class: 'switch-text' });
  const titleEl = el('div', { class: 'switch-title' }, title);
  if (key) titleEl.appendChild(el('span', { class: 'mono' }, key));
  text.appendChild(titleEl);
  if (description) text.appendChild(el('div', { class: 'field-desc' }, description));
  row.appendChild(text);
  return row;
}

export function select(
  options: { value: string; label: string; description?: string }[],
  value: string | undefined,
  onChange: (value: string) => void,
): HTMLElement {
  const node = el('vscode-single-select') as unknown as HTMLElement;
  for (const option of options) {
    const optionEl = el('vscode-option', { value: option.value, description: option.description }, option.label);
    if (option.value === value) optionEl.setAttribute('selected', '');
    node.appendChild(optionEl);
  }
  node.addEventListener('change', (event) => {
    onChange((event.target as unknown as { value: string }).value);
  });
  return node;
}

export function numericField(value: number | undefined, onChange: (value: number | undefined) => void, options: { min?: number; max?: number } = {}): HTMLElement {
  const node = el('vscode-textfield', { type: 'number', min: options.min, max: options.max }) as unknown as HTMLElement;
  (node as unknown as { value: string }).value = value !== undefined ? String(value) : '';
  node.addEventListener('change', (event) => {
    const raw = (event.target as unknown as { value: string }).value;
    const parsed = raw === '' ? undefined : Number(raw);
    onChange(Number.isFinite(parsed) ? parsed : undefined);
  });
  return node;
}

export function footer(...children: (Node | string)[]): HTMLElement {
  const node = el('div', { class: 'footer' });
  append(node, children);
  return node;
}

export function emptyState(icon: string, title: string, ...children: (Node | string)[]): HTMLElement {
  const node = el('div', { class: 'empty' });
  node.appendChild(el('span', { class: `codicon codicon-${icon}` }));
  node.appendChild(el('div', { style: 'font-weight:600;margin-bottom:6px' }, title));
  append(node, children);
  return node;
}

export function diffBlock(patch: string): HTMLElement {
  const node = el('pre', { class: 'diff' });
  node.innerHTML = patch
    .split('\n')
    .map((line) => {
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@') || line.startsWith('Index:')) {
        return `<span class="meta">${escapeHtml(line)}</span>`;
      }
      if (line.startsWith('+')) return `<span class="add">${escapeHtml(line)}</span>`;
      if (line.startsWith('-')) return `<span class="del">${escapeHtml(line)}</span>`;
      return `<span class="ctx">${escapeHtml(line)}</span>`;
    })
    .join('');
  return node;
}

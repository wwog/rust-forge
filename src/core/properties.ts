/**
 * Editable Cargo properties.
 *
 * Each property knows its table, how to read the current value (including
 * workspace inheritance) and where to write it. The UI only ever deals with
 * this descriptor list, so adding a property is a one-line change.
 */
import { parse as parseToml } from 'smol-toml';
import type { ProjectModel } from './cargo/project.js';
import { readTextFile } from './process.js';
import { TomlEditor, quoteString } from './toml/editor.js';
import { t } from './i18n.js';

export type PropertyScope = 'package' | 'workspace';
export type PropertyType = 'string' | 'enum' | 'version' | 'boolean' | 'array';
export type PropertyGroup = 'identity' | 'metadata' | 'publishing' | 'build' | 'workspace';

export interface PropertyDescriptor {
  key: string;
  scope: PropertyScope;
  type: PropertyType;
  label: string;
  labelZh: string;
  description: string;
  descriptionZh: string;
  values?: string[];
  placeholder?: string;
  /** Warn when changing this property has semantic consequences. */
  risky?: boolean;
  allowedEditions?: string[];
  /** Cargo allows this key in [workspace.package] and `key.workspace = true`. */
  inheritable?: boolean;
  /** Effective value when the key is absent (booleans). */
  defaultValue?: string;
  group?: PropertyGroup;
}

export const PACKAGE_PROPERTIES: PropertyDescriptor[] = [
  {
    key: 'rust-version',
    scope: 'package',
    type: 'version',
    label: 'Minimum Rust version (MSRV)',
    labelZh: '最低 Rust 版本（MSRV）',
    description: 'Lowest toolchain version this crate supports. Checked against the active toolchain.',
    descriptionZh: '此 crate 支持的最低工具链版本，会与当前工具链联动校验。',
    placeholder: '1.75',
    inheritable: true,
    group: 'identity',
  },
  {
    key: 'edition',
    scope: 'package',
    type: 'enum',
    label: 'Edition',
    labelZh: 'Edition',
    description: 'Rust edition. Upgrading changes language semantics — review before switching.',
    descriptionZh: 'Rust edition。升级会带来语言语义差异，切换前请评估。',
    values: ['2015', '2018', '2021', '2024'],
    risky: true,
    inheritable: true,
    group: 'identity',
  },
  {
    key: 'version',
    scope: 'package',
    type: 'string',
    label: 'Version',
    labelZh: '版本',
    description: 'Package version. Workspace mode may inherit from [workspace.package].',
    descriptionZh: '包版本。workspace 模式可从 [workspace.package] 继承。',
    placeholder: '0.1.0',
    inheritable: true,
    group: 'identity',
  },
  {
    key: 'name',
    scope: 'package',
    type: 'string',
    label: 'Name',
    labelZh: '名称',
    description: 'Crate name. Changing it affects imports and publish records.',
    descriptionZh: 'crate 名称。修改会影响引用方式与发布记录。',
    risky: true,
    group: 'identity',
  },
  {
    key: 'description',
    scope: 'package',
    type: 'string',
    label: 'Description',
    labelZh: '描述',
    description: 'Short summary shown on crates.io.',
    descriptionZh: '在 crates.io 上展示的简短说明。',
    inheritable: true,
    group: 'identity',
  },
  {
    key: 'authors',
    scope: 'package',
    type: 'array',
    label: 'Authors',
    labelZh: '作者',
    description: 'Comma-separated author entries, e.g. Jane <jane@example.com>.',
    descriptionZh: '逗号分隔的作者信息，例如 Jane <jane@example.com>。',
    placeholder: 'Jane <jane@example.com>',
    inheritable: true,
    group: 'metadata',
  },
  {
    key: 'license',
    scope: 'package',
    type: 'string',
    label: 'License',
    labelZh: '许可证',
    description: 'SPDX license expression, e.g. MIT OR Apache-2.0.',
    descriptionZh: 'SPDX 许可证表达式，例如 MIT OR Apache-2.0。',
    placeholder: 'MIT OR Apache-2.0',
    inheritable: true,
    group: 'metadata',
  },
  {
    key: 'license-file',
    scope: 'package',
    type: 'string',
    label: 'License file',
    labelZh: '许可证文件',
    description: 'Path to a license file. Mutually exclusive with the SPDX license field.',
    descriptionZh: '许可证文件路径。与 SPDX license 字段互斥。',
    placeholder: 'LICENSE',
    inheritable: true,
    group: 'metadata',
  },
  {
    key: 'repository',
    scope: 'package',
    type: 'string',
    label: 'Repository',
    labelZh: '仓库',
    description: 'Source repository URL shown on crates.io.',
    descriptionZh: 'crates.io 上展示的源码仓库地址。',
    placeholder: 'https://github.com/you/crate',
    inheritable: true,
    group: 'metadata',
  },
  {
    key: 'homepage',
    scope: 'package',
    type: 'string',
    label: 'Homepage',
    labelZh: '主页',
    description: 'Project homepage URL.',
    descriptionZh: '项目主页地址。',
    placeholder: 'https://example.com',
    inheritable: true,
    group: 'metadata',
  },
  {
    key: 'documentation',
    scope: 'package',
    type: 'string',
    label: 'Documentation URL',
    labelZh: '文档地址',
    description: 'Documentation URL; crates.io falls back to docs.rs when empty.',
    descriptionZh: '文档地址；留空时 crates.io 会回退到 docs.rs。',
    placeholder: 'https://docs.rs/crate',
    inheritable: true,
    group: 'metadata',
  },
  {
    key: 'readme',
    scope: 'package',
    type: 'string',
    label: 'Readme',
    labelZh: 'Readme',
    description: 'Path to the readme, or true/false to enable/disable it.',
    descriptionZh: 'readme 路径，或用 true/false 启用/禁用。',
    placeholder: 'README.md',
    inheritable: true,
    group: 'metadata',
  },
  {
    key: 'keywords',
    scope: 'package',
    type: 'array',
    label: 'Keywords',
    labelZh: '关键词',
    description: 'Comma-separated keywords; Cargo allows up to 5.',
    descriptionZh: '逗号分隔的关键词；Cargo 最多允许 5 个。',
    placeholder: 'cli, rust',
    inheritable: true,
    group: 'metadata',
  },
  {
    key: 'categories',
    scope: 'package',
    type: 'array',
    label: 'Categories',
    labelZh: '分类',
    description: 'Comma-separated crates.io categories.',
    descriptionZh: '逗号分隔的 crates.io 分类。',
    placeholder: 'command-line-utilities',
    inheritable: true,
    group: 'metadata',
  },
  {
    key: 'publish',
    scope: 'package',
    type: 'string',
    label: 'Publish',
    labelZh: '发布',
    description: 'true, false, or a comma-separated list of registries.',
    descriptionZh: 'true、false，或逗号分隔的 registry 列表。',
    placeholder: 'true',
    inheritable: true,
    group: 'publishing',
  },
  {
    key: 'exclude',
    scope: 'package',
    type: 'array',
    label: 'Exclude files',
    labelZh: '排除文件',
    description: 'Comma-separated globs excluded from the package.',
    descriptionZh: '打包时排除的 glob，逗号分隔。',
    placeholder: 'target, tests/fixtures',
    inheritable: true,
    group: 'publishing',
  },
  {
    key: 'include',
    scope: 'package',
    type: 'array',
    label: 'Include files',
    labelZh: '包含文件',
    description: 'Comma-separated globs to include; replaces the default file set.',
    descriptionZh: '打包时包含的 glob，逗号分隔；设置后会替代默认文件集合。',
    placeholder: 'src/**, Cargo.toml',
    inheritable: true,
    group: 'publishing',
  },
  {
    key: 'build',
    scope: 'package',
    type: 'string',
    label: 'Build script',
    labelZh: '构建脚本',
    description: 'Path to a custom build script, e.g. build.rs.',
    descriptionZh: '自定义构建脚本路径，例如 build.rs。',
    placeholder: 'build.rs',
    group: 'build',
  },
  {
    key: 'links',
    scope: 'package',
    type: 'string',
    label: 'Native library link',
    labelZh: '原生库链接',
    description: 'Name of the native library this crate links to.',
    descriptionZh: '此 crate 链接的原生库名称。',
    placeholder: 'zlib',
    group: 'build',
  },
  {
    key: 'default-run',
    scope: 'package',
    type: 'string',
    label: 'Default binary',
    labelZh: '默认二进制',
    description: 'Binary target run by cargo run when several binaries exist.',
    descriptionZh: '存在多个 binary 时 cargo run 默认运行的目标。',
    placeholder: 'my-app',
    group: 'build',
  },
  {
    key: 'autobins',
    scope: 'package',
    type: 'boolean',
    label: 'Auto-discover binaries',
    labelZh: '自动发现 binary',
    description: 'Automatically discover binaries under src/bin.',
    descriptionZh: '自动发现 src/bin 下的 binary。',
    defaultValue: 'true',
    group: 'build',
  },
  {
    key: 'autoexamples',
    scope: 'package',
    type: 'boolean',
    label: 'Auto-discover examples',
    labelZh: '自动发现 examples',
    description: 'Automatically discover examples.',
    descriptionZh: '自动发现 examples。',
    defaultValue: 'true',
    group: 'build',
  },
  {
    key: 'autotests',
    scope: 'package',
    type: 'boolean',
    label: 'Auto-discover tests',
    labelZh: '自动发现 tests',
    description: 'Automatically discover integration tests.',
    descriptionZh: '自动发现集成测试。',
    defaultValue: 'true',
    group: 'build',
  },
  {
    key: 'autobenches',
    scope: 'package',
    type: 'boolean',
    label: 'Auto-discover benches',
    labelZh: '自动发现 benches',
    description: 'Automatically discover benchmarks.',
    descriptionZh: '自动发现 benchmark。',
    defaultValue: 'true',
    group: 'build',
  },
];

export const WORKSPACE_PROPERTIES: PropertyDescriptor[] = [
  {
    key: 'resolver',
    scope: 'workspace',
    type: 'enum',
    label: 'Feature resolver',
    labelZh: 'Feature resolver',
    description: 'Resolver version for feature unification. 2021+ editions use "2", 2024+ use "3".',
    descriptionZh: 'feature 统一解析的版本。2021+ edition 使用 "2"，2024+ 使用 "3"。',
    values: ['1', '2', '3'],
    risky: true,
    group: 'workspace',
  },
  {
    key: 'members',
    scope: 'workspace',
    type: 'array',
    label: 'Members',
    labelZh: '成员',
    description: 'Comma-separated member paths relative to the workspace root.',
    descriptionZh: '相对于 workspace 根目录的成员路径，逗号分隔。',
    placeholder: 'crates/app, crates/lib',
    group: 'workspace',
  },
  {
    key: 'default-members',
    scope: 'workspace',
    type: 'array',
    label: 'Default members',
    labelZh: '默认成员',
    description: 'Members built by cargo build/test when no package is selected.',
    descriptionZh: '未指定包时 cargo build/test 默认构建的成员。',
    placeholder: 'crates/app, crates/lib',
    group: 'workspace',
  },
  {
    key: 'exclude',
    scope: 'workspace',
    type: 'array',
    label: 'Excluded paths',
    labelZh: '排除路径',
    description: 'Paths excluded from workspace member discovery.',
    descriptionZh: 'workspace 成员发现时排除的路径。',
    placeholder: 'vendor, examples/legacy',
    group: 'workspace',
  },
];

export interface PropertyValue {
  key: string;
  scope: PropertyScope;
  value?: string;
  /** True when the member inherits this field from the workspace. */
  inherited?: boolean;
  /** Value available in [workspace.package], if any. */
  workspaceValue?: string;
  /** Where the value is written (`Cargo.toml`, `[workspace.package]`, …). */
  location: string;
  /** Per-member overrides across the workspace. */
  memberValues?: { member: string; value?: string; inherited: boolean }[];
}

export interface PropertiesModel {
  kind: 'workspace' | 'package';
  rootManifest: string;
  /** True when the root manifest itself carries a [package] table. */
  hasRootPackage: boolean;
  packageProperties: PropertyValue[];
  workspaceProperties: PropertyValue[];
  /** [workspace.package] values that members can inherit. */
  workspacePackageProperties: PropertyValue[];
  members: { name: string; manifestPath: string }[];
  hasWorkspacePackageTable: boolean;
  edition?: string;
  msrv?: string;
}

export async function readProperties(model: ProjectModel): Promise<PropertiesModel> {
  const rootText = await readTextFile(model.manifestPath).catch(() => '');
  const rootData = parseSafe(rootText) ?? {};
  const ws = (rootData.workspace ?? {}) as Record<string, unknown>;
  const wsPkg = (ws.package ?? {}) as Record<string, unknown>;
  const pkg = (rootData.package ?? {}) as Record<string, unknown>;
  const hasRootPackage = model.kind === 'package' || rootData.package !== undefined;

  const packageProperties = PACKAGE_PROPERTIES.map((descriptor) =>
    describePackageProperty(descriptor, pkg, wsPkg, model.kind === 'package' ? 'Cargo.toml' : '[workspace.package]'),
  );

  const workspaceProperties = WORKSPACE_PROPERTIES.map((descriptor) => ({
    key: descriptor.key,
    scope: 'workspace' as const,
    value: ws[descriptor.key] !== undefined ? formatValue(ws[descriptor.key]) : undefined,
    location: 'Cargo.toml [workspace]',
  }));

  const workspacePackageProperties: PropertyValue[] = PACKAGE_PROPERTIES.filter((descriptor) => descriptor.inheritable).map(
    (descriptor) => ({
      key: descriptor.key,
      scope: 'workspace' as const,
      value: wsPkg[descriptor.key] !== undefined ? formatValue(wsPkg[descriptor.key]) : undefined,
      location: 'Cargo.toml [workspace.package]',
    }),
  );

  if (model.kind === 'workspace') {
    // Read every member manifest once, then reuse the parsed package tables for
    // all descriptors instead of re-reading each file per property.
    const memberTables = await Promise.all(
      model.members.map(async (member) => {
        const text = await readTextFile(member.manifestPath).catch(() => '');
        const data = parseSafe(text) ?? {};
        return { member, pkg: (data.package ?? {}) as Record<string, unknown> };
      }),
    );
    for (const property of [...packageProperties, ...workspacePackageProperties]) {
      property.memberValues = memberTables.map(({ member, pkg: memberPkg }) => {
        const raw = memberPkg[property.key];
        const inherited = !!raw && typeof raw === 'object' && (raw as Record<string, unknown>).workspace === true;
        return {
          member: member.name,
          value: raw === undefined || inherited ? undefined : formatValue(raw),
          inherited,
        };
      });
    }
  }

  return {
    kind: model.kind,
    rootManifest: model.manifestPath,
    hasRootPackage,
    packageProperties,
    workspaceProperties,
    workspacePackageProperties,
    members: model.members.map((m) => ({ name: m.name, manifestPath: m.manifestPath })),
    hasWorkspacePackageTable: Object.keys(wsPkg).length > 0,
    edition: typeof pkg.edition === 'string' ? pkg.edition : typeof wsPkg.edition === 'string' ? wsPkg.edition : undefined,
    msrv: typeof pkg['rust-version'] === 'string' ? pkg['rust-version'] : typeof wsPkg['rust-version'] === 'string' ? wsPkg['rust-version'] : undefined,
  };
}

function describePackageProperty(
  descriptor: PropertyDescriptor,
  pkg: Record<string, unknown>,
  wsPkg: Record<string, unknown>,
  workspaceLocation: string,
): PropertyValue {
  const raw = pkg[descriptor.key];
  const inherited = !!raw && typeof raw === 'object' && (raw as Record<string, unknown>).workspace === true;
  const wsValue = wsPkg[descriptor.key] !== undefined ? formatValue(wsPkg[descriptor.key]) : undefined;
  return {
    key: descriptor.key,
    scope: 'package',
    value: raw === undefined || inherited ? undefined : formatValue(raw),
    inherited,
    workspaceValue: wsValue,
    location: inherited ? workspaceLocation : 'Cargo.toml [package]',
  };
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function parseSafe(text: string): Record<string, unknown> | undefined {
  try {
    return parseToml(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export interface PropertyEdit {
  manifestPath: string;
  /** `package` for [package], `workspace` for [workspace], `workspace.package` for inheritance. */
  target: 'package' | 'workspace' | 'workspace.package';
  key: string;
  /** Undefined deletes the key (reverting to inheritance). */
  value?: string;
  /** When true, write `key.workspace = true` instead of a literal value. */
  inherit?: boolean;
}

/** Apply property edits to a manifest, returning the new text. */
export function applyPropertyEdits(original: string, edits: PropertyEdit[]): string {
  // Apply one target group at a time so table creation and insertion points
  // are recomputed against the text produced by the previous group.
  let text = original;
  for (const target of ['package', 'workspace', 'workspace.package'] as const) {
    const group = edits.filter((edit) => edit.target === target);
    if (!group.length) continue;
    const editor = new TomlEditor(text);
    const collected = group.map((edit) => applyPropertyEdit(editor, edit));
    text = editor.apply(collected.flat());
  }
  return text;
}

function applyPropertyEdit(editor: TomlEditor, edit: PropertyEdit): ReturnType<TomlEditor['setKey']> {
  if (edit.target === 'workspace.package') {
    if (edit.value === undefined) return editor.removeKey('workspace.package', edit.key);
    return editor.setKey('workspace.package', edit.key, serializeForProperty(edit.key, edit.value));
  }

  if (edit.target === 'workspace') {
    if (edit.value === undefined) return editor.removeKey('workspace', edit.key);
    return editor.setKey('workspace', edit.key, serializeForProperty(edit.key, edit.value));
  }

  if (edit.inherit) {
    // Replace `key = "..."` with `key.workspace = true`.
    const collected = [];
    const loc = editor.getKey('package', edit.key);
    if (loc) collected.push(...editor.removeKey('package', edit.key));
    collected.push(...editor.setKey('package', [edit.key, 'workspace'], 'true'));
    return collected;
  }

  if (edit.value === undefined) return editor.removeKey('package', edit.key);
  // Writing a literal must also drop `key.workspace = true`; keeping both is
  // invalid TOML (a table and a value under the same key).
  const collected = [];
  const inherited = editor.getKey('package', [edit.key, 'workspace']);
  if (inherited) collected.push(...editor.removeKey('package', [edit.key, 'workspace']));
  collected.push(...editor.setKey('package', edit.key, serializeForProperty(edit.key, edit.value)));
  return collected;
}

const ARRAY_PROPERTY_KEYS = new Set(['authors', 'keywords', 'categories', 'exclude', 'include', 'members', 'default-members']);
const BOOLEAN_PROPERTY_KEYS = new Set(['autobins', 'autoexamples', 'autotests', 'autobenches']);

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function serializeForProperty(key: string, value: string): string {
  if (BOOLEAN_PROPERTY_KEYS.has(key)) return value === 'true' ? 'true' : 'false';
  if (ARRAY_PROPERTY_KEYS.has(key)) {
    return `[${splitList(value).map(quoteString).join(', ')}]`;
  }
  if (key === 'publish') {
    if (value === 'true' || value === 'false') return value;
    return `[${splitList(value).map(quoteString).join(', ')}]`;
  }
  if (key === 'readme' && (value === 'true' || value === 'false')) return value;
  return quoteString(value);
}

/** Validate a property value before writing. */
export function validateProperty(descriptor: PropertyDescriptor, value: string): string | undefined {
  const trimmed = value.trim();
  if (descriptor.type === 'version' && trimmed) {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/.test(trimmed)) {
      return t('"{0}" is not a valid Rust version (expected e.g. 1.75)', trimmed);
    }
  }
  if (descriptor.type === 'boolean' && trimmed && trimmed !== 'true' && trimmed !== 'false') {
    return t('"{0}" must be true or false', trimmed);
  }
  if (descriptor.type === 'enum' && descriptor.values && trimmed && !descriptor.values.includes(trimmed)) {
    return t('{0} must be one of {1}.', trimmed, descriptor.values.join(', '));
  }
  if (
    descriptor.key === 'version' &&
    trimmed &&
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(trimmed)
  ) {
    return t('"{0}" is not a valid SemVer version', trimmed);
  }
  if (descriptor.key === 'name' && trimmed && !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmed)) {
    return t('Crate names must start with a letter and contain only letters, digits, - or _');
  }
  if ((descriptor.key === 'keywords' || descriptor.key === 'categories') && splitList(trimmed).length > 5) {
    return t('Cargo allows at most 5 {0}', descriptor.key);
  }
  return undefined;
}

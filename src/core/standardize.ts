/**
 * Project standardization: detect configuration that belongs in dedicated
 * files, show a diff, then move it with a verification pass.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { createTwoFilesPatch } from 'diff';
import { readTextFile, relativePath } from './process.js';
import { TomlEditor, formatKeyPath, quoteString } from './toml/editor.js';
import type { ProjectModel } from './cargo/project.js';
import { unexpectedContainerEntries, workspaceContainers } from './files.js';
import { applyTopLevelOptionEdits, generateRustfmtToml, type RustfmtEdit } from './rustfmt.js';

export type FindingKind =
  | 'fmt-in-manifest'
  | 'fmt-missing'
  | 'lints-inline'
  | 'clippy-config-in-manifest'
  | 'workspace-container-content';

export interface ProposedChange {
  /** Absolute target path. */
  path: string;
  /** New content, computed from the original file. */
  content: string;
  /** Existing content, or undefined when the file will be created. */
  original?: string;
  /**
   * Re-applies this change to already-transformed text. Needed so several
   * findings that target the same manifest compose instead of overwriting
   * each other.
   */
  transform?: (current: string) => string;
  /** Why this file changes, shown above the diff. */
  reason: string;
  reasonZh: string;
}

export interface StandardizeFinding {
  id: string;
  kind: FindingKind;
  /** Short label for the checkbox row. */
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  manifestPath: string;
  /** Whether this finding can be auto-fixed. */
  fixable: boolean;
  changes: ProposedChange[];
}

export interface StandardizePlan {
  findings: StandardizeFinding[];
  ok: boolean;
}

export async function analyzeStandardization(model: ProjectModel): Promise<StandardizePlan> {
  const findings: StandardizeFinding[] = [];
  const rootManifest = await readTextFile(model.manifestPath).catch(() => '');
  const rootData = safeParse(rootManifest);
  const pkg = (rootData?.package as Record<string, unknown> | undefined) ?? {};
  const cargoMetadata = pkg.metadata as Record<string, unknown> | undefined;

  // 1. rustfmt config living inside Cargo.toml metadata.
  const fmtInMetadata = cargoMetadata?.rustfmt;
  if (fmtInMetadata && typeof fmtInMetadata === 'object') {
    const rustfmtPath = path.join(model.root, 'rustfmt.toml');
    const rustfmtOriginal = await readTextFile(rustfmtPath).catch(() => undefined);
    findings.push({
      id: 'fmt-metadata',
      kind: 'fmt-in-manifest',
      title: 'Move rustfmt options out of Cargo.toml',
      titleZh: '将 rustfmt 选项移出 Cargo.toml',
      description: 'rustfmt options are stored under [package.metadata.rustfmt]; move them to rustfmt.toml.',
      descriptionZh: 'rustfmt 选项位于 [package.metadata.rustfmt]，建议迁移到 rustfmt.toml。',
      manifestPath: model.manifestPath,
      fixable: true,
      changes: [
        {
          path: rustfmtPath,
          content: rustfmtFromMetadata(fmtInMetadata as Record<string, unknown>, rustfmtOriginal),
          original: rustfmtOriginal,
          reason: 'Create rustfmt.toml from metadata',
          reasonZh: '根据元数据生成 rustfmt.toml',
        },
        {
          path: model.manifestPath,
          content: removeTables(rootManifest, ['package.metadata.rustfmt']),
          transform: (current) => removeTables(current, ['package.metadata.rustfmt']),
          original: rootManifest,
          reason: 'Remove the metadata table',
          reasonZh: '移除原 metadata 表',
        },
      ],
    });
  }

  // 2. No rustfmt config at all.
  if (!model.rustfmtFile && !fmtInMetadata) {
    const rustfmtPath = path.join(model.root, 'rustfmt.toml');
    findings.push({
      id: 'fmt-missing',
      kind: 'fmt-missing',
      title: 'Create a recommended rustfmt.toml',
      titleZh: '生成推荐的 rustfmt.toml',
      description: 'No rustfmt.toml found; a conservative recommended config can be created.',
      descriptionZh: '未找到 rustfmt.toml，可生成保守的推荐配置。',
      manifestPath: model.manifestPath,
      fixable: true,
      changes: [
        {
          path: rustfmtPath,
          content: generateRustfmtToml({
            edition: typeof pkg.edition === 'string' ? pkg.edition : undefined,
            includeImportsGranularity: true,
          }),
          original: undefined,
          reason: 'Create rustfmt.toml',
          reasonZh: '创建 rustfmt.toml',
        },
      ],
    });
  }

  // 3. Lints declared inline in a single package, with no workspace table yet.
  const lints = rootData?.lints as Record<string, unknown> | undefined;
  if (lints && model.kind === 'package') {
    const updated = migrateLintsToWorkspace(rootManifest);
    if (updated !== rootManifest) {
      findings.push({
        id: 'lints-inline',
        kind: 'lints-inline',
        title: 'Centralize lint levels as workspace lints',
        titleZh: '将 lint 级别收敛为 workspace lints',
        description: 'Lint levels are declared inline; workspace lints can centralize them for future members.',
        descriptionZh: 'lint 级别内联在清单中；workspace lints 可集中管理并为将来的成员复用。',
        manifestPath: model.manifestPath,
        fixable: true,
        changes: [
          {
            path: model.manifestPath,
            content: updated,
            transform: (current) => migrateLintsToWorkspace(current),
            original: rootManifest,
            reason: 'Move [lints.*] to [workspace.lints.*]',
            reasonZh: '将 [lints.*] 迁移为 [workspace.lints.*]',
          },
        ],
      });
    }
  }

  // 4. clippy behavior config inline.
  const clippyMetadata = cargoMetadata?.clippy;
  if (clippyMetadata && typeof clippyMetadata === 'object') {
    const clippyPath = path.join(model.root, 'clippy.toml');
    const clippyOriginal = await readTextFile(clippyPath).catch(() => undefined);
    findings.push({
      id: 'clippy-metadata',
      kind: 'clippy-config-in-manifest',
      title: 'Move clippy configuration to clippy.toml',
      titleZh: '将 clippy 配置迁移到 clippy.toml',
      description: 'clippy configuration lives under [package.metadata.clippy]; move it to clippy.toml.',
      descriptionZh: 'clippy 配置位于 [package.metadata.clippy]，建议迁移到 clippy.toml。',
      manifestPath: model.manifestPath,
      fixable: true,
      changes: [
        {
          path: clippyPath,
          content: clippyTomlFromMetadata(clippyMetadata as Record<string, unknown>, clippyOriginal),
          original: clippyOriginal,
          reason: 'Create clippy.toml from metadata',
          reasonZh: '根据元数据生成 clippy.toml',
        },
        {
          path: model.manifestPath,
          content: removeTables(rootManifest, ['package.metadata.clippy']),
          transform: (current) => removeTables(current, ['package.metadata.clippy']),
          original: rootManifest,
          reason: 'Remove the metadata table',
          reasonZh: '移除原 metadata 表',
        },
      ],
    });
  }

  // 5. A member container (`crates`, `packages`, …) that holds entries no
  //    member accounts for. The project view still shows its stray files, but
  //    the structure is ambiguous, so this is reported without an auto-fix.
  if (model.kind === 'workspace') {
    const containers = workspaceContainers(
      model.root,
      model.members.map((member) => member.dir),
    );
    for (const container of containers) {
      let entries: { name: string; isDirectory: boolean }[];
      try {
        entries = (await fs.readdir(container.dir, { withFileTypes: true })).map((entry) => ({
          name: entry.name,
          isDirectory: entry.isDirectory(),
        }));
      } catch {
        continue;
      }
      const stray = unexpectedContainerEntries(container, entries);
      if (!stray.length) continue;
      const names = stray.map((entry) => (entry.isDirectory ? `${entry.name}/` : entry.name)).sort();
      findings.push({
        id: `container:${container.name}`,
        kind: 'workspace-container-content',
        title: `Workspace container "${container.name}" contains entries outside members`,
        titleZh: `成员容器目录 “${container.name}” 含有非成员内容`,
        description: `The project view lists only files here. Decide what belongs there: ${names.join(', ')}.`,
        descriptionZh: `项目视图在此处只显示文件，请自行决定这些条目的去留：${names.join('、')}。`,
        manifestPath: model.manifestPath,
        fixable: false,
        changes: [],
      });
    }
  }

  return { findings, ok: findings.length === 0 };
}

function safeParse(text: string): Record<string, unknown> | undefined {
  try {
    return parseToml(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function rustfmtFromMetadata(metadata: Record<string, unknown>, original?: string): string {
  if (original !== undefined) {
    // Existing options (comments, ordering and unrelated keys) are preserved;
    // metadata only adds or updates the keys it owns.
    return applyTopLevelOptionEdits(original, metadataEdits(metadata));
  }
  const lines: string[] = ['# Generated by Rust Forge from Cargo.toml metadata', ''];
  for (const [key, value] of Object.entries(metadata)) {
    const serialized = serializeValue(value);
    if (serialized !== undefined) {
      lines.push(`${formatKeyPath([key])} = ${serialized}`);
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}

function clippyTomlFromMetadata(metadata: Record<string, unknown>, original?: string): string {
  if (original !== undefined) {
    return applyTopLevelOptionEdits(original, metadataEdits(metadata));
  }
  const lines: string[] = ['# Generated by Rust Forge from Cargo.toml metadata', ''];
  for (const [key, value] of Object.entries(metadata)) {
    const serialized = serializeValue(value);
    if (serialized !== undefined) {
      // clippy.toml keys are already kebab-case in the manifest form.
      lines.push(`${key} = ${serialized}`);
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}

/** Metadata values that can be written by the top-level option editor. */
function metadataEdits(metadata: Record<string, unknown>): RustfmtEdit[] {
  const edits: RustfmtEdit[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      edits.push({ key, value });
    } else if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
      edits.push({ key, value: value as string[] });
    }
  }
  return edits;
}

function serializeValue(value: unknown): string | undefined {
  if (typeof value === 'string') return quoteString(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    const items = value.map(serializeValue);
    if (items.some((v) => v === undefined)) return undefined;
    return `[${items.join(', ')}]`;
  }
  return undefined;
}

/** Rewrite inline `[lints.*]` into workspace-inheritable form. */
export function migrateLintsToWorkspace(manifestText: string): string {
  const data = safeParse(manifestText);
  const lints = data?.lints as Record<string, unknown> | undefined;
  if (!lints) return manifestText;

  const editor = new TomlEditor(manifestText);
  const blocks: string[] = [];
  for (const group of Object.keys(lints)) {
    const table = lints[group];
    if (!table || typeof table !== 'object' || Array.isArray(table)) continue;
    const lines = [`[workspace.lints.${group}]`];
    for (const [key, value] of Object.entries(table as Record<string, unknown>)) {
      const serialized = serializeValue(value);
      if (serialized !== undefined) lines.push(`${formatKeyPath([key])} = ${serialized}`);
    }
    if (lines.length > 1) blocks.push(lines.join('\n'));
  }
  if (!blocks.length) return manifestText;

  const edits = removeTablesEdits(editor, ['lints']);
  // The package still has to opt in; without `[lints] workspace = true` the
  // moved levels are inert.
  // A child table such as `[workspace.package]` already implies `[workspace]`;
  // appending an explicit parent afterwards would be a TOML redefinition.
  const hasWorkspace = editor.hasTable('workspace') || editor.getChildTables('workspace').length > 0;
  const base = editor.apply(edits);
  const sections: string[] = [];
  if (!hasWorkspace) sections.push('[workspace]');
  sections.push('[lints]\nworkspace = true');
  sections.push(...blocks);
  const prefix = base.endsWith('\n\n') ? '' : base.endsWith('\n') ? editor.eol : editor.eol + editor.eol;
  return normalize(`${base}${prefix}${sections.join('\n\n')}\n`);
}

function removeTables(manifestText: string, tables: string[]): string {
  const editor = new TomlEditor(manifestText);
  const edits = removeTablesEdits(editor, tables);
  return normalize(editor.apply(edits));
}

function removeTablesEdits(editor: TomlEditor, tables: string[]) {
  const edits = [];
  for (const table of tables) {
    for (const info of editor.getTables()) {
      if (info.name === table || info.name.startsWith(`${table}.`)) {
        edits.push(...editor.removeTable(info.name));
      }
    }
  }
  return edits;
}

/**
 * Collapse runs of blank lines without touching multiline string values.
 * A blind `\n{3,}` replace would rewrite the contents of `"""..."""`.
 */
function normalize(text: string): string {
  let result = '';
  let index = 0;
  while (index < text.length) {
    if (text.startsWith('"""', index)) {
      const end = text.indexOf('"""', index + 3);
      const stop = end < 0 ? text.length : end + 3;
      result += text.slice(index, stop);
      index = stop;
      continue;
    }
    if (text.startsWith("'''", index)) {
      const end = text.indexOf("'''", index + 3);
      const stop = end < 0 ? text.length : end + 3;
      result += text.slice(index, stop);
      index = stop;
      continue;
    }
    const ch = text[index];
    if (ch === '"' || ch === "'") {
      // Single-line string: copy it verbatim, honoring escapes.
      let stop = index + 1;
      while (stop < text.length && text[stop] !== ch) {
        stop += ch === '"' && text[stop] === '\\' ? 2 : 1;
      }
      stop = Math.min(stop + 1, text.length);
      result += text.slice(index, stop);
      index = stop;
      continue;
    }
    if (ch === '\n') {
      let run = index;
      while (text[run] === '\n') run++;
      result += '\n'.repeat(Math.min(run - index, 2));
      index = run;
      continue;
    }
    result += ch;
    index += 1;
  }
  return result.trimEnd() + '\n';
}

export interface StandardizeApplyOptions {
  root: string;
  findings: StandardizeFinding[];
  dryRun: boolean;
}

export interface StandardizeChangePreview {
  path: string;
  diff: string;
  newContent: string;
  original?: string;
}

/** Compute the diffs for the selected findings. */
export function previewStandardization(root: string, findings: StandardizeFinding[]): StandardizeChangePreview[] {
  // Several findings can target the same manifest. Each manifest change is
  // re-applied to the accumulated text so both survive; a plain "last writer
  // wins" would silently discard the earlier extraction.
  const byPath = new Map<string, StandardizeChangePreview>();
  const contents = new Map<string, string>();
  for (const finding of findings) {
    for (const change of finding.changes) {
      const current = contents.get(change.path) ?? change.original ?? '';
      const next = change.transform ? change.transform(current) : change.content;
      contents.set(change.path, next);

      const earlier = byPath.get(change.path);
      const original = earlier?.original ?? change.original;
      byPath.set(change.path, {
        path: change.path,
        original,
        newContent: next,
        diff: createTwoFilesPatch(
          relativePath(root, change.path),
          relativePath(root, change.path),
          original ?? '',
          next,
          original === undefined ? 'absent' : 'before',
          'after',
        ),
      });
    }
  }
  return [...byPath.values()];
}

/** Apply the selected findings. */
export async function applyStandardization(options: StandardizeApplyOptions): Promise<{ changes: StandardizeChangePreview[] }> {
  const changes = previewStandardization(options.root, options.findings);
  if (!options.dryRun) {
    for (const change of changes) {
      await fs.mkdir(path.dirname(change.path), { recursive: true });
      await fs.writeFile(change.path, change.newContent, 'utf8');
    }
  }
  return { changes };
}

/** Find lints in member manifests that override the workspace set. */
export async function memberLintOverrides(model: ProjectModel): Promise<{ member: string; groups: string[] }[]> {
  if (model.kind !== 'workspace') return [];
  const result: { member: string; groups: string[] }[] = [];
  for (const member of model.members) {
    const text = await readTextFile(member.manifestPath).catch(() => '');
    const data = safeParse(text);
    const lints = data?.lints as Record<string, unknown> | undefined;
    if (!lints) continue;
    const groups = Object.keys(lints).filter((k) => k !== 'workspace');
    if (groups.length) result.push({ member: member.name, groups });
  }
  return result;
}

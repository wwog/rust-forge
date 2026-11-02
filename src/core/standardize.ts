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
import { generateRustfmtToml } from './rustfmt.js';

export type FindingKind = 'fmt-in-manifest' | 'fmt-missing' | 'lints-inline' | 'clippy-config-in-manifest';

export interface ProposedChange {
  /** Absolute target path. */
  path: string;
  /** New content. */
  content: string;
  /** Existing content, or undefined when the file will be created. */
  original?: string;
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
          content: rustfmtFromMetadata(fmtInMetadata as Record<string, unknown>),
          original: await readTextFile(rustfmtPath).catch(() => undefined),
          reason: 'Create rustfmt.toml from metadata',
          reasonZh: '根据元数据生成 rustfmt.toml',
        },
        {
          path: model.manifestPath,
          content: removeTables(rootManifest, ['package.metadata.rustfmt']),
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
          content: clippyTomlFromMetadata(clippyMetadata as Record<string, unknown>),
          original: await readTextFile(clippyPath).catch(() => undefined),
          reason: 'Create clippy.toml from metadata',
          reasonZh: '根据元数据生成 clippy.toml',
        },
        {
          path: model.manifestPath,
          content: removeTables(rootManifest, ['package.metadata.clippy']),
          original: rootManifest,
          reason: 'Remove the metadata table',
          reasonZh: '移除原 metadata 表',
        },
      ],
    });
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

function rustfmtFromMetadata(metadata: Record<string, unknown>): string {
  const lines: string[] = ['# Generated by Rust Forge from Cargo.toml metadata', ''];
  for (const [key, value] of Object.entries(metadata)) {
    const serialized = serializeValue(value);
    if (serialized !== undefined) {
      lines.push(`${formatKeyPath([key])} = ${serialized}`);
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}

function clippyTomlFromMetadata(metadata: Record<string, unknown>): string {
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
  // The member now inherits instead of declaring its own levels.
  const hasWorkspace = editor.hasTable('workspace');
  const tail = blocks.join('\n\n');
  if (hasWorkspace) {
    const text = editor.apply(edits);
    const prefix = text.endsWith('\n\n') ? '' : text.endsWith('\n') ? editor.eol : editor.eol + editor.eol;
    return normalize(`${text}${prefix}${tail}\n`);
  }
  const base = editor.apply(edits);
  const prefix = base.endsWith('\n\n') ? '' : base.endsWith('\n') ? editor.eol : editor.eol + editor.eol;
  return normalize(`${base}${prefix}[workspace]${editor.eol}${editor.eol}${tail}\n`);
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

function normalize(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
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
  // Later findings win when two would write the same file, so run the merge on
  // a path-keyed map rather than emitting duplicate writes.
  const byPath = new Map<string, StandardizeChangePreview>();
  for (const finding of findings) {
    for (const change of finding.changes) {
      const before = byPath.get(change.path)?.newContent ?? change.original ?? '';
      byPath.set(change.path, {
        path: change.path,
        original: change.original,
        newContent: change.content,
        diff: createTwoFilesPatch(
          relativePath(root, change.path),
          relativePath(root, change.path),
          before,
          change.content,
          change.original === undefined ? 'absent' : 'before',
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

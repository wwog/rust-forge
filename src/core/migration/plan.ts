/**
 * Cargo manifest construction for the single-package -> workspace conversion.
 *
 * Kept pure: it takes parsed data plus text and returns the exact new file
 * contents and a move plan. Nothing here touches disk, so dry-run and apply
 * share one code path.
 */
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { TomlEditor, formatKeyPath, quoteString } from '../toml/editor.js';
import { declarationTablePath, type DependencyDeclaration } from '../cargo/manifestDeps.js';

export interface InheritableField {
  key: string;
  /** Extract this field to `[workspace.package]` by default. */
  defaultExtract: boolean;
}

/**
 * Fields Cargo allows to be inherited from `[workspace.package]`.
 * `name` and `description` are naturally crate-specific so they default off.
 */
export const INHERITABLE_FIELDS: InheritableField[] = [
  { key: 'version', defaultExtract: true },
  { key: 'edition', defaultExtract: true },
  { key: 'rust-version', defaultExtract: true },
  { key: 'authors', defaultExtract: true },
  { key: 'license', defaultExtract: true },
  { key: 'license-file', defaultExtract: false },
  { key: 'repository', defaultExtract: false },
  { key: 'homepage', defaultExtract: false },
  { key: 'documentation', defaultExtract: false },
  { key: 'readme', defaultExtract: false },
  { key: 'keywords', defaultExtract: false },
  { key: 'categories', defaultExtract: false },
  { key: 'publish', defaultExtract: false },
  { key: 'include', defaultExtract: false },
  { key: 'exclude', defaultExtract: false },
];

/** Files/dirs that stay at the repository root rather than moving into the member. */
export const ROOT_KEEP = [
  'README.md',
  'README',
  'LICENSE',
  'LICENSE.md',
  'LICENSE-APACHE',
  'LICENSE-MIT',
  '.gitignore',
  '.gitattributes',
  '.gitmodules',
  '.github',
  '.gitlab-ci.yml',
  '.travis.yml',
  'rustfmt.toml',
  '.rustfmt.toml',
  'rust-toolchain.toml',
  'rust-toolchain',
  'clippy.toml',
  '.clippy.toml',
  'deny.toml',
  'Cargo.lock',
  'target',
];

/** Package-relative paths that must move with the crate. */
export const PACKAGE_ENTRIES = ['Cargo.toml', 'src', 'tests', 'benches', 'examples', 'build.rs'];

export interface LintExtraction {
  table: 'lints.clippy' | 'lints.rust';
  name: string;
  level: string;
}

export interface PromotedDependency {
  name: string;
  /** Serialized TOML value for `[workspace.dependencies]`. */
  workspaceValue: string;
  /** Serialized member-side value referencing the workspace entry. */
  memberValue: string;
  features: string[];
  reason?: string;
}

export interface KeptDependency {
  name: string;
  table: 'dependencies' | 'dev-dependencies' | 'build-dependencies';
  reason: string;
}

export interface MigrationPlanInput {
  packageName: string;
  rootManifestText: string;
  readmeHandling: 'keep' | 'copy';
  extractFields: string[];
  resolver?: string;
  /** Workspace root, used to recompute path dependencies. */
  workspaceRoot?: string;
  /** Absolute directory the package currently lives in. */
  packageDir?: string;
  /** Absolute directory the package will live in after the move. */
  targetDir?: string;
}

export interface MigrationPlan {
  workspaceManifest: string;
  memberManifest: string;
  promoted: PromotedDependency[];
  kept: KeptDependency[];
  extractedFields: string[];
  resolver: string;
  notes: string[];
}

export function chooseResolver(edition: string | undefined): string {
  if (!edition) return '2';
  const year = Number(edition);
  if (Number.isFinite(year) && year >= 2024) return '3';
  if (Number.isFinite(year) && year >= 2021) return '2';
  return '1';
}

/**
 * Compare dependency declarations to decide promotion.
 *
 * A dependency is promoted when its requirement is identical across every
 * member that declares it and no semantic modifiers (optional, git branch, …)
 * conflict. Cargo forbids `optional` in `[workspace.dependencies]`, so optional
 * deps keep their requirement in the workspace table and set `optional` on the
 * member side.
 */
export function evaluatePromotion(decls: DependencyDeclaration[]): { promoted: Map<string, PromotedDependency>; kept: KeptDependency[] } {
  const byPackage = new Map<string, DependencyDeclaration[]>();
  for (const decl of decls) {
    const list = byPackage.get(decl.packageName) ?? [];
    list.push(decl);
    byPackage.set(decl.packageName, list);
  }

  const promoted = new Map<string, PromotedDependency>();
  const kept: KeptDependency[] = [];

  for (const [name, group] of byPackage) {
    const reasons: string[] = [];
    if (group.length === 1) {
      // Single declaration: promoting is still useful for future members, but
      // path deps keep their relative layout.
      const only = group[0];
      if (only.kind === 'path') {
        reasons.push('path dependency keeps its relative location');
      }
    }

    const kinds = new Set(group.map((g) => g.kind));
    if (kinds.size > 1) {
      reasons.push('mixed declaration kinds');
    }

    const versions = new Set(group.map((g) => g.version ?? ''));
    if (group.every((g) => g.kind === 'registry') && versions.size > 1) {
      reasons.push('conflicting version requirements');
    }

    const gitRefs = new Set(group.map((g) => `${g.git ?? ''}#${g.branch ?? g.tag ?? g.rev ?? ''}`));
    if (group.some((g) => g.kind === 'git') && gitRefs.size > 1) {
      reasons.push('conflicting git references');
    }

    const tables = new Set(group.map((g) => g.table));
    const kindsOfTables = tables.size;
    if (kindsOfTables > 1) {
      reasons.push('declared in different dependency tables');
    }

    if (reasons.length) {
      for (const decl of group) {
        kept.push({ name: decl.packageName, table: decl.table, reason: reasons.join('; ') });
      }
      continue;
    }

    const sample = group[0];
    if (sample.kind === 'workspace') {
      // Already inheriting from a workspace, nothing to promote.
      continue;
    }

    const mergedFeatures = [...new Set(group.flatMap((g) => g.features))].sort();
    const workspaceValue = serializeWorkspaceDependency(sample);
    const memberValue = serializeMemberDependency(sample, mergedFeatures);
    promoted.set(name, {
      name,
      workspaceValue,
      memberValue,
      features: mergedFeatures,
      reason: reasons.length ? reasons.join('; ') : undefined,
    });
  }

  return { promoted, kept };
}

function serializeWorkspaceDependency(decl: DependencyDeclaration): string {
  if (decl.kind === 'registry' && !decl.features.length && decl.defaultFeatures !== false && versionIsSimple(decl.version)) {
    return quoteString(decl.version ?? '*');
  }
  const parts: string[] = [];
  if (decl.kind === 'path') parts.push(`path = ${quoteString(decl.path ?? '')}`);
  else if (decl.kind === 'git') {
    parts.push(`git = ${quoteString(decl.git ?? '')}`);
    if (decl.branch) parts.push(`branch = ${quoteString(decl.branch)}`);
    if (decl.tag) parts.push(`tag = ${quoteString(decl.tag)}`);
    if (decl.rev) parts.push(`rev = ${quoteString(decl.rev)}`);
  } else if (decl.version) {
    parts.push(`version = ${quoteString(decl.version)}`);
  }
  if (decl.features.length) parts.push(`features = [${decl.features.map(quoteString).join(', ')}]`);
  if (decl.defaultFeatures === false) parts.push('default-features = false');
  if (decl.defaultFeatures === true) parts.push('default-features = true');
  return `{ ${parts.join(', ')} }`;
}

function serializeMemberDependency(decl: DependencyDeclaration, extraFeatures: string[]): string {
  const parts: string[] = ['workspace = true'];
  const baseFeatures = new Set(decl.features);
  const extra = extraFeatures.filter((f) => !baseFeatures.has(f));
  if (extra.length) parts.push(`features = [${extra.map(quoteString).join(', ')}]`);
  if (decl.optional) parts.push('optional = true');
  return parts.length === 1 ? '{ workspace = true }' : `{ ${parts.join(', ')} }`;
}

function versionIsSimple(version: string | undefined): boolean {
  return !!version && !version.includes('{') && !version.includes('\n');
}

/** Build the new root manifest and rewritten member manifest. */
export function planMigration(input: MigrationPlanInput): MigrationPlan {
  const rootManifest = parseToml(input.rootManifestText) as Record<string, unknown>;
  const pkg = (rootManifest.package ?? {}) as Record<string, unknown>;
  const packageName = input.packageName || String(pkg.name ?? 'crate');
  const resolver = input.resolver ?? chooseResolver(typeof pkg.edition === 'string' ? pkg.edition : undefined);

  const decls = collectDeclarations(input.rootManifestText);
  const { promoted, kept } = evaluatePromotion(decls);

  const pathRemaps = computePathRemaps(decls, input);

  const extracted = input.extractFields.filter((field) => field in pkg);
  const rootLines: string[] = [];
  const notes: string[] = [];

  rootLines.push('[workspace]');
  rootLines.push('members = ["crates/*"]');
  rootLines.push(`resolver = ${quoteString(resolver)}`);
  rootLines.push('');

  if (extracted.length) {
    rootLines.push('[workspace.package]');
    for (const field of extracted) {
      const value = serializeFieldValue(pkg[field], field);
      if (value === undefined) {
        notes.push(`Skipped ${field}: value type is not inheritable`);
        continue;
      }
      rootLines.push(`${field} = ${value}`);
    }
    rootLines.push('');
  }

  if (promoted.size) {
    rootLines.push('[workspace.dependencies]');
    for (const dep of [...promoted.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      rootLines.push(`${formatKeyPath([dep.name])} = ${dep.workspaceValue}`);
    }
    rootLines.push('');
  }

  // Lints move with the root so members can inherit them.
  const lints = extractLints(rootManifest);
  if (lints.workspaceBlocks.length) {
    rootLines.push(...lints.workspaceBlocks, '');
  }

  const workspaceManifest = normalizeBlock(rootLines.join('\n'));

  const memberManifest = rewriteMemberManifest({
    original: input.rootManifestText,
    extractFields: extracted,
    promoted,
    readmeHandling: input.readmeHandling,
    lintsInherit: lints.workspaceBlocks.length > 0,
    pathRemaps,
  });

  for (const remap of pathRemaps) {
    notes.push(`Path dependency "${remap.name}": ${remap.oldPath} -> ${remap.newPath}`);
  }

  return {
    workspaceManifest,
    memberManifest,
    promoted: [...promoted.values()],
    kept,
    extractedFields: extracted,
    resolver,
    notes,
  };
}

interface RewriteInput {
  original: string;
  extractFields: string[];
  promoted: Map<string, PromotedDependency>;
  readmeHandling: 'keep' | 'copy';
  lintsInherit: boolean;
  pathRemaps: {
    name: string;
    table: 'dependencies' | 'dev-dependencies' | 'build-dependencies';
    target?: string;
    oldPath: string;
    newPath: string;
  }[];
}

/** Swap the `path` value inside a dependency's inline table or table entry. */
function remapPathInValue(rawValue: string, oldPath: string, newPath: string): string | undefined {
  if (rawValue.includes('{')) {
    const replaced = rawValue.replace(/(path\s*=\s*)"([^"]*)"/, (_, prefix: string, current: string) =>
      current === oldPath ? `${prefix}${JSON.stringify(newPath)}` : `${prefix}${JSON.stringify(current)}`,
    );
    return replaced !== rawValue ? replaced : undefined;
  }
  return undefined;
}

function rewriteMemberManifest(input: RewriteInput): string {
  const editor = new TomlEditor(input.original);
  const edits = [];

  for (const field of input.extractFields) {
    if (editor.hasKey('package', field)) {
      // Convert `field = "value"` into `field.workspace = true`.
      const loc = editor.getKey('package', field)!;
      const lineStart = editor.text.lastIndexOf('\n', loc.statement.start - 1) + 1;
      const lineEnd = editor.text.indexOf('\n', loc.statement.end);
      const indentMatch = editor.text.slice(lineStart, loc.statement.start).match(/^\s*/);
      const indent = indentMatch?.[0] ?? '';
      edits.push({
        start: lineStart,
        end: lineEnd < 0 ? editor.text.length : lineEnd,
        text: `${indent}${formatKeyPath([field, 'workspace'])} = true`,
      });
    }
  }

  // Point readme/license at the root copies when they stay there.
  if (input.readmeHandling === 'keep') {
    for (const field of ['readme', 'license-file']) {
      if (editor.hasKey('package', field) && !input.extractFields.includes(field)) {
        const value = editor.getValue('package', field);
        if (value && value.startsWith('"')) {
          const current = JSON.parse(value) as string;
          if (!current.includes('/') && current !== 'false') {
            edits.push(...editor.setKey('package', field, JSON.stringify(`../../${current}`)));
          }
        }
      }
    }
  }

  // Recompute relative path dependencies for the deeper location. Target
  // specific tables must be addressed separately: the same dependency name can
  // appear in both `[dependencies]` and `[target.'cfg(...)'.dependencies]`.
  for (const remap of input.pathRemaps) {
    const table = declarationTablePath({ table: remap.table, target: remap.target });
    if (!editor.hasKey(table, remap.name)) continue;
    const value = editor.getValue(table, remap.name);
    if (!value) continue;
    const rewritten = remapPathInValue(value, remap.oldPath, remap.newPath);
    if (rewritten) edits.push(...editor.setKey(table, remap.name, rewritten));
  }

  if (input.lintsInherit) {
    // Cargo rejects a member that both inherits workspace lints and defines
    // its own `[lints.*]` tables, so the local tables are replaced by the
    // inheritance switch.
    const block = '[lints]\nworkspace = true\n';
    const lintsSpans = lintsTableSpans(editor);
    if (lintsSpans.length) {
      const start = lintsSpans[0].start;
      const end = lintsSpans[lintsSpans.length - 1].end;
      edits.push({ start, end, text: block });
    } else {
      const insertAt = editor.text.endsWith('\n') ? editor.text.length : editor.text.length;
      const prefix = editor.text.length && !editor.text.endsWith('\n\n') ? editor.eol : '';
      edits.push({ start: insertAt, end: insertAt, text: prefix + block });
    }
  }

  for (const [name, dep] of input.promoted) {
    for (const table of ['dependencies', 'dev-dependencies', 'build-dependencies'] as const) {
      if (editor.hasKey(table, name)) {
        edits.push(...editor.setKey(table, name, dep.memberValue));
        break;
      }
    }
  }

  return editor.apply(edits);
}

/**
 * Move `[lints.clippy]` / `[lints.rust]` into workspace form when the source
 * manifest already declares lints. Returns ready-made TOML blocks.
 */
export function extractLints(manifest: Record<string, unknown>): { workspaceBlocks: string[]; memberBlock?: string } {
  const lints = manifest.lints as Record<string, unknown> | undefined;
  if (!lints || typeof lints !== 'object') return { workspaceBlocks: [] };
  const blocks: string[] = [];
  for (const group of ['clippy', 'rust'] as const) {
    const table = lints[group];
    if (!table || typeof table !== 'object' || Array.isArray(table)) continue;
    const lines = [`[workspace.lints.${group}]`];
    for (const [key, value] of Object.entries(table as Record<string, unknown>)) {
      const serialized = serializeFieldValue(value, key);
      if (serialized !== undefined) lines.push(`${formatKeyPath([key])} = ${serialized}`);
    }
    if (lines.length > 1) blocks.push(lines.join('\n'));
  }
  return { workspaceBlocks: blocks, memberBlock: blocks.length ? '[lints]\nworkspace = true\n' : undefined };
}

function collectDeclarations(text: string): DependencyDeclaration[] {
  // Local import avoids a cycle with the editor module at load time.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parseDependencies } = require('../cargo/manifestDeps.js') as typeof import('../cargo/manifestDeps.js');
  return parseDependencies(text, 'Cargo.toml');
}

/**
 * Path dependencies resolve relative to the manifest, so nesting the package
 * one directory deeper changes their meaning. Recompute each one.
 */
function computePathRemaps(
  decls: DependencyDeclaration[],
  input: MigrationPlanInput,
): {
  name: string;
  table: 'dependencies' | 'dev-dependencies' | 'build-dependencies';
  target?: string;
  oldPath: string;
  newPath: string;
}[] {
  if (!input.workspaceRoot || !input.packageDir || !input.targetDir) return [];
  const remaps: ReturnType<typeof computePathRemaps> = [];
  for (const decl of decls) {
    if (decl.kind !== 'path' || !decl.path || path.isAbsolute(decl.path)) continue;
    const absolute = path.resolve(input.packageDir, decl.path);
    const insidePackage = !path.relative(input.packageDir, absolute).startsWith('..');
    if (insidePackage) {
      // The target lives inside the package, so it moves with it and the
      // relative path keeps working.
      continue;
    }
    const newRelative = path.relative(input.targetDir, absolute).split(path.sep).join('/');
    if (newRelative !== decl.path) {
      remaps.push({
        name: decl.key,
        table: decl.table,
        target: decl.target,
        oldPath: decl.path,
        newPath: newRelative || '.',
      });
    }
  }
  return remaps;
}

/** Byte spans covering the whole `[lints]` / `[lints.*]` block. */
function lintsTableSpans(editor: TomlEditor): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  for (const table of editor.getTables()) {
    if (table.name !== 'lints' && !table.name.startsWith('lints.')) continue;
    const header = editor.statements[table.headerIndex];
    if (!header) continue;
    const start = editor.text.lastIndexOf('\n', header.start - 1) + 1;
    const bodyEnd = table.bodyEnd;
    const trimmedEnd = (() => {
      let end = bodyEnd;
      while (end > start) {
        const lineStart = editor.text.lastIndexOf('\n', end - 2) + 1;
        if (editor.text.slice(lineStart, end).trim() !== '') break;
        end = lineStart;
      }
      return end;
    })();
    spans.push({ start, end: trimmedEnd });
  }
  return spans.sort((a, b) => a.start - b.start);
}

export function serializeFieldValue(value: unknown, key?: string): string | undefined {
  if (typeof value === 'string') return quoteString(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    const items = value.map((v) => serializeFieldValue(v, key));
    if (items.some((v) => v === undefined)) return undefined;
    return `[${items.join(', ')}]`;
  }
  return undefined;
}

function normalizeBlock(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** Detect path dependencies that would need rewriting after the move. */
export function pathDependenciesNeedingRewrite(decls: DependencyDeclaration[]): DependencyDeclaration[] {
  return decls.filter((decl) => {
    if (decl.kind !== 'path' || !decl.path) return false;
    const resolved = path.resolve(path.dirname(decl.manifestPath), decl.path);
    // Any path that leaves the package directory changes when nested one level
    // deeper unless it starts with `../` (still relative to the crate).
    return !decl.path.startsWith('..') && !path.isAbsolute(decl.path) && resolved.includes(path.sep);
  });
}

/** Build the member manifest path target for a package name. */
export function memberTargetDir(root: string, name: string, dirName?: string): string {
  return path.join(root, 'crates', dirName ?? name);
}

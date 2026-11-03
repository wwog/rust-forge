/**
 * Manifest-level dependency model.
 *
 * `cargo metadata` tells us what a dependency resolves to; this module tells us
 * *where and how it was declared* so the UI can edit the right table and the
 * safe-upgrade rules can reason about workspace inheritance.
 */
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { fileExists, readTextFile, relativePath } from '../process.js';
import { TomlEditor, formatKeyPath } from '../toml/editor.js';
import type { DependencyTable } from './types.js';

export interface DependencyDeclaration {
  /** Name used in source: `use foo` (the rename when present). */
  key: string;
  /** Package name on crates.io. */
  packageName: string;
  table: DependencyTable;
  /** Overrides the table used for edits, e.g. `workspace.dependencies`. */
  tablePath?: string;
  /** e.g. `^1.2`, `*`, `{ path = "../x" }` handled via `kind`. */
  version?: string;
  kind: 'registry' | 'path' | 'git' | 'workspace' | 'unknown';
  path?: string;
  git?: string;
  branch?: string;
  tag?: string;
  rev?: string;
  features: string[];
  defaultFeatures?: boolean;
  optional?: boolean;
  target?: string;
  /** Raw value text from the manifest, e.g. `{ version = "1", features = ["x"] }`. */
  rawValue: string;
  manifestPath: string;
  /** Line number (0-based) of the declaration, for navigation. */
  line: number;
}

export interface WorkspaceDependencyDeclaration {
  name: string;
  version?: string;
  kind: 'registry' | 'path' | 'git' | 'unknown';
  path?: string;
  git?: string;
  features: string[];
  defaultFeatures?: boolean;
  rawValue: string;
  line: number;
}

const TABLES: DependencyTable[] = ['dependencies', 'dev-dependencies', 'build-dependencies'];

/** Manifest table path for a declaration, including target-specific tables. */
export function declarationTablePath(decl: Pick<DependencyDeclaration, 'table' | 'target' | 'tablePath'>): string {
  if (decl.tablePath) return decl.tablePath;
  return decl.target ? formatKeyPath(['target', decl.target, decl.table]) : decl.table;
}

export async function readDependencies(manifestPath: string): Promise<DependencyDeclaration[]> {
  let text: string;
  try {
    text = await readTextFile(manifestPath);
  } catch {
    return [];
  }
  return parseDependencies(text, manifestPath);
}

export function parseDependencies(text: string, manifestPath: string): DependencyDeclaration[] {
  let data: Record<string, unknown>;
  try {
    data = parseToml(text) as Record<string, unknown>;
  } catch {
    return [];
  }

  const editor = new TomlEditor(text);
  const result: DependencyDeclaration[] = [];

  for (const table of TABLES) {
    const tableData = data[table];
    if (!tableData || typeof tableData !== 'object') continue;
    for (const [key, value] of Object.entries(tableData as Record<string, unknown>)) {
      const decl = declarationFromValue(key, value, table, editor, manifestPath);
      if (decl) result.push(decl);
    }
  }

  // [target.'cfg(...)'.dependencies]
  for (const [topKey, topValue] of Object.entries(data)) {
    if (topKey !== 'target' || !topValue || typeof topValue !== 'object') continue;
    for (const [targetName, targetValue] of Object.entries(topValue as Record<string, unknown>)) {
      if (!targetValue || typeof targetValue !== 'object') continue;
      for (const table of TABLES) {
        const deps = (targetValue as Record<string, unknown>)[table];
        if (!deps || typeof deps !== 'object') continue;
        for (const [key, value] of Object.entries(deps as Record<string, unknown>)) {
          const decl = declarationFromValue(key, value, table, editor, manifestPath, targetName);
          if (decl) result.push(decl);
        }
      }
    }
  }

  return result;
}

function declarationFromValue(
  key: string,
  value: unknown,
  table: DependencyTable,
  editor: TomlEditor,
  manifestPath: string,
  targetName?: string,
): DependencyDeclaration | undefined {
  const line = findLine(editor, declarationTablePath({ table, target: targetName }), key);
  if (typeof value === 'string') {
    return {
      key,
      packageName: key,
      table,
      version: value,
      kind: 'registry',
      features: [],
      rawValue: JSON.stringify(value),
      manifestPath,
      target: targetName,
      line,
    };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const obj = value as Record<string, unknown>;
  const packageName = typeof obj.package === 'string' ? obj.package : key;
  const features = Array.isArray(obj.features) ? obj.features.filter((f): f is string => typeof f === 'string') : [];
  const defaultFeatures = typeof obj['default-features'] === 'boolean' ? obj['default-features'] : undefined;
  const optional = typeof obj.optional === 'boolean' ? obj.optional : undefined;

  let kind: DependencyDeclaration['kind'] = 'unknown';
  if (obj.workspace === true) kind = 'workspace';
  else if (typeof obj.path === 'string') kind = 'path';
  else if (typeof obj.git === 'string') kind = 'git';
  else if (typeof obj.version === 'string') kind = 'registry';

  return {
    key,
    packageName,
    table,
    version: typeof obj.version === 'string' ? obj.version : undefined,
    kind,
    path: typeof obj.path === 'string' ? obj.path : undefined,
    git: typeof obj.git === 'string' ? obj.git : undefined,
    branch: typeof obj.branch === 'string' ? obj.branch : undefined,
    tag: typeof obj.tag === 'string' ? obj.tag : undefined,
    rev: typeof obj.rev === 'string' ? obj.rev : undefined,
    features,
    defaultFeatures,
    optional,
    rawValue: JSON.stringify(obj),
    manifestPath,
    target: targetName,
    line,
  };
}

function findLine(editor: TomlEditor, table: string, key: string): number {
  const loc = editor.getKey(table, key);
  if (!loc) return 0;
  return editor.text.slice(0, loc.statement.start).split('\n').length - 1;
}

export async function readWorkspaceDependencies(root: string): Promise<WorkspaceDependencyDeclaration[]> {
  const manifestPath = path.join(root, 'Cargo.toml');
  if (!(await fileExists(manifestPath))) return [];
  let text: string;
  try {
    text = await readTextFile(manifestPath);
  } catch {
    return [];
  }
  let data: Record<string, unknown>;
  try {
    data = parseToml(text) as Record<string, unknown>;
  } catch {
    return [];
  }
  const ws = data.workspace as Record<string, unknown> | undefined;
  const deps = ws?.dependencies as Record<string, unknown> | undefined;
  if (!deps) return [];

  const editor = new TomlEditor(text);
  const result: WorkspaceDependencyDeclaration[] = [];
  for (const [name, value] of Object.entries(deps)) {
    const decl = workspaceDeclarationFromValue(name, value, editor);
    if (decl) result.push(decl);
  }
  return result;
}

function workspaceDeclarationFromValue(name: string, value: unknown, editor: TomlEditor): WorkspaceDependencyDeclaration | undefined {
  const line = findLine(editor, 'workspace.dependencies', name);
  if (typeof value === 'string') {
    return { name, version: value, kind: 'registry', features: [], rawValue: JSON.stringify(value), line };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const obj = value as Record<string, unknown>;
  let kind: WorkspaceDependencyDeclaration['kind'] = 'unknown';
  if (typeof obj.path === 'string') kind = 'path';
  else if (typeof obj.git === 'string') kind = 'git';
  else if (typeof obj.version === 'string') kind = 'registry';
  return {
    name,
    version: typeof obj.version === 'string' ? obj.version : undefined,
    kind,
    path: typeof obj.path === 'string' ? obj.path : undefined,
    git: typeof obj.git === 'string' ? obj.git : undefined,
    features: Array.isArray(obj.features) ? obj.features.filter((f): f is string => typeof f === 'string') : [],
    defaultFeatures: typeof obj['default-features'] === 'boolean' ? obj['default-features'] : undefined,
    rawValue: JSON.stringify(obj),
    line,
  };
}

/** Human-readable declaration target, e.g. `serde = "1"`. */
export function describeDeclaration(decl: DependencyDeclaration): string {
  if (decl.kind === 'workspace') return `${decl.key} = { workspace = true }`;
  if (decl.kind === 'path') return `${decl.key} = { path = "${decl.path ?? ''}" }`;
  if (decl.kind === 'git') return `${decl.key} = { git = "${decl.git ?? ''}" }`;
  if (decl.version) return `${decl.key} = "${decl.version}"`;
  return `${decl.key} = ${decl.rawValue}`;
}

/** Relative path from the member manifest to the workspace root manifest. */
export function relativeManifestPath(fromManifest: string, toManifest: string): string {
  return relativePath(path.dirname(fromManifest), toManifest);
}

/** Does this dependency point at another package inside the workspace? */
export function isLocalPathDependency(decl: DependencyDeclaration, workspaceRoot: string): boolean {
  if (decl.kind !== 'path' || !decl.path) return false;
  const resolved = path.resolve(path.dirname(decl.manifestPath), decl.path);
  const rel = path.relative(workspaceRoot, resolved);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

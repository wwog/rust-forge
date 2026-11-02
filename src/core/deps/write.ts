/**
 * Write-back for dependency operations.
 *
 * Every function here returns the new manifest text for a specific file; the
 * command layer decides when to flush and verify.
 */
import { TomlEditor, formatKeyPath, quoteString } from '../toml/editor.js';
import type { DependencyDeclaration } from '../cargo/manifestDeps.js';
import type { DependencyTable } from '../cargo/types.js';
import { parse as parseToml } from 'smol-toml';

export interface UpgradeEdit {
  manifestPath: string;
  declaration: DependencyDeclaration;
  newRequirement: string;
  /** Target version being applied, used for `cargo update --precise`. */
  targetVersion: string;
  /** When the declaration lives in `[workspace.dependencies]`. */
  workspaceDependency?: boolean;
}

export interface UpgradeResult {
  /** manifest path -> new text */
  files: Map<string, string>;
  /** Dependency specs to pass to `cargo update`. */
  updateSpecs: string[];
}

/**
 * Rewrite dependency requirements in place.
 *
 * Simple string declarations stay strings; inline tables keep their other
 * fields. Workspace-inheriting members are never edited — the workspace table
 * is the single source of truth.
 */
export function planUpgrades(edits: UpgradeEdit[], texts: Map<string, string>): UpgradeResult {
  const files = new Map<string, string>();
  const updateSpecs: string[] = [];
  const byFile = new Map<string, UpgradeEdit[]>();

  for (const edit of edits) {
    const list = byFile.get(edit.manifestPath) ?? [];
    list.push(edit);
    byFile.set(edit.manifestPath, list);
  }

  for (const [file, fileEdits] of byFile) {
    const original = texts.get(file);
    if (original === undefined) continue;
    const editor = new TomlEditor(original);
    const collected = [];

    for (const edit of fileEdits) {
      const table = edit.declaration.tablePath ?? (edit.workspaceDependency ? 'workspace.dependencies' : edit.declaration.table);
      const key = edit.workspaceDependency ? edit.declaration.packageName : edit.declaration.key;
      if (!editor.hasKey(table, key)) continue;

      const currentValue = editor.getValue(table, key)!;
      const rewritten = rewriteVersionValue(currentValue, edit.newRequirement);
      if (rewritten === undefined) continue;
      collected.push(...editor.setKey(table, key, rewritten));
      updateSpecs.push(`${edit.declaration.packageName}@${edit.targetVersion}`);
    }

    if (collected.length) {
      files.set(file, editor.apply(collected));
    }
  }

  return { files, updateSpecs };
}

/** Replace the version inside a string or inline-table dependency value. */
export function rewriteVersionValue(rawValue: string, newRequirement: string): string | undefined {
  const trimmed = rawValue.trim();
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    return quoteString(newRequirement);
  }
  if (trimmed.startsWith('{')) {
    if (/(^|[,{\s])version\s*=/.test(trimmed)) {
      return trimmed.replace(/(^|[,{\s])version\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/, (_, prefix: string) =>
        `${prefix}version = ${quoteString(newRequirement)}`,
      );
    }
    // Inline table without a version (git/path) — add one.
    return trimmed.replace(/^\{\s*/, `{ version = ${quoteString(newRequirement)}, `);
  }
  return quoteString(newRequirement);
}

export interface InstallTarget {
  name: string;
  manifestPath: string;
}

export interface InstallRequest {
  packageName: string;
  versionReq?: string;
  table: DependencyTable;
  features?: string[];
  optional?: boolean;
  noDefaultFeatures?: boolean;
  /** Install into `[workspace.dependencies]` and reference it from the selected members. */
  workspaceMode: boolean;
  /** Members receiving the reference (workspace mode) or declaration (direct mode). */
  targets: InstallTarget[];
  workspaceManifestPath: string;
  /** Existing manifest texts. */
  texts: Map<string, string>;
}

export interface InstallPlan {
  files: Map<string, string>;
  /** Table the dependency was written to. */
  writtenTable: string;
  notes: string[];
}

/**
 * Add a dependency declaration.
 *
 * Debounced appends avoid rewrite churn in the common case, and the editor's
 * `setKey` handles table creation with correct ordering.
 */
export function planInstall(request: InstallRequest): InstallPlan {
  const files = new Map<string, string>();
  const notes: string[] = [];
  const versionValue = request.versionReq ?? '^latest';
  const targets = dedupeTargets(request.targets);

  if (request.workspaceMode) {
    const rootText = request.texts.get(request.workspaceManifestPath);
    if (rootText === undefined) {
      return { files, writtenTable: 'workspace.dependencies', notes: ['Workspace manifest not found.'] };
    }
    const rootEditor = new TomlEditor(rootText);
    const rootEdits = rootEditor.setKey('workspace.dependencies', request.packageName, formatRegistryRequirement(versionValue));
    files.set(request.workspaceManifestPath, rootEditor.apply(rootEdits));

    const inherited: string[] = [];
    for (const target of targets) {
      if (target.manifestPath === request.workspaceManifestPath) continue;
      const memberText = request.texts.get(target.manifestPath);
      if (memberText === undefined) {
        notes.push(`Manifest for ${target.name} was not found; skipped.`);
        continue;
      }
      const memberEditor = new TomlEditor(memberText);
      const value = workspaceReferenceValue(request.features, request.optional);
      files.set(target.manifestPath, memberEditor.apply(memberEditor.setKey(request.table, request.packageName, value)));
      inherited.push(target.name);
    }
    notes.push(
      inherited.length
        ? `Declared in [workspace.dependencies]; ${inherited.join(', ')} inherit with workspace = true.`
        : 'Declared in [workspace.dependencies] only.',
    );
    return { files, writtenTable: 'workspace.dependencies', notes };
  }

  if (!targets.length) {
    return { files, writtenTable: request.table, notes: ['Select at least one member.'] };
  }
  const value = formatDirectRequirement(request);
  for (const target of targets) {
    const memberText = request.texts.get(target.manifestPath);
    if (memberText === undefined) {
      notes.push(`Manifest for ${target.name} was not found; skipped.`);
      continue;
    }
    const editor = new TomlEditor(memberText);
    files.set(target.manifestPath, editor.apply(editor.setKey(request.table, request.packageName, value)));
  }
  return { files, writtenTable: request.table, notes };
}

function dedupeTargets(targets: InstallTarget[]): InstallTarget[] {
  const seen = new Set<string>();
  const result: InstallTarget[] = [];
  for (const target of targets) {
    if (seen.has(target.manifestPath)) continue;
    seen.add(target.manifestPath);
    result.push(target);
  }
  return result;
}

function formatRegistryRequirement(version: string): string {
  if (version === '^latest' || version === 'latest' || version === '') return '"*"';
  return quoteString(version);
}

function formatDirectRequirement(request: InstallRequest): string {
  const parts: string[] = [];
  if (request.versionReq && request.versionReq !== '^latest' && request.versionReq !== 'latest') {
    parts.push(`version = ${quoteString(request.versionReq)}`);
  } else {
    parts.push('version = "*"');
  }
  if (request.features?.length) parts.push(`features = [${request.features.map(quoteString).join(', ')}]`);
  if (request.optional) parts.push('optional = true');
  if (request.noDefaultFeatures) parts.push('default-features = false');
  return parts.length === 1 && parts[0].startsWith('version = "') && request.versionReq === '^latest'
    ? '"*"'
    : `{ ${parts.join(', ')} }`;
}

export function workspaceReferenceValue(features: string[] = [], optional = false): string {
  const parts: string[] = ['workspace = true'];
  if (features.length) parts.push(`features = [${features.map(quoteString).join(', ')}]`);
  if (optional) parts.push('optional = true');
  return `{ ${parts.join(', ')} }`;
}

/** Remove a dependency from a manifest. */
export function planRemove(manifestPath: string, table: DependencyTable, key: string, text: string): string {
  const editor = new TomlEditor(text);
  return editor.apply(editor.removeKey(table, key, { dropEmptyTable: true }));
}

export type LockState = 'up-to-date' | 'resolved-not-cached' | 'constraint-unsatisfied' | 'no-lockfile' | 'unknown';

export interface LockCheck {
  state: LockState;
  message: string;
  lockedVersion?: string;
  targetVersion?: string;
}

/**
 * Distinguish the two failure modes the spec calls out:
 *  - "resolved but not cached": the lockfile has a version satisfying the
 *    requirement, so only the local cache is missing;
 *  - "constraint not satisfied": no locked version matches the requirement.
 */
export function checkLockBeforeInstall(
  requirement: string | undefined,
  lockedVersions: string[],
  latestVersion: string | undefined,
  satisfier: (req: string, version: string) => boolean,
): LockCheck {
  if (!lockedVersions.length) {
    return { state: 'no-lockfile', message: 'No matching version is present in Cargo.lock; cargo will resolve it during install.' };
  }
  const req = requirement ?? '*';
  const matching = lockedVersions.find((v) => satisfier(req, v));
  if (matching) {
    return {
      state: 'resolved-not-cached',
      message: `Cargo.lock already resolves ${matching}; only the local registry cache may be missing.`,
      lockedVersion: matching,
      targetVersion: latestVersion,
    };
  }
  return {
    state: 'constraint-unsatisfied',
    message: `No version in Cargo.lock satisfies "${req}". Cargo will have to resolve a new version.`,
    lockedVersion: lockedVersions[0],
    targetVersion: latestVersion,
  };
}

/** Detect whether a member manifest already declares a dependency. */
export function hasDependency(text: string, table: DependencyTable, key: string): boolean {
  return new TomlEditor(text).hasKey(table, key);
}

/** Existing features for a dependency, used to seed the install form. */
export function dependencyFeatures(text: string, table: DependencyTable, key: string): string[] {
  try {
    const data = parseToml(text) as Record<string, unknown>;
    const deps = data[table] as Record<string, unknown> | undefined;
    const entry = deps?.[key];
    if (entry && typeof entry === 'object' && Array.isArray((entry as Record<string, unknown>).features)) {
      return ((entry as Record<string, unknown>).features as unknown[]).filter((f): f is string => typeof f === 'string');
    }
  } catch {
    // Ignore malformed manifests here.
  }
  return [];
}

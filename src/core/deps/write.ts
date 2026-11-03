/**
 * Write-back for dependency operations.
 *
 * Every function here returns the new manifest text for a specific file; the
 * command layer decides when to flush and verify.
 */
import {
  TomlEditor,
  formatKeyPath,
  parseDottedKey,
  quoteString,
  type Statement,
  type TableInfo,
  type TextEdit,
} from '../toml/editor.js';
import { declarationTablePath, type DependencyDeclaration } from '../cargo/manifestDeps.js';
import type { DependencyTable } from '../cargo/types.js';
import { parse as parseToml } from 'smol-toml';

export interface UpgradeEdit {
  manifestPath: string;
  declaration: DependencyDeclaration;
  newRequirement: string;
  /** Target version being applied, used to refresh the lockfile. */
  targetVersion: string;
  /** When the declaration lives in `[workspace.dependencies]`. */
  workspaceDependency?: boolean;
  /**
   * The declared requirement already admits the target, so the manifest is not
   * rewritten and only Cargo.lock needs refreshing.
   */
  lockOnly?: boolean;
}

/** One package/version pair to refresh in Cargo.lock. */
export interface UpgradeSpec {
  /** Package name passed to `cargo update -p`. */
  name: string;
  targetVersion: string;
}

export interface UpgradePlan {
  /** Manifest path -> new text, only for requirements that actually changed. */
  files: Map<string, string>;
  /** Rows whose requirement already admits the target: refresh Cargo.lock only. */
  lockOnly: UpgradeSpec[];
  /** Rows whose manifest was rewritten: refresh the package after the rewrite. */
  manifestUpdates: UpgradeSpec[];
  /**
   * @deprecated Aggregate of both spec lists as `name@version`, retained for
   * existing callers. New code should consume `lockOnly` / `manifestUpdates`,
   * which distinguish `--precise` from a plain package refresh.
   */
  updateSpecs: string[];
}

/** @deprecated Use `UpgradePlan`. */
export type UpgradeResult = UpgradePlan;

/**
 * Plan an upgrade batch.
 *
 * The caller gets three disjoint outputs: the manifests whose requirement text
 * changes, the specs that only need a Cargo.lock refresh, and the specs that
 * need a refresh after their manifest rewrite. Workspace-inheriting member
 * stubs (`workspace = true`) are never edited — their requirement lives in the
 * root `[workspace.dependencies]` table.
 */
export function planUpgrades(edits: UpgradeEdit[], texts: Map<string, string>): UpgradePlan {
  const files = new Map<string, string>();
  const manifestEdits: UpgradeEdit[] = [];
  const lockOnly: UpgradeSpec[] = [];
  const seenLockSpecs = new Set<string>();

  for (const edit of edits) {
    // A member stub inherits its requirement from [workspace.dependencies], so
    // editing it would create a conflicting version source.
    const inheritingStub = edit.declaration.kind === 'workspace' && !edit.workspaceDependency;
    const requirementUnchanged =
      edit.declaration.version !== undefined && edit.newRequirement === edit.declaration.version;
    if (inheritingStub || edit.lockOnly || requirementUnchanged) {
      addLockSpec(lockOnly, seenLockSpecs, edit.declaration.packageName, edit.targetVersion);
      continue;
    }
    manifestEdits.push(edit);
  }

  const manifestUpdates: UpgradeSpec[] = [];
  const seenManifestSpecs = new Set<string>();
  const byFile = new Map<string, UpgradeEdit[]>();

  for (const edit of manifestEdits) {
    const list = byFile.get(edit.manifestPath) ?? [];
    list.push(edit);
    byFile.set(edit.manifestPath, list);
  }

  for (const [file, fileEdits] of byFile) {
    const original = texts.get(file);
    if (original === undefined) continue;
    const editor = new TomlEditor(original);
    const collected = [];
    const fileSpecs: UpgradeSpec[] = [];
    const seen = new Set<string>();

    for (const edit of fileEdits) {
      // A workspace root dependency and a member inheriting it both resolve to
      // the same root table/key; apply that declaration only once.
      const table = edit.workspaceDependency ? 'workspace.dependencies' : declarationTablePath(edit.declaration);
      // `key` is the table key (it can differ from the crate name when the
      // declaration is renamed with `package = "..."`).
      const key = edit.declaration.key;
      const signature = `${table}\u0000${key}`;
      if (seen.has(signature)) continue;
      seen.add(signature);

      const changes = rewriteDeclarationRequirement(editor, table, key, edit.newRequirement);
      if (!changes) continue;
      collected.push(...changes);
      fileSpecs.push({ name: edit.declaration.packageName, targetVersion: edit.targetVersion });
    }

    if (!collected.length) continue;
    const updated = editor.apply(collected);
    // A rewrite that produces identical text is not a change; skip both the
    // file entry and its lock refresh.
    if (updated === original) continue;
    files.set(file, updated);
    for (const spec of fileSpecs) addManifestSpec(manifestUpdates, seenManifestSpecs, spec);
  }

  // A manifest rewrite already refreshes that package, so drop lock-only
  // specs for the exact same package@version. A lock-only row for the same
  // package at a *different* target is a separate resolution intent and must
  // still run with --precise.
  const rewrittenSpecs = new Set(manifestUpdates.map((spec) => `${spec.name}@${spec.targetVersion}`));
  const filteredLockOnly = lockOnly.filter((spec) => !rewrittenSpecs.has(`${spec.name}@${spec.targetVersion}`));

  return {
    files,
    lockOnly: filteredLockOnly,
    manifestUpdates,
    updateSpecs: [...manifestUpdates, ...filteredLockOnly].map((spec) => `${spec.name}@${spec.targetVersion}`),
  };
}

function addLockSpec(list: UpgradeSpec[], seen: Set<string>, name: string, targetVersion: string): void {
  const signature = `${name}@${targetVersion}`;
  if (seen.has(signature)) return;
  seen.add(signature);
  list.push({ name, targetVersion });
}

function addManifestSpec(list: UpgradeSpec[], seen: Set<string>, spec: UpgradeSpec): void {
  const signature = `${spec.name}@${spec.targetVersion}`;
  if (seen.has(signature)) return;
  seen.add(signature);
  list.push(spec);
}

/** Replace the version inside a string or inline-table dependency value. */
export function rewriteVersionValue(rawValue: string, newRequirement: string): string | undefined {
  const trimmed = rawValue.trim();
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    return quoteString(newRequirement);
  }
  if (trimmed.startsWith('{')) {
    // `version`, `"version"` and `'version'` are all valid TOML keys.
    if (/(^|[,{\s])(?:version|"version"|'version')\s*=/.test(trimmed)) {
      return trimmed.replace(
        /(^|[,{\s])(?:version|"version"|'version')\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/,
        (_, prefix: string) => `${prefix}version = ${quoteString(newRequirement)}`,
      );
    }
    // A path/git declaration has no registry version; adding one would make
    // cargo resolve a version that conflicts with the local source.
    if (/(^|[,{\s])(?:path|"path"|'path'|git|"git"|'git')\s*=/.test(trimmed)) return undefined;
    // Inline table without a version — add one.
    return trimmed.replace(/^\{\s*/, `{ version = ${quoteString(newRequirement)}, `);
  }
  return quoteString(newRequirement);
}

interface RequirementParts {
  version: string;
  features: string[];
  optional: boolean;
  noDefaultFeatures: boolean;
}

function requirementParts(request: InstallRequest): RequirementParts {
  const version =
    request.versionReq && request.versionReq !== '^latest' && request.versionReq !== 'latest'
      ? request.versionReq
      : '*';
  return {
    version,
    features: request.features ?? [],
    // Cargo rejects optional dev-dependencies.
    optional: !!request.optional && request.table !== 'dev-dependencies',
    noDefaultFeatures: !!request.noDefaultFeatures,
  };
}

function requirementValueText(parts: RequirementParts): string {
  const entries: string[] = [`version = ${quoteString(parts.version)}`];
  if (parts.features.length) entries.push(`features = ${formatStringArray(parts.features)}`);
  if (parts.optional) entries.push('optional = true');
  if (parts.noDefaultFeatures) entries.push('default-features = false');
  // A plain requirement keeps the compact string form.
  if (entries.length === 1) return quoteString(parts.version);
  return `{ ${entries.join(', ')} }`;
}

function formatStringArray(values: string[]): string {
  return `[${values.map(quoteString).join(', ')}]`;
}

function tablePathOf(table: string): string[] {
  return parseDottedKey(table) ?? [table];
}

function keyPathOf(key: string): string[] {
  return parseDottedKey(key) ?? [key];
}

interface DeclarationSite {
  kind: 'value' | 'version' | 'subtable';
  statement?: Statement;
  tablePath: string[];
}

/**
 * Locate a dependency declaration regardless of how it was written:
 * `name = "1"`, `name = { version = "1" }`, `[dependencies.name]`,
 * `name.version = "1"` (inside a table) or root-level dotted keys.
 */
function locateDeclaration(editor: TomlEditor, table: string, key: string): DeclarationSite | undefined {
  const full = [...tablePathOf(table), ...keyPathOf(key)];
  const exact = editor.findByPath(full);
  if (exact) return { kind: 'value', statement: exact.statement, tablePath: exact.table.path };

  const subtable = editor.getTable(formatKeyPath(full));
  if (subtable) {
    const version = subtable.statements.find((statement) => {
      return (statement.keyPath ?? []).length === 1 && statement.keyPath?.[0] === 'version';
    });
    return { kind: 'subtable', statement: version ?? subtable.statements[0], tablePath: full };
  }

  const version = editor.findByPath([...full, 'version']);
  if (version) return { kind: 'version', statement: version.statement, tablePath: version.table.path };
  return undefined;
}

/** Edits that rewrite only the version requirement of an existing declaration. */
export function rewriteDeclarationRequirement(
  editor: TomlEditor,
  table: string,
  key: string,
  newRequirement: string,
): TextEdit[] | undefined {
  const site = locateDeclaration(editor, table, key);
  if (!site?.statement) return undefined;

  if (site.kind === 'value') {
    const rewritten = rewriteVersionValue(site.statement.valueRaw ?? '', newRequirement);
    if (rewritten === undefined) return undefined;
    return [{ start: site.statement.valueStart!, end: site.statement.valueEnd!, text: rewritten }];
  }
  if (site.kind === 'version') {
    return [{ start: site.statement.valueStart!, end: site.statement.valueEnd!, text: quoteString(newRequirement) }];
  }
  // Sub-table: `[dependencies.name] version = "..."`
  const version = (site.statement.keyPath ?? [])[0] === 'version' ? site.statement : undefined;
  if (!version) return undefined;
  return [{ start: version.valueStart!, end: version.valueEnd!, text: quoteString(newRequirement) }];
}

/** Write (or update) a dependency declaration in whichever form it already uses. */
function writeDeclaration(
  editor: TomlEditor,
  table: string,
  key: string,
  parts: RequirementParts,
  reference: boolean,
): TextEdit[] {
  const valueText = reference
    ? workspaceReferenceValue(parts.features, parts.optional, parts.noDefaultFeatures)
    : requirementValueText(parts);
  const site = locateDeclaration(editor, table, key);
  if (!site?.statement) return editor.setKey(table, key, valueText);

  if (site.kind === 'value') {
    // String or inline table: replace only the value, preserving surrounding
    // formatting and any sibling keys on the line.
    return [{ start: site.statement.valueStart!, end: site.statement.valueEnd!, text: valueText }];
  }

  const full = [...tablePathOf(table), ...keyPathOf(key)];
  if (site.kind === 'subtable') {
    const tableName = formatKeyPath(full);
    const edits: TextEdit[] = [];
    // A sub-table may carry a source that the new declaration must not keep:
    // a workspace reference cannot also declare `version`, and a registry
    // install replaces a path/git source.
    const replacedKeys = reference ? ['version', 'path', 'git'] : ['path', 'git'];
    for (const replaced of replacedKeys) {
      if (editor.hasKey(tableName, replaced)) edits.push(...editor.removeKey(tableName, replaced));
    }
    if (reference) edits.push(...editor.setKey(tableName, 'workspace', 'true'));
    else edits.push(...editor.setKey(tableName, 'version', quoteString(parts.version)));
    if (parts.features.length) edits.push(...editor.setKey(tableName, 'features', formatStringArray(parts.features)));
    if (parts.optional) edits.push(...editor.setKey(tableName, 'optional', 'true'));
    if (parts.noDefaultFeatures) edits.push(...editor.setKey(tableName, 'default-features', 'false'));
    return edits;
  }

  // Dotted form: replace `name.version = ...` (or the root-level equivalent)
  // with one inline declaration. The path is relative to the statement's own
  // table, so drop the trailing `version` and keep the rest. Sibling dotted
  // keys (`name.features = [...]`) must go, otherwise the replacement would
  // duplicate the key.
  const dotted = (site.statement.keyPath ?? []).slice(0, -1);
  const indent = site.statement.raw.match(/^[\t ]*/)?.[0] ?? '';
  const removals: TextEdit[] = [];
  for (const { tablePath, statement } of editor.allKeyStatements()) {
    const path = [...tablePath, ...(statement.keyPath ?? [])];
    if (statement === site.statement || path.length <= full.length || !isPathUnder(path, full)) continue;
    removals.push({
      start: lineStartOffset(editor.text, statement.start),
      end: lineEndOffset(editor.text, statement.end),
      text: '',
    });
  }
  return [
    ...removals,
    {
      start: site.statement.start,
      end: site.statement.end,
      text: `${indent}${formatKeyPath(dotted.length ? dotted : keyPathOf(key))} = ${valueText}`,
    },
  ];
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
    const rootTarget = targets.find((target) => target.manifestPath === request.workspaceManifestPath);
    const memberTargets = targets.filter((target) => target.manifestPath !== request.workspaceManifestPath);
    const hasReferences = !!rootTarget || memberTargets.length > 0;

    // `optional` is a per-member concept; Cargo rejects it in
    // [workspace.dependencies]. Without a selected member there is nowhere to
    // put it, so fail rather than silently dropping the user's choice.
    if (!hasReferences && request.optional) {
      return {
        files,
        writtenTable: 'workspace.dependencies',
        notes: ['Select at least one member for an optional dependency.'],
      };
    }

    const rootEditor = new TomlEditor(rootText);
    const rootParts: RequirementParts = {
      version: versionValue === '^latest' || versionValue === 'latest' || versionValue === '' ? '*' : versionValue,
      features: hasReferences ? [] : request.features ?? [],
      // Cargo rejects optional in [workspace.dependencies].
      optional: false,
      noDefaultFeatures: hasReferences ? false : !!request.noDefaultFeatures,
    };
    const rootEdits = writeDeclaration(rootEditor, 'workspace.dependencies', request.packageName, rootParts, false);
    const referenceParts: RequirementParts = {
      version: rootParts.version,
      features: request.features ?? [],
      optional: !!request.optional && request.table !== 'dev-dependencies',
      noDefaultFeatures: !!request.noDefaultFeatures,
    };
    if (request.optional && request.table === 'dev-dependencies') {
      notes.push('Cargo does not allow optional dev-dependencies; the optional flag was ignored.');
    }
    if (rootTarget) {
      // A workspace root package is a member too; it receives an inheritance
      // stub in its own [dependencies] table.
      rootEdits.push(...writeDeclaration(rootEditor, request.table, request.packageName, referenceParts, true));
    }
    files.set(request.workspaceManifestPath, rootEditor.apply(rootEdits));

    const inherited: string[] = rootTarget ? [rootTarget.name] : [];
    for (const target of memberTargets) {
      const memberText = request.texts.get(target.manifestPath);
      if (memberText === undefined) {
        notes.push(`Manifest for ${target.name} was not found; skipped.`);
        continue;
      }
      const memberEditor = new TomlEditor(memberText);
      files.set(
        target.manifestPath,
        memberEditor.apply(writeDeclaration(memberEditor, request.table, request.packageName, referenceParts, true)),
      );
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
  const parts = requirementParts(request);
  if (request.optional && request.table === 'dev-dependencies') {
    notes.push('Cargo does not allow optional dev-dependencies; the optional flag was ignored.');
  }
  for (const target of targets) {
    const memberText = request.texts.get(target.manifestPath);
    if (memberText === undefined) {
      notes.push(`Manifest for ${target.name} was not found; skipped.`);
      continue;
    }
    const editor = new TomlEditor(memberText);
    files.set(target.manifestPath, editor.apply(writeDeclaration(editor, request.table, request.packageName, parts, false)));
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

/** Resolve the panel's `^latest` sentinel once the newest version is known. */
export function resolveRequestedRequirement(
  versionReq: string | undefined,
  latest: string | undefined,
): string | undefined {
  if (versionReq && versionReq !== '^latest' && versionReq !== 'latest') return versionReq;
  return latest ? `^${latest}` : versionReq;
}

export function workspaceReferenceValue(
  features: string[] = [],
  optional = false,
  noDefaultFeatures = false,
): string {
  const parts: string[] = ['workspace = true'];
  if (features.length) parts.push(`features = [${features.map(quoteString).join(', ')}]`);
  if (optional) parts.push('optional = true');
  if (noDefaultFeatures) parts.push('default-features = false');
  return `{ ${parts.join(', ')} }`;
}

function isPathUnder(path: string[], prefix: string[]): boolean {
  return path.length >= prefix.length && prefix.every((part, index) => path[index] === part);
}

function lineStartOffset(text: string, offset: number): number {
  const index = text.lastIndexOf('\n', offset - 1);
  return index < 0 ? 0 : index + 1;
}

function lineEndOffset(text: string, offset: number): number {
  const index = text.indexOf('\n', offset);
  return index < 0 ? text.length : index + 1;
}

/**
 * Remove a declaration in any of the forms Cargo accepts: a string, an inline
 * table, a sub-table, or dotted keys at the table/document root.
 */
function removeDeclaration(editor: TomlEditor, table: string, key: string): TextEdit[] {
  const full = [...tablePathOf(table), ...keyPathOf(key)];
  const edits: TextEdit[] = [];

  // Whole sub-tables (`[dependencies.name]` and anything below it).
  for (const info of editor.getTables()) {
    if (isPathUnder(info.path, full)) edits.push(...editor.removeTable(info.name));
  }
  const insideTableEdit = (offset: number): boolean =>
    edits.some((edit) => offset >= edit.start && offset < Math.max(edit.end, edit.start + 1));

  const groups = new Map<TableInfo, Statement[]>();
  for (const { table: owner, tablePath, statement } of editor.allKeyStatements()) {
    const path = [...tablePath, ...(statement.keyPath ?? [])];
    if (!isPathUnder(path, full) || insideTableEdit(statement.start)) continue;
    const list = groups.get(owner) ?? [];
    list.push(statement);
    groups.set(owner, list);
  }

  for (const [owner, statements] of groups) {
    const removable = owner.statements.filter((statement) => !insideTableEdit(statement.start));
    const dropsTable = owner.headerIndex >= 0 && owner.statements.length === statements.length && removable.length === statements.length;
    if (dropsTable) {
      const header = editor.statements[owner.headerIndex];
      const last = statements[statements.length - 1]!;
      edits.push({
        start: lineStartOffset(editor.text, header.start),
        end: lineEndOffset(editor.text, last.end),
        text: '',
      });
      continue;
    }
    for (const statement of statements) {
      edits.push({ start: lineStartOffset(editor.text, statement.start), end: lineEndOffset(editor.text, statement.end), text: '' });
    }
  }
  return edits;
}

/** Remove a dependency from a manifest. */
export function planRemove(manifestPath: string, table: string, key: string, text: string): string {
  const editor = new TomlEditor(text);
  return editor.apply(removeDeclaration(editor, table, key));
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

/** Detect whether a manifest already declares a dependency, in any form. */
export function hasDependency(text: string, table: string, key: string): boolean {
  return locateDeclaration(new TomlEditor(text), table, key) !== undefined;
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

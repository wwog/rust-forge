/**
 * Member move/rename planning.
 *
 * `planMemberMove` is pure: it takes the current model plus manifest text and
 * returns every post-move file content and the directory move. The command in
 * `commands/members.ts` performs the filesystem work and verification, so the
 * plan can be unit-tested without touching disk.
 */
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { TomlEditor, quoteString, type Statement, type TableInfo, type TextEdit } from '../toml/editor.js';
import { isWorkspacePathExcluded, matchesMemberPattern, workspaceTable, type ProjectModel } from '../cargo/project.js';
import { parseDependencies, type DependencyDeclaration } from '../cargo/manifestDeps.js';
import { isInside } from '../process.js';
import { t } from '../i18n.js';

export interface MovePlanInput {
  model: Pick<ProjectModel, 'root' | 'manifestPath' | 'members'>;
  /** Name of the member to move. */
  member: string;
  /** New workspace-relative directory. */
  targetRelative: string;
  rootText: string;
  /** Manifest text by member name. The root package is handled separately. */
  memberTexts: Record<string, string>;
  /**
   * Whether the destination already exists. The command checks this on disk;
   * the plan stays pure. A case-only rename on macOS/Windows is allowed.
   */
  destinationExists?: boolean;
}

export interface MemberMovePlan {
  /** New manifest contents keyed by their post-move absolute path. */
  files: Record<string, string>;
  /** Original text for each entry in `files`, keyed by post-move path. */
  originals: Record<string, string>;
  moves: { from: string; to: string }[];
  notes: string[];
  errors: string[];
  fromRelative: string;
  toRelative: string;
}

export interface MoveTargetInput {
  model: Pick<ProjectModel, 'root' | 'members'>;
  member: string;
  targetRelative: string;
  destinationExists?: boolean;
}

export interface MoveTargetValidation {
  fromRelative: string;
  toRelative: string;
  errors: string[];
  memberDir?: string;
  targetDir?: string;
}

/**
 * Structural validation shared by the input prompt and the planner: the
 * destination must stay inside the workspace, must not contain (or sit inside)
 * another member, and must not collide with an existing directory.
 */
export function validateMemberTarget(input: MoveTargetInput): MoveTargetValidation {
  const errors: string[] = [];
  const root = path.resolve(input.model.root);
  const member = input.model.members.find((candidate) => candidate.name === input.member);

  const raw = input.targetRelative.trim();
  const toRelative = normalizeRelative(raw);
  if (!member) {
    return { fromRelative: '', toRelative, errors: [t('"{0}" is not a workspace member.', input.member)] };
  }

  const fromRelative = relativeDir(root, member.dir);
  const memberDir = path.resolve(member.dir);
  if (memberDir === root) {
    errors.push(t('The workspace root package cannot be moved.'));
  }

  if (raw === '') {
    errors.push(t('The destination must be a relative directory inside the workspace.'));
    return { fromRelative, toRelative, errors, memberDir };
  }
  if (path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) {
    errors.push(t('The destination must be a relative directory inside the workspace.'));
    return { fromRelative, toRelative, errors, memberDir };
  }
  const segments = raw.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.includes('..')) {
    errors.push(t('The destination must be a relative directory inside the workspace.'));
    return { fromRelative, toRelative, errors, memberDir };
  }
  if (!toRelative || toRelative === '.') {
    errors.push(t('The destination must be a relative directory inside the workspace.'));
    return { fromRelative, toRelative, errors, memberDir };
  }

  const targetDir = path.resolve(root, toRelative);
  if (!isInside(root, targetDir) || targetDir === root) {
    errors.push(t('The destination must be a relative directory inside the workspace.'));
    return { fromRelative, toRelative, errors, memberDir };
  }

  if (toRelative === fromRelative) {
    errors.push(t('The member is already in that directory.'));
  }
  if (targetDir === memberDir) {
    // Covered by the equality check above; kept separate for case-only renames.
  } else if (isInside(memberDir, targetDir)) {
    errors.push(t('The destination cannot be inside the member itself.'));
  }

  for (const other of input.model.members) {
    const otherDir = path.resolve(other.dir);
    if (otherDir === memberDir) continue;
    if (otherDir === targetDir) {
      errors.push(t('"{0}" is already used by the workspace member "{1}".', toRelative, other.name));
      continue;
    }
    if (isInside(otherDir, targetDir)) {
      errors.push(t('"{0}" is inside the workspace member "{1}".', toRelative, other.name));
      continue;
    }
    if (isInside(targetDir, otherDir)) {
      errors.push(t('The workspace member "{0}" is inside the target directory.', other.name));
    }
  }

  if (input.destinationExists && !isCaseOnlyRename(fromRelative, toRelative)) {
    errors.push(t('"{0}" already exists.', toRelative));
  }

  return { fromRelative, toRelative, errors, memberDir, targetDir };
}

/**
 * Build every manifest edit and the directory move for a member rename.
 *
 * Path dependency rewrites cover:
 * - `[workspace.dependencies]` entries in the root manifest;
 * - every member manifest (including the workspace root package);
 * - target-specific `[target.*.dependencies]` tables and `[dependencies.foo]`
 *   sub-table declarations;
 * - the moved member's own outbound path dependencies, recomputed from its new
 *   directory;
 * - best-effort `[patch.*]` path entries in the root manifest.
 */
export function planMemberMove(input: MovePlanInput): MemberMovePlan {
  const validation = validateMemberTarget(input);
  const result: MemberMovePlan = {
    files: {},
    originals: {},
    moves: [],
    notes: [],
    errors: [...validation.errors],
    fromRelative: validation.fromRelative,
    toRelative: validation.toRelative,
  };
  if (result.errors.length || !validation.memberDir || !validation.targetDir) return result;

  const model = input.model;
  const root = path.resolve(model.root);
  const member = model.members.find((candidate) => candidate.name === input.member)!;
  const oldDir = path.resolve(member.dir);
  const newDir = validation.targetDir;

  result.moves.push({ from: oldDir, to: newDir });

  let rootManifest: Record<string, unknown>;
  try {
    rootManifest = parseToml(input.rootText) as Record<string, unknown>;
  } catch {
    result.errors.push(t('The workspace manifest could not be parsed.'));
    return result;
  }

  const ws = workspaceTable(rootManifest);
  const editor = new TomlEditor(input.rootText);
  if (!editor.hasTable('workspace')) {
    result.errors.push(
      t('This manifest declares workspace settings with dotted keys and cannot be edited safely.'),
    );
    return result;
  }

  const members = stringArray(ws?.members);
  const exclude = stringArray(ws?.exclude);
  const defaults = stringArray(ws?.['default-members']);

  // --- workspace.members --------------------------------------------------
  // An explicit entry is followed to the new directory. A glob-covered member
  // only needs an explicit entry when the glob does not match the new path (or
  // when exclude would drop it: an explicit entry wins over exclude).
  //
  // `exclude` is rewritten first so the decision uses the post-move exclusion
  // set: an old exact exclude that moves with the member must still be taken
  // into account when deciding whether a glob covers the new directory.
  const nextExclude = exclude.map((entry) =>
    normalizeRelative(entry) === validation.fromRelative ? validation.toRelative : entry,
  );
  const newExcluded = isWorkspacePathExcluded(validation.toRelative, nextExclude);
  const newCoveredByGlob =
    !newExcluded && members.some((entry) => hasGlob(entry) && matchesMemberPattern(validation.toRelative, entry));
  const exactNewMember = members.some(
    (entry) => !hasGlob(entry) && normalizeRelative(entry) === validation.toRelative,
  );

  const nextMembers: string[] = [];
  let replacedExact = false;
  for (const entry of members) {
    const isOldExact = !hasGlob(entry) && normalizeRelative(entry) === validation.fromRelative;
    if (!isOldExact) {
      nextMembers.push(entry);
      continue;
    }
    if (replacedExact) continue;
    replacedExact = true;
    if (!newCoveredByGlob && !exactNewMember) nextMembers.push(validation.toRelative);
  }
  if (!newCoveredByGlob && !nextMembers.some((entry) => !hasGlob(entry) && normalizeRelative(entry) === validation.toRelative)) {
    nextMembers.push(validation.toRelative);
  }

  const edits: TextEdit[] = [];
  if (!sameStringList(members, nextMembers)) {
    edits.push(...editor.setKey('workspace', 'members', formatStringArray(nextMembers)));
  }

  // --- workspace.default-members -----------------------------------------
  // Values written by the topology panel are paths; replace exact matches only.
  const nextDefaults = defaults.map((entry) =>
    normalizeRelative(entry) === validation.fromRelative ? validation.toRelative : entry,
  );
  if (!sameStringList(defaults, nextDefaults)) {
    edits.push(...editor.setKey('workspace', 'default-members', formatStringArray(nextDefaults)));
  }

  // --- workspace.exclude --------------------------------------------------
  // Preserve an intentional exclusion of the directory by moving it with the
  // member. We never add the old path: it no longer exists after the move.
  if (!sameStringList(exclude, nextExclude)) {
    edits.push(
      ...(nextExclude.length
        ? editor.setKey('workspace', 'exclude', formatStringArray(nextExclude))
        : editor.removeKey('workspace', 'exclude')),
    );
  }

  // --- dependencies in the root manifest ----------------------------------
  const rootContext = rewriteContext(root, root, oldDir, newDir, true, result.notes);
  edits.push(
    ...rewriteDeclarationPaths(editor, parseDependencies(input.rootText, model.manifestPath), rootContext),
  );
  edits.push(...rewriteWorkspaceDependencyPaths(editor, rootContext));
  edits.push(...rewritePatchPaths(editor, rootContext));

  const rootUpdated = editor.apply(edits);
  if (rootUpdated !== input.rootText) {
    result.files[model.manifestPath] = rootUpdated;
    result.originals[model.manifestPath] = input.rootText;
  }

  // --- other member manifests --------------------------------------------
  for (const other of model.members) {
    if (path.resolve(other.dir) === oldDir) continue;
    if (path.resolve(other.manifestPath) === path.resolve(model.manifestPath)) continue;
    const text = input.memberTexts[other.name];
    if (text === undefined) {
      result.notes.push(t('Skipped path rewrites in "{0}" because its manifest could not be read.', other.name));
      continue;
    }
    const memberEditor = new TomlEditor(text);
    const context = rewriteContext(other.dir, other.dir, oldDir, newDir, true, result.notes);
    const memberEdits = rewriteDeclarationPaths(
      memberEditor,
      parseDependencies(text, other.manifestPath),
      context,
    );
    if (!memberEdits.length) continue;
    const updated = memberEditor.apply(memberEdits);
    if (updated === text) continue;
    result.files[other.manifestPath] = updated;
    result.originals[other.manifestPath] = text;
    result.notes.push(t('Updated path dependencies in "{0}".', other.name));
  }

  // --- the moved member's own manifest -----------------------------------
  const movedText = input.memberTexts[member.name];
  if (movedText === undefined) {
    result.errors.push(t('The manifest for "{0}" could not be read.', member.name));
    return result;
  }
  const movedEditor = new TomlEditor(movedText);
  // Every relative path is recomputed from the new directory. Targets inside
  // the member itself move with it, so their relative path is unchanged.
  const movedContext = rewriteContext(oldDir, newDir, oldDir, newDir, false, result.notes);
  const movedEdits = rewriteDeclarationPaths(
    movedEditor,
    parseDependencies(movedText, member.manifestPath),
    movedContext,
  );
  // Package fields such as readme/license-file/build are relative to the
  // manifest. Paths that pointed outside the member keep pointing at the same
  // file, so their relative form changes with the new depth.
  movedEdits.push(...rewritePackagePaths(movedEditor, oldDir, newDir, result.notes));
  if (movedEdits.length) {
    const updated = movedEditor.apply(movedEdits);
    if (updated !== movedText) {
      const newManifestPath = path.join(newDir, 'Cargo.toml');
      result.files[newManifestPath] = updated;
      result.originals[newManifestPath] = movedText;
      result.notes.push(t('Updated path dependencies in "{0}".', member.name));
    }
  }

  return result;
}

// ------------------------------------------------------------- path rewrites

/**
 * Rewrite `[package] readme`, `license-file` and `build` when they point
 * outside the member. Targets inside the member move with it, so their
 * relative path is already correct.
 */
function rewritePackagePaths(
  editor: TomlEditor,
  oldDir: string,
  newDir: string,
  notes: string[],
): TextEdit[] {
  const edits: TextEdit[] = [];
  const packageTable = editor.getTable('package');
  if (!packageTable) return edits;

  for (const key of ['readme', 'license-file', 'build']) {
    const statement = packageTable.statements.find(
      (candidate) => candidate.keyPath?.length === 1 && candidate.keyPath[0] === key,
    );
    if (
      !statement ||
      statement.valueRaw === undefined ||
      statement.valueStart === undefined ||
      statement.valueEnd === undefined
    ) {
      continue;
    }
    const current = decodeTomlString(statement.valueRaw);
    // `readme = true` and `build = false` are booleans, not paths.
    if (!current || path.isAbsolute(current)) continue;
    const resolved = path.resolve(oldDir, current);
    if (resolved === oldDir || isInside(oldDir, resolved)) continue;
    const next = relativeDir(newDir, resolved);
    if (next === normalizeRelative(current)) continue;
    edits.push({ start: statement.valueStart, end: statement.valueEnd, text: quoteString(next) });
    notes.push(t('Updated package path "{0}".', key));
  }
  return edits;
}

interface RewriteContext {
  /** Directory the existing `path` values are relative to (pre-move). */
  resolveFrom: string;
  /** Directory the new `path` values must be relative to (post-move). */
  relativeTo: string;
  oldDir: string;
  newDir: string;
  /** Rewrite only paths that resolve into the moved member. */
  onlyMovedTarget: boolean;
  notes: string[];
}

function rewriteContext(
  resolveFrom: string,
  relativeTo: string,
  oldDir: string,
  newDir: string,
  onlyMovedTarget: boolean,
  notes: string[],
): RewriteContext {
  return { resolveFrom, relativeTo, oldDir, newDir, onlyMovedTarget, notes };
}

function remapPath(decoded: string, context: RewriteContext): string | undefined {
  if (!decoded || path.isAbsolute(decoded)) return undefined;
  const resolved = path.resolve(context.resolveFrom, decoded);
  const targetsMoved = resolved === context.oldDir || isInside(context.oldDir, resolved);
  if (context.onlyMovedTarget && !targetsMoved) return undefined;

  const mapped = targetsMoved
    ? path.join(context.newDir, path.relative(context.oldDir, resolved))
    : resolved;
  const next = relativeDir(context.relativeTo, mapped);
  return next === normalizeRelative(decoded) ? undefined : next;
}

function rewriteDeclarationPaths(
  editor: TomlEditor,
  declarations: DependencyDeclaration[],
  context: RewriteContext,
): TextEdit[] {
  const edits: TextEdit[] = [];
  for (const declaration of declarations) {
    if (declaration.kind !== 'path' || !declaration.path) continue;
    const next = remapPath(declaration.path, context);
    if (!next) continue;

    const tablePath = declarationTablePathParts(declaration);
    const inline = findInlineStatement(editor, tablePath.join('.'), declaration.key);
    if (inline && inline.valueRaw !== undefined && inline.valueStart !== undefined && inline.valueEnd !== undefined) {
      const updated = replaceInlinePath(inline.valueRaw, declaration.path, next);
      if (updated) edits.push({ start: inline.valueStart, end: inline.valueEnd, text: updated });
      continue;
    }

    const child = findChildTable(editor, tablePath, declaration.key);
    if (!child) continue;
    const pathStatement = findPathStatement(child);
    if (!pathStatement || pathStatement.valueStart === undefined || pathStatement.valueEnd === undefined) continue;
    edits.push({ start: pathStatement.valueStart, end: pathStatement.valueEnd, text: quoteString(next) });
  }
  return edits;
}

function declarationTablePathParts(declaration: DependencyDeclaration): string[] {
  return declaration.target
    ? ['target', declaration.target, declaration.table]
    : [declaration.table];
}

/** `[workspace.dependencies]`, both inline values and `[...foo]` sub-tables. */
function rewriteWorkspaceDependencyPaths(editor: TomlEditor, context: RewriteContext): TextEdit[] {
  const edits: TextEdit[] = [];
  const base = ['workspace', 'dependencies'];

  const table = editor.getTable('workspace.dependencies');
  if (table) {
    for (const statement of table.statements) {
      const inline = rewriteInlineStatement(statement, context);
      if (inline) {
        edits.push(inline);
        context.notes.push(t('Rewrote a [workspace.dependencies] path entry.'));
      }
    }
  }

  for (const child of editor.getTables()) {
    if (child.path.length !== base.length + 1) continue;
    if (!base.every((part, index) => child.path[index] === part)) continue;
    const edit = rewriteSubTablePath(child, context);
    if (edit) {
      edits.push(edit);
      context.notes.push(t('Rewrote a [workspace.dependencies] path entry.'));
    }
  }
  return edits;
}

/** Best effort: `[patch.crates-io] foo = { path = "..." }` and sub-tables. */
function rewritePatchPaths(editor: TomlEditor, context: RewriteContext): TextEdit[] {
  const edits: TextEdit[] = [];
  for (const table of editor.getTables()) {
    if (table.path[0] !== 'patch') continue;
    if (table.path.length === 2) {
      for (const statement of table.statements) {
        const edit = rewriteInlineStatement(statement, context);
        if (edit) {
          edits.push(edit);
          context.notes.push(t('Rewrote a [patch] path entry.'));
        }
      }
    } else if (table.path.length >= 3) {
      const edit = rewriteSubTablePath(table, context);
      if (edit) {
        edits.push(edit);
        context.notes.push(t('Rewrote a [patch] path entry.'));
      }
    }
  }
  return edits;
}

function rewriteInlineStatement(statement: Statement, context: RewriteContext): TextEdit | undefined {
  if (statement.valueRaw === undefined || statement.valueStart === undefined || statement.valueEnd === undefined) {
    return undefined;
  }
  const current = extractInlinePath(statement.valueRaw);
  if (!current) return undefined;
  const next = remapPath(current, context);
  if (!next) return undefined;
  const updated = replaceInlinePath(statement.valueRaw, current, next);
  if (!updated) return undefined;
  return { start: statement.valueStart, end: statement.valueEnd, text: updated };
}

function rewriteSubTablePath(table: TableInfo, context: RewriteContext): TextEdit | undefined {
  const statement = findPathStatement(table);
  if (!statement || statement.valueRaw === undefined) return undefined;
  if (statement.valueStart === undefined || statement.valueEnd === undefined) return undefined;
  const current = decodeTomlString(statement.valueRaw);
  if (current === undefined) return undefined;
  const next = remapPath(current, context);
  if (!next) return undefined;
  return { start: statement.valueStart, end: statement.valueEnd, text: quoteString(next) };
}

// ------------------------------------------------------------------ TOML bits

function findInlineStatement(editor: TomlEditor, tableName: string, key: string): Statement | undefined {
  const table = editor.getTable(tableName);
  if (!table) return undefined;
  return (
    table.statements.find((statement) => statement.keyPath?.length === 1 && statement.keyPath[0] === key) ??
    table.statements.find((statement) => statement.keyRaw?.trim() === key)
  );
}

function findChildTable(editor: TomlEditor, basePath: string[], key: string): TableInfo | undefined {
  return editor
    .getTables()
    .find(
      (table) =>
        table.path.length === basePath.length + 1 &&
        basePath.every((part, index) => table.path[index] === part) &&
        table.path[basePath.length] === key,
    );
}

function findPathStatement(table: TableInfo): Statement | undefined {
  return (
    table.statements.find((statement) => statement.keyPath?.length === 1 && statement.keyPath[0] === 'path') ??
    table.statements.find((statement) => statement.keyRaw?.trim() === 'path')
  );
}

/** Replace only the `path = "..."` value, keeping sibling fields untouched. */
export function replaceInlinePath(rawValue: string, currentPath: string, nextPath: string): string | undefined {
  // `path`, `"path"` and `'path'` are all valid TOML keys.
  const match = /((?:(?:"path"|'path')|\bpath)\s*=\s*)("(?:[^"\\]|\\.)*"|'[^']*')/.exec(rawValue);
  if (!match) return undefined;
  const decoded = decodeTomlString(match[2]!);
  if (decoded !== currentPath) return undefined;
  return rawValue.slice(0, match.index) + match[1] + quoteString(nextPath) + rawValue.slice(match.index + match[0].length);
}

function extractInlinePath(rawValue: string): string | undefined {
  const match = /((?:(?:"path"|'path')|\bpath)\s*=\s*)("(?:[^"\\]|\\.)*"|'[^']*')/.exec(rawValue);
  return match ? decodeTomlString(match[2]!) : undefined;
}

function decodeTomlString(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return undefined;
}

// ------------------------------------------------------------------ helpers

function relativeDir(root: string, target: string): string {
  const relative = path.relative(root, target).split(path.sep).join('/');
  return relative || '.';
}

function normalizeRelative(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function hasGlob(value: string): boolean {
  return /[*?\[]/.test(value);
}

function isCaseOnlyRename(from: string, to: string): boolean {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return false;
  return from.toLowerCase() === to.toLowerCase();
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function sameStringList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function formatStringArray(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

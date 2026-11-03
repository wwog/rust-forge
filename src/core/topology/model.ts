/**
 * Workspace topology: a read-only snapshot of how `workspace.members`,
 * `workspace.default-members` and `workspace.exclude` interact, plus the pure
 * edit planner used by the topology panel.
 *
 * Everything here is text-only: no disk writes and no `vscode` imports, so the
 * cargo membership rules stay unit-testable under plain Node.
 */
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { TomlEditor } from '../toml/editor.js';
import {
  isWorkspacePathExcluded,
  matchesMemberPattern,
  workspaceTable,
  type ProjectModel,
} from '../cargo/project.js';
import { t } from '../i18n.js';

/** Mirrors `TopologyMemberData` from the webview protocol. */
export interface TopologyMember {
  name: string;
  /** Workspace-relative, slash-separated member directory (`.` for the root package). */
  relative: string;
  manifestPath: string;
  isRootPackage: boolean;
  /** Explicit `workspace.members` entry, or the glob that includes this member. */
  memberPattern?: string;
  coveredByGlob: boolean;
  isDefault: boolean;
  excluded: boolean;
}

/** Mirrors `TopologyPatternData` from the webview protocol. */
export interface TopologyPattern {
  pattern: string;
  glob: boolean;
  resolved: string[];
  excluded: string[];
}

/** Mirrors `TopologyIssueData` from the webview protocol. */
export interface TopologyIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface TopologySnapshot {
  members: TopologyMember[];
  patterns: TopologyPattern[];
  defaultMembers: string[];
  exclude: string[];
  issues: TopologyIssue[];
  hasDefaultMembers: boolean;
}

export interface TopologyBuildInput {
  model: ProjectModel;
  /** Text of the root `Cargo.toml`. */
  rootText: string;
  /**
   * Stray entries per root-level container (`crates` -> `["README.md"]`).
   * The command reads them from disk; tests can omit this.
   */
  containerStrayEntries?: Record<string, string[]>;
}

/**
 * Derive the topology view model. Cargo semantics that matter here:
 * - explicit `members` entries bypass `exclude`;
 * - `exclude` only filters glob expansion;
 * - no `default-members` key means every member is a default member.
 */
export function buildTopologySnapshot(input: TopologyBuildInput): TopologySnapshot {
  const { model, rootText } = input;
  const issues: TopologyIssue[] = [];
  let manifest: Record<string, unknown> = {};
  try {
    manifest = parseToml(rootText) as Record<string, unknown>;
  } catch {
    issues.push({
      id: 'manifest-parse',
      severity: 'error',
      message: t('The workspace manifest could not be parsed.'),
    });
  }

  const ws = workspaceTable(manifest);
  const memberPatterns = stringArray(ws?.members);
  const excludePatterns = stringArray(ws?.exclude);
  const defaults = stringArray(ws?.['default-members']);
  const hasDefaults = !!ws && Object.prototype.hasOwnProperty.call(ws, 'default-members');

  const memberRelative = new Map<string, string>();
  for (const member of model.members) {
    memberRelative.set(path.resolve(member.dir), relativeDir(model.root, member.dir));
  }
  const relatives = [...memberRelative.values()];

  const explicitPatterns = memberPatterns.filter((pattern) => !hasGlob(pattern)).map((pattern) => normalizeMemberPattern(pattern));

  const members: TopologyMember[] = model.members.map((member) => {
    const relative = memberRelative.get(path.resolve(member.dir)) ?? relativeDir(model.root, member.dir);
    const isRootPackage = path.resolve(member.dir) === path.resolve(model.root);
    const explicit = memberPatterns.some(
      (pattern) => !hasGlob(pattern) && normalizeMemberPattern(pattern) === relative,
    );
    const coveringGlob = explicit
      ? undefined
      : memberPatterns.find((pattern) => hasGlob(pattern) && matchesMemberPattern(relative, pattern));
    const memberPattern = explicit
      ? memberPatterns.find((pattern) => !hasGlob(pattern) && normalizeMemberPattern(pattern) === relative)
      : coveringGlob;

    const isDefault = hasDefaults
      ? defaults.some((entry) => defaultEntryMatches(entry, relative))
      : true;
    const excluded = !explicit && isWorkspacePathExcluded(relative, excludePatterns);

    return {
      name: member.name,
      relative,
      manifestPath: member.manifestPath,
      isRootPackage,
      memberPattern,
      coveredByGlob: !explicit && !!coveringGlob,
      isDefault,
      excluded,
    };
  });

  const patterns: TopologyPattern[] = memberPatterns.map((pattern) => {
    const glob = hasGlob(pattern);
    const normalized = normalizeMemberPattern(pattern);
    const resolved = glob
      ? relatives.filter((relative) => matchesMemberPattern(relative, pattern))
      : relatives.filter((relative) => relative === normalized);
    const excluded = glob
      ? excludePatterns.filter((entry) => {
          const norm = normalizeMemberPattern(entry);
          if (!norm) return false;
          // A plain exclude can cover a whole subtree of the glob; a glob
          // exclude only matches one shape. Both are reported so the panel can
          // explain why a glob resolves to fewer crates than expected.
          if (explicitPatterns.includes(norm)) return false;
          return matchesMemberPattern(norm, pattern) || isAncestorOfAny(norm, resolved);
        })
      : [];
    return { pattern, glob, resolved, excluded };
  });

  // --- issues -------------------------------------------------------------

  if (hasDefaults) {
    for (const entry of defaults) {
      const resolves = members.some((member) => defaultEntryMatches(entry, member.relative));
      if (!resolves) {
        issues.push({
          id: `default-member-missing:${entry}`,
          severity: 'error',
          message: t('"workspace.default-members" entry "{0}" does not resolve to a workspace member.', entry),
        });
      }
    }
  }

  for (const pattern of patterns) {
    if (!pattern.glob && pattern.resolved.length === 0) {
      issues.push({
        id: `member-missing:${pattern.pattern}`,
        severity: 'error',
        message: t('"workspace.members" entry "{0}" does not resolve to a member.', pattern.pattern),
      });
    }
    if (pattern.glob && pattern.resolved.length === 0) {
      if (pattern.excluded.length) {
        issues.push({
          id: `member-glob-excluded:${pattern.pattern}`,
          severity: 'warning',
          message: t('Member glob "{0}" is entirely excluded by workspace.exclude.', pattern.pattern),
        });
      } else {
        issues.push({
          id: `member-glob-empty:${pattern.pattern}`,
          severity: 'error',
          message: t('Member glob "{0}" matches no directories.', pattern.pattern),
        });
      }
    }
  }

  const explicitEntries = memberPatterns.filter((pattern) => !hasGlob(pattern));
  for (const entry of excludePatterns) {
    for (const explicitEntry of explicitEntries) {
      const explicitRelative = normalizeMemberPattern(explicitEntry);
      if (!explicitRelative) continue;
      if (!isWorkspacePathExcluded(explicitRelative, [entry])) continue;
      issues.push({
        id: `exclude-explicit:${entry}:${explicitEntry}`,
        severity: 'warning',
        message: t(
          '"workspace.exclude" entry "{0}" is ignored for the explicit member "{1}".',
          entry,
          explicitEntry,
        ),
      });
    }
  }

  for (const [container, entries] of Object.entries(input.containerStrayEntries ?? {})) {
    if (!entries.length) continue;
    issues.push({
      id: `container-stray:${container}`,
      severity: 'info',
      message: t('"{0}" contains entries that are not workspace members: {1}.', container, entries.join(', ')),
    });
  }

  return {
    members,
    patterns,
    defaultMembers: defaults,
    exclude: excludePatterns,
    issues,
    hasDefaultMembers: hasDefaults,
  };
}

// ------------------------------------------------------------------ editing

export interface TopologyEditRequest {
  defaultMembers: string[];
  exclude: string[];
}

export interface TopologyEditOptions {
  /**
   * Known members (from `cargo metadata` / `ProjectModel`). When omitted the
   * planner falls back to the patterns declared in the manifest, which cannot
   * validate glob-resolved members as precisely.
   */
  members?: readonly { name: string; relative: string }[];
}

export interface TopologyEditPlan {
  changed: boolean;
  text: string;
  issues: TopologyIssue[];
}

/**
 * Plan a `workspace.default-members` / `workspace.exclude` rewrite.
 *
 * - `default-members` is always written as workspace-relative directories.
 *   Selecting every member removes the key instead (Cargo's default is all
 *   members), and an entry that resolves to no member is rejected without
 *   touching the text.
 * - `exclude` is normalized and de-duplicated, but user entries are kept even
 *   when they are redundant; the redundant ones are reported as warnings.
 */
export function planTopologyEdit(
  text: string,
  request: TopologyEditRequest,
  options: TopologyEditOptions = {},
): TopologyEditPlan {
  const issues: TopologyIssue[] = [];
  let manifest: Record<string, unknown>;
  try {
    manifest = parseToml(text) as Record<string, unknown>;
  } catch {
    return {
      changed: false,
      text,
      issues: [{ id: 'manifest-parse', severity: 'error', message: t('The workspace manifest could not be parsed.') }],
    };
  }

  const ws = workspaceTable(manifest);
  const editor = new TomlEditor(text);
  // Dotted definitions such as `workspace.members = [...]` are not addressable
  // through the table editor; refuse rather than corrupt the manifest.
  if (!editor.hasTable('workspace')) {
    return {
      changed: false,
      text,
      issues: [
        {
          id: 'workspace-dotted',
          severity: 'error',
          message: t('This manifest declares workspace settings with dotted keys and cannot be edited safely.'),
        },
      ],
    };
  }

  const memberPatterns = stringArray(ws?.members);
  const known = options.members;
  const selected = new Set<string>();

  for (const raw of request.defaultMembers) {
    const normalized = normalizeMemberPattern(raw);
    if (!normalized) {
      issues.push({
        id: `invalid-default:${raw}`,
        severity: 'error',
        message: t('"{0}" is not a workspace member.', raw),
      });
      continue;
    }

    if (known) {
      const exact = known.find((member) => member.relative === normalized);
      if (exact) {
        selected.add(exact.relative);
        continue;
      }
      const covered = hasGlob(normalized)
        ? known.filter((member) => matchesMemberPattern(member.relative, normalized))
        : [];
      if (covered.length) {
        for (const member of covered) selected.add(member.relative);
        continue;
      }
      issues.push({
        id: `invalid-default:${raw}`,
        severity: 'error',
        message: t('"{0}" is not a workspace member.', raw),
      });
      continue;
    }

    // Fallback: a declared member path, or a path covered by a declared glob.
    const declared = memberPatterns.some(
      (pattern) => normalizeMemberPattern(pattern) === normalized,
    );
    const covered = memberPatterns.some(
      (pattern) => hasGlob(pattern) && matchesMemberPattern(normalized, pattern),
    );
    if (declared || covered) {
      selected.add(normalized);
    } else {
      issues.push({
        id: `invalid-default:${raw}`,
        severity: 'error',
        message: t('"{0}" is not a workspace member.', raw),
      });
    }
  }

  // A rejected entry must not result in a partial rewrite.
  if (issues.some((issue) => issue.severity === 'error')) {
    return { changed: false, text, issues };
  }

  // --- workspace.exclude ---------------------------------------------------
  const nextExclude: string[] = [];
  for (const raw of request.exclude) {
    const normalized = normalizeMemberPattern(raw);
    if (!normalized) continue;
    // Cargo resolves exclude entries relative to the workspace root; absolute
    // paths and parent traversal cannot describe a directory inside it.
    if (path.isAbsolute(raw) || normalized.split('/').includes('..')) {
      issues.push({
        id: `invalid-exclude:${raw}`,
        severity: 'error',
        message: t('workspace.exclude entries must be relative paths inside the workspace: "{0}".', raw),
      });
      continue;
    }
    if (!nextExclude.includes(normalized)) nextExclude.push(normalized);
  }
  if (issues.some((issue) => issue.severity === 'error')) {
    return { changed: false, text, issues };
  }

  // An excluded directory stops being a member when only a glob pulls it in.
  // Keeping it in default-members would make the whole manifest invalid, so it
  // is dropped with an explicit warning instead of writing a broken config.
  const survivesExclude = (relative: string): boolean => {
    const explicit = memberPatterns.some(
      (pattern) => !hasGlob(pattern) && normalizeMemberPattern(pattern) === relative,
    );
    if (explicit) return true;
    const globCovered = memberPatterns.some(
      (pattern) => hasGlob(pattern) && matchesMemberPattern(relative, pattern),
    );
    // Members discovered through path dependencies are not governed by exclude.
    if (!globCovered) return true;
    return !isWorkspacePathExcluded(relative, nextExclude);
  };

  for (const relative of [...selected]) {
    if (survivesExclude(relative)) continue;
    selected.delete(relative);
    issues.push({
      id: `default-excluded:${relative}`,
      severity: 'warning',
      message: t('"{0}" was removed from default-members because workspace.exclude excludes it.', relative),
    });
  }

  const survivingKnown = known ? known.filter((member) => survivesExclude(member.relative)) : [];
  const allSurvivorsSelected =
    !!known &&
    survivingKnown.length > 0 &&
    survivingKnown.every((member) => selected.has(member.relative));

  const nextDefaults = [...selected];
  const currentDefaults = stringArray(ws?.['default-members']);
  const hasDefaults = !!ws && Object.prototype.hasOwnProperty.call(ws, 'default-members');

  const edits = [];
  if (allSurvivorsSelected) {
    if (hasDefaults) edits.push(...editor.removeKey('workspace', 'default-members'));
  } else if (hasDefaults || nextDefaults.length || (known && known.length > 0)) {
    // An explicit empty list ("no default members") is meaningful and must be
    // written, but an empty workspace with an untouched key stays untouched.
    const explicitEmpty = !hasDefaults && nextDefaults.length === 0 && !!known && known.length > 0;
    if (explicitEmpty || !sameStringList(currentDefaults, nextDefaults)) {
      edits.push(...editor.setKey('workspace', 'default-members', formatStringArray(nextDefaults)));
    }
  }

  const currentExclude = stringArray(ws?.exclude);
  if (!sameStringList(currentExclude, nextExclude)) {
    edits.push(
      ...(nextExclude.length
        ? editor.setKey('workspace', 'exclude', formatStringArray(nextExclude))
        : editor.removeKey('workspace', 'exclude')),
    );
  }

  // Redundant excludes are allowed (the user may have their reasons) but are
  // surfaced so the panel can explain why the entry has no effect.
  const explicitEntries = memberPatterns.filter((pattern) => !hasGlob(pattern));
  for (const entry of nextExclude) {
    for (const explicitEntry of explicitEntries) {
      const explicitRelative = normalizeMemberPattern(explicitEntry);
      if (!explicitRelative) continue;
      const id = `exclude-explicit:${entry}:${explicitEntry}`;
      if (issues.some((issue) => issue.id === id)) continue;
      if (entry === explicitRelative || explicitRelative.startsWith(`${entry}/`)) {
        issues.push({
          id,
          severity: 'warning',
          message: t(
            '"workspace.exclude" entry "{0}" is ignored for the explicit member "{1}".',
            entry,
            explicitEntry,
          ),
        });
      }
    }
    for (const pattern of memberPatterns) {
      if (!hasGlob(pattern)) continue;
      const id = `exclude-glob-member:${entry}`;
      if (issues.some((issue) => issue.id === id)) continue;
      if (matchesMemberPattern(entry, pattern) && !explicitEntries.some((e) => normalizeMemberPattern(e) === entry)) {
        issues.push({
          id,
          severity: 'warning',
          message: t('Excluding "{0}" removes it from the workspace because a member glob matches it.', entry),
        });
      }
    }
  }

  const nextText = edits.length ? editor.apply(edits) : text;
  return { changed: nextText !== text, text: nextText, issues };
}

// ------------------------------------------------------------------ helpers

function relativeDir(root: string, dir: string): string {
  const relative = path.relative(root, dir).split(path.sep).join('/');
  return relative || '.';
}

function defaultEntryMatches(entry: string, relative: string): boolean {
  const normalized = normalizeMemberPattern(entry);
  if (!normalized) return false;
  // Cargo treats default-members as member paths (or globs), never package
  // names: `default-members = ["app"]` is rejected when the crate lives in
  // crates/app. Keep the UI aligned with that rule.
  return normalized === relative || (hasGlob(normalized) && matchesMemberPattern(relative, normalized));
}

/** Would the plain `ancestor` path contain (or equal) one of `paths`? */
function isAncestorOfAny(ancestor: string, paths: readonly string[]): boolean {
  if (hasGlob(ancestor)) return false;
  return paths.some((entry) => entry === ancestor || entry.startsWith(`${ancestor}/`));
}

function hasGlob(value: string): boolean {
  return /[*?\[]/.test(value);
}

function normalizeMemberPattern(pattern: string): string {
  return pattern.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
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

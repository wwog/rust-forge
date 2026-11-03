/**
 * Workspace model discovery. This is the single place that decides whether the
 * folder is a single package or a workspace root, and where member manifests
 * live — everything else consumes `ProjectModel`.
 */
import * as fs from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { fileExists, findUp, readTextFile } from '../process.js';
import { TomlEditor, type TextEdit } from '../toml/editor.js';
import type { CargoMetadata, CargoPackage } from './types.js';

export interface ManifestModule {
  name: string;
  path: string;
}

export interface DiscoveredPackage {
  name: string;
  manifestPath: string;
  dir: string;
}

export interface ProjectModel {
  kind: 'workspace' | 'package';
  root: string;
  /** Manifest that defines the workspace (same as root manifest). */
  manifestPath: string;
  members: DiscoveredPackage[];
  /** Root package for single-package projects. */
  rootPackage?: DiscoveredPackage;
  workspaceManifest?: Record<string, unknown>;
  packageManifest?: Record<string, unknown>;
  /** True when `[workspace]` exists but is an empty shell. */
  emptyWorkspaceShell: boolean;
  hasLockfile: boolean;
  toolchainFile?: string;
  rustfmtFile?: string;
}

export interface ManifestParseResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export async function parseManifestFile(file: string): Promise<ManifestParseResult> {
  let text: string;
  try {
    text = await readTextFile(file);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  try {
    const data = parseToml(text) as Record<string, unknown>;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function parseManifestText(text: string): Promise<ManifestParseResult> {
  try {
    return { ok: true, data: parseToml(text) as Record<string, unknown> };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function workspaceTable(manifest: Record<string, unknown>): Record<string, unknown> | undefined {
  return asRecord(manifest.workspace);
}

export function packageTable(manifest: Record<string, unknown>): Record<string, unknown> | undefined {
  return asRecord(manifest.package);
}

/** `[workspace]` present but carrying no members/packages = empty shell. */
export function isEmptyWorkspaceShell(manifest: Record<string, unknown>): boolean {
  const ws = workspaceTable(manifest);
  if (!ws) return false;
  const members = ws.members;
  const hasMembers = Array.isArray(members) && members.length > 0;
  const hasPackage = packageTable(manifest) !== undefined;
  const meaningfulKeys = Object.keys(ws).filter((k) => k !== 'members');
  return !hasMembers && !hasPackage && meaningfulKeys.length === 0;
}

/** Expand workspace member globs the way cargo does. */
export async function expandMembers(
  root: string,
  patterns: string[],
  excludePatterns: string[] = [],
): Promise<DiscoveredPackage[]> {
  const result: DiscoveredPackage[] = [];
  const seen = new Set<string>();

  const add = async (dir: string, fallbackName: string): Promise<void> => {
    const manifestPath = path.join(dir, 'Cargo.toml');
    if (!(await fileExists(manifestPath))) return;
    if (seen.has(manifestPath)) return;
    seen.add(manifestPath);
    const parsed = await parseManifestFile(manifestPath);
    const name = parsed.data ? String(packageTable(parsed.data)?.name ?? fallbackName) : fallbackName;
    result.push({ name, manifestPath, dir });
  };

  for (const pattern of patterns) {
    const normalized = normalizeMemberPattern(pattern);
    if (!normalized) continue;
    if (!hasGlob(normalized)) {
      const dir = path.join(root, normalized);
      await add(dir, path.basename(dir));
      continue;
    }
    for (const dir of await expandGlobDirs(normalized.split('/'), 0, root)) {
      // Cargo applies `exclude` only to glob-expanded members; an explicit
      // member path wins over `exclude` (verified with cargo 1.99).
      if (isWorkspacePathExcluded(path.relative(root, dir), excludePatterns)) continue;
      await add(dir, path.basename(dir));
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Cargo's `workspace.exclude` semantics for a glob-expanded candidate.
 *
 * - A plain path excludes that path and every directory below it, so
 *   `exclude = ["crates"]` drops `crates/app` when `members = ["crates/*"]`.
 * - A glob matches the path itself only: `exclude = ["crates/*"]` does not
 *   drop `crates/group/app`.
 * - Explicit `members` entries bypass `exclude` entirely; callers must only
 *   apply this to glob expansion.
 */
export function isWorkspacePathExcluded(relative: string, excludePatterns: readonly string[]): boolean {
  const normalized = normalizeMemberPattern(relative);
  if (!normalized) return false;
  return excludePatterns.some((raw) => {
    const pattern = normalizeMemberPattern(raw);
    if (!pattern) return false;
    if (hasGlob(pattern)) return matchesMemberPattern(normalized, pattern);
    return normalized === pattern || normalized.startsWith(`${pattern}/`);
  });
}

function normalizeMemberPattern(pattern: string): string {
  return pattern.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function hasGlob(value: string): boolean {
  return /[*?\[]/.test(value);
}

/** Directories matched by a member/exclude glob, walking every segment. */
async function expandGlobDirs(segments: string[], index: number, current: string): Promise<string[]> {
  if (index >= segments.length) return [current];
  const segment = segments[index];
  if (!segment || segment === '.') return expandGlobDirs(segments, index + 1, current);

  if (segment === '**') {
    const dirs = await expandGlobDirs(segments, index + 1, current);
    for (const entry of await readDirectories(current)) {
      dirs.push(...(await expandGlobDirs(segments, index, entry)));
    }
    return dirs;
  }

  if (!hasGlob(segment)) {
    const next = path.join(current, segment);
    return (await isDirectory(next)) ? expandGlobDirs(segments, index + 1, next) : [];
  }

  const matcher = globSegmentMatcher(segment);
  const dirs: string[] = [];
  for (const entry of await readDirectories(current)) {
    if (!matcher(path.basename(entry))) continue;
    dirs.push(...(await expandGlobDirs(segments, index + 1, entry)));
  }
  return dirs;
}

async function readDirectories(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/** Match one path segment with `*`, `?` and `[...]` glob syntax. */
function globSegmentMatcher(segment: string): (name: string) => boolean {
  let source = '^';
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (ch === '*') {
      source += '.*';
    } else if (ch === '?') {
      source += '.';
    } else if (ch === '[') {
      const close = segment.indexOf(']', i + 1);
      if (close < 0) {
        source += '\\[';
      } else {
        let body = segment.slice(i + 1, close);
        if (body.startsWith('!')) body = `^${body.slice(1)}`;
        source += `[${body.replace(/\\/g, '\\\\')}]`;
        i = close;
      }
    } else {
      source += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  source += '$';
  try {
    const regex = new RegExp(source);
    return (name) => regex.test(name);
  } catch {
    return (name) => name === segment;
  }
}

/**
 * Does `relative` (a member directory) fall under `pattern` (a members/exclude
 * entry, possibly a glob)? Both sides are normalized first so callers can pass
 * native paths or cargo-style forward-slash patterns interchangeably.
 */
export function matchesMemberPattern(relative: string, pattern: string): boolean {
  const parts = normalizeMemberPattern(relative).split('/').filter(Boolean);
  const patternParts = normalizeMemberPattern(pattern).split('/').filter(Boolean);
  return matchMemberSegments(patternParts, 0, parts, 0);
}

export interface MemberRemovalPlan {
  changed: boolean;
  text: string;
  /** Set when the directory is not managed through `workspace.members`. */
  reason?: 'not-listed';
}

function formatStringArray(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

/**
 * Plan the removal of one workspace member without touching disk.
 *
 * A glob entry such as `crates/*` must never be dropped: it still covers every
 * other crate. Instead the removed directory is added to `workspace.exclude`.
 * Directories that are neither explicit members nor matched by a glob are not
 * managed by the members list at all (cargo includes them as path dependencies)
 * and cannot be removed through this operation.
 */
export function planMemberRemoval(manifestText: string, relativeDir: string): MemberRemovalPlan {
  let manifest: Record<string, unknown>;
  try {
    manifest = parseToml(manifestText) as Record<string, unknown>;
  } catch {
    return { changed: false, text: manifestText };
  }

  const ws = workspaceTable(manifest);
  const members = stringArray(ws?.members);
  const excludes = stringArray(ws?.exclude);
  const relative = normalizeMemberPattern(relativeDir);
  if (!relative) return { changed: false, text: manifestText, reason: 'not-listed' };

  const explicitIndexes = new Set(
    members.flatMap((member, index) => (normalizeMemberPattern(member) === relative ? [index] : [])),
  );
  const explicit = explicitIndexes.size > 0;
  const coveredByGlob = members.some(
    (member, index) => !explicitIndexes.has(index) && hasGlob(member) && matchesMemberPattern(relative, member),
  );

  if (!explicit && !coveredByGlob) {
    return { changed: false, text: manifestText, reason: 'not-listed' };
  }

  const editor = new TomlEditor(manifestText);
  // Dotted `workspace.members = [...]` definitions cannot be updated safely by
  // the table editor, so leave those manifests alone rather than corrupt them.
  if (!editor.hasTable('workspace')) return { changed: false, text: manifestText };

  const edits: TextEdit[] = [];
  if (explicit) {
    const nextMembers = members.filter((_, index) => !explicitIndexes.has(index));
    edits.push(...editor.setKey('workspace', 'members', formatStringArray(nextMembers)));
  }
  if (coveredByGlob) {
    const alreadyExcluded = isWorkspacePathExcluded(relative, excludes);
    if (!alreadyExcluded) {
      edits.push(...editor.setKey('workspace', 'exclude', formatStringArray([...excludes, relative])));
    }
  }

  // Cargo rejects a `default-members` entry that no longer resolves to a
  // member, so drop exact matches alongside the member entry.
  const defaultMembers = stringArray(ws?.['default-members']);
  const nextDefaults = defaultMembers.filter((pattern) => normalizeMemberPattern(pattern) !== relative);
  if (nextDefaults.length !== defaultMembers.length) {
    edits.push(
      ...(nextDefaults.length
        ? editor.setKey('workspace', 'default-members', formatStringArray(nextDefaults))
        : editor.removeKey('workspace', 'default-members')),
    );
  }

  return { changed: true, text: editor.apply(edits) };
}

/**
 * Plan adding a workspace member.
 *
 * A directory already covered by a member glob needs no extra entry, and an
 * exact `exclude` entry for it must be dropped so it actually becomes a member
 * again after a previous removal.
 */
export function planMemberAddition(manifestText: string, memberPattern: string): MemberRemovalPlan {
  let manifest: Record<string, unknown>;
  try {
    manifest = parseToml(manifestText) as Record<string, unknown>;
  } catch {
    return { changed: false, text: manifestText };
  }

  const ws = workspaceTable(manifest);
  const members = stringArray(ws?.members);
  const excludes = stringArray(ws?.exclude);
  const target = normalizeMemberPattern(memberPattern);
  if (!target) return { changed: false, text: manifestText };

  const explicit = members.some((member) => normalizeMemberPattern(member) === target);
  const coveredByGlob = members.some(
    (member) => hasGlob(member) && !explicit && matchesMemberPattern(target, member),
  );
  const excluded = isWorkspacePathExcluded(target, excludes);
  // An exact exclude entry can simply be dropped. An ancestor/glob exclude
  // cannot (that would include other directories), but an explicit member
  // entry wins over `exclude`, so adding one is the precise way to include a
  // directory that a member glob would otherwise drop.
  const exactExclude = excludes.some((pattern) => normalizeMemberPattern(pattern) === target);
  const nextExcludes = excludes.filter((pattern) => normalizeMemberPattern(pattern) !== target);

  const editor = new TomlEditor(manifestText);
  if (!editor.hasTable('workspace')) return { changed: false, text: manifestText };

  const edits: TextEdit[] = [];
  if (!explicit && (!coveredByGlob || (excluded && !exactExclude))) {
    edits.push(...editor.setKey('workspace', 'members', formatStringArray([...members, memberPattern])));
  }
  if (nextExcludes.length !== excludes.length) {
    edits.push(
      ...(nextExcludes.length
        ? editor.setKey('workspace', 'exclude', formatStringArray(nextExcludes))
        : editor.removeKey('workspace', 'exclude')),
    );
  }
  if (!edits.length) return { changed: false, text: manifestText };
  return { changed: true, text: editor.apply(edits) };
}

function matchMemberSegments(pattern: string[], index: number, parts: string[], partIndex: number): boolean {
  if (index === pattern.length) return partIndex === parts.length;
  const segment = pattern[index];
  if (segment === '**') {
    if (matchMemberSegments(pattern, index + 1, parts, partIndex)) return true;
    return partIndex < parts.length && matchMemberSegments(pattern, index, parts, partIndex + 1);
  }
  if (partIndex >= parts.length) return false;
  const matches = hasGlob(segment) ? globSegmentMatcher(segment)(parts[partIndex]) : parts[partIndex] === segment;
  return matches && matchMemberSegments(pattern, index + 1, parts, partIndex + 1);
}

/**
 * Resolve the manifest that should be treated as the project root.
 * When `dir` is a workspace member, returns the ancestor workspace manifest
 * and reports the discovery so callers can prompt the user.
 */
export async function discoverProject(
  dir: string,
  options: { respectMembership?: boolean } = {},
): Promise<{ model?: ProjectModel; memberOfWorkspace?: string; error?: string }> {
  const start = path.resolve(dir);
  const localManifest = path.join(start, 'Cargo.toml');
  const hasLocal = await fileExists(localManifest);

  if (!hasLocal) {
    const found = await findUp(start, 'Cargo.toml');
    if (!found) return { error: 'no-manifest' };
    return buildModel(path.dirname(found));
  }

  const parsed = await parseManifestFile(localManifest);
  if (!parsed.ok) return { error: parsed.error };

  const hasWorkspace = workspaceTable(parsed.data!) !== undefined;
  if (hasWorkspace) {
    return buildModel(start);
  }

  // A plain package: check whether an ancestor workspace claims it.
  if (options.respectMembership !== false) {
    const ancestor = await findUp(path.dirname(start), 'Cargo.toml');
    if (ancestor) {
      const ancestorParsed = await parseManifestFile(ancestor);
      const ws = ancestorParsed.data ? workspaceTable(ancestorParsed.data) : undefined;
      if (ws) {
        const root = path.dirname(ancestor);
        const members = await expandMembers(root, stringArray(ws.members), stringArray(ws.exclude));
        if (members.some((m) => path.resolve(m.manifestPath) === path.resolve(localManifest))) {
          const ancestorModel = await buildModel(root);
          return { memberOfWorkspace: root, model: ancestorModel.model, error: ancestorModel.error };
        }
      }
    }
  }

  return buildModel(start);
}

export async function buildModel(root: string): Promise<{ model?: ProjectModel; error?: string }> {
  const manifestPath = path.join(root, 'Cargo.toml');
  if (!(await fileExists(manifestPath))) return { error: 'no-manifest' };

  const parsed = await parseManifestFile(manifestPath);
  if (!parsed.ok) return { error: parsed.error };
  const manifest = parsed.data!;
  const ws = workspaceTable(manifest);
  const pkg = packageTable(manifest);
  const emptyShell = isEmptyWorkspaceShell(manifest);

  const model: ProjectModel = {
    kind: ws && !emptyShell ? 'workspace' : 'package',
    root,
    manifestPath,
    members: [],
    emptyWorkspaceShell: emptyShell,
    hasLockfile: await fileExists(path.join(root, 'Cargo.lock')),
    workspaceManifest: ws,
    packageManifest: pkg,
  };

  const toolchain = path.join(root, 'rust-toolchain.toml');
  const toolchainAlt = path.join(root, 'rust-toolchain');
  if (await fileExists(toolchain)) model.toolchainFile = toolchain;
  else if (await fileExists(toolchainAlt)) model.toolchainFile = toolchainAlt;

  for (const candidate of ['rustfmt.toml', '.rustfmt.toml']) {
    const file = path.join(root, candidate);
    if (await fileExists(file)) {
      model.rustfmtFile = file;
      break;
    }
  }

  if (model.kind === 'workspace') {
    const members = await expandMembers(root, stringArray(ws?.members), stringArray(ws?.exclude));
    if (pkg) {
      const rootPackage: DiscoveredPackage = {
        name: String(pkg.name ?? path.basename(root)),
        manifestPath,
        dir: root,
      };
      model.rootPackage = rootPackage;
      // Cargo treats a workspace root that also has [package] as a member.
      if (!members.some((member) => path.resolve(member.manifestPath) === path.resolve(manifestPath))) {
        members.unshift(rootPackage);
      }
    }
    model.members = members;
  } else if (pkg) {
    const name = String(pkg.name ?? path.basename(root));
    model.rootPackage = { name, manifestPath, dir: root };
    model.members = [model.rootPackage];
  } else {
    return { error: 'no-package' };
  }

  return { model };
}

/**
 * Replace manifest-glob membership with cargo's resolved `workspace_members`.
 *
 * Cargo also promotes path dependencies inside the workspace to members and
 * applies `exclude`, which is hard to reproduce exactly. When metadata comes
 * from the same workspace root, its membership is authoritative.
 */
export function applyMetadataMembers(model: ProjectModel, metadata: CargoMetadata): ProjectModel {
  if (!samePath(metadata.workspace_root, model.root)) return model;

  const byId = new Map(metadata.packages.map((pkg) => [pkg.id, pkg]));
  const seen = new Set<string>();
  const members: DiscoveredPackage[] = [];
  for (const id of metadata.workspace_members) {
    const pkg = byId.get(id);
    if (!pkg) continue;
    // Cargo canonicalizes paths (e.g. /tmp -> /private/tmp on macOS). Rebase
    // its results onto the model root so every path in the model uses the same
    // representation as the folder the user opened.
    const manifestPath = path.join(model.root, path.relative(metadata.workspace_root, pkg.manifest_path));
    const key = path.resolve(manifestPath);
    if (seen.has(key)) continue;
    seen.add(key);
    members.push({ name: pkg.name, manifestPath, dir: path.dirname(manifestPath) });
  }
  if (!members.length) return model;

  members.sort((a, b) => a.name.localeCompare(b.name));
  const rootPackage = members.find((member) => path.resolve(member.manifestPath) === path.resolve(model.manifestPath));
  return { ...model, members, rootPackage: rootPackage ?? model.rootPackage };
}

/** Compare paths that may differ only by symlinks (e.g. /tmp on macOS). */
function samePath(a: string, b: string): boolean {
  if (path.resolve(a) === path.resolve(b)) return true;
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Upstream-most workspace root from a cargo metadata result. */
export function workspaceRootFromMetadata(metadata: CargoMetadata): string {
  return metadata.workspace_root;
}

/** Convenience: map manifest path -> workspace member package. */
export function packagesByManifest(packages: CargoPackage[]): Map<string, CargoPackage> {
  const map = new Map<string, CargoPackage>();
  for (const pkg of packages) {
    map.set(path.resolve(pkg.manifest_path), pkg);
  }
  return map;
}

/** Extract the raw manifest text and a ready-to-use editor. */
export async function openManifestEditor(file: string): Promise<TomlEditor> {
  return new TomlEditor(await readTextFile(file));
}

export function workspacePackageTable(manifest: Record<string, unknown>): Record<string, unknown> | undefined {
  const ws = workspaceTable(manifest);
  return ws ? asRecord(ws.package) : undefined;
}

export function workspaceDependenciesTable(manifest: Record<string, unknown>): Record<string, unknown> | undefined {
  const ws = workspaceTable(manifest);
  return ws ? asRecord(ws.dependencies) : undefined;
}

export function isWorkspaceMemberManifest(manifest: Record<string, unknown>): boolean {
  return workspaceTable(manifest) !== undefined;
}

export { asRecord };

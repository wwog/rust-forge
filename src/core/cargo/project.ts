/**
 * Workspace model discovery. This is the single place that decides whether the
 * folder is a single package or a workspace root, and where member manifests
 * live — everything else consumes `ProjectModel`.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { fileExists, findUp, readTextFile } from '../process.js';
import { TomlEditor } from '../toml/editor.js';
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

/** Expand workspace member globs the way cargo does (single `*` segment). */
export async function expandMembers(root: string, patterns: string[]): Promise<DiscoveredPackage[]> {
  const result: DiscoveredPackage[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const normalized = pattern.replace(/\\/g, '/').replace(/\/+$/, '');
    if (normalized.includes('*')) {
      const segments = normalized.split('/');
      const star = segments.findIndex((s) => s.includes('*'));
      const base = segments.slice(0, star).join('/');
      const rest = segments.slice(star + 1);
      const prefix = segments[star].replace(/\*/g, '');
      const dir = path.join(root, base);
      let entries: string[] = [];
      try {
        entries = await fs.readdir(dir);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.startsWith(prefix)) continue;
        const candidateDir = path.join(dir, entry, ...rest);
        const manifestPath = path.join(candidateDir, 'Cargo.toml');
        if (await fileExists(manifestPath)) {
          const parsed = await parseManifestFile(manifestPath);
          const name = parsed.data ? String(packageTable(parsed.data)?.name ?? entry) : entry;
          if (seen.has(manifestPath)) continue;
          seen.add(manifestPath);
          result.push({ name, manifestPath, dir: candidateDir });
        }
      }
    } else {
      const manifestPath = path.join(root, normalized, 'Cargo.toml');
      if (await fileExists(manifestPath)) {
        const parsed = await parseManifestFile(manifestPath);
        const fallback = path.basename(path.join(root, normalized));
        const name = parsed.data ? String(packageTable(parsed.data)?.name ?? fallback) : fallback;
        if (seen.has(manifestPath)) continue;
        seen.add(manifestPath);
        result.push({ name, manifestPath, dir: path.join(root, normalized) });
      }
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
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
        const members = await expandMembers(root, stringArray(ws.members));
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
    const members = await expandMembers(root, stringArray(ws?.members));
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

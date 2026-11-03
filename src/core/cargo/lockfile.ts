/** Cargo.lock parsing: resolved versions keyed by crate name. */
import * as path from 'node:path';
import * as semver from 'semver';
import { parse as parseToml } from 'smol-toml';
import { fileExists, readTextFile } from '../process.js';
import { cargoReqToRange } from '../deps/versions.js';

export interface LockedPackage {
  name: string;
  version: string;
  source?: string;
  checksum?: string;
  dependencies?: string[];
}

export interface LockfileInfo {
  path: string;
  version: number;
  packages: LockedPackage[];
  /** name -> highest locked version (SemVer ordering, prereleases last). */
  versions: Map<string, string[]>;
}

export async function readLockfile(root: string): Promise<LockfileInfo | undefined> {
  const file = path.join(root, 'Cargo.lock');
  if (!(await fileExists(file))) return undefined;
  let text: string;
  try {
    text = await readTextFile(file);
  } catch {
    return undefined;
  }
  return parseLockfile(text, file);
}

export function parseLockfile(text: string, file = 'Cargo.lock'): LockfileInfo | undefined {
  let data: Record<string, unknown>;
  try {
    data = parseToml(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const rawPackages = Array.isArray(data.package) ? data.package : [];
  const packages: LockedPackage[] = [];
  const versions = new Map<string, string[]>();

  for (const entry of rawPackages) {
    if (!entry || typeof entry !== 'object') continue;
    const pkg = entry as Record<string, unknown>;
    if (typeof pkg.name !== 'string' || typeof pkg.version !== 'string') continue;
    packages.push({
      name: pkg.name,
      version: pkg.version,
      source: typeof pkg.source === 'string' ? pkg.source : undefined,
      checksum: typeof pkg.checksum === 'string' ? pkg.checksum : undefined,
      dependencies: Array.isArray(pkg.dependencies) ? pkg.dependencies.filter((d): d is string => typeof d === 'string') : undefined,
    });
    const list = versions.get(pkg.name) ?? [];
    list.push(pkg.version);
    versions.set(pkg.name, list);
  }

  for (const list of versions.values()) {
    list.sort((a, b) => {
      // Stable releases first: a `2.0.0-rc.1` must never shadow `1.10.0` just
      // because its core version is higher.
      const aStable = isStable(a);
      const bStable = isStable(b);
      if (aStable !== bStable) return aStable ? -1 : 1;
      return semver.rcompare(a, b);
    });
  }

  return {
    path: file,
    version: typeof data.version === 'number' ? data.version : 3,
    packages,
    versions,
  };
}

function isStable(version: string): boolean {
  const parsed = semver.parse(version);
  return !!parsed && parsed.prerelease.length === 0;
}

/** Is a package resolved in the lockfile? */
export function isLocked(lock: LockfileInfo | undefined, name: string): boolean {
  return !!lock?.versions.get(name)?.length;
}

/**
 * Locked version of a direct dependency. When a requirement is supplied and
 * the crate is locked at several versions, prefer the one that satisfies the
 * declaration instead of merely the highest.
 */
export function lockedVersion(
  lock: LockfileInfo | undefined,
  name: string,
  requirement?: string,
): string | undefined {
  const versions = lock?.versions.get(name);
  if (!versions?.length) return undefined;
  const range = requirement ? cargoReqToRange(requirement) : undefined;
  if (range) {
    const match = versions.find((version) => semver.satisfies(version, range, { includePrerelease: false }));
    if (match) return match;
  }
  return versions[0];
}

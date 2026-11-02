/** Cargo.lock parsing: resolved versions keyed by crate name. */
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { fileExists, readTextFile } from '../process.js';

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
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const semver = require('semver') as typeof import('semver');
        return semver.rcompare(a, b);
      } catch {
        return b.localeCompare(a);
      }
    });
  }

  return {
    path: file,
    version: typeof data.version === 'number' ? data.version : 3,
    packages,
    versions,
  };
}

/** Is a package resolved in the lockfile? */
export function isLocked(lock: LockfileInfo | undefined, name: string): boolean {
  return !!lock?.versions.get(name)?.length;
}

/** Locked version of a direct dependency, if present. */
export function lockedVersion(lock: LockfileInfo | undefined, name: string): string | undefined {
  return lock?.versions.get(name)?.[0];
}

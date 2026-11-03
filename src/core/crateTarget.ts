/**
 * Cargo target discovery for a single package directory.
 *
 * The project view offers "Run" only for binary crates and "Run Tests" for
 * every crate. `cargo metadata` targets are authoritative when available;
 * otherwise the manifest and the conventional `src/main.rs` / `src/bin`
 * layout are inspected so the menu still works before metadata loads.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { fileExists, readTextFile } from './process.js';
import type { CargoPackage } from './cargo/types.js';

export interface CrateBinaryTarget {
  name: string;
  /** Absolute source path when it can be determined. */
  path?: string;
}

export interface CrateTargetInfo {
  dir: string;
  packageName?: string;
  /** True when at least one crate target produces an executable. */
  isBinary: boolean;
  /** True when a library target exists. */
  isLibrary: boolean;
  /** `src/main.rs` exists, even when autobins disables it. */
  hasMain: boolean;
  binaries: CrateBinaryTarget[];
  /** `[package] default-run`, used when several binaries exist. */
  defaultRun?: string;
  /** True when the result came from `cargo metadata` targets. */
  fromMetadata: boolean;
}

const LIBRARY_TARGET_KINDS = new Set(['lib', 'rlib', 'dylib', 'cdylib', 'staticlib', 'proc-macro']);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Detect the runnable targets of the package rooted at `dir`. */
export async function detectCrateTargets(
  dir: string,
  options: { metadataPackage?: CargoPackage } = {},
): Promise<CrateTargetInfo> {
  const manifestPath = path.join(dir, 'Cargo.toml');
  let manifest: Record<string, unknown> = {};
  try {
    manifest = parseToml(await readTextFile(manifestPath)) as Record<string, unknown>;
  } catch {
    // A broken or missing manifest still gets the conventional file layout.
  }

  const packageTable = asRecord(manifest.package);
  const packageName =
    options.metadataPackage?.name ??
    (typeof packageTable?.name === 'string' ? packageTable.name : undefined) ??
    path.basename(dir);

  const hasMain = await fileExists(path.join(dir, 'src', 'main.rs'));
  const defaultRun =
    typeof packageTable?.['default-run'] === 'string' ? packageTable['default-run'] : undefined;
  const autobins = packageTable?.autobins !== false;
  const binaries: CrateBinaryTarget[] = [];
  // Cargo forbids two binary targets with the same name, so the name is the
  // identity: a metadata target and an explicit `[[bin]]` entry for the same
  // name describe the same target.
  const add = (target: CrateBinaryTarget) => {
    if (!binaries.some((existing) => existing.name === target.name)) binaries.push(target);
  };

  // Metadata is authoritative for explicit targets, but it can be stale when
  // only source files changed (the controller reloads metadata on Cargo.toml
  // changes). Merge the conventional layout so adding src/main.rs immediately
  // enables the Run action on the next tree refresh.
  if (options.metadataPackage) {
    for (const target of options.metadataPackage.targets) {
      if (target.kind.includes('bin') && (await fileExists(target.src_path))) {
        add({ name: target.name, path: target.src_path });
      }
    }
  }

  if (autobins && hasMain) {
    add({ name: packageName, path: path.join(dir, 'src', 'main.rs') });
  }
  if (autobins) {
    for (const target of await autoBinTargets(dir)) add(target);
  }

  const explicitBins = Array.isArray(manifest.bin) ? manifest.bin : [];
  for (const value of explicitBins) {
    const bin = asRecord(value);
    if (!bin) continue;
    const name =
      typeof bin.name === 'string'
        ? bin.name
        : typeof bin.path === 'string'
          ? path.basename(bin.path, '.rs')
          : packageName;
    const source = typeof bin.path === 'string' ? path.resolve(dir, bin.path) : undefined;
    add({ name, path: source });
  }

  const libTable = asRecord(manifest.lib);
  const isLibrary =
    libTable !== undefined ||
    (options.metadataPackage?.targets.some((target) =>
      target.kind.some((kind) => LIBRARY_TARGET_KINDS.has(kind)),
    ) ??
      false) ||
    (await fileExists(path.join(dir, 'src', 'lib.rs')));

  return {
    dir,
    packageName,
    isBinary: binaries.length > 0,
    isLibrary,
    hasMain,
    binaries,
    defaultRun,
    fromMetadata: options.metadataPackage !== undefined,
  };
}

/** `src/bin/*.rs` and `src/bin/<name>/main.rs` auto-discovered binaries. */
async function autoBinTargets(dir: string): Promise<CrateBinaryTarget[]> {
  const binDir = path.join(dir, 'src', 'bin');
  let entries;
  try {
    entries = await fs.readdir(binDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const targets: CrateBinaryTarget[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.rs')) {
      targets.push({
        name: entry.name.slice(0, -'.rs'.length),
        path: path.join(binDir, entry.name),
      });
    } else if (entry.isDirectory()) {
      const main = path.join(binDir, entry.name, 'main.rs');
      if (await fileExists(main)) targets.push({ name: entry.name, path: main });
    }
  }
  return targets.sort((a, b) => a.name.localeCompare(b.name));
}

/** Context value suffix used by the project view's run/test menu clauses. */
export function crateTargetContextSuffix(info: CrateTargetInfo | undefined): ':binary' | ':library' | '' {
  if (!info) return '';
  if (info.isBinary) return ':binary';
  if (info.isLibrary) return ':library';
  return '';
}

/**
 * Cargo registry mirror selection.
 *
 * Mirrors are applied only to cargo processes that Rust Forge starts, via the
 * global `--config` flag. Nothing is written to `~/.cargo/config.toml` or the
 * user's shell environment, so selecting a mirror here cannot change builds
 * run outside the extension.
 */

export interface CargoMirror {
  /** Stable identifier stored in `rustForge.cargoMirror`. */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** Sparse/git index URL. `undefined` means "let Cargo use its own config". */
  index?: string;
  builtin: boolean;
}

/** A user-added mirror. Stored in `rustForge.cargoMirrors`. */
export interface CustomCargoMirror {
  name: string;
  index: string;
}

export const OFFICIAL_MIRROR_ID = 'official';
export const CUSTOM_MIRROR_PREFIX = 'custom:';
/** Source name used for the replacement; fixed so custom names stay free-form. */
export const MIRROR_SOURCE_NAME = 'rustforge-mirror';

/**
 * Built-in mirrors. URLs verified against the mirrors' documentation:
 * Tsinghua (TUNA), Aliyun, USTC and RsProxy all expose sparse indexes.
 */
export const BUILTIN_MIRRORS: readonly CargoMirror[] = [
  {
    id: OFFICIAL_MIRROR_ID,
    name: 'Official crates.io',
    builtin: true,
  },
  {
    id: 'tuna',
    name: 'Tsinghua TUNA',
    index: 'sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/',
    builtin: true,
  },
  {
    id: 'aliyun',
    name: 'Aliyun',
    index: 'sparse+https://mirrors.aliyun.com/crates.io-index/',
    builtin: true,
  },
  {
    id: 'ustc',
    name: 'USTC',
    index: 'sparse+https://mirrors.ustc.edu.cn/crates.io-index/',
    builtin: true,
  },
  {
    id: 'rsproxy',
    name: 'RsProxy',
    index: 'sparse+https://rsproxy.cn/index/',
    builtin: true,
  },
];

export function customMirrorId(name: string): string {
  return `${CUSTOM_MIRROR_PREFIX}${name.trim()}`;
}

/** Convert a stored custom entry into the common shape. */
export function customMirror(entry: CustomCargoMirror): CargoMirror {
  return {
    id: customMirrorId(entry.name),
    name: entry.name,
    index: entry.index,
    builtin: false,
  };
}

/**
 * Resolve the selected mirror id, falling back to the official source when the
 * id is unknown (for example after a custom mirror was deleted or the setting
 * was edited by hand).
 */
export function resolveCargoMirror(
  selectedId: string | undefined,
  custom: readonly CustomCargoMirror[] = [],
): CargoMirror {
  const id = (selectedId ?? OFFICIAL_MIRROR_ID).trim();
  const builtin = BUILTIN_MIRRORS.find((mirror) => mirror.id === id);
  if (builtin) return builtin;

  const customName = id.startsWith(CUSTOM_MIRROR_PREFIX)
    ? id.slice(CUSTOM_MIRROR_PREFIX.length)
    : id;
  const entry = custom.find((mirror) => mirror.name === customName);
  if (entry) return customMirror(entry);

  return BUILTIN_MIRRORS[0]!;
}

/** All mirrors shown in the picker, built-ins first. */
export function allCargoMirrors(custom: readonly CustomCargoMirror[] = []): CargoMirror[] {
  return [...BUILTIN_MIRRORS, ...custom.map(customMirror)];
}

/**
 * Arguments that make one cargo invocation use `index`.
 *
 * `--config` is a cargo global option, so it must precede the subcommand. The
 * values are TOML fragments; `JSON.stringify` provides the required quoting.
 */
export function mirrorConfigArgs(index: string | undefined): string[] {
  if (!index) return [];
  return [
    '--config',
    `source.crates-io.replace-with=${JSON.stringify(MIRROR_SOURCE_NAME)}`,
    '--config',
    `source.${MIRROR_SOURCE_NAME}.registry=${JSON.stringify(index)}`,
  ];
}

/**
 * Add the selected index to `cargo install`.
 *
 * Unlike dependency resolution, `cargo install` does not honor `[source]`
 * replacement for the crate being installed; it needs `--index` explicitly.
 * `--list`, `--path` and `--git` installs do not contact a registry.
 */
export function installMirrorArgs(args: readonly string[], index: string | undefined): string[] {
  const result = [...args];
  if (!index || result[0] !== 'install') return result;
  if (
    result.includes('--index') ||
    result.includes('--list') ||
    result.includes('--path') ||
    result.includes('--git')
  ) {
    return result;
  }
  return [result[0]!, '--index', index, ...result.slice(1)];
}

/**
 * Normalize a user-entered sparse URL. Sparse indexes require a trailing
 * slash; add it rather than failing a URL copied without one.
 */
export function normalizeMirrorIndex(value: string): string {
  const trimmed = value.trim();
  // A query/fragment already marks the end of the path; do not append a slash
  // after it.
  if (trimmed.startsWith('sparse+') && !trimmed.endsWith('/') && !/[?#]/.test(trimmed)) {
    return `${trimmed}/`;
  }
  return trimmed;
}

/** Validate an index URL before storing it. Returns an error message key. */
export function mirrorIndexError(value: string): 'empty' | 'invalid' | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'empty';
  const withoutSparse = trimmed.replace(/^sparse\+/i, '');
  if (/[\s"'\\]/.test(withoutSparse)) return 'invalid';
  let url: URL;
  try {
    url = new URL(withoutSparse);
  } catch {
    return 'invalid';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'invalid';
  if (!url.hostname) return 'invalid';
  // Credentials would end up in logs and terminal commands; mirrors are public.
  if (url.username || url.password) return 'invalid';
  return undefined;
}

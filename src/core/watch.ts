/**
 * Project configuration files whose contents feed the project model.
 *
 * Kept as a pure helper so the extension host wiring and the tests agree on
 * exactly which files trigger a model refresh.
 */

const PROJECT_CONFIG_FILES = new Set([
  'Cargo.toml',
  'Cargo.lock',
  'rust-toolchain.toml',
  'rust-toolchain',
  'rustfmt.toml',
  '.rustfmt.toml',
]);

/** Is `fileName` (a path or a basename) one of the project configuration files? */
export function isProjectConfigFile(fileName: string): boolean {
  const segments = fileName.split(/[\\/]/);
  const base = segments[segments.length - 1] ?? '';
  return PROJECT_CONFIG_FILES.has(base);
}

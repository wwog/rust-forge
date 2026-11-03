/**
 * Scaffolding shared by the create wizard and in-place initialization.
 *
 * In-place initialization treats the open folder itself as the project root, so
 * the generated files must never add another directory level.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { writeTextFile } from '../process.js';
import { generateRustfmtToml } from '../rustfmt.js';

export interface WorkspaceSkeletonOptions {
  name: string;
  vcs: 'git' | 'none';
  generateRustfmt: boolean;
  language: 'en' | 'zh-cn';
}

/** Cargo-compatible package name derived from the folder name. */
export function defaultCrateName(folder: string): string {
  const base = path
    .basename(path.resolve(folder))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!base) return 'my-rust-project';
  return /^[a-z]/.test(base) ? base : `crate-${base}`;
}

/** Write a `[workspace]` skeleton into `root` without creating a child folder. */
export async function writeWorkspaceSkeleton(root: string, options: WorkspaceSkeletonOptions): Promise<void> {
  await fs.mkdir(root, { recursive: true });
  const manifest = [
    '[workspace]',
    'members = []',
    'resolver = "3"',
    '',
    '[workspace.package]',
    'version = "0.1.0"',
    'edition = "2024"',
    '',
  ].join('\n');
  await writeTextFile(path.join(root, 'Cargo.toml'), manifest);
  await fs.mkdir(path.join(root, 'crates'), { recursive: true });
  await writeTextFile(
    path.join(root, 'README.md'),
    `# ${options.name}\n\nA Cargo workspace.\n\n## Members\n\nAdd crates under \`crates/\`, then run \`cargo metadata\`.\n`,
  );
  if (options.vcs === 'git') {
    await writeTextFile(path.join(root, '.gitignore'), '/target\n');
  }
  if (options.generateRustfmt) {
    await writeTextFile(
      path.join(root, 'rustfmt.toml'),
      generateRustfmtToml({ language: options.language }),
    );
  }
}

/** `cargo` command surface used by the extension. */
import * as path from 'node:path';
import { augmentedPath, run, which, type RunResult, type RunOptions } from '../process.js';
import type { CargoMetadata } from './types.js';
import { installMirrorArgs, mirrorConfigArgs } from './mirror.js';

export interface CargoServiceOptions {
  cargoPath?: string;
  offline?: boolean;
  timeoutMs?: number;
  /**
   * Registry index used by cargo processes started by Rust Forge. Undefined
   * means "leave Cargo's own configuration untouched".
   */
  mirrorIndex?: string;
}

/**
 * Build the `cargo update` arguments for one `name@version` spec.
 *
 * A bare `name@version` is a package *selection* and fails when that exact
 * version is not already in the lockfile; refreshing a lock-only upgrade needs
 * `-p name --precise version`. Cargo accepts only one `--precise` per
 * invocation, so callers must run one command per spec.
 */
export function updateArgs(spec: string): string[] {
  const args = ['update'];
  const at = spec.lastIndexOf('@');
  if (at > 0) args.push('-p', spec.slice(0, at), '--precise', spec.slice(at + 1));
  else args.push(spec);
  return args;
}

export class CargoService {
  private resolved?: string;

  constructor(private readonly options: CargoServiceOptions = {}) {}

  get offline(): boolean {
    return !!this.options.offline;
  }

  /** Global `--config` arguments for the selected mirror (empty for official). */
  mirrorArgs(): string[] {
    return mirrorConfigArgs(this.options.mirrorIndex);
  }

  /** Locate cargo once; the result is cached for the session. */
  async resolve(): Promise<string | undefined> {
    if (this.resolved) return this.resolved;
    const configured = this.options.cargoPath?.trim();
    const found = configured ? await which(configured, augmentedPath()) : await which('cargo', augmentedPath());
    if (found) this.resolved = found;
    return found;
  }

  async isAvailable(): Promise<boolean> {
    return (await this.resolve()) !== undefined;
  }

  async exec(args: string[], cwd: string, overrides: Partial<RunOptions> = {}): Promise<RunResult> {
    const cargo = await this.resolve();
    if (!cargo) {
      return {
        code: 127,
        stdout: '',
        stderr: 'cargo was not found on PATH',
        command: `cargo ${args.join(' ')}`,
        durationMs: 0,
        missingBinary: true,
      };
    }
    const offlineArgs = this.options.offline && !args.includes('--offline') ? ['--offline'] : [];
    // `install` ignores source replacement, so it gets an explicit index.
    const effectiveArgs = installMirrorArgs(args, this.options.mirrorIndex);
    // `--config` is a cargo global option, so it must precede the subcommand.
    const allArgs = [...this.mirrorArgs(), ...offlineArgs, ...effectiveArgs];
    return run(cargo, allArgs, {
      cwd,
      timeoutMs: overrides.timeoutMs ?? this.options.timeoutMs ?? 120_000,
      ...overrides,
    });
  }

  async metadata(cwd: string, opts: { noDeps?: boolean; offline?: boolean } = {}, overrides: Partial<RunOptions> = {}): Promise<{ ok: boolean; metadata?: CargoMetadata; result: RunResult; error?: string }> {
    const args = ['metadata', '--format-version', '1'];
    if (opts.noDeps) args.push('--no-deps');
    if (opts.offline ?? this.offline) args.push('--offline');
    const result = await this.exec(args, cwd, overrides);
    if (result.missingBinary) {
      return { ok: false, result, error: 'cargo-missing' };
    }
    if (result.code !== 0) {
      return { ok: false, result, error: result.stderr.trim() || result.stdout.trim() };
    }
    try {
      const metadata = JSON.parse(result.stdout) as CargoMetadata;
      return { ok: true, metadata, result };
    } catch (err) {
      return { ok: false, result, error: `Failed to parse cargo metadata: ${(err as Error).message}` };
    }
  }

  async check(cwd: string, opts: { workspace?: boolean; allTargets?: boolean; package?: string } = {}, overrides: Partial<RunOptions> = {}): Promise<RunResult> {
    const args = ['check'];
    if (opts.allTargets) args.push('--all-targets');
    if (opts.workspace) args.push('--workspace');
    if (opts.package) args.push('--package', opts.package);
    return this.exec(args, cwd, { timeoutMs: 600_000, ...overrides });
  }

  async update(cwd: string, specs: string[], overrides: Partial<RunOptions> = {}): Promise<RunResult> {
    if (specs.length <= 1) {
      return this.exec(updateArgs(specs[0] ?? ''), cwd, { timeoutMs: 600_000, ...overrides });
    }
    // `--precise` may only appear once per invocation, so refresh each package
    // separately and merge the results.
    const results: RunResult[] = [];
    for (const spec of specs) {
      results.push(await this.exec(updateArgs(spec), cwd, { timeoutMs: 600_000, ...overrides }));
    }
    return mergeRunResults(results);
  }

  /**
   * Refresh one or more packages in Cargo.lock without pinning an exact
   * version. Used after a manifest rewrite, where the new requirement already
   * constrains the resolution and `--precise` would fight it.
   */
  async refreshPackages(cwd: string, names: string[], overrides: Partial<RunOptions> = {}): Promise<RunResult> {
    const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    if (!unique.length) return emptyRunResult('cargo update');
    const args = ['update'];
    for (const name of unique) args.push('-p', name);
    return this.exec(args, cwd, { timeoutMs: 600_000, ...overrides });
  }

  /**
   * Pin each spec to an exact version. Cargo accepts one `--precise` per
   * invocation, so this runs one command per spec and merges the results.
   */
  async updatePrecise(
    cwd: string,
    specs: { name: string; targetVersion: string }[],
    overrides: Partial<RunOptions> = {},
  ): Promise<RunResult> {
    const unique = new Map<string, { name: string; targetVersion: string }>();
    for (const spec of specs) {
      if (!spec.name || !spec.targetVersion) continue;
      unique.set(`${spec.name}@${spec.targetVersion}`, spec);
    }
    if (!unique.size) return emptyRunResult('cargo update');
    const results: RunResult[] = [];
    for (const spec of unique.values()) {
      results.push(
        await this.exec(['update', '-p', spec.name, '--precise', spec.targetVersion], cwd, {
          timeoutMs: 600_000,
          ...overrides,
        }),
      );
    }
    return mergeRunResults(results);
  }

  async fmtCheck(cwd: string, overrides: Partial<RunOptions> = {}): Promise<RunResult> {
    return this.exec(['fmt', '--all', '--', '--check'], cwd, { timeoutMs: 180_000, ...overrides });
  }

  async fmt(cwd: string, overrides: Partial<RunOptions> = {}): Promise<RunResult> {
    return this.exec(['fmt', '--all'], cwd, { timeoutMs: 180_000, ...overrides });
  }

  async clippy(cwd: string, opts: { allTargets?: boolean; workspace?: boolean } = {}, overrides: Partial<RunOptions> = {}): Promise<RunResult> {
    const args = ['clippy'];
    if (opts.allTargets !== false) args.push('--all-targets');
    if (opts.workspace) args.push('--workspace');
    return this.exec(args, cwd, { timeoutMs: 600_000, ...overrides });
  }

  /** `cargo tree -d` with a machine-stable prefix and no de-duplication. */
  async treeDuplicates(cwd: string, opts: { workspace?: boolean } = {}, overrides: Partial<RunOptions> = {}): Promise<RunResult> {
    const args = ['tree', '--duplicates', '--prefix', 'depth', '--no-dedupe', '--charset', 'ascii'];
    if (opts.workspace) args.push('--workspace');
    return this.exec(args, cwd, { timeoutMs: 180_000, ...overrides });
  }

  async new(cwd: string, name: string, kind: 'bin' | 'lib', vcs: 'git' | 'none' = 'git'): Promise<RunResult> {
    return this.exec(['new', '--name', name, kind === 'lib' ? '--lib' : '--bin', '--vcs', vcs, name], cwd, {
      timeoutMs: 120_000,
    });
  }

  /** Initialize an existing (empty) folder as the package root. */
  async init(cwd: string, name: string, kind: 'bin' | 'lib', vcs: 'git' | 'none' = 'git'): Promise<RunResult> {
    return this.exec(['init', '--name', name, kind === 'lib' ? '--lib' : '--bin', '--vcs', vcs], cwd, {
      timeoutMs: 120_000,
    });
  }

  async add(
    cwd: string,
    spec: { name: string; version?: string; features?: string[]; optional?: boolean; table?: 'dependencies' | 'dev-dependencies' | 'build-dependencies'; noDefaultFeatures?: boolean; path?: string },
    overrides: Partial<RunOptions> = {},
  ): Promise<RunResult> {
    const args = ['add'];
    const dep = spec.version ? `${spec.name}@${spec.version}` : spec.name;
    args.push(dep);
    if (spec.table === 'dev-dependencies') args.push('--dev');
    if (spec.table === 'build-dependencies') args.push('--build');
    if (spec.features?.length) args.push('--features', spec.features.join(','));
    // Cargo rejects `--optional` together with `--dev`.
    if (spec.optional && spec.table !== 'dev-dependencies') args.push('--optional');
    if (spec.noDefaultFeatures) args.push('--no-default-features');
    if (spec.path) args.push('--path', spec.path);
    return this.exec(args, cwd, { timeoutMs: 300_000, ...overrides });
  }

  async generateLockfile(cwd: string, overrides: Partial<RunOptions> = {}): Promise<RunResult> {
    return this.exec(['generate-lockfile'], cwd, { timeoutMs: 300_000, ...overrides });
  }

  get lockfilePath(): string {
    return 'Cargo.lock';
  }
}

export function lockfileFor(root: string): string {
  return path.join(root, 'Cargo.lock');
}

/** Merge per-package `cargo update` runs into one result. */
function mergeRunResults(results: RunResult[]): RunResult {
  const failed = results.find((result) => result.code !== 0);
  return {
    code: failed?.code ?? 0,
    stdout: results.map((result) => result.stdout).filter(Boolean).join('\n'),
    stderr: results.map((result) => result.stderr).filter(Boolean).join('\n'),
    command: results.map((result) => result.command).join(' && '),
    durationMs: results.reduce((total, result) => total + result.durationMs, 0),
    missingBinary: results.some((result) => result.missingBinary),
    timedOut: results.some((result) => result.timedOut),
    cancelled: results.some((result) => result.cancelled),
  };
}

/** A no-op success, used when there is nothing to refresh. */
function emptyRunResult(command: string): RunResult {
  return { code: 0, stdout: '', stderr: '', command, durationMs: 0 };
}

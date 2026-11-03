/** `cargo` command surface used by the extension. */
import * as path from 'node:path';
import { augmentedPath, run, which, type RunResult, type RunOptions } from '../process.js';
import type { CargoMetadata } from './types.js';

export interface CargoServiceOptions {
  cargoPath?: string;
  offline?: boolean;
  timeoutMs?: number;
}

/**
 * Build `cargo update` arguments from `name@version` specs.
 *
 * A bare `name@version` is a package *selection* and fails when that exact
 * version is not already in the lockfile; refreshing a lock-only upgrade needs
 * `-p name --precise version`.
 */
export function updateArgs(specs: string[]): string[] {
  const args = ['update'];
  for (const spec of specs) {
    const at = spec.lastIndexOf('@');
    if (at > 0) args.push('-p', spec.slice(0, at), '--precise', spec.slice(at + 1));
    else args.push(spec);
  }
  return args;
}

export class CargoService {
  private resolved?: string;

  constructor(private readonly options: CargoServiceOptions = {}) {}

  get offline(): boolean {
    return !!this.options.offline;
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
    const offlineArgs = this.options.offline && !args.includes('--offline') ? ['--offline', ...args] : args;
    return run(cargo, offlineArgs, {
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
    return this.exec(updateArgs(specs), cwd, { timeoutMs: 600_000, ...overrides });
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
    if (spec.optional) args.push('--optional');
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

/**
 * Toolchain detection and MSRV comparison.
 *
 * Detection order is `rust-toolchain.toml` (or the legacy plain file), then
 * `rustup show active-toolchain`, then plain `rustc --version`.
 */
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import * as semver from 'semver';
import { augmentedPath, fileExists, readTextFile, run, which, type RunResult } from './process.js';

export interface ToolchainFileSpec {
  path: string;
  channel?: string;
  components?: string[];
  targets?: string[];
  profile?: string;
}

export interface InstalledToolchain {
  name: string;
  active: boolean;
  default: boolean;
  version?: string;
  path?: string;
}

export interface ChannelUpdate {
  channel: string;
  installed?: string;
  latest?: string;
  updateAvailable: boolean;
  detail?: string;
}

export type MsrvRelation = 'satisfied' | 'violated' | 'unknown';

export interface ToolchainState {
  /** `cargo` resolved on PATH. */
  cargoPath?: string;
  rustupPath?: string;
  rustcVersion?: string;
  activeToolchain?: string;
  activeSource?: 'rust-toolchain.toml' | 'rustup' | 'rustc';
  toolchainFile?: ToolchainFileSpec;
  installed: InstalledToolchain[];
  updates: ChannelUpdate[];
  msrv?: string;
  msrvRelation: MsrvRelation;
  /** Components installed for the active toolchain, when obtainable. */
  components?: string[];
  targets?: string[];
  rustupVersion?: string;
}

export interface ToolchainOptions {
  rustupPath?: string;
  cargoPath?: string;
  timeoutMs?: number;
}

export class ToolchainService {
  constructor(private readonly options: ToolchainOptions = {}) {}

  async rustup(): Promise<string | undefined> {
    const configured = this.options.rustupPath?.trim();
    return configured ? which(configured, augmentedPath()) : which('rustup', augmentedPath());
  }

  async cargo(): Promise<string | undefined> {
    const configured = this.options.cargoPath?.trim();
    return configured ? which(configured, augmentedPath()) : which('cargo', augmentedPath());
  }

  private async rustupRun(args: string[], cwd: string): Promise<RunResult | undefined> {
    const rustup = await this.rustup();
    if (!rustup) return undefined;
    return run(rustup, args, { cwd, timeoutMs: this.options.timeoutMs ?? 60_000 });
  }

  async readToolchainFile(root: string): Promise<ToolchainFileSpec | undefined> {
    const tomlFile = path.join(root, 'rust-toolchain.toml');
    if (await fileExists(tomlFile)) {
      try {
        const data = parseToml(await readTextFile(tomlFile)) as Record<string, unknown>;
        const tc = (data.toolchain ?? {}) as Record<string, unknown>;
        const channel = typeof data.channel === 'string' ? data.channel : typeof tc.channel === 'string' ? tc.channel : undefined;
        return {
          path: tomlFile,
          channel,
          components: stringArray(typeof tc.components === 'string' ? [tc.components] : tc.components),
          targets: stringArray(tc.targets),
          profile: typeof tc.profile === 'string' ? tc.profile : undefined,
        };
      } catch {
        return { path: tomlFile };
      }
    }
    const plain = path.join(root, 'rust-toolchain');
    if (await fileExists(plain)) {
      try {
        const channel = (await readTextFile(plain)).trim().split('\n')[0]?.trim();
        return { path: plain, channel: channel || undefined };
      } catch {
        return { path: plain };
      }
    }
    return undefined;
  }

  async detect(root: string, msrv?: string): Promise<ToolchainState> {
    const state: ToolchainState = {
      installed: [],
      updates: [],
      msrvRelation: 'unknown',
      msrv,
    };

    state.cargoPath = await this.cargo();
    state.rustupPath = await this.rustup();
    state.toolchainFile = await this.readToolchainFile(root);
    if (state.toolchainFile) state.activeSource = 'rust-toolchain.toml';

    if (state.cargoPath) {
      const version = await run(state.cargoPath, ['--version'], { cwd: root, timeoutMs: 20_000 });
      if (version.code === 0) {
        state.rustcVersion = parseCargoVersion(version.stdout);
      }
    }

    if (state.rustupPath) {
      const rustupVersion = await run(state.rustupPath, ['--version'], { cwd: root, timeoutMs: 20_000 });
      if (rustupVersion.code === 0) state.rustupVersion = rustupVersion.stdout.trim().split('\n')[0];

      const active = await run(state.rustupPath, ['show', 'active-toolchain'], { cwd: root, timeoutMs: 30_000 });
      if (active.code === 0) {
        const firstLine = active.stdout.trim().split('\n')[0] ?? '';
        const match = firstLine.match(/^(\S+)/);
        if (match) {
          state.activeToolchain = match[1];
          if (!state.toolchainFile) state.activeSource = 'rustup';
        }
      }

      const list = await run(state.rustupPath, ['toolchain', 'list'], { cwd: root, timeoutMs: 30_000 });
      if (list.code === 0) {
        state.installed = parseToolchainList(list.stdout, state.activeToolchain);
      }

      state.updates = await this.checkUpdates(root);
    } else if (state.rustcVersion && !state.activeSource) {
      state.activeSource = 'rustc';
    }

    state.msrv = msrv;
    state.msrvRelation = compareMsrv(state.rustcVersion, msrv);

    if (state.rustupPath && state.installed.length) {
      const components = await this.rustupRun(['component', 'list', '--installed'], root);
      if (components?.code === 0) {
        state.components = components.stdout
          .split('\n')
          .map((l) => l.trim().replace(/\s*\(.*\)$/, ''))
          .filter(Boolean);
      }
      const targets = await this.rustupRun(['target', 'list', '--installed'], root);
      if (targets?.code === 0) {
        state.targets = targets.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
      }
    }

    return state;
  }

  async checkUpdates(root: string): Promise<ChannelUpdate[]> {
    const result = await this.rustupRun(['check'], root);
    if (!result || result.code !== 0) return [];
    const updates: ChannelUpdate[] = [];
    for (const line of result.stdout.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'No updates available' || trimmed.startsWith('rustup -')) continue;
      // e.g. "stable-aarch64-apple-darwin - Up to date : 1.99.1 (...)"
      //      "stable-aarch64-apple-darwin - Update available : 1.99.1 -> 1.99.2"
      const match = trimmed.match(/^(\S+)\s+-\s+(.+?)\s*:\s*(.+)$/);
      if (!match) continue;
      const [, channel, status, detail] = match;
      updates.push({
        channel,
        latest: detail.includes('->') ? detail.split('->').pop()?.trim() : detail,
        installed: detail.includes('->') ? detail.split('->')[0].trim() : detail,
        updateAvailable: /update available/i.test(status),
        detail,
      });
    }
    return updates;
  }

  async update(root: string, channel?: string): Promise<RunResult | undefined> {
    return this.rustupRun(channel ? ['update', channel] : ['update'], root);
  }

  async install(root: string, channel: string, opts: { components?: string[]; profile?: string; force?: boolean } = {}): Promise<RunResult | undefined> {
    const args = ['toolchain', 'install', channel];
    if (opts.force) args.push('--force');
    if (opts.profile) args.push('--profile', opts.profile);
    if (opts.components?.length) args.push('--component', opts.components.join(','));
    return this.rustupRun(args, root);
  }

  async addComponent(root: string, component: string): Promise<RunResult | undefined> {
    return this.rustupRun(['component', 'add', component], root);
  }

  /** Commands shown in the confirmation preview. */
  static installPreview(channel: string): string {
    return `rustup toolchain install ${channel}`;
  }
}

export function parseCargoVersion(output: string): string | undefined {
  const match = output.match(/cargo\s+(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/);
  if (match) return match[1];
  const rustc = output.match(/rustc\s+(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/);
  return rustc?.[1];
}

export function parseToolchainList(output: string, active?: string): InstalledToolchain[] {
  const result: InstalledToolchain[] = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const defaultToolchain = /\(default\)/.test(trimmed);
    const activeMark = /\(active/.test(trimmed);
    const name = trimmed.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    if (!name) continue;
    result.push({
      name,
      active: activeMark || name === active,
      default: defaultToolchain,
    });
  }
  return result;
}

/** Compare the compiler version against a manifest `rust-version`. */
export function compareMsrv(compilerVersion: string | undefined, msrv: string | undefined): MsrvRelation {
  if (!compilerVersion || !msrv) return 'unknown';
  const clean = (v: string) => v.replace(/^rustc\s+/, '').split('-')[0].split('+')[0];
  const compiler = semver.coerce(clean(compilerVersion));
  const required = semver.coerce(msrv);
  if (!compiler || !required) return 'unknown';
  return semver.gte(compiler, required) ? 'satisfied' : 'violated';
}

export function channelIsNightly(channel: string | undefined): boolean {
  return !!channel && /nightly/.test(channel);
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === 'string');
}

/**
 * Toolchain detection and MSRV comparison.
 *
 * Detection order is `rust-toolchain.toml` (or the legacy plain file, both
 * searched from the project root upwards like rustup does), then
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
  activeSource?: 'rust-toolchain.toml' | 'rust-toolchain' | 'rustup' | 'rustc';
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
  /** How long a `rustup check` result stays valid. Defaults to 12 minutes. */
  updatesCacheMs?: number;
}

/** `rustup check` hits the network, so results are reused for a while. */
const DEFAULT_UPDATES_CACHE_MS = 12 * 60 * 1000;

export class ToolchainService {
  private readonly updatesCache = new Map<string, { at: number; updates: ChannelUpdate[] }>();

  constructor(private readonly options: ToolchainOptions = {}) {}

  async rustup(): Promise<string | undefined> {
    const configured = this.options.rustupPath?.trim();
    return configured ? which(configured, augmentedPath()) : which('rustup', augmentedPath());
  }

  async cargo(): Promise<string | undefined> {
    const configured = this.options.cargoPath?.trim();
    return configured ? which(configured, augmentedPath()) : which('cargo', augmentedPath());
  }

  async rustc(): Promise<string | undefined> {
    return which('rustc', augmentedPath());
  }

  private async rustupRun(args: string[], cwd: string): Promise<RunResult | undefined> {
    const rustup = await this.rustup();
    if (!rustup) return undefined;
    return run(rustup, args, { cwd, timeoutMs: this.options.timeoutMs ?? 60_000 });
  }

  /**
   * Find the toolchain override that applies to `root`.
   *
   * rustup walks from the current directory towards the filesystem root, and
   * within a directory prefers `rust-toolchain.toml` over the legacy
   * `rust-toolchain` file. The nearest file wins.
   */
  async readToolchainFile(root: string): Promise<ToolchainFileSpec | undefined> {
    let dir = path.resolve(root);
    for (;;) {
      const tomlFile = path.join(dir, 'rust-toolchain.toml');
      if (await fileExists(tomlFile)) return this.readToolchainSpec(tomlFile, true);
      const legacyFile = path.join(dir, 'rust-toolchain');
      if (await fileExists(legacyFile)) return this.readToolchainSpec(legacyFile, false);
      const parent = path.dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  }

  private async readToolchainSpec(file: string, tomlName: boolean): Promise<ToolchainFileSpec> {
    let content: string;
    try {
      content = await readTextFile(file);
    } catch {
      return { path: file };
    }

    // The legacy `rust-toolchain` file may contain either a bare channel name
    // or the same `[toolchain]` TOML as `rust-toolchain.toml`, so try TOML
    // first for both names.
    const spec = parseToolchainToml(content);
    if (spec) return { path: file, ...spec };
    if (tomlName) return { path: file };

    return { path: file, channel: firstMeaningfulLine(content) };
  }

  async detect(root: string, msrv?: string, options: { refreshUpdates?: boolean } = {}): Promise<ToolchainState> {
    const state: ToolchainState = {
      installed: [],
      updates: [],
      msrvRelation: 'unknown',
      msrv,
    };

    state.cargoPath = await this.cargo();
    state.rustupPath = await this.rustup();
    state.toolchainFile = await this.readToolchainFile(root);
    if (state.toolchainFile) {
      state.activeSource = path.basename(state.toolchainFile.path) === 'rust-toolchain.toml' ? 'rust-toolchain.toml' : 'rust-toolchain';
    }

    const rustc = await this.rustc();
    if (rustc) {
      const version = await run(rustc, ['--version'], { cwd: root, timeoutMs: 20_000 });
      if (version.code === 0) state.rustcVersion = parseCargoVersion(version.stdout);
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

      state.updates = await this.checkUpdates(root, { refresh: options.refreshUpdates });
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

  /**
   * Cached `rustup check` results. `refresh` bypasses the cache (used after an
   * update/install) and failures fall back to the last known result instead of
   * blanking the view.
   */
  async checkUpdates(root: string, options: { refresh?: boolean } = {}): Promise<ChannelUpdate[]> {
    const key = path.resolve(root);
    const cached = this.updatesCache.get(key);
    const now = Date.now();
    const ttl = this.options.updatesCacheMs ?? DEFAULT_UPDATES_CACHE_MS;
    if (!options.refresh && cached && now - cached.at < ttl) return cached.updates;

    const result = await this.rustupRun(['check'], root);
    if (!result || result.code !== 0) return cached?.updates ?? [];

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
    this.updatesCache.set(key, { at: now, updates });
    return updates;
  }

  /** Drop cached `rustup check` results, e.g. after an update or install. */
  invalidateUpdates(root?: string): void {
    if (root === undefined) {
      this.updatesCache.clear();
      return;
    }
    this.updatesCache.delete(path.resolve(root));
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

/**
 * Parse a toolchain file body as TOML. Accepts both `[toolchain]` and a
 * top-level `channel` (older files). Returns undefined when the body is not
 * TOML or carries no toolchain fields, so callers can fall back to the legacy
 * one-line format.
 */
function parseToolchainToml(content: string): Omit<ToolchainFileSpec, 'path'> | undefined {
  let data: unknown;
  try {
    data = parseToml(content);
  } catch {
    return undefined;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;

  const root = data as Record<string, unknown>;
  const toolchainTable = root.toolchain;
  const hasToolchainTable =
    !!toolchainTable && typeof toolchainTable === 'object' && !Array.isArray(toolchainTable);
  const tc = hasToolchainTable ? (toolchainTable as Record<string, unknown>) : {};

  const channel =
    typeof tc.channel === 'string'
      ? tc.channel
      : typeof root.channel === 'string'
        ? root.channel
        : undefined;
  const components = stringArray(typeof tc.components === 'string' ? [tc.components] : tc.components);
  const targets = stringArray(tc.targets);
  const profile = typeof tc.profile === 'string' ? tc.profile : undefined;

  // Treat the body as TOML when it actually looks like a toolchain spec, so a
  // legacy file such as `path = "/opt/rust"` is not misread as a channel name.
  const looksLikeToml =
    hasToolchainTable ||
    'channel' in root ||
    'path' in root ||
    components !== undefined ||
    targets !== undefined ||
    profile !== undefined;
  if (!looksLikeToml) return undefined;
  return { channel, components, targets, profile };
}

/** First non-empty, non-comment line of a legacy `rust-toolchain` file. */
function firstMeaningfulLine(content: string): string | undefined {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    return trimmed;
  }
  return undefined;
}

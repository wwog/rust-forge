/** crates.io sparse-index HTTP client with in-memory caching and offline mode. */
import * as semver from 'semver';
import type * as vscode from 'vscode';

export interface CrateSummary {
  name: string;
  maxVersion: string;
  maxStableVersion?: string;
  description?: string;
  repository?: string;
  documentation?: string;
  homepage?: string;
  updatedAt?: string;
  downloads?: number;
}

export interface CrateVersionInfo {
  num: string;
  yanked: boolean;
  rustVersion?: string;
  license?: string;
  /** Feature name -> features it enables. */
  features: Record<string, string[]>;
  createdAt?: string;
}

export interface CrateDetail extends CrateSummary {
  versions: CrateVersionInfo[];
}

/**
 * Newest non-yanked stable release.
 *
 * crates.io does not guarantee that `versions` is ordered by SemVer (old
 * releases are occasionally backfilled), and build metadata such as
 * `1.1.8+spec-1.1.0` is still a stable release. Sort explicitly and only use
 * prereleases when the crate has no stable release at all.
 */
export function latestStableVersion(
  detail: Pick<CrateDetail, 'versions' | 'maxStableVersion' | 'maxVersion'>,
): string | undefined {
  const maxStable = detail.maxStableVersion;
  if (maxStable && isStableVersion(maxStable) && detail.versions.some((version) => version.num === maxStable && !version.yanked)) {
    return maxStable;
  }
  const stable = detail.versions
    .filter((version) => !version.yanked && isStableVersion(version.num))
    .map((version) => version.num)
    .sort((a, b) => semver.rcompare(a, b));
  if (stable.length) return stable[0];
  if (maxStable && isStableVersion(maxStable)) return maxStable;
  return detail.maxVersion;
}

function isStableVersion(version: string): boolean {
  const parsed = semver.parse(version);
  return !!parsed && parsed.prerelease.length === 0;
}

export interface RegistryClientOptions {
  offline?: boolean;
  timeoutMs?: number;
  userAgent?: string;
  baseUrl?: string;
}

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const TTL_MS = 10 * 60 * 1000;

export class RegistryClient {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private lastNetworkError?: string;
  private offline = false;
  private lastFailureAt = 0;
  private lastSuccessAt = 0;

  constructor(private readonly options: RegistryClientOptions = {}) {
    this.offline = !!options.offline;
  }

  get degraded(): boolean {
    return this.offline || this.lastFailureAt > this.lastSuccessAt;
  }

  get networkError(): string | undefined {
    return this.lastNetworkError;
  }

  setOffline(value: boolean): void {
    this.offline = value;
  }

  /** Mark the client degraded after a failed request so the UI can explain why. */
  private degrade(error: string): void {
    this.lastNetworkError = error;
    this.lastFailureAt = Date.now();
  }

  /** A response arrived (even 404), so the network is reachable again. */
  private markHealthy(): void {
    this.lastSuccessAt = Date.now();
    this.lastNetworkError = undefined;
  }

  private async request<T>(url: string): Promise<T | undefined> {
    if (this.offline) return undefined;
    const cached = this.cache.get(url) as CacheEntry<T> | undefined;
    if (cached && cached.expires > Date.now()) return cached.value;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8000);
      let response: Response;
      try {
        response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': this.options.userAgent ?? 'rust-forge-vscode (Cargo tooling)',
          },
        });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) {
        if (response.status === 404) {
          this.markHealthy();
          return undefined;
        }
        this.degrade(`HTTP ${response.status}`);
        return undefined;
      }
      const value = (await response.json()) as T;
      this.markHealthy();
      this.cache.set(url, { value, expires: Date.now() + TTL_MS });
      return value;
    } catch (err) {
      const message = (err as Error).name === 'AbortError' ? 'timeout' : (err as Error).message;
      this.degrade(message);
      return undefined;
    }
  }

  private base(): string {
    return (this.options.baseUrl ?? 'https://crates.io/api/v1').replace(/\/$/, '');
  }

  async search(query: string, limit = 20): Promise<CrateSummary[]> {
    const url = `${this.base()}/crates?q=${encodeURIComponent(query)}&per_page=${limit}&sort=relevance`;
    const raw = await this.request<{ crates?: RawCrate[] }>(url);
    if (!raw?.crates) return [];
    return raw.crates.map(toSummary);
  }

  async crate(name: string): Promise<CrateDetail | undefined> {
    const url = `${this.base()}/crates/${encodeURIComponent(name)}`;
    const raw = await this.request<{ crate?: RawCrate; versions?: RawVersion[] }>(url);
    if (!raw?.crate) return undefined;
    const versions = (raw.versions ?? [])
      .filter((v) => !v.yanked)
      .map((v) => ({
        num: v.num,
        yanked: !!v.yanked,
        rustVersion: v.rust_version ?? undefined,
        license: v.license ?? undefined,
        features: (v.features ?? {}) as Record<string, string[]>,
        createdAt: v.created_at,
      }));
    return { ...toSummary(raw.crate), versions };
  }

  /**
   * Latest non-yanked, non-prerelease version. Falls back to the crate's
   * `max_version` when the version list is unavailable.
   */
  async latestVersion(name: string): Promise<string | undefined> {
    const detail = await this.crate(name);
    return detail ? latestStableVersion(detail) : undefined;
  }
}

interface RawCrate {
  name: string;
  max_version: string;
  max_stable_version?: string | null;
  description?: string | null;
  repository?: string | null;
  documentation?: string | null;
  homepage?: string | null;
  updated_at?: string;
  downloads?: number;
}

interface RawVersion {
  num: string;
  yanked?: boolean;
  rust_version?: string | null;
  license?: string | null;
  features?: Record<string, unknown>;
  created_at?: string;
}

function toSummary(crate: RawCrate): CrateSummary {
  return {
    name: crate.name,
    maxVersion: crate.max_version,
    maxStableVersion: crate.max_stable_version ?? undefined,
    description: crate.description ?? undefined,
    repository: crate.repository ?? undefined,
    documentation: crate.documentation ?? undefined,
    homepage: crate.homepage ?? undefined,
    updatedAt: crate.updated_at,
    downloads: crate.downloads,
  };
}

/** Canonical crates.io page for a crate, pinned to a version when known. */
export function crateDocsUrl(name: string, version?: string): string {
  const base = `https://crates.io/crates/${encodeURIComponent(name)}`;
  return version && /^\d+\.\d+\.\d+/.test(version) ? `${base}/${encodeURIComponent(version)}` : base;
}

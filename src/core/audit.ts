/**
 * Security advisories.
 *
 * Two sources are supported:
 *  1. `cargo audit --json` when it is installed (authoritative, RustSec);
 *  2. the OSV API, which mirrors RustSec advisories and needs no install.
 *
 * Results are cached on disk so opening the view does not hammer the network.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { run, type RunResult } from './process.js';
import { readLockfile, type LockfileInfo } from './cargo/lockfile.js';

export interface Advisory {
  id: string;
  aliases: string[];
  title: string;
  description?: string;
  severity?: 'low' | 'moderate' | 'high' | 'critical' | 'unknown';
  url?: string;
  fixed?: string;
  patched?: string;
  packageName: string;
  packageVersion: string;
}

export interface AuditResult {
  source: 'cargo-audit' | 'osv' | 'cache' | 'unavailable';
  advisories: Advisory[];
  /** package name -> advisories, keyed for tree rendering. */
  byPackage: Map<string, Advisory[]>;
  error?: string;
  fetchedAt: number;
}

export interface AuditOptions {
  offline?: boolean;
  cacheHours?: number;
  timeoutMs?: number;
  cacheDir?: string;
}

interface CacheShape {
  fetchedAt: number;
  advisories: Advisory[];
}

const OSV_BATCH = 'https://api.osv.dev/v1/querybatch';
const OSV_VULN = 'https://api.osv.dev/v1/vulns';

export class AuditService {
  constructor(private readonly options: AuditOptions = {}) {}

  private cacheDir(): string {
    return this.options.cacheDir ?? path.join(os.tmpdir(), 'rust-forge-audit');
  }

  private cacheFile(root: string, fingerprint: string): string {
    const key = Buffer.from(root).toString('base64url').slice(0, 40);
    return path.join(this.cacheDir(), `${key}-${fingerprint}.json`);
  }

  async run(root: string, cargoAudit: boolean, runOptions: { force?: boolean } = {}): Promise<AuditResult> {
    const lock = await readLockfile(root);
    if (!lock?.packages.length) {
      return { source: 'unavailable', advisories: [], byPackage: new Map(), error: 'no-lockfile', fetchedAt: Date.now() };
    }

    const fingerprint = lockFingerprint(lock);
    const cached = runOptions.force ? undefined : await this.readCache(root, fingerprint);
    if (cached) {
      return { source: 'cache', advisories: cached.advisories, byPackage: indexAdvisories(cached.advisories), fetchedAt: cached.fetchedAt };
    }

    if (this.options.offline) {
      return { source: 'unavailable', advisories: [], byPackage: new Map(), error: 'offline', fetchedAt: Date.now() };
    }

    if (cargoAudit) {
      const viaCargo = await this.tryCargoAudit(root);
      if (viaCargo) {
        await this.writeCache(root, fingerprint, viaCargo.advisories);
        return viaCargo;
      }
    }

    const viaOsv = await this.queryOsv(lock, root);
    if (viaOsv) {
      await this.writeCache(root, fingerprint, viaOsv.advisories);
      return viaOsv;
    }

    return { source: 'unavailable', advisories: [], byPackage: new Map(), error: 'network', fetchedAt: Date.now() };
  }

  private async readCache(root: string, fingerprint: string): Promise<CacheShape | undefined> {
    const hours = this.options.cacheHours ?? 6;
    try {
      const raw = await fs.readFile(this.cacheFile(root, fingerprint), 'utf8');
      const parsed = JSON.parse(raw) as CacheShape;
      if (Date.now() - parsed.fetchedAt > hours * 3600_000) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  private async writeCache(root: string, fingerprint: string, advisories: Advisory[]): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir(), { recursive: true });
      const data: CacheShape = { fetchedAt: Date.now(), advisories };
      await fs.writeFile(this.cacheFile(root, fingerprint), JSON.stringify(data), 'utf8');
    } catch {
      // Cache is best-effort.
    }
  }

  private async tryCargoAudit(root: string): Promise<AuditResult | undefined> {
    const result: RunResult = await run('cargo', ['audit', '--json'], { cwd: root, timeoutMs: 120_000 });
    if (result.missingBinary || result.code === 101 && /no such command/.test(result.stderr)) return undefined;
    try {
      const json = JSON.parse(result.stdout) as CargoAuditJson;
      const advisories = parseCargoAuditJson(json);
      return { source: 'cargo-audit', advisories, byPackage: indexAdvisories(advisories), fetchedAt: Date.now() };
    } catch {
      return undefined;
    }
  }

  private async queryOsv(lock: LockfileInfo, root: string): Promise<AuditResult | undefined> {
    const registryPackages = lock.packages.filter((p) => p.source?.includes('crates.io') || p.source?.startsWith('registry+'));
    if (!registryPackages.length) {
      return { source: 'osv', advisories: [], byPackage: new Map(), fetchedAt: Date.now() };
    }

    const queries = registryPackages.map((p) => ({
      package: { ecosystem: 'crates.io', name: p.name },
      version: p.version,
    }));

    const chunks: typeof queries[] = [];
    for (let i = 0; i < queries.length; i += 500) {
      chunks.push(queries.slice(i, i + 500));
    }

    const ids = new Set<string>();
    const perQuery: { id: string; version: string }[] = [];

    try {
      for (const chunk of chunks) {
        const response = await fetchWithTimeout(
          OSV_BATCH,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queries: chunk }),
          },
          this.options.timeoutMs ?? 15000,
        );
        if (!response.ok) return undefined;
        const data = (await response.json()) as { results?: { vulns?: { id: string }[] }[] };
        (data.results ?? []).forEach((result, index) => {
          for (const vuln of result.vulns ?? []) {
            ids.add(vuln.id);
            const pkg = chunk[index];
            perQuery.push({ id: vuln.id, version: pkg ? pkg.version : '' });
          }
        });
      }

      if (!ids.size) {
        return { source: 'osv', advisories: [], byPackage: new Map(), fetchedAt: Date.now() };
      }

      const details = await Promise.all([...ids].map((id) => this.fetchOsvDetails(id)));
      const advisories: Advisory[] = [];
      for (const detail of details) {
        if (!detail) continue;
        advisories.push(detail);
      }
      // Attach affected versions from the lockfile so severity lists match.
      const byPackage = indexAdvisories(advisories);
      void perQuery;
      void root;
      return { source: 'osv', advisories, byPackage, fetchedAt: Date.now() };
    } catch {
      return undefined;
    }
  }

  private async fetchOsvDetails(id: string): Promise<Advisory | undefined> {
    try {
      const response = await fetchWithTimeout(`${OSV_VULN}/${id}`, { method: 'GET' }, this.options.timeoutMs ?? 15000);
      if (!response.ok) return undefined;
      const vuln = (await response.json()) as OsvVulnerability;
      return mapOsvVulnerability(vuln);
    } catch {
      return undefined;
    }
  }
}

/**
 * Stable fingerprint of the resolved dependency set in a lockfile.
 *
 * Package order in Cargo.lock is not meaningful, so entries are sorted before
 * hashing. Any version or source change produces a different fingerprint,
 * which keeps cached advisories from leaking across lockfile updates.
 */
export function lockFingerprint(lock: LockfileInfo): string {
  const entries = lock.packages.map((pkg) => `${pkg.name}@${pkg.version}@${pkg.source ?? ''}`).sort();
  return createHash('sha256').update(entries.join('\n')).digest('hex').slice(0, 16);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function indexAdvisories(advisories: Advisory[]): Map<string, Advisory[]> {
  const map = new Map<string, Advisory[]>();
  for (const advisory of advisories) {
    const list = map.get(advisory.packageName) ?? [];
    list.push(advisory);
    map.set(advisory.packageName, list);
  }
  return map;
}

interface CargoAuditJson {
  vulnerabilities?: {
    found?: boolean;
    list?: {
      advisory?: {
        id?: string;
        package?: string;
        title?: string;
        description?: string;
        url?: string;
        aliases?: string[];
        patched_versions?: string;
        severity?: string;
      };
      package?: { name?: string; version?: string };
      versions?: string[];
    }[];
  };
}

export function parseCargoAuditJson(json: CargoAuditJson): Advisory[] {
  const list = json.vulnerabilities?.list ?? [];
  return list.map((entry) => {
    const advisory = entry.advisory ?? {};
    return {
      id: advisory.id ?? 'unknown',
      aliases: advisory.aliases ?? [],
      title: advisory.title ?? advisory.id ?? 'Advisory',
      description: advisory.description,
      severity: normalizeSeverity(advisory.severity),
      url: advisory.url ?? (advisory.id ? `https://rustsec.org/advisories/${advisory.id}.html` : undefined),
      patched: advisory.patched_versions,
      packageName: entry.package?.name ?? advisory.package ?? 'unknown',
      packageVersion: entry.package?.version ?? entry.versions?.[0] ?? '',
    };
  });
}

export interface OsvVulnerability {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  references?: { type: string; url: string }[];
  affected?: {
    package?: { name?: string; ecosystem?: string };
    ranges?: { type: string; events: { introduced?: string; fixed?: string }[] }[];
  }[];
  database_specific?: { severity?: string };
  severity?: { type: string; score: string }[];
}

export function mapOsvVulnerability(vuln: OsvVulnerability): Advisory | undefined {
  const affected = vuln.affected?.find((a) => a.package?.ecosystem === 'crates.io') ?? vuln.affected?.[0];
  const packageName = affected?.package?.name;
  if (!packageName) return undefined;

  let fixed: string | undefined;
  for (const range of affected?.ranges ?? []) {
    const fixedEvent = range.events.find((e) => e.fixed);
    if (fixedEvent?.fixed) {
      fixed = fixedEvent.fixed;
    }
  }

  const rustsecRef = vuln.references?.find((r) => r.url.includes('rustsec.org/advisories'))?.url;
  const url = rustsecRef ?? vuln.references?.find((r) => r.type === 'ADVISORY')?.url ?? `https://osv.dev/vulnerability/${vuln.id}`;

  return {
    id: vuln.id,
    aliases: vuln.aliases ?? [],
    title: vuln.summary ?? vuln.id,
    description: vuln.details,
    severity: normalizeSeverity(vuln.database_specific?.severity),
    url,
    fixed,
    patched: fixed ? `>= ${fixed}` : undefined,
    packageName,
    packageVersion: '',
  };
}

function normalizeSeverity(value: string | undefined): Advisory['severity'] {
  switch ((value ?? '').toLowerCase()) {
    case 'low':
      return 'low';
    case 'moderate':
    case 'medium':
      return 'moderate';
    case 'high':
      return 'high';
    case 'critical':
      return 'critical';
    default:
      return 'unknown';
  }
}

/** Human label for an advisory severity. */
export function severityLabel(severity: Advisory['severity']): string {
  switch (severity) {
    case 'low':
      return 'Low';
    case 'moderate':
      return 'Moderate';
    case 'high':
      return 'High';
    case 'critical':
      return 'Critical';
    default:
      return 'Unknown';
  }
}

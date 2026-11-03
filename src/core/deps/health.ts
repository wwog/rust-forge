/**
 * Declared-dependency health checks that do not require a cargo invocation:
 * unused declarations, workspace inheritance gaps, and version disagreements
 * between members.
 *
 * Unused detection is a source scan, not a compiler analysis. Optional
 * dependencies are skipped because they may be enabled externally, and crates
 * used only through a derive/attribute macro are covered by a small known-symbol
 * table. The UI labels the result as heuristic.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import type { DependencyTable } from '../cargo/types.js';
import type { ProjectModel } from '../cargo/project.js';
import {
  readWorkspaceDependencies,
  type DependencyDeclaration,
  type WorkspaceDependencyDeclaration,
} from '../cargo/manifestDeps.js';
import { isInside, readTextFile } from '../process.js';
import { cargoReqToRange } from './versions.js';

export interface UnusedDependency {
  packageName: string;
  key: string;
  member: string;
  manifestPath: string;
  line: number;
  table: DependencyTable;
  requirement?: string;
  kind: DependencyDeclaration['kind'];
}

export interface WorkspaceDependencyMember {
  member: string;
  manifestPath: string;
  line: number;
  requirement?: string;
  kind: DependencyDeclaration['kind'];
}

export type WorkspaceDependencyIssueKind = 'unused-entry' | 'not-inherited';

export interface WorkspaceDependencyIssue {
  name: string;
  kind: WorkspaceDependencyIssueKind;
  workspaceVersion?: string;
  /** Direct declarations that bypass the workspace entry. */
  members: WorkspaceDependencyMember[];
}

export interface MemberRequirement {
  member: string;
  manifestPath: string;
  line: number;
  key: string;
  requirement: string;
  source: 'direct' | 'workspace';
}

export interface VersionMismatch {
  packageName: string;
  /** Distinct raw requirements, in member order. */
  requirements: string[];
  members: MemberRequirement[];
}

export interface DeclaredHealth {
  unused: UnusedDependency[];
  workspaceDependencies: WorkspaceDependencyIssue[];
  versionMismatches: VersionMismatch[];
  /** Number of Rust source files scanned across all members. */
  scannedFiles: number;
}

export interface AnalyzeOptions {
  workspaceDependencies?: WorkspaceDependencyDeclaration[];
}

interface MemberSources {
  text: string;
  buildText: string;
  fileCount: number;
}

/** Run the manifest/source-level checks for every workspace member. */
export async function analyzeDeclaredHealth(
  model: ProjectModel,
  declarations: { member: string; manifestPath: string; deps: DependencyDeclaration[] }[],
  options: AnalyzeOptions = {},
): Promise<DeclaredHealth> {
  const workspaceDependencies =
    options.workspaceDependencies ??
    (model.kind === 'workspace' ? await readWorkspaceDependencies(model.root) : []);

  const unused: UnusedDependency[] = [];
  const mismatchGroups = new Map<string, MemberRequirement[]>();
  let scannedFiles = 0;

  for (const entry of declarations) {
    const member = model.members.find((candidate) => candidate.name === entry.member);
    if (!member) continue;

    const { manifest, features } = await readManifest(entry.manifestPath);
    // A non-virtual workspace root is also a member; do not let nested member
    // sources count as references for the root package's dependencies.
    const nestedMembers = new Set(
      model.members
        .filter((other) => path.resolve(other.dir) !== path.resolve(member.dir) && isInside(member.dir, other.dir))
        .map((other) => path.resolve(other.dir)),
    );
    const sources = await collectMemberSources(member.dir, manifest, nestedMembers);
    scannedFiles += sources.fileCount;
    // Normal and dev dependencies are not available to the build script, so
    // only source targets (including tests/examples/benches) are scanned here.
    const text = sources.text;

    for (const decl of entry.deps) {
      const requirement = dependencyRequirement(decl, workspaceDependencies);

      if (decl.table === 'build-dependencies') {
        if (!sources.buildText && !featureReferencesDependency(features, decl)) {
          unused.push(toUnused(decl, entry.member, requirement));
          continue;
        }
        if (!isReferenced(decl, sources.buildText) && !featureReferencesDependency(features, decl)) {
          unused.push(toUnused(decl, entry.member, requirement));
        }
        continue;
      }

      if (decl.optional === true) continue;
      if (!isReferenced(decl, text) && !featureReferencesDependency(features, decl)) {
        unused.push(toUnused(decl, entry.member, requirement));
      }
    }

    for (const decl of entry.deps) {
      if (decl.kind !== 'registry' && decl.kind !== 'workspace') continue;
      const requirement = dependencyRequirement(decl, workspaceDependencies);
      if (!requirement) continue;
      const list = mismatchGroups.get(decl.packageName) ?? [];
      const key = `${entry.member}\u0000${requirement}\u0000${decl.kind}`;
      if (
        !list.some(
          (existing) =>
            `${existing.member}\u0000${existing.requirement}\u0000${existing.source === 'workspace' ? 'workspace' : 'registry'}` === key,
        )
      ) {
        list.push({
          member: entry.member,
          manifestPath: entry.manifestPath,
          line: decl.line,
          key: decl.key,
          requirement,
          source: decl.kind === 'workspace' ? 'workspace' : 'direct',
        });
      }
      mismatchGroups.set(decl.packageName, list);
    }
  }

  const versionMismatches: VersionMismatch[] = [];
  for (const [packageName, members] of mismatchGroups) {
    const normalized = new Map<string, string>();
    for (const member of members) normalized.set(member.requirement, normalizeRequirement(member.requirement));
    if (new Set(normalized.values()).size < 2) continue;
    versionMismatches.push({
      packageName,
      requirements: [...normalized.keys()],
      members: members.sort((a, b) => a.member.localeCompare(b.member)),
    });
  }
  versionMismatches.sort((a, b) => a.packageName.localeCompare(b.packageName));

  return {
    unused: unused.sort(
      (a, b) => a.member.localeCompare(b.member) || a.packageName.localeCompare(b.packageName) || a.table.localeCompare(b.table),
    ),
    workspaceDependencies: workspaceIssues(model, declarations, workspaceDependencies),
    versionMismatches,
    scannedFiles,
  };
}

/** Workspace dependency entries that no member inherits, or that members bypass. */
export function workspaceIssues(
  model: ProjectModel,
  declarations: { member: string; manifestPath: string; deps: DependencyDeclaration[] }[],
  workspaceDependencies: WorkspaceDependencyDeclaration[],
): WorkspaceDependencyIssue[] {
  if (model.kind !== 'workspace' || !workspaceDependencies.length) return [];

  const issues: WorkspaceDependencyIssue[] = [];
  for (const dependency of workspaceDependencies) {
    const users = declarations.flatMap((entry) =>
      entry.deps
        .filter((decl) => decl.key === dependency.name || decl.packageName === dependency.name)
        .map((decl) => ({ entry, decl })),
    );
    if (!users.length) {
      issues.push({
        name: dependency.name,
        kind: 'unused-entry',
        workspaceVersion: dependency.version,
        members: [],
      });
      continue;
    }

    const direct = users.filter(({ decl }) => decl.kind !== 'workspace');
    if (!direct.length) continue;
    issues.push({
      name: dependency.name,
      kind: 'not-inherited',
      workspaceVersion: dependency.version,
      members: direct
        .map(({ entry, decl }) => ({
          member: entry.member,
          manifestPath: entry.manifestPath,
          line: decl.line,
          requirement: decl.version,
          kind: decl.kind,
        }))
        .sort((a, b) => a.member.localeCompare(b.member)),
    });
  }
  return issues.sort((a, b) => a.name.localeCompare(b.name));
}

function toUnused(
  decl: DependencyDeclaration,
  member: string,
  requirement: string | undefined,
): UnusedDependency {
  return {
    packageName: decl.packageName,
    key: decl.key,
    member,
    manifestPath: decl.manifestPath,
    line: decl.line,
    table: decl.table,
    requirement,
    kind: decl.kind,
  };
}

function dependencyRequirement(
  decl: DependencyDeclaration,
  workspaceDependencies: WorkspaceDependencyDeclaration[],
): string | undefined {
  if (decl.kind !== 'workspace') return decl.version;
  const workspace = workspaceDependencies.find(
    (dependency) => dependency.name === decl.key || dependency.name === decl.packageName,
  );
  return workspace?.version;
}

function normalizeRequirement(requirement: string): string {
  return cargoReqToRange(requirement) ?? requirement.trim();
}

async function readManifest(manifestPath: string): Promise<{ manifest: Record<string, unknown>; features: Record<string, unknown> }> {
  try {
    const manifest = parseToml(await readTextFile(manifestPath)) as Record<string, unknown>;
    return {
      manifest,
      features: (manifest.features as Record<string, unknown> | undefined) ?? {},
    };
  } catch {
    return { manifest: {}, features: {} };
  }
}

/** Collect all `.rs` text for a member, separating the build script. */
async function collectMemberSources(
  dir: string,
  manifest: Record<string, unknown>,
  excludedDirs: ReadonlySet<string> = new Set(),
): Promise<MemberSources> {
  const packageTable = asRecord(manifest.package);
  const buildSetting = packageTable?.build;
  const buildScript = buildSetting === false ? undefined : normalizeRelative(typeof buildSetting === 'string' ? buildSetting : 'build.rs');

  const textChunks: string[] = [];
  const buildChunks: string[] = [];
  let fileCount = 0;

  const walk = async (current: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'target' || entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.rf-snapshots' || entry.name === 'vendor') {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (excludedDirs.has(path.resolve(full))) continue;
        await walk(full);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.rs')) continue;
      const relative = normalizeRelative(path.relative(dir, full));
      let content: string;
      try {
        content = await readTextFile(full);
      } catch {
        continue;
      }
      fileCount++;
      if (buildScript && relative === buildScript) buildChunks.push(content);
      else textChunks.push(content);
    }
  };

  await walk(dir);
  return { text: textChunks.join('\n'), buildText: buildChunks.join('\n'), fileCount };
}

function normalizeRelative(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function featureReferencesDependency(
  features: Record<string, unknown>,
  decl: DependencyDeclaration,
): boolean {
  const names = new Set([decl.key, decl.packageName]);
  for (const values of Object.values(features)) {
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (typeof value !== 'string') continue;
      // `dep:serde`, `serde/derive`, `serde?/derive` or `serde`.
      const match = /^(?:dep:)?([A-Za-z0-9_-]+)(?:\?\/|\/|$)/.exec(value);
      if (match && names.has(match[1])) return true;
    }
  }
  return false;
}

/** Strong syntactic references only; identifiers in strings/comments may match. */
function isReferenced(decl: DependencyDeclaration, text: string): boolean {
  if (!text) return false;
  const identifier = decl.key.replace(/-/g, '_');
  const escaped = escapeRegExp(identifier);
  const patterns = [
    new RegExp(`\\b(?:use|extern\\s+crate)\\s+(?:::)?${escaped}\\b`),
    new RegExp(`\\b${escaped}\\s*::`),
    new RegExp(`\\b${escaped}\\s*!`),
    new RegExp(`#\\[\\s*${escaped}\\b`),
  ];
  if (patterns.some((pattern) => pattern.test(text))) return true;

  const macroSymbols = MACRO_REFERENCES[decl.packageName] ?? MACRO_REFERENCES[identifier];
  return macroSymbols?.some((pattern) => pattern.test(text)) ?? false;
}

/** Crates commonly used through a derive/attribute without a path prefix. */
const MACRO_REFERENCES: Record<string, RegExp[]> = {
  serde: [/\bSerialize\b/, /\bDeserialize\b/, /\bserde\b/],
  thiserror: [/\bError\b/],
  'async-trait': [/\basync_trait\b/],
  async_trait: [/\basync_trait\b/],
  tracing: [/\binstrument\b/, /\btracing\b/],
  tokio: [/\btokio\b/],
  clap: [/\bParser\b/, /\bSubcommand\b/, /\bArgs\b/, /\bValueEnum\b/],
  num_derive: [/\bFromPrimitive\b/, /\bToPrimitive\b/, /\bNumOps\b/],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

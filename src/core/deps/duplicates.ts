/**
 * Duplicate-version analysis built on `cargo tree --duplicates`.
 *
 * `cargo tree -d` prints one inverse tree per duplicate package version. We
 * parse those trees, attach each version to the workspace members that pull it
 * in, and read the dependents' declared requirements from full `cargo metadata`
 * so the UI can explain why one copy was not enough.
 */
import * as semver from 'semver';
import type { CargoMetadata } from '../cargo/types.js';
import { cargoReqToRange, parseVersionReq, requirementSatisfied } from './versions.js';

export interface DuplicateNodeRef {
  name: string;
  version: string;
}

export interface DuplicateSource {
  /** Immediate dependent that declares the duplicate. */
  package: string;
  version: string;
  requirement?: string;
  /** Path from the duplicate up to a workspace member, when one is reached. */
  chain: DuplicateNodeRef[];
  /** Workspace member at the end of `chain`, if any. */
  member?: string;
  /** True when a workspace member requires the duplicate directly. */
  direct: boolean;
}

export interface DuplicateVersion {
  version: string;
  sources: DuplicateSource[];
  /** True when at least one workspace member requires this version directly. */
  direct: boolean;
}

export interface DuplicateRequirement {
  /** Duplicate version selected by this requirement. */
  version: string;
  parent: string;
  parentVersion: string;
  requirement: string;
  member?: string;
}

export type DuplicateReason =
  | 'incompatible-requirements'
  | 'overlapping-requirements'
  | 'unknown-requirements';

export interface DuplicateGroup {
  name: string;
  versions: DuplicateVersion[];
  requirements: DuplicateRequirement[];
  /** True when two declared requirements cannot be satisfied by one version. */
  incompatible: boolean;
  reason: DuplicateReason;
}

export interface DuplicateContext {
  members: { name: string; dir: string }[];
  metadata?: CargoMetadata;
}

interface PackageToken {
  name: string;
  version: string;
  path?: string;
}

interface ParsedEntry extends PackageToken {
  depth: number;
}

interface TreeBlock extends PackageToken {
  entries: ParsedEntry[];
}

/** Parse the output of `cargo tree -d --prefix depth --no-dedupe`. */
export function parseCargoTreeDuplicates(output: string, context: DuplicateContext): DuplicateGroup[] {
  const blocks = parseBlocks(output);
  const byName = new Map<string, Map<string, DuplicateVersion>>();

  for (const block of blocks) {
    const versions = byName.get(block.name) ?? new Map<string, DuplicateVersion>();
    byName.set(block.name, versions);
    const version =
      versions.get(block.version) ??
      ({ version: block.version, sources: [], direct: false } satisfies DuplicateVersion);
    versions.set(block.version, version);

    for (const source of sourcesForBlock(block, context)) {
      const key = `${source.package}\u0000${source.version}\u0000${source.member ?? ''}\u0000${source.requirement ?? ''}`;
      const exists = version.sources.some(
        (existing) => `${existing.package}\u0000${existing.version}\u0000${existing.member ?? ''}\u0000${existing.requirement ?? ''}` === key,
      );
      if (!exists) version.sources.push(source);
      if (source.direct) version.direct = true;
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [name, versions] of byName) {
    if (versions.size < 2) continue;
    const ordered = [...versions.values()].sort(compareVersions);
    for (const version of ordered) {
      version.sources.sort((a, b) => a.package.localeCompare(b.package) || compareVersions(a.version, b.version));
    }
    groups.push(assess(name, ordered));
  }
  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

function assess(name: string, versions: DuplicateVersion[]): DuplicateGroup {
  const requirements: DuplicateRequirement[] = [];
  for (const version of versions) {
    for (const source of version.sources) {
      if (!source.requirement) continue;
      const key = `${source.package}\u0000${source.version}\u0000${source.requirement}`;
      if (requirements.some((entry) => `${entry.parent}\u0000${entry.parentVersion}\u0000${entry.requirement}` === key)) {
        continue;
      }
      requirements.push({
        version: version.version,
        parent: source.package,
        parentVersion: source.version,
        requirement: source.requirement,
        member: source.member,
      });
    }
  }

  let incompatible = false;
  for (let i = 0; i < requirements.length && !incompatible; i++) {
    for (let j = i + 1; j < requirements.length; j++) {
      if (requirements[i].version === requirements[j].version) continue;
      const left = cargoReqToRange(requirements[i].requirement);
      const right = cargoReqToRange(requirements[j].requirement);
      if (!left || !right) continue;
      if (!semver.intersects(left, right)) {
        incompatible = true;
        break;
      }
    }
  }

  return {
    name,
    versions,
    requirements,
    incompatible,
    reason:
      incompatible
        ? 'incompatible-requirements'
        : requirements.length >= 2
          ? 'overlapping-requirements'
          : 'unknown-requirements',
  };
}

function parseBlocks(output: string): TreeBlock[] {
  const blocks: TreeBlock[] = [];
  let current: TreeBlock | undefined;

  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line) {
      current = undefined;
      continue;
    }
    const match = /^(\d+)(.*)$/.exec(line);
    if (!match) continue;
    const depth = Number(match[1]);
    const token = parsePackageToken(match[2]);
    if (!token) continue;

    if (depth === 0) {
      current = { ...token, entries: [] };
      blocks.push(current);
    } else if (current) {
      current.entries.push({ depth, ...token });
    }
  }

  return blocks;
}

function parsePackageToken(raw: string): PackageToken | undefined {
  const token = raw.trim().replace(/\s+\(\*\)$/, '');
  // `name v1.2.3` or `name v1.2.3 (/path/to/crate)`.
  const match = /^(\S+)\s+v([^\s]+)(?:\s+\((.*)\))?$/.exec(token);
  if (!match) return undefined;
  return { name: match[1], version: match[2], path: match[3] };
}

function sourcesForBlock(block: TreeBlock, context: DuplicateContext): DuplicateSource[] {
  const members = new Set(context.members.map((member) => member.name));
  const chains = chainEntries(block);
  const sources: DuplicateSource[] = [];

  // The immediate dependent is depth 1. Every workspace-member path that goes
  // through it becomes one source row for the duplicate version.
  const directParents = chains.filter((entry) => entry.entry.depth === 1);
  for (const { entry: parent } of directParents) {
    const memberPaths = chains.filter(
      (candidate) =>
        candidate.chain[1] === parent &&
        candidate.chain.length > 1 &&
        members.has(candidate.chain[candidate.chain.length - 1].name),
    );
    const paths = memberPaths.length
      ? memberPaths
      : [
          {
            chain: [
              { name: block.name, version: block.version, depth: 0 },
              { name: parent.name, version: parent.version, depth: 1 },
            ],
          },
        ];
    const seenMembers = new Set<string>();
    for (const path of paths) {
      const member = memberPaths.length ? path.chain[path.chain.length - 1].name : undefined;
      if (member && seenMembers.has(member)) continue;
      if (member) seenMembers.add(member);
      sources.push({
        package: parent.name,
        version: parent.version,
        requirement: requirementFor(context.metadata, parent.name, parent.version, block.name, block.version),
        chain: path.chain.map((node) => ({ name: node.name, version: node.version })),
        member,
        direct: members.has(parent.name),
      });
    }
  }

  return sources;
}

interface ChainEntry {
  entry: ParsedEntry;
  chain: ParsedEntry[];
}

/** Reconstruct DFS paths from the depth-prefixed listing. */
function chainEntries(block: TreeBlock): ChainEntry[] {
  // Depth 0 is the duplicate itself; entries below it are its reverse deps.
  const stack: ParsedEntry[] = [{ name: block.name, version: block.version, path: block.path, depth: 0 }];
  const result: ChainEntry[] = [];
  for (const entry of block.entries) {
    stack.length = entry.depth;
    stack[entry.depth] = entry;
    result.push({ entry, chain: stack.slice(0, entry.depth + 1) });
  }
  return result;
}

function requirementFor(
  metadata: CargoMetadata | undefined,
  parentName: string,
  parentVersion: string,
  dependencyName: string,
  dependencyVersion: string,
): string | undefined {
  if (!metadata) return undefined;
  const pkg = metadata.packages.find((candidate) => candidate.name === parentName && candidate.version === parentVersion);
  const dependencies = pkg?.dependencies.filter((dependency) => dependency.name === dependencyName) ?? [];
  if (!dependencies.length) return undefined;
  // A package can depend on the same name in several tables (normal + build)
  // at different requirements. Pick the entry that selected this version.
  const matching = dependencies.find((dependency) =>
    requirementSatisfied(parseVersionReq(dependency.req), dependencyVersion),
  );
  return (matching ?? dependencies[0]).req;
}

function compareVersions(a: { version: string } | string, b: { version: string } | string): number {
  const left = typeof a === 'string' ? a : a.version;
  const right = typeof b === 'string' ? b : b.version;
  if (semver.valid(left) && semver.valid(right)) return semver.compare(left, right);
  return left.localeCompare(right);
}

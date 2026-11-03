/**
 * Dependency tree construction.
 *
 * Shows only *directly declared, self-contained* dependencies. Transitive
 * dependencies stay hidden unless they are workspace members (local path deps),
 * which are expanded to expose the internal topology.
 */
import * as path from 'node:path';
import type { CargoMetadata, CargoPackage, DependencyTable } from '../cargo/types.js';
import { dependencyKindToTable, parsePackageId } from '../cargo/types.js';
import type { DependencyDeclaration } from '../cargo/manifestDeps.js';
import type { ProjectModel } from '../cargo/project.js';
import { lockedVersion, type LockfileInfo } from '../cargo/lockfile.js';
import type { Advisory } from '../audit.js';
import { latestStableVersion, type CrateDetail } from './registry.js';
import { classifyUpgrade, type FeatureChange, type UpgradeAssessment } from './versions.js';
import { diffCrateFeatures } from './upgradePlan.js';

export type DependencyNodeKind = 'workspace' | 'member' | 'dependency' | 'localDependency' | 'group';

export interface DependencyNode {
  kind: DependencyNodeKind;
  id: string;
  label: string;
  description?: string;
  /** Declared requirement, e.g. `^1.2`. */
  requirement?: string;
  lockedVersion?: string;
  latestVersion?: string;
  /** True when crates.io could not be reached. */
  registryUnavailable?: boolean;
  upgrade?: UpgradeAssessment;
  /**
   * Informational feature diff between the locked and target release. It is
   * never fed into `classifyUpgrade`, so new crate features cannot silently
   * reclassify an otherwise safe upgrade.
   */
  featureChange?: FeatureChange;
  /** `rust-version` declared by the target release, when crates.io reports it. */
  targetRustVersion?: string;
  /** `rust-version` declared by the currently locked release. */
  lockedRustVersion?: string;
  advisories: Advisory[];
  /** Declaring member (workspace mode) and manifest path. */
  memberName?: string;
  manifestPath?: string;
  table?: DependencyTable;
  declaration?: DependencyDeclaration;
  children?: DependencyNode[];
  /** For local path deps, the workspace member they resolve to. */
  localTarget?: string;
  features?: string[];
  optional?: boolean;
  isWorkspaceDependency?: boolean;
  /** True for a declaration in the root `[workspace.dependencies]` table. */
  workspaceRootDependency?: boolean;
  icon?: string;
}

export interface BuildTreeOptions {
  model: ProjectModel;
  metadata?: CargoMetadata;
  declarations: { member: string; manifestPath: string; deps: DependencyDeclaration[] }[];
  workspaceDependencies?: DependencyDeclaration[];
  lockfile?: LockfileInfo;
  registryData: Map<string, CrateDetail | undefined>;
  registryDegraded: boolean;
  advisories: Map<string, Advisory[]>;
}

export interface DependencyTree {
  root: DependencyNode;
  /** Flat list for bulk-upgrade UI. */
  upgradable: DependencyNode[];
  registryDegraded: boolean;
  /** Packages whose latest version could not be determined. */
  unresolved: string[];
}

export function buildDependencyTree(options: BuildTreeOptions): DependencyTree {
  const { model, lockfile, registryData, registryDegraded, advisories } = options;
  const memberByName = new Map<string, { name: string; manifestPath: string; dir: string }>();
  for (const member of model.members) memberByName.set(member.name, member);

  const memberNodes: DependencyNode[] = [];
  const upgradable: DependencyNode[] = [];
  const unresolved: string[] = [];

  for (const entry of options.declarations) {
    const depNodes: DependencyNode[] = [];
    for (const decl of entry.deps) {
      const node = buildDependencyNode({
        decl,
        memberName: entry.member,
        manifestPath: entry.manifestPath,
        lockfile,
        registryData,
        registryDegraded,
        advisories,
        memberByName,
        workspaceDependencies: options.workspaceDependencies,
        depth: 0,
      });
      if (node) {
        depNodes.push(node);
        if (node.upgrade?.classification === 'safe') upgradable.push(node);
        if (registryDegraded) unresolved.push(node.label);
      }
    }

    depNodes.sort((a, b) => a.label.localeCompare(b.label));
    memberNodes.push({
      kind: 'member',
      id: `member:${entry.member}:${entry.manifestPath}`,
      label: entry.member,
      description: entry.manifestPath,
      advisories: [],
      manifestPath: entry.manifestPath,
      memberName: entry.member,
      children: depNodes,
    });
  }

  const workspaceNodes: DependencyNode[] = [];
  for (const decl of options.workspaceDependencies ?? []) {
    const node = buildDependencyNode({
      decl,
      memberName: 'workspace',
      manifestPath: model.manifestPath,
      lockfile,
      registryData,
      registryDegraded,
      advisories,
      memberByName,
      workspaceDependencies: options.workspaceDependencies,
      depth: 0,
    });
    if (!node) continue;
    node.id = `workspace-dep:${decl.key}`;
    node.workspaceRootDependency = true;
    workspaceNodes.push(node);
  }
  workspaceNodes.sort((a, b) => a.label.localeCompare(b.label));

  let workspaceGroup: DependencyNode | undefined;
  if (workspaceNodes.length) {
    const local = workspaceNodes.filter((node) => node.declaration?.kind === 'path');
    const remote = workspaceNodes.filter((node) => node.declaration?.kind !== 'path');
    const groups: DependencyNode[] = [];
    if (local.length) {
      groups.push({
        kind: 'group',
        id: 'workspace-deps:local',
        label: 'Local dependencies',
        description: String(local.length),
        advisories: [],
        children: local,
        icon: 'folder-library',
      });
    }
    if (remote.length) {
      groups.push({
        kind: 'group',
        id: 'workspace-deps:remote',
        label: 'Remote dependencies',
        description: String(remote.length),
        advisories: [],
        children: remote,
        icon: 'cloud',
      });
    }
    workspaceGroup = {
      kind: 'group',
      id: 'workspace-dependencies',
      label: 'Workspace dependencies',
      description: String(workspaceNodes.length),
      advisories: [],
      children: groups,
      icon: 'library',
    };
  }

  const root: DependencyNode =
    model.kind === 'workspace'
      ? {
          kind: 'workspace',
          id: `workspace:${model.root}`,
          label: path.basename(model.root) || 'workspace',
          description: `${model.members.length} members${workspaceNodes.length ? ` · ${workspaceNodes.length} workspace dependencies` : ''}`,
          advisories: [],
          children: [...(workspaceGroup ? [workspaceGroup] : []), ...memberNodes],
        }
      : memberNodes[0] ?? {
          kind: 'member',
          id: 'member:empty',
          label: 'dependencies',
          advisories: [],
          children: [],
        };

  return { root, upgradable, registryDegraded, unresolved };
}

interface NodeContext {
  decl: DependencyDeclaration;
  memberName: string;
  manifestPath: string;
  lockfile?: LockfileInfo;
  registryData: Map<string, CrateDetail | undefined>;
  registryDegraded: boolean;
  advisories: Map<string, Advisory[]>;
  memberByName: Map<string, { name: string; manifestPath: string; dir: string }>;
  workspaceDependencies?: DependencyDeclaration[];
  depth: number;
}

function buildDependencyNode(ctx: NodeContext): DependencyNode | undefined {
  const { decl } = ctx;
  // An inherited declaration takes its kind/version/path from the workspace
  // table. Without this, a `[workspace.dependencies] foo = { path = ... }`
  // inherited by a member is mistaken for a registry dependency and gets
  // "upgraded" by writing a version into the path entry.
  const inherited = decl.kind === 'workspace' ? workspaceEntry(decl, ctx.workspaceDependencies) : undefined;
  const effective: DependencyDeclaration = inherited
    ? {
        ...decl,
        packageName: inherited.packageName,
        kind: inherited.kind,
        version: inherited.version,
        path: inherited.path,
        git: inherited.git,
        rawValue: inherited.rawValue,
        features: decl.features.length ? decl.features : inherited.features,
        defaultFeatures: decl.defaultFeatures ?? inherited.defaultFeatures,
        manifestPath: inherited.manifestPath,
      }
    : decl;

  const requirement = effective.version;
  const localMember = resolveLocalMember(effective, ctx.memberByName);
  const locked = localMember ? undefined : lockedVersion(ctx.lockfile, effective.packageName, requirement);
  const crate = localMember ? undefined : ctx.registryData.get(effective.packageName);

  const latest = crate ? latestStableVersion(crate) : undefined;
  const targetVersionInfo = crate?.versions.find((v) => v.num === latest);
  const lockedVersionInfo = crate?.versions.find((v) => v.num === locked);
  const defaultFeatureSetChanged = defaultFeaturesChanged(lockedVersionInfo, targetVersionInfo);
  // Display-only diff: classification keeps receiving `latestFeatures:
  // undefined`, which is what makes newly added crate features non-blocking.
  const featureChange = diffCrateFeatures(lockedVersionInfo, targetVersionInfo);

  const upgrade =
    effective.kind === 'registry'
      ? classifyUpgrade({
          declared: requirement ?? '*',
          locked,
          latest: crate?.maxVersion,
          latestStable: latest,
          currentFeatures: effective.features,
          latestFeatures: undefined,
          defaultFeatureSetChanged,
        })
      : undefined;

  const nodeAdvisories = (ctx.advisories.get(effective.packageName) ?? []).filter(
    (advisory) => !advisory.packageVersion || !locked || advisory.packageVersion === locked,
  );
  const icon =
    effective.kind === 'path'
      ? 'package'
      : effective.kind === 'git'
        ? 'repo'
        : effective.kind === 'workspace'
          ? 'library'
          : 'cloud';

  const node: DependencyNode = {
    kind: localMember ? 'localDependency' : 'dependency',
    id: `dep:${decl.manifestPath}:${decl.table}:${decl.target ?? ''}:${decl.key}:${ctx.depth}`,
    label: decl.key === decl.packageName ? decl.packageName : `${decl.key} (${decl.packageName})`,
    description: descriptionFor(decl, locked, latest, ctx.registryDegraded),
    requirement,
    lockedVersion: locked,
    latestVersion: latest,
    registryUnavailable: ctx.registryDegraded,
    upgrade,
    featureChange,
    targetRustVersion: targetVersionInfo?.rustVersion,
    lockedRustVersion: lockedVersionInfo?.rustVersion,
    advisories: nodeAdvisories,
    memberName: ctx.memberName,
    manifestPath: decl.manifestPath,
    table: decl.table,
    declaration: decl,
    localTarget: localMember?.name,
    features: effective.features,
    optional: decl.optional,
    isWorkspaceDependency: decl.kind === 'workspace',
    icon,
  };

  if (localMember && ctx.depth < 6) {
    node.children = [];
  }

  return node;
}

function descriptionFor(decl: DependencyDeclaration, locked: string | undefined, latest: string | undefined, degraded: boolean): string {
  const parts: string[] = [];
  if (decl.kind === 'path') parts.push(`path ${decl.path ?? ''}`);
  else if (decl.kind === 'git') parts.push(`git ${decl.git ?? ''}`);
  else if (decl.kind === 'workspace') parts.push('workspace');
  else if (decl.version) parts.push(decl.version);
  if (locked && locked !== decl.version) parts.push(`locked ${locked}`);
  if (latest) parts.push(`latest ${latest}`);
  else if (degraded) parts.push('latest unavailable');
  if (decl.optional) parts.push('optional');
  return parts.join(' · ');
}

function workspaceEntry(
  decl: DependencyDeclaration,
  workspaceDeps?: DependencyDeclaration[],
): DependencyDeclaration | undefined {
  // Inheritance matches the key. Falling back to the package name is only for
  // manifests where the alias differs from the workspace entry name; checking
  // it first would pick the wrong alias when one crate has two entries.
  return (
    workspaceDeps?.find((d) => d.key === decl.key) ??
    workspaceDeps?.find((d) => d.packageName === decl.packageName || d.key === decl.packageName)
  );
}

function defaultFeaturesChanged(
  before: { features: Record<string, string[]> } | undefined,
  after: { features: Record<string, string[]> } | undefined,
): boolean {
  if (!before || !after) return false;
  return JSON.stringify(before.features.default ?? []) !== JSON.stringify(after.features.default ?? []);
}

function resolveLocalMember(decl: DependencyDeclaration, members: Map<string, { name: string; manifestPath: string; dir: string }>): { name: string; manifestPath: string; dir: string } | undefined {
  if (decl.kind !== 'path' || !decl.path) return undefined;
  const resolved = path.resolve(path.dirname(decl.manifestPath), decl.path);
  for (const member of members.values()) {
    if (path.resolve(member.dir) === resolved) return member;
  }
  return undefined;
}

/** Flatten a node's direct dependencies for webview tables. */
export function flattenDependencies(root: DependencyNode): DependencyNode[] {
  const out: DependencyNode[] = [];
  const walk = (node: DependencyNode) => {
    if (node.kind === 'dependency' || node.kind === 'localDependency') out.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(root);
  return out;
}

/** Metadata-derived direct dependency versions, used to cross-check manifest edits. */
export function metadataDependencies(metadata: CargoMetadata | undefined, memberName: string): Map<string, { req: string; kind: 'dev' | 'build' | null }> {
  const map = new Map<string, { req: string; kind: 'dev' | 'build' | null }>();
  const pkg = metadata?.packages.find((p: CargoPackage) => p.name === memberName);
  if (!pkg) return map;
  for (const dep of pkg.dependencies) {
    map.set(dep.rename ?? dep.name, { req: dep.req, kind: dep.kind });
  }
  return map;
}

export { dependencyKindToTable, parsePackageId };

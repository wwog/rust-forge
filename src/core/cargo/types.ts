/** Types mirroring the subset of `cargo metadata` output we consume. */

export interface CargoDependency {
  name: string;
  source: string | null;
  req: string;
  kind: 'dev' | 'build' | null;
  rename: string | null;
  optional: boolean;
  uses_default_features: boolean;
  features: string[];
  target: string | null;
  registry: string | null;
  path?: string;
}

export interface CargoTarget {
  kind: string[];
  crate_types: string[];
  name: string;
  src_path: string;
  edition: string;
  doc: boolean;
  doctest: boolean;
  test: boolean;
}

export interface CargoPackage {
  name: string;
  version: string;
  id: string;
  license: string | null;
  license_file: string | null;
  description: string | null;
  source: string | null;
  dependencies: CargoDependency[];
  targets: CargoTarget[];
  features: Record<string, string[]>;
  manifest_path: string;
  metadata: unknown;
  publish: string[] | null;
  authors: string[];
  categories: string[];
  keywords: string[];
  readme: string | null;
  repository: string | null;
  homepage: string | null;
  documentation: string | null;
  edition: string;
  links: string | null;
  default_run: string | null;
  rust_version: string | null;
}

export interface ResolveNodeDep {
  name: string;
  pkg: string;
  dep_kinds: { kind: 'dev' | 'build' | null; target: string | null }[];
}

export interface ResolveNode {
  id: string;
  dependencies: string[];
  deps: ResolveNodeDep[];
  features: string[];
}

export interface CargoMetadata {
  packages: CargoPackage[];
  workspace_members: string[];
  workspace_default_members: string[];
  resolve: { nodes: ResolveNode[]; root: string | null } | null;
  target_directory: string;
  build_directory?: string;
  version: number;
  workspace_root: string;
}

export type DependencyTable = 'dependencies' | 'dev-dependencies' | 'build-dependencies';

export const DEPENDENCY_TABLES: DependencyTable[] = ['dependencies', 'dev-dependencies', 'build-dependencies'];

export function dependencyKindToTable(kind: 'dev' | 'build' | null): DependencyTable {
  if (kind === 'dev') return 'dev-dependencies';
  if (kind === 'build') return 'build-dependencies';
  return 'dependencies';
}

/** Split a cargo package id into name and version. */
export function parsePackageId(id: string): { name: string; version: string } {
  if (id.includes('#')) {
    const [prefix, rest] = id.split('#');
    const version = rest.includes('@') ? rest.slice(rest.lastIndexOf('@') + 1) : '';
    const name = prefix.includes('://') ? prefix.slice(prefix.lastIndexOf('/') + 1) : prefix;
    return { name, version };
  }
  return { name: id, version: '' };
}

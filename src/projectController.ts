/**
 * Central project state.
 *
 * Owns the active ProjectModel plus derived data (metadata, dependency tree,
 * toolchain state) and fires events so every view refreshes consistently.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as semver from 'semver';
import * as vscode from 'vscode';
import type { CargoMetadata } from './core/cargo/types.js';
import { applyMetadataMembers, buildModel, discoverProject, parseManifestFile, type ProjectModel } from './core/cargo/project.js';
import { readLockfile, type LockfileInfo } from './core/cargo/lockfile.js';
import { readDependencies, readWorkspaceDependencies, type DependencyDeclaration } from './core/cargo/manifestDeps.js';
import type { CrateDetail } from './core/deps/registry.js';
import { buildDependencyTree, type DependencyTree } from './core/deps/tree.js';
import { AuditService, type AuditResult } from './core/audit.js';
import type { ToolchainState } from './core/toolchain.js';
import type { Services } from './services.js';
import type { PropertiesModel } from './core/properties.js';
import { readProperties } from './core/properties.js';
import { fileExists } from './core/process.js';

/**
 * What the open workspace folder contains when it is not a Rust project.
 *
 * - `noFolder`: no folder is open at all.
 * - `unknown`: the root manifest is still being checked.
 * - `empty`: the folder has no entries, so it starts the initialization flow.
 * - `nonRust`: the folder has content but no `Cargo.toml` at its root.
 * - `rust`: a root manifest exists and the project model is (being) loaded.
 */
export type FolderState = 'noFolder' | 'unknown' | 'empty' | 'nonRust' | 'rust';

export interface ProjectSnapshot {
  model: ProjectModel;
  metadata?: CargoMetadata;
  depTree: DependencyTree;
  toolchain: ToolchainState;
  audit: AuditResult;
  properties: PropertiesModel;
  errors: string[];
}

export type LoadPhase = 'idle' | 'loading' | 'ready' | 'error';

export class ProjectController implements vscode.Disposable {
  private model: ProjectModel | undefined;
  private metadata: CargoMetadata | undefined;
  private depTree: DependencyTree | undefined;
  private toolchainState: ToolchainState | undefined;
  private auditResult: AuditResult | undefined;
  private propertiesModel: PropertiesModel | undefined;
  private lastErrors: string[] = [];
  private loadPhase: LoadPhase = 'idle';
  private folderStateValue: FolderState = 'noFolder';
  private loadPromise: Promise<void> | undefined;

  private readonly extraDisposables: vscode.Disposable[] = [];

  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  private readonly onDidChangeStateEmitter = new vscode.EventEmitter<LoadPhase>();
  readonly onDidChangeState = this.onDidChangeStateEmitter.event;

  constructor(private readonly services: Services, private readonly context: vscode.ExtensionContext) {}

  get phase(): LoadPhase {
    return this.loadPhase;
  }

  get project(): ProjectModel | undefined {
    return this.model;
  }

  /** Contents of the workspace folder while no project is loaded. */
  get folderState(): FolderState {
    return this.model ? 'rust' : this.folderStateValue;
  }

  get snapshot(): ProjectSnapshot | undefined {
    if (!this.model || !this.depTree || !this.toolchainState || !this.auditResult || !this.propertiesModel) return undefined;
    return {
      model: this.model,
      metadata: this.metadata,
      depTree: this.depTree,
      toolchain: this.toolchainState,
      audit: this.auditResult,
      properties: this.propertiesModel,
      errors: this.lastErrors,
    };
  }

  get root(): string | undefined {
    return this.model?.root;
  }

  /** Errors from the last completed load, surfaced by the view placeholders. */
  get errors(): string[] {
    return this.lastErrors;
  }

  /** Dependency node lookup by tree id, used by the upgrade panel. */
  findDependencyNode(id: string): import('./core/deps/tree.js').DependencyNode | undefined {
    const root = this.depTree?.root;
    if (!root) return undefined;
    const stack = [root];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.id === id) return node;
      for (const child of node.children ?? []) stack.push(child);
    }
    return undefined;
  }

  /** Root folder of the first workspace, used before a project is detected. */
  get workspaceFolder(): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.[0];
  }

  async initialize(): Promise<void> {
    const folder = this.workspaceFolder;
    if (!folder) {
      this.setNoProject('noFolder');
      return;
    }
    // Publish the loading state before the first filesystem/cargo round-trip so
    // the views do not render their "no project" welcome while we are looking.
    this.folderStateValue = 'unknown';
    this.setPhase('loading');
    try {
      // Only a manifest at the workspace-folder root makes this a Rust project.
      // Searching ancestors here would list the files of an ordinary,
      // non-Rust folder as if it were a project.
      if (!(await fileExists(path.join(folder.uri.fsPath, 'Cargo.toml')))) {
        this.setNoProject(await classifyNoProjectFolder(folder.uri.fsPath));
        return;
      }
      this.folderStateValue = 'rust';
      const discovered = await discoverProject(folder.uri.fsPath, { respectMembership: false });
      if (!discovered.model) {
        if (discovered.error && discovered.error !== 'no-manifest') this.fail(discovered.error);
        else this.setNoProject(await classifyNoProjectFolder(folder.uri.fsPath));
        return;
      }
      await this.load(discovered.model.root);
    } catch (error) {
      this.fail(error);
    }
  }

  /** Load (or reload) a project rooted at `dir`. */
  async load(dir: string): Promise<void> {
    this.setPhase('loading');
    try {
      await this.reload(dir);
    } catch (error) {
      this.fail(error);
    }
  }

  private async reload(dir: string): Promise<void> {
    const errors: string[] = [];

    const built = await buildModel(dir);
    if (!built.model) {
      if (built.error === 'no-manifest') this.setNoProject(await classifyNoProjectFolder(dir));
      else this.fail(built.error ?? 'Could not read the Cargo manifest.');
      return;
    }
    this.model = built.model;
    this.folderStateValue = 'rust';

    const metadataResult = await this.services.cargo.metadata(dir, { noDeps: true });
    if (metadataResult.ok && metadataResult.metadata) {
      this.metadata = metadataResult.metadata;
      this.model = applyMetadataMembers(this.model, metadataResult.metadata);
    } else {
      this.metadata = undefined;
      errors.push(metadataResult.error === 'cargo-missing' ? 'cargo was not found on PATH' : `cargo metadata failed: ${truncate(metadataResult.error ?? '')}`);
    }

    const lockfile = await readLockfile(dir);
    const declarations = await this.loadDeclarations(this.model);

    const registryData = await this.loadRegistryData(declarations);
    const audit = this.services.settings.auditEnabled
      ? await this.services.audit.run(dir, false)
      : { source: 'unavailable' as const, advisories: [], byPackage: new Map(), fetchedAt: Date.now(), error: 'disabled' };

    const model = this.model;
    const workspaceDeps = model.kind === 'workspace' ? await readWorkspaceDependencies(model.root) : [];
    const tree = buildDependencyTree({
      model,
      metadata: this.metadata,
      declarations,
      workspaceDependencies: workspaceDeps.map((d) => ({
        key: d.name,
        packageName: d.packageName,
        table: 'dependencies' as const,
        tablePath: 'workspace.dependencies',
        version: d.version,
        kind: d.kind === 'registry' ? 'registry' : d.kind === 'path' ? 'path' : d.kind === 'git' ? 'git' : 'unknown',
        path: d.path,
        git: d.git,
        features: d.features,
        defaultFeatures: d.defaultFeatures,
        rawValue: d.rawValue,
        manifestPath: path.join(model.root, 'Cargo.toml'),
        line: d.line,
      })),
      lockfile,
      registryData,
      registryDegraded: this.services.registry.degraded,
      advisories: audit.byPackage,
    });

    this.depTree = tree;
    this.auditResult = audit;
    this.toolchainState = await this.services.toolchain.detect(this.model.root, this.projectMsrv());
    this.propertiesModel = await readProperties(this.model);
    this.lastErrors = errors;
    this.loadPhase = 'ready';
    await this.updateContextKeys();
    this.onDidChangeStateEmitter.fire('ready');
    this.onDidChangeEmitter.fire();
  }

  /**
   * Highest `rust-version` across the workspace. A virtual workspace has no
   * single root package, and taking one arbitrary member would miss a stricter
   * MSRV declared elsewhere.
   */
  private projectMsrv(): string | undefined {
    const packages = this.metadata?.packages ?? [];
    const versions = packages.map((pkg) => pkg.rust_version).filter((version): version is string => !!version);
    if (!versions.length) {
      return packages.find((pkg) => pkg.name === this.primaryPackageName())?.rust_version ?? undefined;
    }
    return versions.reduce((highest, version) => {
      const candidate = semver.coerce(version);
      const current = semver.coerce(highest);
      if (!candidate || !current) return highest;
      return semver.gte(candidate, current) ? version : highest;
    });
  }

  private async loadDeclarations(model: ProjectModel): Promise<{ member: string; manifestPath: string; deps: DependencyDeclaration[] }[]> {
    const result: { member: string; manifestPath: string; deps: DependencyDeclaration[] }[] = [];
    for (const member of model.members) {
      result.push({
        member: member.name,
        manifestPath: member.manifestPath,
        deps: await readDependencies(member.manifestPath),
      });
    }
    return result;
  }

  private async loadRegistryData(
    declarations: { member: string; manifestPath: string; deps: DependencyDeclaration[] }[],
  ): Promise<Map<string, CrateDetail | undefined>> {
    const map = new Map<string, CrateDetail | undefined>();
    if (this.services.settings.offline) return map;

    const names = new Set<string>();
    for (const entry of declarations) {
      for (const dep of entry.deps) {
        if (dep.kind === 'registry' || dep.kind === 'workspace') names.add(dep.packageName);
      }
    }

    const entries = [...names];
    const concurrency = 6;
    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
      while (index < entries.length) {
        const name = entries[index++];
        const detail = await this.services.registry.crate(name);
        map.set(name, detail);
      }
    });
    await Promise.all(workers);
    return map;
  }

  primaryPackageName(): string {
    if (!this.model) return '';
    return this.model.rootPackage?.name ?? this.model.members[0]?.name ?? '';
  }

  private setNoProject(state: FolderState, error?: string): void {
    this.model = undefined;
    this.metadata = undefined;
    this.depTree = undefined;
    this.toolchainState = undefined;
    this.auditResult = undefined;
    this.propertiesModel = undefined;
    this.folderStateValue = state;
    this.lastErrors = error && error !== 'no-manifest' ? [error] : [];
    this.setPhase('idle');
    this.onDidChangeEmitter.fire();
  }

  /** Transition the load phase and let the views re-render immediately. */
  private setPhase(phase: LoadPhase): void {
    this.loadPhase = phase;
    void this.updateContextKeys();
    this.onDidChangeStateEmitter.fire(phase);
  }

  /** Record a failed load; any model already loaded stays on screen. */
  private fail(error: unknown): void {
    this.lastErrors = [error instanceof Error ? error.message : String(error)];
    this.setPhase('error');
    this.onDidChangeEmitter.fire();
  }

  /** Clear project state and re-inspect the workspace folder. */
  reset(): void {
    this.folderStateValue = 'unknown';
    void this.initialize();
  }

  async refresh(): Promise<void> {
    if (!this.model) {
      await this.initialize();
      return;
    }
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this.load(this.model.root).finally(() => {
      this.loadPromise = undefined;
    });
    return this.loadPromise;
  }

  /** Force a refetch of security advisories, bypassing the cache. */
  async refreshAudit(): Promise<void> {
    if (!this.model) return;
    const result = await this.services.audit.run(this.model.root, true, { force: true });
    this.auditResult = result;
    if (this.depTree) {
      // Re-index advisories on existing nodes without rebuilding the tree.
      const applyNode = (node: import('./core/deps/tree.js').DependencyNode) => {
        node.advisories = node.declaration ? result.byPackage.get(node.declaration.packageName) ?? [] : [];
        for (const child of node.children ?? []) applyNode(child);
      };
      applyNode(this.depTree.root);
    }
    this.onDidChangeEmitter.fire();
  }

  private async updateContextKeys(): Promise<void> {
    const hasProject = !!this.model;
    await vscode.commands.executeCommand('setContext', 'rustForge.hasProject', hasProject);
    await vscode.commands.executeCommand('setContext', 'rustForge.folderState', this.folderState);
    await vscode.commands.executeCommand('setContext', 'rustForge.loading', this.loadPhase === 'loading');
    await vscode.commands.executeCommand('setContext', 'rustForge.isWorkspace', this.model?.kind === 'workspace');
    await vscode.commands.executeCommand('setContext', 'rustForge.singlePackage', this.model?.kind === 'package');
  }

  /** Track a disposable tied to this controller's lifetime. */
  registerDisposable(disposable: vscode.Disposable): void {
    this.extraDisposables.push(disposable);
  }

  /** Refresh context keys after a snapshot is created or rolled back. */
  async syncContextKeys(): Promise<void> {
    await this.updateContextKeys();
  }

  dispose(): void {
    for (const disposable of this.extraDisposables) disposable.dispose();
    this.onDidChangeEmitter.dispose();
    this.onDidChangeStateEmitter.dispose();
  }
}

function truncate(value: string, limit = 400): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

/**
 * Classify a folder that has no root `Cargo.toml`. Finder leaves `.DS_Store`
 * behind in otherwise empty folders, so that file alone still counts as empty.
 */
async function classifyNoProjectFolder(root: string): Promise<FolderState> {
  try {
    const entries = await fs.readdir(root);
    return entries.some((name) => name !== '.DS_Store') ? 'nonRust' : 'empty';
  } catch {
    return 'nonRust';
  }
}

export { parseManifestFile, path };

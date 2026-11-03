/**
 * Project view: the merged Cargo structure and Explorer-style file tree.
 *
 * The root node lists workspace members first, then the root folder's other
 * directories and files. Members expand to their own directory contents, so no
 * intermediate `crates` folder is shown, and every directory behaves like the
 * built-in Explorer (lazy loading, theme icons, `files.exclude`, sort order).
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { ProjectModel } from '../core/cargo/project.js';
import type { CargoPackage } from '../core/cargo/types.js';
import { crateTargetContextSuffix, detectCrateTargets } from '../core/crateTarget.js';
import { SnapshotTreeProvider, type FileTreeHost } from './shared.js';
import {
  excludePatterns,
  explorerSortOrder,
  isInside,
  joinRelative,
  readDirectoryEntries,
  rootName,
  type FileEntry,
} from './fileTree.js';
import { isPathExcluded, sortEntries, workspaceContainers } from '../core/files.js';
import { isProjectConfigFile } from '../core/watch.js';
import { moveEntriesToDirectory } from '../commands/files.js';
import { t } from '../core/i18n.js';

const PROJECT_TREE_MIME = 'application/vnd.code.tree.rustforge.project';

type ProjectNodeKind = 'root' | 'member' | 'directory' | 'file' | 'info' | 'action' | 'message';

interface ProjectNode {
  kind: ProjectNodeKind;
  label: string;
  description?: string;
  tooltip?: string;
  manifestPath?: string;
  memberName?: string;
  icon?: string;
  resourceUri?: vscode.Uri;
  command?: vscode.Command;
  children?: ProjectNode[];
  contextValue?: string;
  id?: string;
}

export class ProjectTreeProvider
  extends SnapshotTreeProvider<ProjectNode>
  implements vscode.Disposable, FileTreeHost, vscode.TreeDragAndDropController<ProjectNode>
{
  readonly dropMimeTypes = [PROJECT_TREE_MIME, 'text/uri-list', 'files'];
  readonly dragMimeTypes = [PROJECT_TREE_MIME, 'text/uri-list'];

  private readonly disposables: vscode.Disposable[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly controller: ProjectController) {
    super();

    // The tree is also the file browser, so filesystem changes must refresh it.
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    const schedule = (uri: vscode.Uri) => {
      const root = this.rootUri;
      if (root && uri.scheme === root.scheme && isInside(root, uri)) this.scheduleRefresh();
    };
    this.disposables.push(
      watcher,
      watcher.onDidCreate(schedule),
      watcher.onDidDelete(schedule),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('files.exclude') || event.affectsConfiguration('explorer.sortOrder')) {
          this.refresh();
        }
      }),
    );
  }

  get rootUri(): vscode.Uri | undefined {
    const project = this.controller.project;
    if (project) return vscode.Uri.file(project.root);
    return vscode.workspace.workspaceFolders?.[0]?.uri;
  }

  // ----------------------------------------------------------- drag & drop
  //
  // Only files and plain directories can be dragged. Members (`crate` nodes)
  // and the project root are drop targets, never drag sources.

  handleDrag(source: readonly ProjectNode[], dataTransfer: vscode.DataTransfer): void {
    const uris = source
      .filter((node) => (node.kind === 'file' || node.kind === 'directory') && !!node.resourceUri)
      .map((node) => node.resourceUri!);
    if (!uris.length) return;
    const values = uris.map((uri) => uri.toString());
    // Custom data survives an internal drop; `text/uri-list` keeps the drag
    // usable by other trees and editors.
    dataTransfer.set(PROJECT_TREE_MIME, new vscode.DataTransferItem(values));
    dataTransfer.set('text/uri-list', new vscode.DataTransferItem(values.join('\r\n')));
  }

  async handleDrop(
    target: ProjectNode | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken,
  ): Promise<void> {
    if (!this.controller.project) return;
    const directory = this.dropDirectory(target);
    if (!directory) return;
    const sources = (await this.dropSources(dataTransfer)).filter((uri) => !this.isMemberRoot(uri));
    if (token.isCancellationRequested || !sources.length) return;

    const changed = await moveEntriesToDirectory(this, sources, directory);
    if (!changed) return;
    this.refresh();
    if (sources.some((uri) => isProjectConfigFile(path.basename(uri.fsPath)))) {
      await this.controller.refresh();
    }
  }

  /** Directory a drop lands in; dropping on a file targets its parent folder. */
  private dropDirectory(target: ProjectNode | undefined): vscode.Uri | undefined {
    if (!target) return this.rootUri;
    if (!target.resourceUri) return undefined;
    switch (target.kind) {
      case 'root':
      case 'member':
      case 'directory':
        return target.resourceUri;
      case 'file':
        return vscode.Uri.joinPath(target.resourceUri, '..');
      default:
        return undefined;
    }
  }

  /** Crate roots are never drag sources, even when dragged in from the Explorer. */
  private isMemberRoot(uri: vscode.Uri): boolean {
    const project = this.controller.project;
    if (!project || uri.scheme !== 'file') return false;
    return project.members.some((member) => path.resolve(member.dir) === path.resolve(uri.fsPath));
  }

  private async dropSources(dataTransfer: vscode.DataTransfer): Promise<vscode.Uri[]> {
    const uris = new Map<string, vscode.Uri>();
    const add = (uri: vscode.Uri) => {
      if (uri.scheme === 'file') uris.set(uri.toString(), uri);
    };

    const internal = dataTransfer.get(PROJECT_TREE_MIME)?.value;
    if (Array.isArray(internal)) {
      for (const value of internal) {
        if (typeof value === 'string') add(vscode.Uri.parse(value));
      }
    }
    if (!uris.size) {
      const list = await dataTransfer.get('text/uri-list')?.asString();
      if (list) {
        for (const line of list.split(/\r?\n/)) {
          const value = line.trim();
          if (value && !value.startsWith('#')) add(vscode.Uri.parse(value));
        }
      }
    }
    for (const [mime, item] of dataTransfer) {
      if (mime !== 'files') continue;
      const file = item.asFile();
      if (file?.uri) add(file.uri);
    }
    return [...uris.values()];
  }

  getTreeItem(node: ProjectNode): vscode.TreeItem {
    const item = new vscode.TreeItem(node.label, this.collapsibleState(node));
    item.id = node.id;
    item.description = node.description;
    item.tooltip = node.tooltip ?? node.description;
    item.contextValue = node.contextValue;
    item.command = node.command;
    if (node.resourceUri) item.resourceUri = node.resourceUri;
    if (node.icon) item.iconPath = new vscode.ThemeIcon(node.icon);
    else if (node.kind === 'directory') item.iconPath = vscode.ThemeIcon.Folder;
    else if (node.kind === 'file') item.iconPath = vscode.ThemeIcon.File;
    return item;
  }

  async getChildren(element?: ProjectNode): Promise<ProjectNode[]> {
    if (!element) return this.buildTopLevel();

    if (element.kind === 'member') {
      return element.resourceUri ? this.listDirectory(element.resourceUri) : [];
    }
    if (element.kind === 'directory') {
      if (!element.resourceUri) return [];
      const project = this.controller.project;
      const rootLevel = !!project && path.resolve(path.dirname(element.resourceUri.fsPath)) === path.resolve(project.root);
      const visible = rootLevel
        ? (await this.workspaceLayout()).visibleContainers.has(path.resolve(element.resourceUri.fsPath))
        : false;
      // A container directory is only shown because it has files that no
      // member accounts for; member folders are represented as project nodes,
      // so the container itself lists files only.
      return this.listDirectory(element.resourceUri, undefined, visible);
    }
    if (element.kind === 'root') {
      if (!element.resourceUri) return [];
      const layout = await this.workspaceLayout();
      const entries = await this.listDirectory(element.resourceUri, layout.hiddenRootNames);
      return element.contextValue?.startsWith('workspaceRoot') ? [...(await this.memberNodes()), ...entries] : entries;
    }
    return element.children ?? [];
  }

  private collapsibleState(node: ProjectNode): vscode.TreeItemCollapsibleState {
    switch (node.kind) {
      case 'root':
        return vscode.TreeItemCollapsibleState.Expanded;
      case 'member':
      case 'directory':
        return vscode.TreeItemCollapsibleState.Collapsed;
      case 'info':
        return node.children?.length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
      default:
        return vscode.TreeItemCollapsibleState.None;
    }
  }

  private async buildTopLevel(): Promise<ProjectNode[]> {
    const project = this.controller.project;
    // Without a root Cargo.toml this is not a Rust project: leave the view
    // empty so the folder-state welcome (initialize / create / open) shows
    // instead of an ordinary file listing.
    if (!project) {
      if (this.controller.phase !== 'error') return [];
      return [this.statusNode('error', t('Could not load project data.'), this.controller.errors.join('\n') || undefined)];
    }
    const root = this.rootUri;
    if (!root) return [];

    const snapshot = this.controller.snapshot;
    const phase = this.controller.phase;
    const nodes: ProjectNode[] = [];
    // The project tree stays on the last known layout while refreshing; unlike
    // Dependencies and Toolchain it never shows a loading row.
    if (phase === 'error') {
      nodes.push(this.statusNode('error', t('Could not load project data.'), this.controller.errors.join('\n') || undefined));
    }
    nodes.push(await this.rootNode(root, project));

    if (project.emptyWorkspaceShell) {
      nodes.push({
        kind: 'info',
        label: t('Empty [workspace] table detected'),
        description: t('conversion treats this as a single package'),
        icon: 'info',
        contextValue: 'info',
        id: 'info:empty-workspace-shell',
      });
    }

    if (snapshot?.errors.length) {
      nodes.push({
        kind: 'info',
        label: t('Issues detected'),
        description: `${snapshot.errors.length}`,
        tooltip: snapshot.errors.join('\n'),
        icon: 'warning',
        contextValue: 'info',
        id: 'info:issues',
        children: snapshot.errors.map((error) => ({
          kind: 'info' as const,
          label: error,
          icon: 'error',
          contextValue: 'info',
        })),
      });
    }

    if (snapshot?.toolchain.msrvRelation === 'violated') {
      nodes.push({
        kind: 'action',
        label: t('Toolchain is below the project MSRV'),
        description: t('review the toolchain view'),
        icon: 'warning',
        command: { command: 'rustForge.updateToolchain', title: t('Update Toolchain') },
        contextValue: 'action',
        id: 'action:msrv',
      });
    }

    return nodes;
  }

  private statusNode(status: 'loading' | 'error', label: string, tooltip?: string): ProjectNode {
    return {
      kind: 'message',
      label,
      tooltip,
      icon: status === 'loading' ? 'sync~spin' : 'error',
      contextValue: `status:${status}`,
      id: `status:${status}`,
      command: status === 'error' ? { command: 'rustForge.refresh', title: t('Retry') } : undefined,
    };
  }

  private async rootNode(root: vscode.Uri, project: ProjectModel | undefined): Promise<ProjectNode> {
    const uriKey = root.toString();
    if (project?.kind === 'workspace') {
      const rootPackage = project.rootPackage;
      const target = rootPackage
        ? await detectCrateTargets(rootPackage.dir, { metadataPackage: this.metadataPackage(rootPackage.name) })
        : undefined;
      return {
        kind: 'root',
        label: path.basename(project.root) || 'workspace',
        description: t(
          '{0} members · resolver {1}',
          project.members.length,
          String((project.workspaceManifest?.resolver as string | undefined) ?? '—'),
        ),
        tooltip: project.manifestPath,
        manifestPath: project.manifestPath,
        memberName: rootPackage?.name,
        resourceUri: root,
        icon: 'root-folder',
        contextValue: `workspaceRoot${crateTargetContextSuffix(target)}`,
        id: `root:${uriKey}`,
      };
    }
    if (project?.rootPackage) {
      const target = await detectCrateTargets(project.rootPackage.dir, {
        metadataPackage: this.metadataPackage(project.rootPackage.name),
      });
      return {
        kind: 'root',
        label: project.rootPackage.name,
        description: t('single package'),
        tooltip: project.rootPackage.manifestPath,
        manifestPath: project.rootPackage.manifestPath,
        memberName: project.rootPackage.name,
        resourceUri: root,
        icon: 'package',
        contextValue: `rootPackage${crateTargetContextSuffix(target)}`,
        id: `root:${uriKey}`,
      };
    }
    return {
      kind: 'root',
      label: rootName(root),
      tooltip: root.fsPath,
      resourceUri: root,
      icon: 'root-folder',
      contextValue: 'rootDirectory',
      id: `root:${uriKey}`,
    };
  }

  /** Workspace members as expandable package nodes, ordered by package name. */
  private async memberNodes(): Promise<ProjectNode[]> {
    const project = this.controller.project;
    if (!project || project.kind !== 'workspace') return [];
    const sorted = sortEntries(
      project.members
        // The workspace root package is represented by the root node itself.
        .filter((member) => path.resolve(member.dir) !== path.resolve(project.root))
        .map((member) => ({ name: member.name, isDirectory: true, member })),
      explorerSortOrder(),
    );

    const nodes: ProjectNode[] = [];
    for (const { member } of sorted) {
      const target = await detectCrateTargets(member.dir, { metadataPackage: this.metadataPackage(member.name) });
      nodes.push({
        kind: 'member',
        label: member.name,
        description: vscode.workspace.asRelativePath(member.dir, false),
        tooltip: member.manifestPath,
        manifestPath: member.manifestPath,
        memberName: member.name,
        resourceUri: vscode.Uri.file(member.dir),
        icon: 'package',
        contextValue: `member${crateTargetContextSuffix(target)}`,
        id: `member:${member.dir}`,
      });
    }
    return nodes;
  }

  /** `cargo metadata --no-deps` package for a workspace member, when loaded. */
  private metadataPackage(name: string | undefined): CargoPackage | undefined {
    if (!name) return undefined;
    return this.controller.snapshot?.metadata?.packages.find((pkg) => pkg.name === name);
  }

  /**
   * How the workspace root should be rendered.
   *
   * - Member directories are never listed twice: a member at the root is
   *   hidden from the file listing, and a container such as `crates` is hidden
   *   when it only groups members.
   * - A container that also holds files is shown, but only its files: the
   *   member folders inside it already appear as project nodes. Extra
   *   directories are left for the Standardize panel to report.
   */
  private async workspaceLayout(): Promise<{ hiddenRootNames: Set<string>; visibleContainers: Set<string> }> {
    const project = this.controller.project;
    const hiddenRootNames = new Set<string>();
    const visibleContainers = new Set<string>();
    if (!project || project.kind !== 'workspace') return { hiddenRootNames, visibleContainers };

    for (const member of project.members) {
      const relative = path.relative(project.root, member.dir);
      if (!relative || path.isAbsolute(relative) || relative.startsWith('..')) continue;
      const parts = relative.split(path.sep).filter(Boolean);
      // Top-level members and the workspace root package itself.
      if (parts.length === 1) hiddenRootNames.add(parts[0]!);
    }

    const excluded = excludePatterns();
    for (const container of workspaceContainers(project.root, project.members.map((member) => member.dir))) {
      let entries: [string, vscode.FileType][];
      try {
        entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(container.dir));
      } catch {
        hiddenRootNames.add(container.name);
        continue;
      }
      const hasStrayFile = entries.some(
        ([name, type]) =>
          !container.memberChildren.has(name) &&
          (type & vscode.FileType.Directory) === 0 &&
          !isPathExcluded(joinRelative(container.name, name), excluded),
      );
      if (hasStrayFile) visibleContainers.add(path.resolve(container.dir));
      else hiddenRootNames.add(container.name);
    }
    return { hiddenRootNames, visibleContainers };
  }

  private async listDirectory(
    directory: vscode.Uri,
    hiddenNames?: ReadonlySet<string>,
    filesOnly = false,
  ): Promise<ProjectNode[]> {
    const root = this.rootUri ?? directory;
    try {
      const entries = await readDirectoryEntries(directory, root, hiddenNames);
      const visible = filesOnly ? entries.filter((entry) => !entry.isDirectory) : entries;
      return visible.map((entry) => this.entryNode(entry));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return [
        {
          kind: 'message',
          label: t('Cannot read folder: {0}', detail),
          tooltip: detail,
          icon: 'warning',
          contextValue: 'message',
          id: `message:${directory.toString()}`,
        },
      ];
    }
  }

  private entryNode(entry: FileEntry): ProjectNode {
    const tooltip = vscode.workspace.asRelativePath(entry.uri, false);
    if (entry.isDirectory) {
      return {
        kind: 'directory',
        label: entry.name,
        tooltip,
        resourceUri: entry.uri,
        contextValue: 'directory',
        id: `dir:${entry.uri.toString()}`,
      };
    }
    return {
      kind: 'file',
      label: entry.name,
      tooltip,
      resourceUri: entry.uri,
      contextValue: 'file',
      id: `file:${entry.uri.toString()}`,
      command: {
        command: 'vscode.open',
        title: t('Open File'),
        arguments: [entry.uri, { preview: true }],
      },
    };
  }

  dispose(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables.length = 0;
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      this.refresh();
    }, 200);
  }
}

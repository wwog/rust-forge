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
import { SnapshotTreeProvider, type FileTreeHost } from './shared.js';
import {
  explorerSortOrder,
  isInside,
  readDirectoryEntries,
  rootName,
  type FileEntry,
} from './fileTree.js';
import { sortEntries } from '../core/files.js';
import { t } from '../core/i18n.js';

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

export class ProjectTreeProvider extends SnapshotTreeProvider<ProjectNode> implements vscode.Disposable, FileTreeHost {
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
      return element.resourceUri ? this.listDirectory(element.resourceUri) : [];
    }
    if (element.kind === 'root') {
      if (!element.resourceUri) return [];
      const entries = await this.listDirectory(element.resourceUri, this.hiddenRootNames());
      return element.contextValue === 'workspaceRoot' ? [...this.memberNodes(), ...entries] : entries;
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

  private buildTopLevel(): ProjectNode[] {
    const project = this.controller.project;
    const root = this.rootUri;
    if (!root) return [];

    const snapshot = this.controller.snapshot;
    const nodes: ProjectNode[] = [this.rootNode(root, project)];

    if (project?.emptyWorkspaceShell) {
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

  private rootNode(root: vscode.Uri, project: ProjectModel | undefined): ProjectNode {
    const uriKey = root.toString();
    if (project?.kind === 'workspace') {
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
        resourceUri: root,
        icon: 'root-folder',
        contextValue: 'workspaceRoot',
        id: `root:${uriKey}`,
      };
    }
    if (project?.rootPackage) {
      return {
        kind: 'root',
        label: project.rootPackage.name,
        description: t('single package'),
        tooltip: project.rootPackage.manifestPath,
        manifestPath: project.rootPackage.manifestPath,
        memberName: project.rootPackage.name,
        resourceUri: root,
        icon: 'package',
        contextValue: 'rootPackage',
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
  private memberNodes(): ProjectNode[] {
    const project = this.controller.project;
    if (!project || project.kind !== 'workspace') return [];
    return sortEntries(
      project.members.map((member) => ({ name: member.name, isDirectory: true, member })),
      explorerSortOrder(),
    ).map(({ member }) => ({
      kind: 'member' as const,
      label: member.name,
      description: vscode.workspace.asRelativePath(member.dir, false),
      tooltip: member.manifestPath,
      manifestPath: member.manifestPath,
      memberName: member.name,
      resourceUri: vscode.Uri.file(member.dir),
      icon: 'package',
      contextValue: 'member',
      id: `member:${member.dir}`,
    }));
  }

  /**
   * Root-level directories that only group workspace members (typically
   * `crates`). They are omitted so members appear directly under the project.
   */
  private hiddenRootNames(): Set<string> {
    const project = this.controller.project;
    if (!project || project.kind !== 'workspace') return new Set();
    const hidden = new Set<string>();
    for (const member of project.members) {
      const relative = path.relative(project.root, member.dir);
      if (!relative || path.isAbsolute(relative) || relative.startsWith('..')) continue;
      const [first, ...rest] = relative.split(path.sep).filter(Boolean);
      if (first && rest.length) hidden.add(first);
    }
    return hidden;
  }

  private async listDirectory(
    directory: vscode.Uri,
    hiddenNames?: ReadonlySet<string>,
  ): Promise<ProjectNode[]> {
    const root = this.rootUri ?? directory;
    try {
      const entries = await readDirectoryEntries(directory, root, hiddenNames);
      return entries.map((entry) => this.entryNode(entry));
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

/** Dependency tree view: workspace -> members -> declared dependencies. */
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { DependencyNode } from '../core/deps/tree.js';
import { SnapshotTreeProvider, errorStatus, isStatusNode, statusTreeItem, type StatusNode } from './shared.js';
import { severityLabel } from '../core/audit.js';
import { t } from '../core/i18n.js';

export interface DependencyTreeElement {
  node: DependencyNode;
  parent?: DependencyTreeElement;
}

export type DependencyViewElement = DependencyTreeElement | StatusNode;

export class DependencyTreeProvider extends SnapshotTreeProvider<DependencyViewElement> {
  constructor(private readonly controller: ProjectController) {
    super();
  }

  getTreeItem(element: DependencyViewElement): vscode.TreeItem {
    if (isStatusNode(element)) return statusTreeItem(element);
    const { node } = element;
    const collapsible = node.children?.length
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(this.label(node), collapsible);
    item.description = this.describe(node);
    item.tooltip = this.tooltip(node);
    item.contextValue = this.contextValue(node);
    item.iconPath = this.icon(node);

    if (node.kind === 'dependency' || node.kind === 'localDependency') {
      if (node.manifestPath) {
        item.command = {
          command: 'rustForge.openDependencyManifest',
          title: t('Open declaration'),
          arguments: [element],
        };
      }
    } else if (node.kind === 'member' && node.manifestPath) {
      item.command = {
        command: 'rustForge.openManifest',
        title: t('Open Cargo.toml'),
        arguments: [node.manifestPath],
      };
    }
    return item;
  }

  getChildren(element?: DependencyViewElement): DependencyViewElement[] {
    if (element && isStatusNode(element)) return [];

    const tree = this.controller.snapshot?.depTree;
    const phase = this.controller.phase;
    if (!element) {
      if (!tree) {
        if (phase === 'loading') return [{ status: 'loading', label: t('Loading dependencies…') }];
        if (phase === 'error') {
          return [errorStatus(t('Could not load dependencies.'), this.controller.errors.join('\n') || undefined)];
        }
        return [];
      }
      // Root: the workspace node, or the single member's dependencies.
      const root = this.wrap(tree.root);
      if (phase === 'loading') return [{ status: 'loading', label: t('Refreshing dependencies…') }, root];
      if (phase === 'error') {
        return [errorStatus(t('Could not load dependencies.'), this.controller.errors.join('\n') || undefined), root];
      }
      return [root];
    }

    const children = element.node.children ?? [];
    // Local workspace dependencies expand to the full dependency set of the
    // target member, exposing internal topology without showing transitive
    // registry crates.
    if (element.node.kind === 'localDependency' && element.node.localTarget) {
      const target = this.findMemberNode(element.node.localTarget);
      if (target) {
        return (target.children ?? []).map((child) => this.wrap(child, element));
      }
    }
    return children.map((child) => this.wrap(child, element));
  }

  private wrap(node: DependencyNode, parent?: DependencyTreeElement): DependencyTreeElement {
    return { node, parent };
  }

  private findMemberNode(memberName: string): DependencyNode | undefined {
    const root = this.controller.snapshot?.depTree.root;
    if (!root) return undefined;
    if (root.kind === 'member' && root.memberName === memberName) return root;
    return root.children?.find((child) => child.memberName === memberName);
  }

  private label(node: DependencyNode): string {
    switch (node.id) {
      case 'workspace-dependencies':
        return t('Workspace dependencies');
      case 'workspace-deps:local':
        return t('Local dependencies');
      case 'workspace-deps:remote':
        return t('Remote dependencies');
      default:
        return node.label;
    }
  }

  private describe(node: DependencyNode): string {
    if (node.kind === 'group') return node.description ?? '';
    if (node.kind === 'workspace') {
      const members = node.children?.filter((child) => child.kind === 'member').length ?? 0;
      const workspaceGroup = node.children?.find((child) => child.id === 'workspace-dependencies');
      const workspaceDeps = workspaceGroup?.children?.reduce((sum, group) => sum + (group.children?.length ?? 0), 0) ?? 0;
      return workspaceDeps
        ? t('{0} members · {1} workspace dependencies', members, workspaceDeps)
        : t('{0} members', members);
    }
    if (node.kind === 'member') {
      const deps = node.children?.length ?? 0;
      return t('{0} declared', deps);
    }
    const parts: string[] = [];
    if (node.requirement) parts.push(node.requirement);
    if (node.lockedVersion) parts.push(`→ ${node.lockedVersion}`);
    if (node.latestVersion && node.latestVersion !== node.lockedVersion) parts.push(`↑ ${node.latestVersion}`);
    if (node.advisories.length) parts.push(t('⚠ {0}', node.advisories.length));
    if (node.optional) parts.push(t('optional'));
    if (node.upgrade?.classification === 'major') parts.push(t('major'));
    return parts.join(' · ');
  }

  private tooltip(node: DependencyNode): vscode.MarkdownString | string {
    if (node.kind === 'workspace' || node.kind === 'member') return node.description ?? node.label;
    if (node.kind === 'group') return this.label(node);
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${node.label}**\n\n`);
    if (node.requirement) md.appendMarkdown(`- ${t('Declared')}: \`${node.requirement}\`\n`);
    if (node.lockedVersion) md.appendMarkdown(`- ${t('Locked')}: \`${node.lockedVersion}\`\n`);
    if (node.latestVersion) md.appendMarkdown(`- ${t('Latest')}: \`${node.latestVersion}\`\n`);
    if (node.registryUnavailable) md.appendMarkdown(`- ${t('Latest version unavailable')}\n`);
    if (node.features?.length) md.appendMarkdown(`- ${t('Features')}: \`${node.features.join(', ')}\`\n`);
    if (node.upgrade) {
      md.appendMarkdown(`- ${t('Upgrade')}: ${node.upgrade.classification} (${node.upgrade.from} → ${node.upgrade.to})\n`);
    }
    if (node.advisories.length) {
      md.appendMarkdown(`\n**${t('Security advisories')}**\n`);
      for (const advisory of node.advisories) {
        md.appendMarkdown(`- [${advisory.id}](${advisory.url ?? ''}) ${advisory.title} (${severityLabel(advisory.severity)})\n`);
      }
    }
    md.isTrusted = false;
    return md;
  }

  private contextValue(node: DependencyNode): string {
    if (node.kind === 'workspace') return 'workspace';
    if (node.kind === 'member') return 'memberDeps';
    if (node.kind === 'group') return node.id;
    const parts = ['dependency'];
    if (node.declaration?.kind) parts.push(node.declaration.kind);
    if (node.upgrade?.classification === 'safe') parts.push('safe');
    if (node.upgrade?.classification === 'major') parts.push('major');
    // An update only exists when the registry reports a different version and
    // the assessment found something actionable; "not-applicable" means the
    // dependency is already at the latest version.
    if (node.upgrade && node.upgrade.classification !== 'not-applicable') parts.push('upgradable');
    if (node.advisories.length) parts.push('vulnerable');
    if (node.localTarget) parts.push('local');
    if (node.declaration?.kind !== 'path') parts.push('documentable');
    if (node.workspaceRootDependency) parts.push('workspaceRootDependency');
    if (this.isPromotable(node)) parts.push('promotable');
    return parts.join(':');
  }

  /**
   * A direct declaration in a workspace member can be promoted to
   * `[workspace.dependencies]`, including a path dependency on another member.
   * Entries that already inherit are not promotable.
   */
  private isPromotable(node: DependencyNode): boolean {
    return (
      (node.kind === 'dependency' || node.kind === 'localDependency') &&
      !!node.declaration &&
      node.declaration.kind !== 'workspace' &&
      !node.workspaceRootDependency &&
      this.controller.project?.kind === 'workspace'
    );
  }

  private icon(node: DependencyNode): vscode.ThemeIcon {
    if (node.kind === 'group') return new vscode.ThemeIcon(node.icon ?? 'library');
    if (node.advisories.length) return new vscode.ThemeIcon('shield', new vscode.ThemeColor('problemsErrorIcon.foreground'));
    if (node.kind === 'workspace') return new vscode.ThemeIcon('root-folder');
    if (node.kind === 'member') return new vscode.ThemeIcon('package');
    switch (node.declaration?.kind) {
      case 'path':
        return new vscode.ThemeIcon('folder-library');
      case 'git':
        return new vscode.ThemeIcon('repo');
      case 'workspace':
        return new vscode.ThemeIcon('library');
      default:
        break;
    }
    if (node.upgrade?.classification === 'major') return new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('notificationsWarningIcon.foreground'));
    if (node.upgrade?.classification === 'safe') return new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('charts.green'));
    return new vscode.ThemeIcon('cloud');
  }
}

/** Toolchain view: active channel, available updates and MSRV status. */
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import { resolveCargoMirror } from '../core/cargo/mirror.js';
import { readSettings } from '../settings.js';
import { SnapshotTreeProvider } from './shared.js';
import { t } from '../core/i18n.js';

type ToolchainNodeKind =
  | 'active'
  | 'msrv'
  | 'installed'
  | 'update'
  | 'group'
  | 'action'
  | 'component'
  | 'target'
  | 'mirror'
  | 'status';

interface ToolchainNode {
  kind: ToolchainNodeKind;
  label: string;
  description?: string;
  tooltip?: string;
  icon?: string;
  color?: string;
  contextValue?: string;
  command?: vscode.Command;
  children?: ToolchainNode[];
  channel?: string;
}

export class ToolchainTreeProvider extends SnapshotTreeProvider<ToolchainNode> {
  constructor(private readonly controller: ProjectController) {
    super();
  }

  getTreeItem(node: ToolchainNode): vscode.TreeItem {
    const collapsible = node.children?.length
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(node.label, collapsible);
    item.description = node.description;
    item.tooltip = node.tooltip ?? node.description;
    item.contextValue = node.contextValue;
    item.command = node.command;
    if (node.icon) {
      item.iconPath = node.color ? new vscode.ThemeIcon(node.icon, new vscode.ThemeColor(node.color)) : new vscode.ThemeIcon(node.icon);
    }
    return item;
  }

  getChildren(element?: ToolchainNode): ToolchainNode[] {
    if (element) return element.children ?? [];
    const snapshot = this.controller.snapshot;
    const phase = this.controller.phase;
    if (!snapshot) {
      if (phase === 'loading') return [this.statusNode('loading', t('Loading toolchain…'))];
      if (phase === 'error') {
        return [this.statusNode('error', t('Could not load the toolchain.'), this.controller.errors.join('\n') || undefined)];
      }
      return [];
    }
    const state = snapshot.toolchain;
    const nodes: ToolchainNode[] = [];
    if (phase === 'loading') nodes.push(this.statusNode('loading', t('Refreshing toolchain…')));
    else if (phase === 'error') {
      nodes.push(this.statusNode('error', t('Could not load the toolchain.'), this.controller.errors.join('\n') || undefined));
    }

    if (!state.cargoPath) {
      nodes.push({
        kind: 'action',
        label: t('cargo was not found on PATH'),
        description: t('required for all project operations'),
        icon: 'error',
        color: 'errorForeground',
        command: { command: 'rustForge.installRustup', title: t('Install rustup') },
      });
    }

    if (state.activeToolchain || state.rustcVersion) {
      nodes.push({
        kind: 'active',
        label: state.activeToolchain ?? `rustc ${state.rustcVersion}`,
        description: state.activeToolchain && state.rustcVersion ? `rustc ${state.rustcVersion}` : undefined,
        tooltip: [
          `${t('Active toolchain')}: ${state.activeToolchain ?? '—'}`,
          state.rustcVersion ? `rustc ${state.rustcVersion}` : undefined,
          state.activeSource ? `${t('Detected via')}: ${state.activeSource}` : undefined,
          state.toolchainFile?.path ? `rust-toolchain: ${vscode.workspace.asRelativePath(state.toolchainFile.path)}` : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
        icon: 'versions',
        contextValue: 'activeToolchain',
        children: [
          ...(state.components?.length
            ? [{ kind: 'component' as const, label: t('Components'), icon: 'extensions', children: state.components.map((c) => ({ kind: 'component' as const, label: c })) }]
            : []),
          ...(state.targets?.length
            ? [{ kind: 'target' as const, label: t('Targets'), icon: 'device-desktop', children: state.targets.map((c) => ({ kind: 'target' as const, label: c })) }]
            : []),
        ],
      });
    }

    const settings = readSettings();
    const mirror = resolveCargoMirror(settings.cargoMirror, settings.cargoMirrors);
    nodes.push({
      kind: 'mirror',
      label: t('Cargo mirror'),
      description: mirror.index ? mirror.name : t('Cargo default (no replacement)'),
      tooltip: [
        `${t('Mirror source')}: ${mirror.name}`,
        mirror.index ?? t('Cargo default (no replacement)'),
        t('Applies only to cargo processes started by Rust Forge.'),
      ].join('\n'),
      icon: 'globe',
      contextValue: 'cargoMirror',
      command: { command: 'rustForge.selectCargoMirror', title: t('Select Cargo Mirror…') },
    });

    if (state.msrv) {
      const violated = state.msrvRelation === 'violated';
      nodes.push({
        kind: 'msrv',
        label: `${t('MSRV')}: ${state.msrv}`,
        description:
          state.msrvRelation === 'satisfied'
            ? t('satisfied by active toolchain')
            : violated
              ? t('active toolchain is too old')
              : t('unable to verify'),
        icon: violated ? 'warning' : state.msrvRelation === 'satisfied' ? 'pass' : 'question',
        color: violated ? 'errorForeground' : undefined,
        tooltip: violated
          ? t('The active toolchain ({0}) is older than the manifest rust-version ({1}).', state.rustcVersion ?? '?', state.msrv)
          : undefined,
        command: violated ? { command: 'rustForge.updateToolchain', title: t('Update Toolchain') } : undefined,
      });
    }

    const updates = state.updates.filter((u) => u.updateAvailable);
    if (updates.length) {
      nodes.push({
        kind: 'group',
        label: t('Available updates'),
        description: `${updates.length}`,
        icon: 'cloud-download',
        children: updates.map((update) => ({
          kind: 'update' as const,
          label: update.channel,
          description: update.detail,
          tooltip: `${update.channel}\n${update.detail ?? ''}`,
          icon: 'sync',
          contextValue: 'toolchainUpdate',
          channel: update.channel,
          command: { command: 'rustForge.updateToolchain', title: t('Update Toolchain'), arguments: [update.channel] },
        })),
      });
    }

    if (state.installed.length) {
      nodes.push({
        kind: 'group',
        label: t('Installed toolchains'),
        description: `${state.installed.length}`,
        icon: 'server',
        children: state.installed.map((toolchain) => ({
          kind: 'installed' as const,
          label: toolchain.name,
          description: toolchain.active ? t('active') : toolchain.default ? t('default') : undefined,
          icon: toolchain.active ? 'check' : 'circle-outline',
          contextValue: toolchain.active ? 'installedToolchain:active' : 'installedToolchain',
        })),
      });
    }

    if (!state.rustupPath) {
      nodes.push({
        kind: 'action',
        label: t('rustup was not found'),
        description: t('install it to manage toolchains'),
        icon: 'info',
        command: { command: 'rustForge.installRustup', title: t('Install rustup') },
      });
    }

    return nodes;
  }

  private statusNode(status: 'loading' | 'error', label: string, tooltip?: string): ToolchainNode {
    return {
      kind: 'status',
      label,
      tooltip,
      icon: status === 'loading' ? 'sync~spin' : 'error',
      color: status === 'error' ? 'errorForeground' : undefined,
      contextValue: `status:${status}`,
      command: status === 'error' ? { command: 'rustForge.refresh', title: t('Retry') } : undefined,
    };
  }
}

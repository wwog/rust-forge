/**
 * Dependency health panel: duplicate versions from `cargo tree -d`, plus
 * manifest/source-level checks for unused declarations, workspace inheritance
 * gaps and member version disagreements.
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import type { ProjectModel } from '../core/cargo/project.js';
import { readDependencies } from '../core/cargo/manifestDeps.js';
import { parseCargoTreeDuplicates, type DuplicateGroup } from '../core/deps/duplicates.js';
import { analyzeDeclaredHealth, type DeclaredHealth } from '../core/deps/health.js';
import { t } from '../core/i18n.js';
import { openFile } from '../views/shared.js';
import { WebviewPanelHost } from '../webviews/host.js';
import type { HealthPanelData, WebviewMessage } from '../webviews/protocol.js';
import { convergeWorkspaceDependency } from './workspaceDeps.js';

export async function dependencyHealthCommand(
  controller: ProjectController,
  services: Services,
  extensionUri: vscode.Uri,
): Promise<void> {
  const model = controller.project;
  if (!model) {
    void vscode.window.showInformationMessage(t('Open a Rust project first.'));
    return;
  }

  let declared = await readDeclaredHealth(model);
  let duplicateState: DuplicateState = { duplicates: [], error: undefined, detail: undefined };
  let running = false;

  const host = WebviewPanelHost.create({
    extensionUri,
    id: 'health',
    title: t('Dependency health'),
    data: toPanelData(model, declared, duplicateState, true),
    // Manifest edits and lockfile changes both affect this panel.
    watch: [model.manifestPath, ...model.members.map((member) => member.manifestPath), path.join(model.root, 'Cargo.lock')],
    reload: async (current) => {
      const latest = controller.project;
      if (!latest) return current ?? toPanelData(model, declared, duplicateState, false);
      const nextDeclared = await readDeclaredHealth(latest);
      const nextDuplicates = await analyzeDuplicates(latest, services);
      return toPanelData(latest, nextDeclared, nextDuplicates, false);
    },
    handlers: async (message: WebviewMessage) => {
      switch (message.type) {
        case 'refreshHealth': {
          if (running) return;
          running = true;
          host.setData(toPanelData(model, declared, duplicateState, true));
          try {
            const latest = controller.project ?? model;
            const nextDeclared = await readDeclaredHealth(latest);
            const nextDuplicates = await analyzeDuplicates(latest, services);
            declared = nextDeclared;
            duplicateState = nextDuplicates;
            host.setData(toPanelData(latest, nextDeclared, nextDuplicates, false));
          } catch (error) {
            host.toast(error instanceof Error ? error.message : String(error), 'error');
          } finally {
            running = false;
          }
          break;
        }
        case 'openFile':
          await openFile(message.path, message.line);
          break;
        case 'convergeWorkspaceDependency': {
          try {
            await convergeWorkspaceDependency(controller, services, host, message.name);
          } catch (error) {
            host.toast(error instanceof Error ? error.message : String(error), 'error');
          }
          // Re-render from disk even when the command was refused or
          // verification failed, so the panel never keeps stale rows.
          try {
            const latest = controller.project ?? model;
            const nextDeclared = await readDeclaredHealth(latest);
            const nextDuplicates = await analyzeDuplicates(latest, services);
            declared = nextDeclared;
            duplicateState = nextDuplicates;
            host.setData(toPanelData(latest, nextDeclared, nextDuplicates, false));
          } catch (error) {
            host.toast(error instanceof Error ? error.message : String(error), 'error');
          }
          break;
        }
        case 'runCommand':
          await vscode.commands.executeCommand(message.command, ...(message.args ?? []));
          break;
        case 'openUrl':
          if (message.url) await vscode.env.openExternal(vscode.Uri.parse(message.url));
          break;
        default:
          break;
      }
    },
  });

  // The declared checks are already available; duplicate analysis needs cargo
  // and is delivered as a second payload so the panel is usable immediately.
  try {
    duplicateState = await analyzeDuplicates(model, services);
  } catch (error) {
    duplicateState = { duplicates: [], error: error instanceof Error ? error.message : String(error) };
  }
  host.setData(toPanelData(model, declared, duplicateState, false));
}

interface DuplicateState {
  duplicates: DuplicateGroup[];
  error?: string;
  detail?: string;
}

async function readDeclaredHealth(model: ProjectModel): Promise<DeclaredHealth> {
  const declarations = await Promise.all(
    model.members.map(async (member) => ({
      member: member.name,
      manifestPath: member.manifestPath,
      deps: await readDependencies(member.manifestPath),
    })),
  );
  return analyzeDeclaredHealth(model, declarations);
}

async function analyzeDuplicates(model: ProjectModel, services: Services): Promise<DuplicateState> {
  const result = await services.cargo.treeDuplicates(model.root, { workspace: model.kind === 'workspace' });
  if (result.missingBinary) {
    return { duplicates: [], error: t('cargo was not found on PATH.') };
  }
  if (result.code !== 0) {
    return {
      duplicates: [],
      error: t('cargo tree -d failed.'),
      detail: (result.stderr || result.stdout).trim().slice(0, 4000) || undefined,
    };
  }

  const output = result.stdout.trim();
  if (!output) return { duplicates: [] };

  // Requirements are not part of `cargo tree` output; full metadata supplies
  // the dependency ranges that explain why two copies were selected.
  const metadataResult = await services.cargo.metadata(model.root, { noDeps: false }, { timeoutMs: 180_000 });
  const duplicates = parseCargoTreeDuplicates(result.stdout, {
    members: model.members.map((member) => ({ name: member.name, dir: member.dir })),
    metadata: metadataResult.ok ? metadataResult.metadata : undefined,
  });
  return { duplicates };
}

function toPanelData(
  model: ProjectModel,
  declared: DeclaredHealth,
  duplicates: DuplicateState,
  analyzing: boolean,
): HealthPanelData {
  return {
    kind: 'health-panel',
    workspace: model.kind === 'workspace',
    analyzing,
    duplicates: duplicates.duplicates,
    unused: declared.unused,
    workspaceDependencies: declared.workspaceDependencies,
    versionMismatches: declared.versionMismatches,
    scannedFiles: declared.scannedFiles,
    duplicateError: duplicates.error,
    duplicateErrorDetail: duplicates.detail,
  };
}

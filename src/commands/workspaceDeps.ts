/**
 * Commands for promoting a direct dependency to `[workspace.dependencies]`
 * and for converging members onto an existing workspace entry.
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import type { DependencyDeclaration } from '../core/cargo/manifestDeps.js';
import { readDependencies, readWorkspaceDependencies } from '../core/cargo/manifestDeps.js';
import type { ProjectModel } from '../core/cargo/project.js';
import type { DependencyNode } from '../core/deps/tree.js';
import { planConvergence, planPromotion } from '../core/topology/workspaceDeps.js';
import { readTextFile } from '../core/process.js';
import { t } from '../core/i18n.js';
import { confirmWithDiffs, writeFilesWithVerification } from './shared.js';
import type { WebviewPanelHost } from '../webviews/host.js';

/** The tree passes its element; other callers may pass the node directly. */
function nodeOf(value: DependencyNode | { node?: DependencyNode } | undefined): DependencyNode | undefined {
  if (!value) return undefined;
  const candidate = (value as { node?: DependencyNode }).node;
  return candidate ?? (value as DependencyNode);
}

interface WorkspaceInputs {
  declarations: DependencyDeclaration[];
  texts: Map<string, string>;
  workspaceEntries: Awaited<ReturnType<typeof readWorkspaceDependencies>>;
}

/** Read every member manifest once, plus the workspace root manifest. */
async function readWorkspaceInputs(model: ProjectModel): Promise<WorkspaceInputs> {
  const declarations: DependencyDeclaration[] = [];
  const texts = new Map<string, string>();
  const seen = new Set<string>();

  for (const member of model.members) {
    const key = path.resolve(member.manifestPath);
    if (!seen.has(key)) {
      seen.add(key);
      declarations.push(...(await readDependencies(member.manifestPath)));
    }
    if (!texts.has(member.manifestPath)) {
      texts.set(member.manifestPath, await readTextFile(member.manifestPath));
    }
  }
  if (!texts.has(model.manifestPath)) {
    texts.set(model.manifestPath, await readTextFile(model.manifestPath));
  }

  return {
    declarations,
    texts,
    workspaceEntries: await readWorkspaceDependencies(model.root),
  };
}

async function showPlanErrors(title: string, errors: string[]): Promise<void> {
  const [first, ...rest] = errors;
  await vscode.window.showWarningMessage(
    title,
    { modal: true, detail: [first, ...rest].filter(Boolean).join('\n\n') },
    t('Close'),
  );
}

/**
 * Move every direct declaration of the selected package into
 * `[workspace.dependencies]` and leave `workspace = true` references behind.
 */
export async function promoteDependencyToWorkspaceCommand(
  controller: ProjectController,
  services: Services,
  element?: DependencyNode | { node?: DependencyNode },
  members?: string[],
): Promise<void> {
  const model = controller.project;
  if (!model || model.kind !== 'workspace') {
    void vscode.window.showInformationMessage(t('Open a workspace to promote workspace dependencies.'));
    return;
  }

  const node = nodeOf(element);
  const packageName = node?.declaration?.packageName;
  if (!packageName) {
    void vscode.window.showInformationMessage(t('Select a direct dependency to promote.'));
    return;
  }

  const inputs = await readWorkspaceInputs(model);
  const plan = planPromotion({
    model,
    packageName,
    declarations: inputs.declarations,
    workspaceEntries: inputs.workspaceEntries,
    texts: inputs.texts,
    members,
  });

  if (!plan.ok) {
    await showPlanErrors(t('Cannot promote {0} to [workspace.dependencies].', packageName), plan.errors);
    return;
  }
  if (!plan.changes.length) {
    void vscode.window.showInformationMessage(t('No manifest changes were necessary.'));
    return;
  }

  const approved = await confirmWithDiffs(
    plan.changes.map((change) => ({ path: change.path, original: change.original, updated: change.updated })),
    t('Promote {0} to workspace dependencies', packageName),
  );
  if (!approved) return;

  const result = await writeFilesWithVerification({
    root: model.root,
    files: new Map(plan.changes.map((change) => [change.path, change.updated])),
    cargo: services.cargo,
    verify: { metadata: true, check: true, workspace: true },
  });

  await controller.refresh();
  await controller.syncContextKeys();
  if (!result.ok) return;

  void vscode.window.showInformationMessage(
    t('Promoted {0} declaration(s) to [workspace.dependencies].', plan.members.length),
  );
}

/**
 * Rewrite direct declarations of an existing workspace dependency into
 * `workspace = true` references. Refuses to change the effective requirement
 * unless the user explicitly approves updating the workspace entry.
 */
export async function convergeWorkspaceDependency(
  controller: ProjectController,
  services: Services,
  host: WebviewPanelHost | undefined,
  name: string,
): Promise<void> {
  const model = controller.project;
  if (!model || model.kind !== 'workspace') {
    host?.toast(t('Open a workspace to converge workspace dependencies.'), 'warning');
    return;
  }

  const inputs = await readWorkspaceInputs(model);
  const base = {
    model,
    name,
    declarations: inputs.declarations,
    workspaceEntries: inputs.workspaceEntries,
    texts: inputs.texts,
  };

  let plan = planConvergence(base);
  if (!plan.ok) {
    const proposed = plan.proposedWorkspaceRequirement;
    if (proposed && plan.incompatible.length) {
      const current = inputs.workspaceEntries.find((entry) => entry.name === name)?.version ?? '*';
      const approved = await vscode.window.showWarningMessage(
        t('{0} declaration(s) of {1} require a requirement the workspace entry does not allow.', plan.incompatible.length, name),
        {
          modal: true,
          detail: t(
            'Update the [workspace.dependencies] requirement for {0} from "{1}" to "{2}" and converge?',
            name,
            current,
            proposed,
          ),
        },
        t('Update requirement'),
      );
      if (approved !== t('Update requirement')) return;
      plan = planConvergence({ ...base, workspaceRequirementOverride: proposed });
    }
    if (!plan.ok) {
      await showPlanErrors(t('Cannot converge {0} to workspace inheritance.', name), plan.errors);
      return;
    }
  }

  if (!plan.changes.length) {
    host?.toast(t('No manifest changes were necessary.'), 'info');
    return;
  }

  const approved = await confirmWithDiffs(
    plan.changes.map((change) => ({ path: change.path, original: change.original, updated: change.updated })),
    t('Converge {0} to workspace dependencies', name),
  );
  if (!approved) return;

  host?.busy(true, t('Converging {0}…', name));
  const result = await writeFilesWithVerification({
    root: model.root,
    files: new Map(plan.changes.map((change) => [change.path, change.updated])),
    cargo: services.cargo,
    verify: { metadata: true, check: true, workspace: true },
  });
  host?.busy(false);

  // The health panel must stay usable even when verification fails, so always
  // reload project state from disk.
  await controller.refresh();
  await controller.syncContextKeys();
  if (!result.ok) return;

  const message = t('Converged {0} declaration(s) to workspace inheritance.', plan.converged.length);
  if (host) host.toast(message, 'success');
  else void vscode.window.showInformationMessage(message);
}

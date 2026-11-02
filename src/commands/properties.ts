/** Properties panel command. */
import * as vscode from 'vscode';
import { parse as parseToml } from 'smol-toml';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import {
  applyPropertyEdits,
  PACKAGE_PROPERTIES,
  WORKSPACE_PROPERTIES,
  readProperties,
  validateProperty,
  type PropertyEdit,
  type PropertiesModel,
} from '../core/properties.js';
import { buildModel } from '../core/cargo/project.js';
import { readTextFile } from '../core/process.js';
import { TomlEditor, quoteString } from '../core/toml/editor.js';
import { t } from '../core/i18n.js';
import { writeFilesWithVerification } from './shared.js';
import { WebviewPanelHost } from '../webviews/host.js';
import type { PropertiesPanelData, WebviewMessage } from '../webviews/protocol.js';

const KEY = 'properties';

export async function editPropertiesCommand(
  controller: ProjectController,
  services: Services,
  extensionUri: vscode.Uri,
): Promise<void> {
  const snapshot = controller.snapshot;
  if (!snapshot) {
    void vscode.window.showInformationMessage(t('Open a Rust project first.'));
    return;
  }

  const buildData = (properties: PropertiesModel = controller.snapshot!.properties): PropertiesPanelData => {
    const zh = vscode.env.language.toLowerCase().startsWith('zh');
    const label = (descriptor: (typeof PACKAGE_PROPERTIES)[number]): string =>
      zh && descriptor.labelZh ? descriptor.labelZh : descriptor.label;
    const description = (descriptor: (typeof PACKAGE_PROPERTIES)[number]): string =>
      zh && descriptor.descriptionZh ? descriptor.descriptionZh : descriptor.description;
    return {
      kind: 'properties-panel',
      workspace: properties.kind === 'workspace',
      hasRootPackage: properties.hasRootPackage,
      packageProperties: properties.packageProperties.map((property) => {
        const descriptor = PACKAGE_PROPERTIES.find((d) => d.key === property.key)!;
        return {
          key: property.key,
          label: label(descriptor),
          description: description(descriptor),
          type: descriptor.type,
          value: property.value,
          inherited: property.inherited,
          workspaceValue: property.workspaceValue,
          location: property.location,
          values: descriptor.values,
          placeholder: descriptor.placeholder,
          risky: descriptor.risky,
          defaultValue: descriptor.defaultValue,
          inheritable: descriptor.inheritable,
          group: descriptor.group,
          memberValues: property.memberValues,
        };
      }),
      workspaceProperties: properties.workspaceProperties.map((property) => {
        const descriptor = WORKSPACE_PROPERTIES.find((d) => d.key === property.key)!;
        return {
          key: property.key,
          label: label(descriptor),
          description: description(descriptor),
          type: descriptor.type,
          value: property.value,
          location: property.location,
          values: descriptor.values,
          placeholder: descriptor.placeholder,
          risky: descriptor.risky,
          defaultValue: descriptor.defaultValue,
          group: descriptor.group,
        };
      }),
      workspacePackageProperties: properties.workspacePackageProperties.map((property) => {
        const descriptor = PACKAGE_PROPERTIES.find((d) => d.key === property.key && d.inheritable)!;
        return {
          key: property.key,
          label: label(descriptor),
          description: description(descriptor),
          type: descriptor.type,
          value: property.value,
          location: property.location,
          values: descriptor.values,
          placeholder: descriptor.placeholder,
          defaultValue: descriptor.defaultValue,
          inheritable: true,
          group: descriptor.group,
          risky: descriptor.risky,
          memberValues: property.memberValues,
        };
      }),
      members: properties.members,
    };
  };

  const host = WebviewPanelHost.create({
    extensionUri,
    id: KEY,
    title: t('Project properties'),
    data: buildData(),
    watch: [snapshot.model.manifestPath, ...snapshot.model.members.map((member) => member.manifestPath)],
    reload: async () => {
      // Read straight from disk: cheap, and independent of the cached snapshot.
      const built = await buildModel(snapshot.model.root);
      if (!built.model) return buildData();
      return buildData(await readProperties(built.model));
    },
    handlers: async (message: WebviewMessage) => {
      if (message.type === 'saveProperties') {
        const saved = await save(controller, services, message.edits);
        if (saved) host.setData(buildData());
      } else if (message.type === 'refresh') {
        await controller.refresh();
        host.setData(buildData());
      }
    },
  });
}

/**
 * The properties panel always edits the project root manifest: `[workspace]`
 * and `[workspace.package]` for workspaces, `[package]` for a single package
 * (and for a workspace root that also declares a package).
 */
async function save(
  controller: ProjectController,
  services: Services,
  rawEdits: { key: string; value?: string; inherit?: boolean; target: 'package' | 'workspace' | 'workspace.package' }[],
): Promise<boolean> {
  const snapshot = controller.snapshot;
  if (!snapshot) return false;
  const model = snapshot.model;

  const packageEdits: PropertyEdit[] = [];
  const workspaceEdits: PropertyEdit[] = [];
  const workspacePackageEdits: PropertyEdit[] = [];
  const errors: string[] = [];

  for (const raw of rawEdits) {
    if (raw.target === 'workspace.package') {
      const descriptor = PACKAGE_PROPERTIES.find((d) => d.key === raw.key && d.inheritable);
      if (!descriptor) continue;
      const error = raw.value !== undefined ? validateProperty(descriptor, raw.value) : undefined;
      if (error) errors.push(error);
      else
        workspacePackageEdits.push({
          manifestPath: model.manifestPath,
          target: 'workspace.package',
          key: raw.key,
          value: raw.value,
        });
      continue;
    }

    if (raw.target === 'workspace') {
      const descriptor = WORKSPACE_PROPERTIES.find((d) => d.key === raw.key);
      if (!descriptor) continue;
      const error = raw.value !== undefined ? validateProperty(descriptor, raw.value) : undefined;
      if (error) errors.push(error);
      else workspaceEdits.push({ manifestPath: model.manifestPath, target: 'workspace', key: raw.key, value: raw.value });
      continue;
    }

    const descriptor = PACKAGE_PROPERTIES.find((d) => d.key === raw.key);
    if (!descriptor) continue;
    if (raw.inherit) {
      packageEdits.push({ manifestPath: model.manifestPath, target: 'package', key: raw.key, inherit: true });
      continue;
    }
    if (raw.value === undefined) {
      packageEdits.push({ manifestPath: model.manifestPath, target: 'package', key: raw.key, value: undefined });
      continue;
    }
    const error = validateProperty(descriptor, raw.value);
    if (error) errors.push(error);
    else packageEdits.push({ manifestPath: model.manifestPath, target: 'package', key: raw.key, value: raw.value.trim() });
  }

  if (errors.length) {
    for (const error of errors) void vscode.window.showErrorMessage(error);
    return false;
  }

  const files = new Map<string, string>();
  let rootText = await readTextFile(model.manifestPath);

  // Inheriting requires a value in [workspace.package]; lift the root
  // package's current value there when the workspace table has none yet.
  const inheritedKeys = packageEdits.filter((e) => e.inherit).map((e) => e.key);
  if (inheritedKeys.length) {
    const rootData = parseToml(rootText) as Record<string, unknown>;
    const wsPkg = ((rootData.workspace as Record<string, unknown> | undefined)?.package ?? {}) as Record<string, unknown>;
    const rootPkg = (rootData.package ?? {}) as Record<string, unknown>;

    for (const key of inheritedKeys) {
      if (wsPkg[key] !== undefined) continue;
      const current = rootPkg[key];
      if (current === undefined) {
        void vscode.window.showErrorMessage(t('Cannot inherit {0}: the root manifest has no value to lift into [workspace.package].', key));
        return false;
      }
      const editor = new TomlEditor(rootText);
      rootText = editor.apply(editor.setKey('workspace.package', key, serializeTomlValue(current)));
    }
  }

  rootText = applyPropertyEdits(rootText, [...workspaceEdits, ...workspacePackageEdits, ...packageEdits]);

  const originalRoot = await readTextFile(model.manifestPath);
  if (rootText !== originalRoot) files.set(model.manifestPath, rootText);

  if (!files.size) {
    void vscode.window.showInformationMessage(t('No changes.'));
    return false;
  }

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: t('Saving properties…'), cancellable: false },
    () =>
      writeFilesWithVerification({
        root: model.root,
        files,
        cargo: services.cargo,
        verify: { metadata: true, check: true, workspace: model.kind === 'workspace' },
      }),
  );

  if (result.ok) {
    void vscode.window.showInformationMessage(t('Properties saved and verified.'));
    await controller.refresh();
    await controller.syncContextKeys();
    return true;
  }
  if (result.report) {
    const failed = result.report.steps.find((s) => !s.ok);
    void vscode.window.showErrorMessage(
      t('{0} failed after saving. See the Rust Forge output.', failed?.name ?? 'Verification'),
      t('Show output'),
    );
  } else {
    void vscode.window.showErrorMessage(result.error ?? t('Save failed.'));
  }
  return false;
}

function serializeTomlValue(value: unknown): string {
  if (typeof value === 'string') return quoteString(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(serializeTomlValue).join(', ')}]`;
  return '""';
}

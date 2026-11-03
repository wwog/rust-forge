/**
 * Cargo mirror management.
 *
 * The selection is persisted in Rust Forge's own settings and injected into
 * cargo processes as `--config` arguments (see `core/cargo/mirror.ts`), so the
 * user's global Cargo configuration and shell are never modified.
 */
import * as vscode from 'vscode';
import type { ProjectController } from '../projectController.js';
import type { Services } from '../services.js';
import {
  allCargoMirrors,
  customMirrorId,
  mirrorIndexError,
  normalizeMirrorIndex,
  resolveCargoMirror,
  type CustomCargoMirror,
} from '../core/cargo/mirror.js';
import { mirrorConfiguration, readSettings } from '../settings.js';
import { t } from '../core/i18n.js';

const ADD_ACTION = '__add__';

function configuration(): vscode.WorkspaceConfiguration {
  return mirrorConfiguration();
}

/** Write at the scope that already overrides the setting, else user scope. */
function targetFor(key: string): vscode.ConfigurationTarget {
  const inspected = configuration().inspect(key);
  if (inspected?.workspaceFolderValue !== undefined) return vscode.ConfigurationTarget.WorkspaceFolder;
  if (inspected?.workspaceValue !== undefined) return vscode.ConfigurationTarget.Workspace;
  return vscode.ConfigurationTarget.Global;
}

/** Pick an existing mirror or start the add flow. */
export async function selectCargoMirrorCommand(
  controller: ProjectController,
  services: Services,
): Promise<void> {
  const settings = readSettings();
  const current = resolveCargoMirror(settings.cargoMirror, settings.cargoMirrors);

  type Item = vscode.QuickPickItem & { value: string };
  const items: Item[] = allCargoMirrors(settings.cargoMirrors).map((mirror) => ({
    label: mirror.name,
    description: [mirror.index ?? t('Cargo default (no replacement)'), mirror.id === current.id ? t('current') : '']
      .filter(Boolean)
      .join(' · '),
    detail: mirror.builtin ? t('Built-in mirror') : t('Custom mirror'),
    value: mirror.id,
  }));
  items.push({
    label: t('Add Cargo Mirror…'),
    value: ADD_ACTION,
  });

  const pick = await vscode.window.showQuickPick(items, {
    title: t('Select Cargo Mirror'),
    placeHolder: t("Choose the crate registry used by Rust Forge's cargo commands."),
  });
  if (!pick) return;

  if (pick.value === ADD_ACTION) {
    await addCargoMirrorCommand(controller, services);
    return;
  }

  const mirror = resolveCargoMirror(pick.value, settings.cargoMirrors);
  await configuration().update('cargoMirror', mirror.id, targetFor('cargoMirror'));
  services.reconfigure();
  await controller.refresh();
  void vscode.window.showInformationMessage(t('Cargo mirror set to {0}.', mirror.name));
}

/** Add a custom sparse/git index and select it. */
export async function addCargoMirrorCommand(
  controller: ProjectController,
  services: Services,
): Promise<void> {
  const settings = readSettings();

  const name = await vscode.window.showInputBox({
    title: t('Add Cargo Mirror'),
    prompt: t('Mirror name, e.g. Company mirror'),
    validateInput: (value) => {
      const trimmed = value.trim();
      if (!trimmed) return t('A name is required');
      if (trimmed.includes(':')) return t('The name cannot contain ":".');
      if (
        allCargoMirrors(settings.cargoMirrors).some(
          (mirror) =>
            mirror.name.toLowerCase() === trimmed.toLowerCase() ||
            mirror.id.toLowerCase() === trimmed.toLowerCase(),
        )
      ) {
        return t('A mirror with this name already exists.');
      }
      return undefined;
    },
  });
  if (!name) return;

  const index = await vscode.window.showInputBox({
    title: t('Add Cargo Mirror'),
    prompt: t('Sparse index URL, e.g. sparse+https://mirror.example.com/crates.io-index/'),
    placeHolder: 'sparse+https://mirror.example.com/crates.io-index/',
    validateInput: (value) => {
      const error = mirrorIndexError(value);
      if (error === 'empty') return t('A URL is required');
      if (error === 'invalid') return t('Enter an http(s) URL, optionally prefixed with sparse+.');
      return undefined;
    },
  });
  if (!index) return;

  const entry: CustomCargoMirror = {
    name: name.trim(),
    index: normalizeMirrorIndex(index),
  };
  await configuration().update(
    'cargoMirrors',
    [...settings.cargoMirrors, entry],
    targetFor('cargoMirrors'),
  );
  await configuration().update('cargoMirror', customMirrorId(entry.name), targetFor('cargoMirror'));
  services.reconfigure();
  await controller.refresh();
  void vscode.window.showInformationMessage(t('Custom mirror {0} added and selected.', entry.name));
}

/** Remove a user-added mirror; fall back to the official source if selected. */
export async function removeCargoMirrorCommand(
  controller: ProjectController,
  services: Services,
): Promise<void> {
  const settings = readSettings();
  if (!settings.cargoMirrors.length) {
    void vscode.window.showInformationMessage(t('No custom mirrors to remove.'));
    return;
  }

  const pick = await vscode.window.showQuickPick(
    settings.cargoMirrors.map((mirror) => ({
      label: mirror.name,
      description: mirror.index,
      value: mirror.name,
    })),
    { title: t('Remove Cargo Mirror') },
  );
  if (!pick) return;

  const confirmed = await vscode.window.showWarningMessage(
    t('Remove {0}?', pick.value),
    {
      modal: true,
      detail: t('Cargo commands started by Rust Forge will use the official source if this mirror was selected.'),
    },
    t('Remove'),
  );
  if (!confirmed) return;

  const remaining = settings.cargoMirrors.filter((mirror) => mirror.name !== pick.value);
  await configuration().update('cargoMirrors', remaining, targetFor('cargoMirrors'));

  const selectedId = settings.cargoMirror;
  if (selectedId === customMirrorId(pick.value) || selectedId === pick.value) {
    await configuration().update('cargoMirror', 'official', targetFor('cargoMirror'));
  }

  services.reconfigure();
  await controller.refresh();
  void vscode.window.showInformationMessage(t('Custom mirror removed.'));
}

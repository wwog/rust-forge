/**
 * Planning for dependency promotion and workspace-inheritance convergence.
 *
 * Both operations are pure: callers hand in the parsed declarations and the
 * current manifest texts, and receive complete replacement texts for each file
 * that changes. Only `TomlEditor` splices are used, so comments, key order and
 * line endings survive.
 *
 * Promotion moves every direct declaration of one package into
 * `[workspace.dependencies]` and leaves a `{ workspace = true, ... }` reference
 * behind. Convergence rewrites declarations that bypass an existing workspace
 * entry into inheritance references.
 */
import * as path from 'node:path';
import * as semver from 'semver';
import type { DependencyDeclaration, WorkspaceDependencyDeclaration } from '../cargo/manifestDeps.js';
import { declarationTablePath } from '../cargo/manifestDeps.js';
import type { ProjectModel } from '../cargo/project.js';
import { workspaceReferenceValue } from '../deps/write.js';
import { cargoReqToRange } from '../deps/versions.js';
import { t } from '../i18n.js';
import {
  TomlEditor,
  formatKeyPath,
  parseDottedKey,
  quoteKey,
  quoteString,
  type Statement,
  type TextEdit,
} from '../toml/editor.js';

export type DependencyKind = 'registry' | 'path' | 'git';

/** A manifest whose text changes. */
export interface ManifestChange {
  path: string;
  original: string;
  updated: string;
}

export interface PromotionMember {
  member: string;
  manifestPath: string;
  key: string;
  table: string;
  declaration: DependencyDeclaration;
  /** Extra features kept on the member reference. */
  features: string[];
  optional: boolean;
  noDefaultFeatures: boolean;
  valueText: string;
}

export interface PromotionPlan {
  ok: boolean;
  /** Actionable, user-facing reasons when `ok` is false. */
  errors: string[];
  /** Direct declarations that become workspace references. */
  members: PromotionMember[];
  /** The `[workspace.dependencies]` entry, when a promotion is possible. */
  entry?: { key: string; valueText: string };
  /** True when the workspace entry already holds an equivalent value. */
  entryUnchanged?: boolean;
  changes: ManifestChange[];
}

export interface PromotionRequest {
  model: ProjectModel;
  /** Real crate name (`declaration.packageName`). */
  packageName: string;
  /** Declarations from every member manifest, including target tables. */
  declarations: DependencyDeclaration[];
  workspaceEntries?: WorkspaceDependencyDeclaration[];
  /** Current manifest text keyed by absolute manifest path. */
  texts: ReadonlyMap<string, string>;
  /** Optional member-name filter (future selective promotion). */
  members?: string[];
}

export interface ConvergedMember {
  member: string;
  manifestPath: string;
  key: string;
  table: string;
  features: string[];
  optional: boolean;
  noDefaultFeatures: boolean;
  valueText: string;
}

export interface ConvergencePlan {
  ok: boolean;
  errors: string[];
  /** Direct declarations whose requirement the workspace entry cannot cover. */
  incompatible: { member: string; manifestPath: string; requirement?: string }[];
  /**
   * Set when every direct registry declaration agrees on one requirement that
   * differs from the workspace entry. The caller may offer to rewrite the
   * workspace entry to this value and retry.
   */
  proposedWorkspaceRequirement?: string;
  converged: ConvergedMember[];
  changes: ManifestChange[];
}

export interface ConvergenceRequest {
  model: ProjectModel;
  /** Key of the `[workspace.dependencies]` entry. */
  name: string;
  declarations: DependencyDeclaration[];
  workspaceEntries: WorkspaceDependencyDeclaration[];
  texts: ReadonlyMap<string, string>;
  /**
   * User-approved replacement for the workspace requirement. Supplying this
   * skips the "requirement not covered" refusal.
   */
  workspaceRequirementOverride?: string;
}

// ---------------------------------------------------------------- promotion

export function planPromotion(request: PromotionRequest): PromotionPlan {
  const { model, packageName } = request;
  const empty: PromotionPlan = { ok: false, errors: [], members: [], changes: [] };
  const rootManifestPath = model.manifestPath;

  const matching = request.declarations.filter(
    (decl) => decl.packageName === packageName || decl.key === packageName,
  );
  const direct = matching.filter((decl) => decl.kind !== 'workspace');
  if (!direct.length) {
    return {
      ...empty,
      errors: [
        matching.length
          ? t('{0} is already inherited from [workspace.dependencies] by every member.', packageName)
          : t('There is no direct declaration of {0} to promote.', packageName),
      ],
    };
  }

  const nameByManifest = new Map<string, string>();
  for (const member of model.members) nameByManifest.set(path.resolve(member.manifestPath), member.name);
  const selected = request.members?.length
    ? direct.filter((decl) => request.members!.includes(nameByManifest.get(path.resolve(decl.manifestPath)) ?? ''))
    : direct;
  if (!selected.length) {
    return {
      ...empty,
      errors: [t('No declaration of {0} was found in the selected members.', packageName)],
    };
  }

  const errors: string[] = [];

  // The rewritten reference only carries workspace/features/optional/
  // default-features, so any other Cargo option would be dropped silently.
  const unsupported = unique(selected.flatMap(unsupportedReferenceKeys));
  if (unsupported.length) {
    errors.push(
      t(
        '{0} uses dependency options that cannot be moved to [workspace.dependencies]: {1}.',
        packageName,
        unsupported.join(', '),
      ),
    );
  }

  // Cargo matches inheritance by key, so every declaration must share one key.
  const keys = unique(selected.map((decl) => decl.key));
  if (keys.length > 1) {
    errors.push(
      t(
        '{0} is declared under different keys ({1}). Cargo matches workspace inheritance by key, so one entry cannot preserve every alias.',
        packageName,
        keys.join(', '),
      ),
    );
  }

  const kinds = unique(selected.map((decl) => decl.kind));
  if (kinds.length > 1) {
    errors.push(
      t('{0} is declared with conflicting dependency kinds ({1}).', packageName, kinds.join(', ')),
    );
  }
  const kind = selected[0].kind;
  if (kind !== 'registry' && kind !== 'path' && kind !== 'git') {
    errors.push(
      t('{0} is declared without a recognisable source (registry, path or git).', packageName),
    );
  }

  // The crate behind the key must be unambiguous before `package = "..."` can
  // be emitted.
  const packageNames = unique(selected.map((decl) => decl.packageName));
  if (packageNames.length > 1) {
    errors.push(
      t('{0} resolves to different package names ({1}).', packageName, packageNames.join(', ')),
    );
  }

  const key = keys[0] ?? selected[0].key;

  let version: string | undefined;
  if (kind === 'registry') {
    const requirements = unique(selected.map((decl) => (decl.version ?? '*').trim()));
    if (requirements.length > 1) {
      errors.push(
        t(
          '{0} is declared with conflicting registry requirements ({1}).',
          packageName,
          requirements.join(', '),
        ),
      );
    }
    version = requirements[0] ?? '*';
  }

  let resolvedDir: string | undefined;
  if (kind === 'path') {
    for (const decl of selected) {
      const dir = decl.path ? path.resolve(path.dirname(decl.manifestPath), decl.path) : undefined;
      if (!dir) {
        errors.push(
          t('{0} has a path declaration without a path in {1}.', packageName, decl.manifestPath),
        );
        continue;
      }
      if (resolvedDir === undefined) resolvedDir = dir;
      else if (path.resolve(resolvedDir) !== path.resolve(dir)) {
        errors.push(t('{0} points at different directories ({1}, {2}).', packageName, resolvedDir, dir));
        break;
      }
    }
  }

  let gitSource: { git: string; branch?: string; tag?: string; rev?: string } | undefined;
  if (kind === 'git') {
    for (const decl of selected) {
      if (!decl.git) {
        errors.push(
          t('{0} has a git declaration without a URL in {1}.', packageName, decl.manifestPath),
        );
        continue;
      }
      if (!gitSource) {
        gitSource = { git: decl.git, branch: decl.branch, tag: decl.tag, rev: decl.rev };
        continue;
      }
      if (
        gitSource.git !== decl.git ||
        gitSource.branch !== decl.branch ||
        gitSource.tag !== decl.tag ||
        gitSource.rev !== decl.rev
      ) {
        errors.push(t('{0} is declared with conflicting git sources.', packageName));
        break;
      }
    }
  }

  if (errors.length) return { ...empty, errors };

  // Shared features go on the workspace entry; the rest stay on the member.
  const sharedFeatures = intersectFeatures(selected.map((decl) => decl.features));
  const sharedSet = new Set(sharedFeatures);

  const defaults = selected.map((decl) => decl.defaultFeatures);
  const allDefaultOff = defaults.every((value) => value === false);
  const allDefaultOn = defaults.every((value) => value === undefined || value === true);
  const entryNoDefault = allDefaultOff;
  const mixedDefault = !allDefaultOff && !allDefaultOn;

  const renderedKey = key;
  const relative = packageNames.length === 1 && packageNames[0] !== renderedKey ? packageNames[0] : undefined;

  const spec: EntrySpec = {
    key: renderedKey,
    // `kind` was validated above; errors.length being zero guarantees it.
    kind: kind as DependencyKind,
    version,
    dir:
      resolvedDir !== undefined
        ? path.relative(model.root, resolvedDir).split(path.sep).join('/') || '.'
        : undefined,
    git: gitSource?.git,
    branch: gitSource?.branch,
    tag: gitSource?.tag,
    rev: gitSource?.rev,
    packageName: relative,
    features: sharedFeatures,
    defaultFeatures: entryNoDefault ? false : undefined,
  };
  const entryValue = formatEntryValue(spec);

  const members: PromotionMember[] = selected.map((decl) => {
    const features = dedupe(decl.features.filter((feature) => !sharedSet.has(feature)));
    const optional = decl.optional === true;
    const noDefaultFeatures = mixedDefault && decl.defaultFeatures === false;
    return {
      member: nameByManifest.get(path.resolve(decl.manifestPath)) ?? path.basename(path.dirname(decl.manifestPath)),
      manifestPath: decl.manifestPath,
      key: decl.key,
      table: declarationTablePath(decl),
      declaration: decl,
      features,
      optional,
      noDefaultFeatures,
      valueText: workspaceReferenceValue(features, optional, noDefaultFeatures),
    };
  });

  const previousEntry = request.workspaceEntries?.find((entry) => entry.name === key);
  const entryUnchanged = previousEntry ? workspaceEntryMatches(model.root, previousEntry, spec) : false;
  if (!entryUnchanged && previousEntry && workspaceEntryIsSubTable(request.texts.get(rootManifestPath), renderedKey)) {
    return {
      ...empty,
      errors: [
        t('The [workspace.dependencies] entry for {0} uses a table; edit that entry manually.', key),
      ],
    };
  }
  if (previousEntry?.kind === 'unknown') {
    return {
      ...empty,
      errors: [
        t('The [workspace.dependencies] entry for {0} uses a table; edit that entry manually.', key),
      ],
    };
  }
  if (previousEntry && !entryUnchanged) {
    // Repurposing a key is far more dangerous than adding a new entry: every
    // existing inheritor would silently switch package or source.
    const expectedPackage = relative ?? renderedKey;
    if (previousEntry.packageName !== expectedPackage) {
      return {
        ...empty,
        errors: [
          t(
            'The [workspace.dependencies] entry for {0} points at package "{1}", but the declarations to promote use "{2}".',
            renderedKey,
            previousEntry.packageName,
            expectedPackage,
          ),
        ],
      };
    }
    if (previousEntry.kind !== spec.kind) {
      return {
        ...empty,
        errors: [
          t(
            'The [workspace.dependencies] entry for {0} is a {1} dependency; promoting {2} declarations would change its source.',
            renderedKey,
            previousEntry.kind,
            spec.kind,
          ),
        ],
      };
    }
    const extra = unsupportedEntryKeys(previousEntry);
    if (extra.length) {
      return {
        ...empty,
        errors: [
          t(
            'The [workspace.dependencies] entry for {0} uses options that promotion cannot preserve: {1}.',
            renderedKey,
            extra.join(', '),
          ),
        ],
      };
    }
  }
  // Edits are grouped per file; the root manifest may receive both the entry
  // and a reference when the root package declares the dependency.
  const byFile = new Map<string, PromotionMember[]>();
  for (const member of members) {
    const list = byFile.get(member.manifestPath) ?? [];
    list.push(member);
    byFile.set(member.manifestPath, list);
  }
  if (!entryUnchanged) {
    const list = byFile.get(rootManifestPath) ?? [];
    byFile.set(rootManifestPath, list);
  }

  const changes: ManifestChange[] = [];
  const missing: string[] = [];
  for (const [file, fileMembers] of byFile) {
    const original = request.texts.get(file);
    if (original === undefined) {
      missing.push(file);
      continue;
    }
    if (!fileMembers.length && entryUnchanged) continue;
    const editor = new TomlEditor(original);
    const edits: TextEdit[] = [];
    for (const member of fileMembers) {
      edits.push(...rewriteReference(editor, member.table, member.key, member.valueText));
    }
    if (file === rootManifestPath && !entryUnchanged) {
      edits.push(...editor.setKey('workspace.dependencies', [renderedKey], entryValue));
    }
    if (!edits.length) continue;
    const updated = editor.apply(edits);
    if (updated !== original) changes.push({ path: file, original, updated });
  }
  if (missing.length) {
    return {
      ...empty,
      errors: [
        missing.length === 1
          ? t('The manifest {0} could not be read.', missing[0])
          : t('The manifests {0} could not be read.', missing.join(', ')),
      ],
    };
  }

  return {
    ok: true,
    errors: [],
    members,
    entry: { key: renderedKey, valueText: entryValue },
    entryUnchanged,
    changes,
  };
}

// --------------------------------------------------------------- convergence

export function planConvergence(request: ConvergenceRequest): ConvergencePlan {
  const { model, name } = request;
  const empty: ConvergencePlan = { ok: false, errors: [], incompatible: [], converged: [], changes: [] };

  const entry = request.workspaceEntries.find((candidate) => candidate.name === name);
  if (!entry) {
    return {
      ...empty,
      errors: [t('The [workspace.dependencies] entry for {0} was not found.', name)],
    };
  }

  const direct = request.declarations.filter(
    (decl) => decl.kind !== 'workspace' && (decl.key === entry.name || decl.packageName === entry.packageName),
  );
  if (!direct.length) {
    return {
      ...empty,
      errors: [t('Every declaration of {0} already inherits from [workspace.dependencies].', name)],
    };
  }

  const memberName = new Map<string, string>();
  for (const member of model.members) memberName.set(path.resolve(member.manifestPath), member.name);

  const errors: string[] = [];
  const incompatible: ConvergencePlan['incompatible'] = [];
  const override = request.workspaceRequirementOverride?.trim();
  const workspaceRequirement = override ?? entry.version?.trim() ?? '*';

  for (const decl of direct) {
    const label = memberName.get(path.resolve(decl.manifestPath)) ?? path.basename(path.dirname(decl.manifestPath));

    const unsupported = unsupportedReferenceKeys(decl);
    if (unsupported.length) {
      errors.push(
        t(
          '{0} in {1} uses options that cannot be inherited from [workspace.dependencies]: {2}.',
          decl.packageName,
          label,
          unsupported.join(', '),
        ),
      );
      continue;
    }

    // Inheritance matches the key, so an alias cannot be converged without a
    // rename first.
    if (decl.key !== entry.name) {
      errors.push(
        t(
          '{0} is declared as "{1}" in {2}, but the [workspace.dependencies] entry is named "{3}". Rename the declaration first.',
          decl.packageName,
          decl.key,
          label,
          entry.name,
        ),
      );
      continue;
    }

    // A key can be reused for a different crate (`alias = { package = "x" }`).
    // Inheriting the workspace entry would change which crate is built.
    if (decl.packageName !== entry.packageName) {
      errors.push(
        t(
          '{0} in {1} resolves to package "{2}", but the workspace entry resolves to "{3}". Rename the declaration first.',
          decl.key,
          label,
          decl.packageName,
          entry.packageName,
        ),
      );
      continue;
    }

    if (decl.kind !== entry.kind) {
      errors.push(
        t(
          '{0} is declared directly as a {1} dependency in {2}, but the [workspace.dependencies] entry is a {3} dependency.',
          decl.packageName,
          decl.kind,
          label,
          entry.kind,
        ),
      );
      continue;
    }

    if (decl.kind === 'registry') {
      const requirement = decl.version?.trim() ?? '*';
      // Convergence only needs a version both requirements can resolve to;
      // Cargo already unifies them today, so losing the member's lower bound
      // does not change the locked version when the ranges intersect.
      if (!requirementsOverlap(workspaceRequirement, requirement)) {
        incompatible.push({ member: label, manifestPath: decl.manifestPath, requirement });
      }
      continue;
    }

    if (decl.kind === 'path') {
      const entryObject = rawObject(entry);
      const directDir = decl.path ? path.resolve(path.dirname(decl.manifestPath), decl.path) : undefined;
      const entryPath = typeof entryObject?.path === 'string' ? entryObject.path : entry.path;
      const entryDir = entryPath ? path.resolve(model.root, entryPath) : undefined;
      if (!directDir || !entryDir || directDir !== entryDir) {
        errors.push(
          t(
            '{0} points at {1} in {2}, but the workspace entry points at {3}.',
            decl.packageName,
            directDir ?? t('an unknown directory'),
            label,
            entryDir ?? t('an unknown directory'),
          ),
        );
      }
      continue;
    }

    if (decl.kind === 'git') {
      const entryObject = rawObject(entry);
      const sameSource =
        entryObject?.git === decl.git &&
        entryObject?.branch === decl.branch &&
        entryObject?.tag === decl.tag &&
        entryObject?.rev === decl.rev;
      if (!sameSource) {
        errors.push(
          t('{0} in {1} uses a different git source than the workspace entry.', decl.packageName, label),
        );
      }
      continue;
    }

    errors.push(t('{0} in {1} has an unsupported dependency kind.', decl.packageName, label));
  }

  if (errors.length) {
    return { ...empty, errors, incompatible, proposedWorkspaceRequirement: proposeRequirement(entry, direct, incompatible, override) };
  }

  if (incompatible.length && !override) {
    const requirement = entry.version ?? '*';
    const details = incompatible
      .map((item) => `${item.member} (${item.requirement ?? '*'})`)
      .join(', ');
    return {
      ...empty,
      errors: [
        t(
          'The [workspace.dependencies] requirement "{0}" does not allow the requirement declared by {1}.',
          requirement,
          details,
        ),
        t('Update the workspace requirement for {0} first.', name),
      ],
      incompatible,
      proposedWorkspaceRequirement: proposeRequirement(entry, direct, incompatible, override),
    };
  }

  // An override was approved by the user; make sure it really covers every
  // direct requirement before writing.
  if (override) {
    const uncovered = direct.filter(
      (decl) => decl.kind === 'registry' && !requirementsOverlap(override, decl.version?.trim() ?? '*'),
    );
    if (uncovered.length) {
      return {
        ...empty,
        errors: [
          t('The requirement "{0}" does not allow every direct declaration of {1}.', override, name),
        ],
        incompatible: uncovered.map((decl) => ({
          member: memberName.get(path.resolve(decl.manifestPath)) ?? decl.manifestPath,
          manifestPath: decl.manifestPath,
          requirement: decl.version,
        })),
      };
    }
  }

  const entryFeatures = new Set(entry.features);
  const converged: ConvergedMember[] = direct.map((decl) => {
    const features = dedupe(decl.features.filter((feature) => !entryFeatures.has(feature)));
    const optional = decl.optional === true;
    const noDefaultFeatures = decl.defaultFeatures === false && entry.defaultFeatures !== false;
    return {
      member: memberName.get(path.resolve(decl.manifestPath)) ?? path.basename(path.dirname(decl.manifestPath)),
      manifestPath: decl.manifestPath,
      key: decl.key,
      table: declarationTablePath(decl),
      features,
      optional,
      noDefaultFeatures,
      valueText: workspaceReferenceValue(features, optional, noDefaultFeatures),
    };
  });

  const rootManifestPath = model.manifestPath;
  const byFile = new Map<string, ConvergedMember[]>();
  for (const member of converged) {
    const list = byFile.get(member.manifestPath) ?? [];
    list.push(member);
    byFile.set(member.manifestPath, list);
  }
  const updateEntry = override !== undefined && override !== (entry.version?.trim() ?? '');
  if (updateEntry && workspaceEntryIsSubTable(request.texts.get(rootManifestPath), entry.name)) {
    return {
      ...empty,
      errors: [
        t('The [workspace.dependencies] entry for {0} uses a table; edit that entry manually.', entry.name),
      ],
      incompatible,
    };
  }
  if (updateEntry) {
    const list = byFile.get(rootManifestPath) ?? [];
    byFile.set(rootManifestPath, list);
  }

  const changes: ManifestChange[] = [];
  const missing: string[] = [];
  for (const [file, fileMembers] of byFile) {
    const original = request.texts.get(file);
    if (original === undefined) {
      missing.push(file);
      continue;
    }
    const editor = new TomlEditor(original);
    const edits: TextEdit[] = [];
    for (const member of fileMembers) {
      edits.push(...rewriteReference(editor, member.table, member.key, member.valueText));
    }
    if (file === rootManifestPath && updateEntry) {
      const valueText = workspaceEntryValueWithRequirement(entry, override);
      edits.push(...editor.setKey('workspace.dependencies', [entry.name], valueText));
    }
    if (!edits.length) continue;
    const updated = editor.apply(edits);
    if (updated !== original) changes.push({ path: file, original, updated });
  }
  if (missing.length) {
    return {
      ...empty,
      errors: [
        missing.length === 1
          ? t('The manifest {0} could not be read.', missing[0])
          : t('The manifests {0} could not be read.', missing.join(', ')),
      ],
      incompatible,
    };
  }

  return {
    ok: true,
    errors: [],
    incompatible: [],
    converged,
    changes,
  };
}

function proposeRequirement(
  entry: WorkspaceDependencyDeclaration,
  direct: DependencyDeclaration[],
  incompatible: ConvergencePlan['incompatible'],
  override: string | undefined,
): string | undefined {
  if (override || !incompatible.length) return undefined;
  if (direct.some((decl) => decl.kind !== 'registry')) return undefined;
  const requirements = unique(direct.map((decl) => (decl.version ?? '*').trim()));
  if (requirements.length !== 1) return undefined;
  const candidate = requirements[0];
  if (candidate === (entry.version?.trim() ?? '*')) return undefined;
  // Only propose a rewrite when it actually covers each declaration.
  if (!direct.every((decl) => coversRequirement(candidate, decl.version?.trim() ?? '*'))) return undefined;
  return candidate;
}

/** Does `workspaceRequirement` admit every version allowed by `directRequirement`? */
export function coversRequirement(workspaceRequirement: string, directRequirement: string): boolean {
  const workspace = workspaceRequirement.trim();
  const direct = directRequirement.trim();
  if (workspace === direct) return true;
  if (workspace === '*') return true;
  if (direct === '*') return false;
  const workspaceRange = cargoReqToRange(workspace);
  const directRange = cargoReqToRange(direct);
  if (!workspaceRange || !directRange) return false;
  try {
    return semver.subset(directRange, workspaceRange);
  } catch {
    return false;
  }
}

/**
 * Can one resolved version satisfy both requirements?
 *
 * This is the convergence criterion: Cargo already unifies the declarations
 * today, so inheriting the workspace entry preserves the resolution whenever
 * the ranges intersect. Full subset semantics (`coversRequirement`) would
 * reject valid cases such as a member with a lower floor than the workspace.
 */
export function requirementsOverlap(workspaceRequirement: string, directRequirement: string): boolean {
  const workspace = workspaceRequirement.trim();
  const direct = directRequirement.trim();
  if (workspace === '*' || direct === '*' || workspace === direct) return true;
  const workspaceRange = cargoReqToRange(workspace);
  const directRange = cargoReqToRange(direct);
  if (!workspaceRange || !directRange) return false;
  try {
    return semver.intersects(workspaceRange, directRange);
  } catch {
    return false;
  }
}

// -------------------------------------------------------------- entry values

interface EntrySpec {
  key: string;
  kind: DependencyKind;
  version?: string;
  dir?: string;
  git?: string;
  branch?: string;
  tag?: string;
  rev?: string;
  packageName?: string;
  features: string[];
  defaultFeatures?: boolean;
}

function formatEntryValue(spec: EntrySpec): string {
  if (spec.kind === 'registry') {
    const parts: string[] = [];
    if (spec.features.length || spec.defaultFeatures === false || spec.packageName) {
      parts.push(`version = ${quoteString(spec.version ?? '*')}`);
      appendInlineParts(parts, spec);
      return `{ ${parts.join(', ')} }`;
    }
    return quoteString(spec.version ?? '*');
  }
  const parts: string[] = [];
  if (spec.kind === 'path') {
    parts.push(`path = ${quoteString(spec.dir ?? '')}`);
  } else {
    parts.push(`git = ${quoteString(spec.git ?? '')}`);
    if (spec.branch) parts.push(`branch = ${quoteString(spec.branch)}`);
    if (spec.tag) parts.push(`tag = ${quoteString(spec.tag)}`);
    if (spec.rev) parts.push(`rev = ${quoteString(spec.rev)}`);
  }
  appendInlineParts(parts, spec);
  return `{ ${parts.join(', ')} }`;
}

function appendInlineParts(parts: string[], spec: EntrySpec): void {
  if (spec.packageName) parts.push(`package = ${quoteString(spec.packageName)}`);
  if (spec.features.length) parts.push(`features = [${spec.features.map(quoteString).join(', ')}]`);
  if (spec.defaultFeatures === false) parts.push('default-features = false');
}

function workspaceEntryIsSubTable(text: string | undefined, key: string): boolean {
  if (text === undefined) return false;
  const editor = new TomlEditor(text);
  const table = editor.getTable(formatKeyPath(['workspace', 'dependencies', key]));
  return !!table && table.headerIndex >= 0;
}

function workspaceEntryMatches(
  root: string,
  entry: WorkspaceDependencyDeclaration,
  spec: EntrySpec,
): boolean {
  if (entry.kind !== spec.kind) return false;
  if (!sameSet(entry.features, spec.features)) return false;
  const existingNoDefault = entry.defaultFeatures === false;
  if (existingNoDefault !== (spec.defaultFeatures === false)) return false;

  const raw = rawValue(entry);
  if (typeof raw === 'string') {
    return spec.kind === 'registry' && !spec.packageName && raw.trim() === (spec.version ?? '').trim();
  }
  if (!raw) return false;

  const packageName = typeof raw.package === 'string' ? raw.package : entry.name;
  if (packageName !== (spec.packageName ?? entry.name)) return false;
  // Any extra fields (e.g. a registry override) make this a manual edit.
  const known = new Set(['version', 'path', 'git', 'branch', 'tag', 'rev', 'package', 'features', 'default-features']);
  if (Object.keys(raw).some((key) => !known.has(key))) return false;

  if (spec.kind === 'registry') {
    return typeof raw.version === 'string' && raw.version.trim() === (spec.version ?? '').trim();
  }
  if (spec.kind === 'path') {
    return (
      typeof raw.path === 'string' &&
      path.resolve(root, raw.path) === path.resolve(root, spec.dir ?? '')
    );
  }
  return (
    raw.git === spec.git &&
    raw.branch === spec.branch &&
    raw.tag === spec.tag &&
    raw.rev === spec.rev
  );
}

function workspaceEntryValueWithRequirement(entry: WorkspaceDependencyDeclaration, requirement: string): string {
  const raw = rawValue(entry);
  if (typeof raw === 'string') return quoteString(requirement);
  const values: Record<string, unknown> = { ...(raw ?? {}) };
  values.version = requirement;
  const preferred = ['version', 'path', 'git', 'branch', 'tag', 'rev', 'registry', 'package'];
  const parts: string[] = [];
  for (const key of preferred) {
    if (values[key] !== undefined) parts.push(`${quoteKey(key)} = ${inlineValue(values[key])}`);
  }
  for (const [key, value] of Object.entries(values)) {
    if (preferred.includes(key) || value === undefined) continue;
    parts.push(`${quoteKey(key)} = ${inlineValue(value)}`);
  }
  return `{ ${parts.join(', ')} }`;
}

function inlineValue(value: unknown): string {
  if (typeof value === 'string') return quoteString(value);
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return `[${(value as string[]).map(quoteString).join(', ')}]`;
  }
  return quoteString(String(value));
}

function rawObject(entry: WorkspaceDependencyDeclaration): Record<string, unknown> | undefined {
  const raw = rawValue(entry);
  return raw && typeof raw === 'object' ? raw : undefined;
}

function rawValue(entry: WorkspaceDependencyDeclaration): string | Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(entry.rawValue);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------- manifest rewriting

/**
 * Replace one dependency declaration with a workspace reference.
 *
 * Handles direct inline values, dotted keys and `[dependencies.key]`
 * sub-tables. The remaining key/value range is replaced in place so comments
 * and indentation survive.
 */
export function rewriteReference(
  editor: TomlEditor,
  table: string,
  key: string,
  valueText: string,
): TextEdit[] {
  const tablePath = parseDottedKey(table) ?? [table];
  const subTable = formatKeyPath([...tablePath, key]);
  const subTableInfo = editor.getTable(subTable);
  if (subTableInfo && subTableInfo.headerIndex >= 0) {
    return subTableReference(editor, subTable, valueText);
  }

  // `name = ...` inside the table.
  const direct = findDirectStatement(editor, tablePath, key);
  if (direct?.valueStart !== undefined && direct.valueEnd !== undefined) {
    return [{ start: direct.valueStart, end: direct.valueEnd, text: valueText }];
  }

  // Dotted form: `name.version = ...` (possibly at the document root).
  const full = [...tablePath, key];
  const group = dottedGroup(editor, full);
  if (group.length) {
    return dottedGroupEdit(editor, group, valueText);
  }

  // `dependencies.name = ...` at the document root.
  const atRoot = editor.findByPath(full);
  if (atRoot?.statement.valueStart !== undefined && atRoot.statement.valueEnd !== undefined) {
    return [{ start: atRoot.statement.valueStart, end: atRoot.statement.valueEnd, text: valueText }];
  }

  return editor.setKey(table, [key], valueText);
}

function findDirectStatement(editor: TomlEditor, tablePath: string[], key: string): Statement | undefined {
  const table = editor.getTable(formatKeyPath(tablePath));
  return table?.statements.find(
    (statement) => statement.keyPath?.length === 1 && statement.keyPath[0] === key,
  );
}

function dottedGroup(
  editor: TomlEditor,
  full: string[],
): { tablePath: string[]; statement: Statement }[] {
  return editor.allKeyStatements().filter(({ tablePath, statement }) => {
    const path = [...tablePath, ...(statement.keyPath ?? [])];
    if (path.length <= full.length) return false;
    return full.every((part, index) => path[index] === part);
  });
}

function dottedGroupEdit(
  editor: TomlEditor,
  group: { tablePath: string[]; statement: Statement }[],
  valueText: string,
): TextEdit[] {
  const sorted = [...group].sort((a, b) => a.statement.start - b.statement.start);
  const first = sorted[0];
  const indent = first.statement.raw.match(/^[\t ]*/)?.[0] ?? '';
  // The replacement is written in the table that owns the dotted keys; when
  // the keys are rooted at the document root, keep the full path.
  const path = first.tablePath.length ? [first.statement.keyPath![0]] : fullKey(first);
  const prefix = formatKeyPath(path);
  // Rewrite only the lines that belong to this dotted group. Unrelated
  // statements may be interleaved between `foo.version` and `foo.features`;
  // replacing the whole span would delete them.
  const edits: TextEdit[] = [
    {
      start: lineStartOffset(editor.text, first.statement.start),
      end: lineEndOffset(editor.text, first.statement.end),
      text: `${indent}${prefix} = ${valueText}${editor.eol}`,
    },
  ];
  for (const entry of sorted.slice(1)) {
    edits.push({
      start: lineStartOffset(editor.text, entry.statement.start),
      end: lineEndOffset(editor.text, entry.statement.end),
      text: '',
    });
  }
  return edits;
}

function fullKey(entry: { tablePath: string[]; statement: Statement }): string[] {
  return (entry.statement.keyPath ?? []).slice(0, -1);
}

/**
 * Convert `[dependencies.key]` into an inheritance sub-table. Source keys are
 * dropped, `workspace = true` is added, and optional feature extras are kept.
 */
function subTableReference(editor: TomlEditor, tableName: string, valueText: string): TextEdit[] {
  const reference = parseReferenceValue(valueText);
  const edits: TextEdit[] = [];
  for (const key of ['version', 'path', 'git', 'branch', 'tag', 'rev', 'registry', 'package']) {
    if (editor.hasKey(tableName, key)) edits.push(...editor.removeKey(tableName, key));
  }
  edits.push(...editor.setKey(tableName, ['workspace'], 'true'));
  if (reference.features.length) {
    edits.push(...editor.setKey(tableName, ['features'], `[${reference.features.map(quoteString).join(', ')}]`));
  } else if (editor.hasKey(tableName, 'features')) {
    edits.push(...editor.removeKey(tableName, 'features'));
  }
  if (reference.optional) {
    edits.push(...editor.setKey(tableName, ['optional'], 'true'));
  } else if (editor.hasKey(tableName, 'optional')) {
    edits.push(...editor.removeKey(tableName, 'optional'));
  }
  if (reference.noDefaultFeatures) {
    edits.push(...editor.setKey(tableName, ['default-features'], 'false'));
  } else if (editor.hasKey(tableName, 'default-features')) {
    edits.push(...editor.removeKey(tableName, 'default-features'));
  }
  return edits;
}

/** Parse the value generated by `workspaceReferenceValue` back into parts. */
function parseReferenceValue(valueText: string): {
  features: string[];
  optional: boolean;
  noDefaultFeatures: boolean;
} {
  const featuresMatch = /features\s*=\s*\[([^\]]*)\]/.exec(valueText);
  const features = featuresMatch
    ? featuresMatch[1]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          try {
            return JSON.parse(part) as string;
          } catch {
            return part.replace(/^["']|["']$/g, '');
          }
        })
    : [];
  return {
    features,
    optional: /(^|[,{\s])optional\s*=\s*true/.test(valueText),
    noDefaultFeatures: /(^|[,{\s])default-features\s*=\s*false/.test(valueText),
  };
}

// -------------------------------------------------------------------- utils

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Cargo dependency keys a `workspace = true` reference can carry. */
const REFERENCE_KEYS = new Set([
  'workspace',
  'features',
  'optional',
  'default-features',
]);

/** Cargo dependency keys the workspace entry can reproduce. */
const PROMOTABLE_KEYS = new Set([
  'version',
  'path',
  'git',
  'branch',
  'tag',
  'rev',
  'package',
  'features',
  'default-features',
  'optional',
  'workspace',
]);

/**
 * Options on a declaration that promotion/convergence would silently drop.
 *
 * `registry`, `registry-index`, `public`, `artifact`, `lib` and `target` are
 * legal Cargo keys that the rewritten inline reference cannot express, so the
 * planner refuses instead of changing semantics.
 */
function unsupportedReferenceKeys(decl: { rawValue: string }): string[] {
  return unsupportedKeys(decl, new Set([...REFERENCE_KEYS, ...PROMOTABLE_KEYS]));
}

/** Options on an existing workspace entry that promotion would drop. */
function unsupportedEntryKeys(entry: { rawValue: string }): string[] {
  // `optional` is not valid in [workspace.dependencies] at all, so it is not
  // something promotion could preserve either.
  const allowed = new Set([...PROMOTABLE_KEYS].filter((key) => key !== 'optional'));
  return unsupportedKeys(entry, allowed);
}

function unsupportedKeys(value: { rawValue: string }, allowed: ReadonlySet<string>): string[] {
  let raw: unknown;
  try {
    raw = JSON.parse(value.rawValue);
  } catch {
    return [];
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.keys(raw as Record<string, unknown>).filter((key) => !allowed.has(key));
}

function dedupe(values: string[]): string[] {
  return unique(values);
}

function sameSet(a: string[], b: string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

/** Order-preserving intersection of every feature list. */
function intersectFeatures(lists: string[][]): string[] {
  if (!lists.length) return [];
  const [first, ...rest] = lists;
  const others = rest.map((list) => new Set(list));
  return dedupe(first).filter((feature) => others.every((set) => set.has(feature)));
}

function lineStartOffset(text: string, offset: number): number {
  const index = text.lastIndexOf('\n', offset - 1);
  return index < 0 ? 0 : index + 1;
}

function lineEndOffset(text: string, offset: number): number {
  const index = text.indexOf('\n', offset);
  return index < 0 ? text.length : index + 1;
}

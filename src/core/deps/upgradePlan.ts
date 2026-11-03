/**
 * Pure planning helpers for Upgrade Planner 2.0.
 *
 * Everything here is synchronous and free of VS Code / node-only imports so it
 * can be unit tested under plain Node (tsx) and reused by both the command and
 * webview layers.
 */
import * as semver from 'semver';
import type { CrateVersionInfo } from './registry.js';
import type { FeatureChange, UpgradeAssessment, UpgradeClass } from './versions.js';

/** How an upgrade is applied: rewrite the manifest, refresh Cargo.lock, or nothing. */
export type ChangeMode = 'manifest' | 'lock-only' | 'none';

export interface MsrvComparison {
  /** The target release needs a newer compiler than the active toolchain. */
  violated: boolean;
  /** The target release carries no `rust-version`, so the requirement is unknown. */
  unknown: boolean;
}

/**
 * Compare a dependency's declared `rust-version` against the active toolchain.
 *
 * Both sides go through `semver.coerce` because manifests use values such as
 * `1.75` while `rustc --version` reports `1.75.0` (and occasionally a channel
 * suffix). A missing target MSRV is reported as unknown; a missing toolchain
 * version is not treated as a violation.
 */
export function compareTargetMsrv(target: string | undefined, toolchain: string | undefined): MsrvComparison {
  const required = coerceVersion(target);
  if (!required) return { violated: false, unknown: true };
  const compiler = coerceVersion(toolchain);
  if (!compiler) return { violated: false, unknown: false };
  return { violated: semver.gt(required, compiler), unknown: false };
}

function coerceVersion(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // Strip `rustc ` and any channel/target suffix before coercing.
  const cleaned = value
    .replace(/^rustc\s+/i, '')
    .split(/\s+/)[0]
    .split('-')[0]
    .split('+')[0];
  return semver.coerce(cleaned)?.version;
}

/**
 * Informational feature-set diff between two published releases.
 *
 * This deliberately never feeds `classifyUpgrade`: newly added crate features
 * are surfaced for review but must not silently reclassify an upgrade. Returns
 * undefined when either side is unknown, so the UI can stay quiet instead of
 * showing every feature as "added".
 */
export function diffCrateFeatures(
  before: Pick<CrateVersionInfo, 'features'> | undefined,
  after: Pick<CrateVersionInfo, 'features'> | undefined,
): FeatureChange | undefined {
  if (!before || !after) return undefined;
  const beforeFeatures = before.features ?? {};
  const afterFeatures = after.features ?? {};
  const beforeNames = new Set(Object.keys(beforeFeatures));
  const afterNames = new Set(Object.keys(afterFeatures));
  const added = [...afterNames].filter((name) => !beforeNames.has(name)).sort();
  const removed = [...beforeNames].filter((name) => !afterNames.has(name)).sort();
  const defaultChanged = !sameStringSet(beforeFeatures.default ?? [], afterFeatures.default ?? []);
  return { added, removed, defaultChanged };
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((value) => set.has(value));
}

/**
 * Decide the write strategy for one row.
 *
 * `lock-only` means the declared requirement already admits the target (or the
 * requirement does not change), so refreshing Cargo.lock is enough. `manifest`
 * means the requirement text itself must be rewritten.
 */
export function changeModeFor(
  requirement: string | undefined,
  upgrade: Pick<UpgradeAssessment, 'classification' | 'lockOnly' | 'newRequirement'> | undefined,
): ChangeMode {
  if (!upgrade || upgrade.classification === 'not-applicable') return 'none';
  if (upgrade.lockOnly) return 'lock-only';
  const after = upgrade.newRequirement ?? requirement;
  return after === requirement ? 'lock-only' : 'manifest';
}

export interface SafeUpgradeCandidate {
  classification: UpgradeClass;
  msrvViolated?: boolean;
}

/**
 * Rows a one-click batch may include: classified safe and not known to need a
 * newer compiler. An unknown MSRV stays eligible (it is shown, not hidden).
 */
export function isSafeUpgradeEligible(candidate: SafeUpgradeCandidate): boolean {
  return candidate.classification === 'safe' && !candidate.msrvViolated;
}

/**
 * Dependency classification and safe-upgrade rules.
 *
 * "Safe" here is stricter than raw SemVer compatibility: the update must stay
 * inside the declared requirement, and the feature selection must be unchanged
 * in meaning. Anything else is surfaced as needing confirmation.
 *
 * Requirements are parsed with Cargo's semantics, where a bare `1.2` means the
 * caret range `>=1.2.0, <2.0.0` (unlike npm).
 */
import * as semver from 'semver';

export interface VersionReqInfo {
  /** Raw requirement string, e.g. "^1.2", "1", "=1.0.3", ">=1, <2". */
  raw: string;
  /** Semver range in node-semver syntax, when the requirement is registry-based. */
  range?: string;
  kind: 'caret' | 'tilde' | 'exact' | 'range' | 'wildcard' | 'star' | 'unknown';
  isAny: boolean;
  /** Minimum version admitted by the requirement, if determinable. */
  minVersion?: string;
}

/** Translate a Cargo version requirement into a node-semver range. */
export function cargoReqToRange(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*') return undefined;

  const comparators = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  if (comparators.length === 0) return undefined;

  const converted = comparators.map((comparator) => {
    if (/^[=<>~^]/.test(comparator) || comparator.includes('*')) return comparator;
    // Bare versions in Cargo are caret requirements.
    return `^${comparator}`;
  });

  const range = semver.validRange(converted.join(' '));
  return range ?? undefined;
}

export function parseVersionReq(raw: string | undefined): VersionReqInfo {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '' || trimmed === '*') {
    return { raw: trimmed, kind: 'star', isAny: true };
  }

  const range = cargoReqToRange(trimmed);
  const min = range ? semver.minVersion(range)?.version : undefined;
  let kind: VersionReqInfo['kind'] = 'unknown';

  if (trimmed.startsWith('^')) kind = 'caret';
  else if (trimmed.startsWith('~')) kind = 'tilde';
  else if (trimmed.startsWith('=')) kind = 'exact';
  else if (/^[\d*]/.test(trimmed) && trimmed.includes('*')) kind = 'wildcard';
  else if (/^[\d.]+\s*$/u.test(trimmed)) kind = 'caret';
  else if (/[<>=|]/.test(trimmed)) kind = 'range';
  else if (range) kind = 'range';

  return { raw: trimmed, range, kind, isAny: false, minVersion: min };
}

/**
 * The requirement a safe upgrade writes back, preserving the operator and
 * precision the user wrote: `^1.2` -> `^1.5`, `~1.2.3` -> `~1.2.9`, `1` -> `1`.
 */
export function rewriteRequirement(req: VersionReqInfo, target: string): string | undefined {
  if (!semver.valid(target)) return undefined;
  if (req.isAny) return `^${target}`;

  const raw = req.raw;
  const targetParts = target.split('.');
  const precision = (part: string) => {
    const cleaned = part.replace(/^[\^~=<>v\s]+/, '');
    return cleaned.split('.').filter((p) => /^\d+$/.test(p)).length || 1;
  };
  const keep = (n: number) => targetParts.slice(0, Math.max(1, Math.min(3, n))).join('.');

  if (req.kind === 'exact') {
    return raw.startsWith('=') ? `=${target}` : target;
  }
  if (req.kind === 'caret') {
    return `^${keep(precision(raw))}`;
  }
  if (req.kind === 'tilde') {
    return `~${keep(precision(raw))}`;
  }
  if (req.kind === 'wildcard') {
    const parts = raw.replace(/^[\^~]/, '').split('.');
    const starIndex = parts.indexOf('*');
    if (starIndex >= 0) {
      const fixed = parts.slice(0, starIndex).length;
      if (fixed === 1) {
        return `${targetParts[0]}.*`;
      }
      return `${keep(2)}.*`;
    }
    return `^${target}`;
  }
  if (req.kind === 'range') {
    // Ranges are hand-written policy; bump the lower bound only when the
    // target is still inside the range (handled as lock-only) or fall back to
    // an equivalent caret range that we can reason about.
    return `^${target}`;
  }
  return `^${target}`;
}

/** Does the requirement admit `version`? Unknown requirements never match. */
export function requirementSatisfied(req: VersionReqInfo, version: string): boolean {
  if (!req.range || !semver.valid(version)) return false;
  return semver.satisfies(version, req.range, { includePrerelease: false });
}

export interface FeatureChange {
  added: string[];
  removed: string[];
  defaultChanged: boolean;
}

export type UpgradeClass = 'safe' | 'major' | 'not-applicable' | 'unknown';

export interface UpgradeAssessment {
  classification: UpgradeClass;
  reason?:
    | 'major'
    | 'outside-requirement'
    | 'no-update'
    | 'unknown-version'
    | 'features-changed'
    | 'non-registry';
  from: string;
  to: string;
  featureChange: FeatureChange;
  newRequirement?: string;
  /** Requirement already admits the target, so only Cargo.lock changes. */
  lockOnly: boolean;
  /** True when the version numbers disagree in the major component. */
  majorChange: boolean;
}

export interface UpgradeInput {
  declared: string;
  locked?: string;
  latest?: string;
  latestStable?: string;
  /** Features enabled today by the manifest (undefined = unknown). */
  currentFeatures?: string[];
  /** Features the target version offers by default (undefined = unknown). */
  latestFeatures?: string[];
  targetVersion?: string;
  /** True when the crate's `default` feature set differs from the locked version. */
  defaultFeatureSetChanged?: boolean;
}

export function classifyUpgrade(input: UpgradeInput): UpgradeAssessment {
  const req = parseVersionReq(input.declared);
  const target = input.targetVersion ?? input.latestStable ?? input.latest;
  const from = input.locked ?? req.minVersion ?? input.declared;
  const featureChange = diffFeatures(input.currentFeatures, input.latestFeatures);

  const base: UpgradeAssessment = {
    classification: 'unknown',
    from,
    to: target ?? '',
    featureChange,
    lockOnly: false,
    majorChange: false,
  };

  if (!target || !semver.valid(target)) {
    return { ...base, classification: 'not-applicable', reason: 'unknown-version' };
  }
  base.majorChange = !isCargoCompatible(from, target);

  if (req.isAny) {
    const current = input.locked && semver.valid(input.locked) ? input.locked : undefined;
    if (current && semver.eq(current, target)) {
      return { ...base, classification: 'not-applicable', reason: 'no-update' };
    }
    if (base.majorChange) {
      return { ...base, classification: 'major', reason: 'major', newRequirement: `^${target}` };
    }
    return { ...base, classification: 'safe', newRequirement: `^${target}` };
  }
  if (!req.range) {
    return { ...base, classification: 'not-applicable', reason: 'non-registry' };
  }

  const current = input.locked && semver.valid(input.locked) ? input.locked : undefined;
  if (current && semver.eq(current, target)) {
    return { ...base, classification: 'not-applicable', reason: 'no-update' };
  }

  // A changed default feature set is a semantic change even when the version is
  // already inside the requirement, so it must be confirmed before the
  // lock-only fast path.
  if (input.defaultFeatureSetChanged) {
    return { ...base, classification: 'unknown', reason: 'features-changed', newRequirement: input.declared };
  }

  if (requirementSatisfied(req, target)) {
    // Cargo already allows this version; refreshing the lockfile is enough.
    return { ...base, classification: 'safe', lockOnly: !input.locked || semver.lt(input.locked, target), newRequirement: input.declared };
  }

  if (base.majorChange) {
    return { ...base, classification: 'major', reason: 'major', newRequirement: `^${target}` };
  }

  // Features that appear in a newer minor release might be non-optional; make
  // the user confirm rather than silently enabling new build surface.
  if (input.defaultFeatureSetChanged || introducesRequiredFeatures(featureChange, from, target)) {
    return { ...base, classification: 'unknown', reason: 'features-changed', newRequirement: rewriteRequirement(req, target) };
  }

  const newRequirement = rewriteRequirement(req, target);
  if (!newRequirement || !requirementSatisfied(parseVersionReq(newRequirement), target)) {
    return { ...base, classification: 'unknown', reason: 'features-changed' };
  }

  return { ...base, classification: 'safe', reason: 'outside-requirement', newRequirement };
}

/** Compare feature lists; `undefined` means "unknown", not "none". */
export function diffFeatures(before: string[] | undefined, after: string[] | undefined): FeatureChange {
  if (!before || !after) return { added: [], removed: [], defaultChanged: false };
  const b = new Set(before);
  const a = new Set(after);
  const added = [...a].filter((f) => !b.has(f));
  const removed = [...b].filter((f) => !a.has(f));
  return {
    added,
    removed,
    defaultChanged: b.has('default') !== a.has('default') && (added.includes('default') || removed.includes('default')),
  };
}

/**
 * Newly added features are treated as opt-out-unknown. A new `default` entry or
 * any added feature on a minor/major bump could change build surface, so those
 * require confirmation.
 */
export function introducesRequiredFeatures(change: FeatureChange, fromVersion: string, toVersion: string): boolean {
  if (!change.added.length) return false;
  const from = semver.valid(fromVersion);
  const to = semver.valid(toVersion);
  if (!from || !to) return true;
  if (semver.major(from) !== semver.major(to)) return true;
  if (semver.minor(from) !== semver.minor(to)) return true;
  return change.defaultChanged;
}

/** Version-distance classification used by the UI. */
export function versionBumpKind(from: string | undefined, to: string): 'none' | 'patch' | 'minor' | 'major' | 'unknown' {
  if (!from || !semver.valid(from) || !semver.valid(to)) return 'unknown';
  if (semver.eq(from, to)) return 'none';
  if (semver.major(from) !== semver.major(to)) return 'major';
  if (semver.minor(from) !== semver.minor(to)) return 'minor';
  return 'patch';
}

/**
 * Cargo's compatibility rule: for `0.x` releases the minor component is the
 * breaking axis, so 0.2.1 -> 0.3.0 is a breaking change even though the major
 * component is unchanged.
 */
export function isCargoCompatible(from: string | undefined, to: string): boolean {
  const a = from ? semver.parse(from) : null;
  const b = semver.parse(to);
  if (!a || !b) return false;
  if (a.major !== b.major) return false;
  if (a.major > 0) return true;
  if (a.minor !== b.minor) return false;
  if (a.minor > 0) return true;
  return a.patch === b.patch;
}

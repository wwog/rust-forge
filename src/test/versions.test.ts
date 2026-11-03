import assert from 'node:assert/strict';
import test from 'node:test';
import { latestStableVersion } from '../core/deps/registry.js';
import { classifyUpgrade, parseVersionReq, rewriteRequirement, requirementSatisfied, isCargoCompatible } from '../core/deps/versions.js';

test('bare Cargo versions are caret requirements', () => {
  const req = parseVersionReq('1.2');
  assert.equal(req.kind, 'caret');
  assert.ok(requirementSatisfied(req, '1.9.0'));
  assert.ok(!requirementSatisfied(req, '2.0.0'));
});

test('patch upgrade inside the declared range is lock-only', () => {
  const result = classifyUpgrade({ declared: '1', locked: '1.0.228', latest: '1.0.229' });
  assert.equal(result.classification, 'safe');
  assert.equal(result.lockOnly, true);
  assert.equal(result.newRequirement, '1');
});

test('minor upgrade outside a tilde range is safe and rewrites the requirement', () => {
  const result = classifyUpgrade({ declared: '~1.2.3', locked: '1.2.3', latest: '1.5.0' });
  assert.equal(result.classification, 'safe');
  assert.equal(result.newRequirement, '~1.5.0');
});

test('major upgrade needs confirmation', () => {
  const result = classifyUpgrade({ declared: '1.2', locked: '1.2.0', latest: '2.0.0' });
  assert.equal(result.classification, 'major');
  assert.equal(result.majorChange, true);
});

test('0.x minor bump is breaking under Cargo semantics', () => {
  const result = classifyUpgrade({ declared: '0.2', locked: '0.2.1', latest: '0.3.0' });
  assert.equal(result.classification, 'major');
  assert.equal(isCargoCompatible('0.2.1', '0.3.0'), false);
});

test('exact pins are rewritten but still classified safe for patch bumps', () => {
  const result = classifyUpgrade({ declared: '=1.0.0', locked: '1.0.0', latest: '1.0.1' });
  assert.equal(result.classification, 'safe');
  assert.equal(result.newRequirement, '=1.0.1');
});

test('default feature changes require confirmation', () => {
  const result = classifyUpgrade({
    declared: '1',
    locked: '1.2.0',
    latest: '1.3.0',
    defaultFeatureSetChanged: true,
  });
  assert.equal(result.classification, 'unknown');
  assert.equal(result.reason, 'features-changed');
});

test('no update is reported as not-applicable', () => {
  const result = classifyUpgrade({ declared: '1', locked: '1.0.0', latest: '1.0.0' });
  assert.equal(result.classification, 'not-applicable');
  assert.equal(result.reason, 'no-update');
});

test('requirement rewriting preserves operator and precision', () => {
  assert.equal(rewriteRequirement(parseVersionReq('^1.2'), '1.9.4'), '^1.9');
  assert.equal(rewriteRequirement(parseVersionReq('1'), '1.4.4'), '^1');
  assert.equal(rewriteRequirement(parseVersionReq('1'), '2.3.4'), '^2');
  assert.equal(rewriteRequirement(parseVersionReq('~0.3.1'), '0.3.9'), '~0.3.9');
  assert.equal(rewriteRequirement(parseVersionReq('=1.2.3'), '1.2.4'), '=1.2.4');
  assert.equal(rewriteRequirement(parseVersionReq('1.*'), '1.7.0'), '1.*');
});

test('an unrestricted requirement is upgraded to a caret on the target', () => {
  const result = classifyUpgrade({ declared: '*', locked: '1.0.0', latest: '2.0.0' });
  // With no locked version to compare against, a major-looking jump still
  // requires confirmation because the baseline is unknown.
  assert.equal(result.classification, 'major');
  const patch = classifyUpgrade({ declared: '*', locked: '2.0.0', latest: '2.0.1' });
  assert.equal(patch.classification, 'safe');
  assert.equal(patch.newRequirement, '^2.0.1');
});

test('latest stable tolerates crates.io backfilled version ordering', () => {
  const versions = ['0.1.1', '0.2.3', '0.3.2', '0.4.3', '0.10.1'].map((num) => ({
    num,
    yanked: false,
    features: {},
  }));
  assert.equal(
    latestStableVersion({ maxVersion: '0.10.1', maxStableVersion: '0.10.1', versions }),
    '0.10.1',
  );
});

test('latest stable keeps build metadata and ignores prereleases', () => {
  const versions = ['1.1.8+spec-1.1.0', '1.1.7+spec-1.1.0', '0.9.8', '2.0.0-beta.1'].map((num) => ({
    num,
    yanked: false,
    features: {},
  }));
  assert.equal(
    latestStableVersion({ maxVersion: '2.0.0-beta.1', maxStableVersion: '1.1.8+spec-1.1.0', versions }),
    '1.1.8+spec-1.1.0',
  );
});

test('latest stable skips yanked versions and falls back to maxVersion', () => {
  const versions = [
    { num: '1.9.0', yanked: false, features: {} },
    { num: '2.0.0', yanked: true, features: {} },
    { num: '1.10.0', yanked: false, features: {} },
  ];
  assert.equal(
    latestStableVersion({ maxVersion: '2.0.0', maxStableVersion: '2.0.0', versions }),
    '1.10.0',
  );
  assert.equal(
    latestStableVersion({
      maxVersion: '0.5.0-alpha.1',
      versions: [{ num: '0.5.0-alpha.1', yanked: false, features: {} }],
    }),
    '0.5.0-alpha.1',
  );
});

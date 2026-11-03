import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRustfmtTarget } from '../core/rustfmtTarget.js';

const model = {
  root: '/ws',
  members: [
    { name: 'alpha', dir: '/ws/crates/alpha' },
    { name: 'beta', dir: '/ws/crates/beta' },
  ],
};

test('workspace scope targets the workspace root', () => {
  const target = resolveRustfmtTarget(model, 'workspace');
  assert.equal(target.scope, 'workspace');
  assert.equal(target.dir, '/ws');
  assert.equal(target.missingMember, false);
  // The active member is still reported so a later switch preserves it.
  assert.equal(target.member?.name, 'alpha');
});

test('member scope resolves the named member directory', () => {
  const target = resolveRustfmtTarget(model, 'member', 'beta');
  assert.equal(target.scope, 'member');
  assert.equal(target.dir, '/ws/crates/beta');
  assert.equal(target.member?.name, 'beta');
  assert.equal(target.missingMember, false);
});

test('member scope falls back to the first member for an unknown name', () => {
  const target = resolveRustfmtTarget(model, 'member', 'missing');
  assert.equal(target.dir, '/ws/crates/alpha');
  assert.equal(target.member?.name, 'alpha');
  assert.equal(target.missingMember, false);
});

test('member scope without members reports missingMember and never falls back to the root', () => {
  const target = resolveRustfmtTarget({ root: '/ws', members: [] }, 'member', 'alpha');
  assert.equal(target.scope, 'member');
  assert.equal(target.member, undefined);
  // The caller must refuse to write; `dir` is only a display fallback.
  assert.equal(target.missingMember, true);
  assert.equal(target.dir, '/ws');
});

test('workspace scope without members stays valid', () => {
  const target = resolveRustfmtTarget({ root: '/ws', members: [] }, 'workspace');
  assert.equal(target.dir, '/ws');
  assert.equal(target.missingMember, false);
  assert.equal(target.member, undefined);
});

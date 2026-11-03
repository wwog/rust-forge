import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'smol-toml';
import {
  isWorkspacePathExcluded,
  matchesMemberPattern,
  planMemberAddition,
  planMemberRemoval,
} from '../core/cargo/project.js';

function workspaceOf(text: string): Record<string, any> {
  const parsed = parse(text) as { workspace?: Record<string, any> };
  return parsed.workspace ?? {};
}

test('removing a glob-covered member keeps the glob and adds an exclude', () => {
  const text = '[workspace]\nmembers = ["crates/*"]\n';
  const plan = planMemberRemoval(text, 'crates/foo');

  assert.equal(plan.changed, true);
  assert.equal(plan.reason, undefined);
  const ws = workspaceOf(plan.text);
  assert.deepEqual(ws.members, ['crates/*']);
  assert.deepEqual(ws.exclude, ['crates/foo']);
});

test('removing an explicit member drops only that entry', () => {
  const text = '[workspace]\nmembers = ["crates/foo", "crates/bar"]\n';
  const plan = planMemberRemoval(text, 'crates/foo');

  assert.equal(plan.changed, true);
  const ws = workspaceOf(plan.text);
  assert.deepEqual(ws.members, ['crates/bar']);
  assert.equal(ws.exclude, undefined);
});

test('an existing exclude list is preserved and the member is appended', () => {
  const text = '[workspace]\nmembers = ["crates/*"]\nexclude = ["crates/old"]\n';
  const plan = planMemberRemoval(text, 'crates/foo');

  assert.equal(plan.changed, true);
  const ws = workspaceOf(plan.text);
  assert.deepEqual(ws.members, ['crates/*']);
  assert.deepEqual(ws.exclude, ['crates/old', 'crates/foo']);
});

test('an explicit member that is also glob-covered is removed and excluded', () => {
  const text = '[workspace]\nmembers = ["crates/*", "crates/foo"]\n';
  const plan = planMemberRemoval(text, 'crates/foo');

  assert.equal(plan.changed, true);
  const ws = workspaceOf(plan.text);
  assert.deepEqual(ws.members, ['crates/*']);
  assert.deepEqual(ws.exclude, ['crates/foo']);
});

test('a directory outside members and globs is reported as not listed', () => {
  const text = '[workspace]\nmembers = ["crates/*"]\n';
  const plan = planMemberRemoval(text, 'tools/foo');

  assert.equal(plan.changed, false);
  assert.equal(plan.reason, 'not-listed');
  assert.equal(plan.text, text);
});

test('invalid TOML is left untouched', () => {
  const text = '[workspace\nmembers = [';
  const plan = planMemberRemoval(text, 'crates/foo');

  assert.equal(plan.changed, false);
  assert.equal(plan.text, text);
});

test('comments and surrounding formatting survive the rewrite', () => {
  const text = [
    '[workspace]',
    '# Members are globbed under crates/.',
    'members = ["crates/*"] # keep this glob',
    'resolver = "3"',
    '',
  ].join('\n');
  const plan = planMemberRemoval(text, 'crates/foo');

  assert.equal(plan.changed, true);
  assert.ok(plan.text.includes('# Members are globbed under crates/.'));
  assert.ok(plan.text.includes('members = ["crates/*"] # keep this glob'));
  assert.ok(plan.text.includes('resolver = "3"'));
  assert.deepEqual(workspaceOf(plan.text).exclude, ['crates/foo']);
});

test('exclude matches cargo: plain paths cover descendants, globs match only themselves', () => {
  assert.equal(isWorkspacePathExcluded('crates/foo', ['crates']), true);
  assert.equal(isWorkspacePathExcluded('crates/group/foo', ['crates/group']), true);
  assert.equal(isWorkspacePathExcluded('crates/foo', ['crates/*']), true);
  assert.equal(isWorkspacePathExcluded('crates/group/foo', ['crates/*']), false);
  assert.equal(isWorkspacePathExcluded('tools/foo', ['crates']), false);
});

test('adding a member excluded only by a glob adds an explicit entry', () => {
  const text = '[workspace]\nmembers = ["crates/*"]\nexclude = ["crates/*"]\n';
  const plan = planMemberAddition(text, 'crates/foo');
  assert.equal(plan.changed, true);
  const ws = workspaceOf(plan.text);
  assert.deepEqual(ws.members, ['crates/*', 'crates/foo']);
  assert.deepEqual(ws.exclude, ['crates/*']);
});

test('adding a member under an ancestor exclude adds an explicit entry', () => {
  const text = '[workspace]\nmembers = ["crates/*"]\nexclude = ["crates"]\n';
  const plan = planMemberAddition(text, 'crates/foo');
  assert.equal(plan.changed, true);
  const ws = workspaceOf(plan.text);
  assert.deepEqual(ws.members, ['crates/*', 'crates/foo']);
  assert.deepEqual(ws.exclude, ['crates']);
});

test('matchesMemberPattern normalizes separators, ./ prefixes and trailing slashes', () => {
  assert.equal(matchesMemberPattern('./crates/foo/', 'crates/*'), true);
  assert.equal(matchesMemberPattern('.\\crates\\foo\\', 'crates/*'), true);
  assert.equal(matchesMemberPattern('crates/foo', './crates/*/'), true);
  assert.equal(matchesMemberPattern('tools/foo', 'crates/*'), false);
});

test('adding a member already covered by a glob is a no-op', () => {
  const text = '[workspace]\nmembers = ["crates/*"]\n';
  const plan = planMemberAddition(text, 'crates/new-crate');
  assert.equal(plan.changed, false);
  assert.equal(plan.text, text);
});

test('adding a member clears an exact exclude left by a previous removal', () => {
  const text = '[workspace]\nmembers = ["crates/*"]\nexclude = ["crates/foo", "crates/old"]\n';
  const plan = planMemberAddition(text, 'crates/foo');
  assert.equal(plan.changed, true);
  const ws = workspaceOf(plan.text);
  assert.deepEqual(ws.members, ['crates/*']);
  assert.deepEqual(ws.exclude, ['crates/old']);
});

test('adding a new explicit member appends it', () => {
  const text = '[workspace]\nmembers = ["crates/foo"]\n';
  const plan = planMemberAddition(text, 'crates/bar');
  assert.equal(plan.changed, true);
  const ws = workspaceOf(plan.text);
  assert.deepEqual(ws.members, ['crates/foo', 'crates/bar']);
});

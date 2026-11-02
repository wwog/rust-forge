import assert from 'node:assert/strict';
import test from 'node:test';
import { TomlEditor, applyEdits, parseDottedKey } from '../core/toml/editor.js';

const base = `# Top level comment
[package]
name = "demo"     # trailing comment
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1", features = ["derive"] }
anyhow = "1"
`;

test('parses statements and preserves raw text', () => {
  const ed = new TomlEditor(base);
  const pkg = ed.getTable('package')!;
  assert.ok(pkg);
  assert.equal(ed.getValue('package', 'version'), '"0.1.0"');
  assert.equal(ed.getValue('package', 'name'), '"demo"');
  assert.equal(ed.getTable('dependencies')!.statements.length, 2);
});

test('setKey replaces only the value and keeps comments', () => {
  const ed = new TomlEditor(base);
  const edits = ed.setKey('package', 'version', '"0.2.0"');
  const out = ed.apply(edits);
  assert.match(out, /name = "demo"     # trailing comment/);
  assert.match(out, /version = "0.2.0"/);
  assert.equal(new TomlEditor(out).getValue('package', 'version'), '"0.2.0"');
});

test('setKey adds a key into an existing table', () => {
  const ed = new TomlEditor(base);
  const out = ed.apply(ed.setKey('package', 'rust-version', '"1.80"'));
  assert.match(out, /edition = "2021"\nrust-version = "1.80"\n/);
  assert.equal(new TomlEditor(out).getValue('package', 'rust-version'), '"1.80"');
});

test('setKey creates a missing table at the end', () => {
  const ed = new TomlEditor(base);
  const out = ed.apply(ed.setKey('workspace.lints.clippy', 'unwrap_used', '"deny"'));
  const re = new TomlEditor(out);
  assert.equal(re.getValue('workspace.lints.clippy', 'unwrap_used'), '"deny"');
  // Parent tables are not required to exist beforehand.
  assert.ok(out.trimEnd().endsWith('unwrap_used = "deny"'));
});

test('createTable inserts parent before an existing child table', () => {
  const src = `[workspace.lints.clippy]
unwrap_used = "warn"
`;
  const ed = new TomlEditor(src);
  const out = ed.apply(ed.setKey('workspace', 'resolver', '"2"'));
  const re = new TomlEditor(out);
  assert.equal(re.getValue('workspace', 'resolver'), '"2"');
  assert.ok(out.indexOf('[workspace]') < out.indexOf('[workspace.lints.clippy]'));
});

test('append to a table before the next header', () => {
  const src = `[package]
name = "a"

[dependencies]
serde = "1"
`;
  const ed = new TomlEditor(src);
  const out = ed.apply(ed.setKey('package', 'description', '"x"'));
  assert.equal(new TomlEditor(out).getValue('package', 'description'), '"x"');
  assert.ok(out.indexOf('description') < out.indexOf('[dependencies]'));
});

test('removeKey drops the statement and its line', () => {
  const ed = new TomlEditor(base);
  const out = ed.apply(ed.removeKey('dependencies', 'anyhow'));
  assert.ok(!out.includes('anyhow'));
  assert.ok(out.includes('serde'));
});

test('removeKey can drop an emptied table', () => {
  const src = `[package]
name = "a"

[dev-dependencies]
tempfile = "3"
`;
  const ed = new TomlEditor(src);
  const out = ed.apply(ed.removeKey('dev-dependencies', 'tempfile', { dropEmptyTable: true }));
  assert.ok(!out.includes('dev-dependencies'));
  assert.ok(out.includes('name = "a"'));
});

test('multiline arrays and inline tables are one statement', () => {
  const src = `[dependencies]
serde = { version = "1", features = [
  "derive",
  "rc",
] }
foo = "1"
`;
  const ed = new TomlEditor(src);
  assert.equal(ed.getTable('dependencies')!.statements.length, 2);
  const out = ed.apply(ed.setKey('dependencies', 'foo', '"2"'));
  assert.match(out, /"rc",\n\]\s*\}\nfoo = "2"/);
});

test('dotted keys and quoted keys', () => {
  assert.deepEqual(parseDottedKey('a.b.c'), ['a', 'b', 'c']);
  assert.deepEqual(parseDottedKey('workspace.package'), ['workspace', 'package']);
  assert.deepEqual(parseDottedKey('a."b.c"'), ['a', 'b.c']);
  assert.equal(parseDottedKey('a..b'), null);

  const src = `[dependencies]
bar.version = "1"
`;
  const ed = new TomlEditor(src);
  assert.equal(ed.getValue('dependencies', 'bar.version'), '"1"');
});

test('replaceTable swaps the whole block', () => {
  const src = `[package]
name = "a"

[dependencies]
serde = "1"
anyhow = "1"

[features]
default = []
`;
  const ed = new TomlEditor(src);
  const out = ed.apply(ed.replaceTable('dependencies', '[dependencies]\nserde = "2"\n'));
  assert.ok(out.includes('serde = "2"'));
  assert.ok(!out.includes('anyhow'));
  assert.ok(out.includes('[features]'));
});

test('applyEdits rejects overlaps', () => {
  assert.throws(() => applyEdits('abcdef', [
    { start: 0, end: 3, text: 'x' },
    { start: 2, end: 4, text: 'y' },
  ]));
});

test('windows line endings survive edits', () => {
  const src = '[package]\r\nname = "a"\r\nversion = "1"\r\n';
  const ed = new TomlEditor(src);
  const out = ed.apply(ed.setKey('package', 'version', '"2"'));
  const re = new TomlEditor(out);
  assert.equal(re.getValue('package', 'version'), '"2"');
  assert.ok(out.includes('\r\n'));
});

test('value with # inside a string is not a comment', () => {
  const src = `[package]
description = "a # b" # real comment
`;
  const ed = new TomlEditor(src);
  assert.equal(ed.getValue('package', 'description'), '"a # b"');
});

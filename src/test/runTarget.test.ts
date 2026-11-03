import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { crateTargetContextSuffix, detectCrateTargets } from '../core/crateTarget.js';
import type { CargoPackage } from '../core/cargo/types.js';

async function fixture(manifest: string, files: Record<string, string> = {}): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-targets-'));
  await fs.writeFile(path.join(dir, 'Cargo.toml'), manifest, 'utf8');
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(dir, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, 'utf8');
  }
  return dir;
}

test('detects a binary from src/main.rs', async () => {
  const dir = await fixture(
    `[package]
name = "demo"
version = "0.1.0"
edition = "2024"
`,
    { 'src/main.rs': 'fn main() {}\n' },
  );
  try {
    const target = await detectCrateTargets(dir);
    assert.equal(target.isBinary, true);
    assert.equal(target.isLibrary, false);
    assert.equal(target.hasMain, true);
    assert.deepEqual(target.binaries.map((bin) => bin.name), ['demo']);
    assert.equal(crateTargetContextSuffix(target), ':binary');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a library crate has no runnable binary', async () => {
  const dir = await fixture(
    `[package]
name = "demo"
version = "0.1.0"
edition = "2024"
`,
    { 'src/lib.rs': 'pub fn demo() {}\n' },
  );
  try {
    const target = await detectCrateTargets(dir);
    assert.equal(target.isBinary, false);
    assert.equal(target.isLibrary, true);
    assert.equal(target.hasMain, false);
    assert.equal(crateTargetContextSuffix(target), ':library');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('explicit [[bin]] targets count without src/main.rs', async () => {
  const dir = await fixture(
    `[package]
name = "demo"
version = "0.1.0"
edition = "2024"

[[bin]]
name = "tool"
path = "src/tool.rs"
`,
    { 'src/tool.rs': 'fn main() {}\n' },
  );
  try {
    const target = await detectCrateTargets(dir);
    assert.equal(target.isBinary, true);
    assert.equal(target.hasMain, false);
    assert.deepEqual(target.binaries.map((bin) => bin.name), ['tool']);
    assert.equal(target.binaries[0].path, path.join(dir, 'src', 'tool.rs'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('autobins = false disables the conventional main.rs binary', async () => {
  const dir = await fixture(
    `[package]
name = "demo"
version = "0.1.0"
edition = "2024"
autobins = false
`,
    { 'src/main.rs': 'fn main() {}\n' },
  );
  try {
    const target = await detectCrateTargets(dir);
    assert.equal(target.hasMain, true);
    assert.equal(target.isBinary, false);
    assert.equal(crateTargetContextSuffix(target), '');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('src/bin auto-discovery finds file and nested-directory binaries', async () => {
  const dir = await fixture(
    `[package]
name = "demo"
version = "0.1.0"
edition = "2024"
`,
    {
      'src/main.rs': 'fn main() {}\n',
      'src/bin/one.rs': 'fn main() {}\n',
      'src/bin/two/main.rs': 'fn main() {}\n',
    },
  );
  try {
    const target = await detectCrateTargets(dir);
    assert.deepEqual(target.binaries.map((bin) => bin.name).sort(), ['demo', 'one', 'two']);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('cargo metadata targets are merged with the current filesystem', async () => {
  const dir = await fixture(
    `[package]
name = "demo"
version = "0.1.0"
edition = "2024"
`,
    { 'src/lib.rs': 'pub fn demo() {}\n', 'build/generated.rs': 'fn main() {}\n' },
  );
  try {
    const metadataPackage = {
      name: 'demo',
      targets: [{ kind: ['bin'], name: 'generated', src_path: path.join(dir, 'build', 'generated.rs') }],
    } as unknown as CargoPackage;
    const target = await detectCrateTargets(dir, { metadataPackage });
    assert.equal(target.fromMetadata, true);
    assert.equal(target.isBinary, true);
    assert.deepEqual(target.binaries.map((bin) => bin.name), ['generated']);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a newly added src/main.rs enables Run before metadata is refreshed', async () => {
  const dir = await fixture(
    `[package]
name = "demo"
version = "0.1.0"
edition = "2024"
`,
    { 'src/main.rs': 'fn main() {}\n' },
  );
  try {
    const staleMetadata = {
      name: 'demo',
      targets: [{ kind: ['lib'], name: 'demo', src_path: path.join(dir, 'src', 'lib.rs') }],
    } as unknown as CargoPackage;
    const target = await detectCrateTargets(dir, { metadataPackage: staleMetadata });
    assert.equal(target.isBinary, true);
    assert.deepEqual(target.binaries.map((bin) => bin.name), ['demo']);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

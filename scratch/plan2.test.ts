import { planMigration } from '../src/core/migration/plan.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = mkdtempSync(join(tmpdir(),'rf-'));
const toml = `[package]
name = "demo"
version = "0.3.0"
edition = "2021"

[dependencies]
shared = { path = "../shared" }
inner = { path = "vendor/inner" }
`;
const plan = planMigration({ packageName:'demo', rootManifestText: toml, readmeHandling:'keep', extractFields:['version'],
  workspaceRoot: root, packageDir: root, targetDir: join(root,'crates','demo') });
console.log(plan.memberManifest);
console.log('NOTES', plan.notes);

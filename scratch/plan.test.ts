import { planMigration } from '../src/core/migration/plan.js';
const toml = `# my crate
[package]
name = "demo"
version = "0.3.0"
edition = "2021"
rust-version = "1.80"
readme = "README.md"
license = "MIT"
description = "a demo"

[dependencies]
serde = { version = "1", features = ["derive"], optional = true }
anyhow = "1"
local = { path = "../shared" }

[dev-dependencies]
test-case = "3"
anyhow = "1"

[build-dependencies]
cc = "1"

[lints.clippy]
unwrap_used = "deny"
`;
const plan = planMigration({ packageName:'demo', rootManifestText: toml, readmeHandling:'keep', extractFields:['version','edition','rust-version','license'] });
console.log('=== root ==='); console.log(plan.workspaceManifest);
console.log('=== member ==='); console.log(plan.memberManifest);
console.log('=== promoted ===', plan.promoted.map(p=>p.name));
console.log('=== kept ===', plan.kept);
console.log('notes', plan.notes);

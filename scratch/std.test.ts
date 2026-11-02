import { analyzeStandardization, migrateLintsToWorkspace } from '../src/core/standardize.js';
const src = `[package]
name = "x"
version = "0.1.0"
edition = "2021"

[lints.clippy]
unwrap_used = "deny"

[lints.rust]
unsafe_code = "forbid"
`;
console.log(migrateLintsToWorkspace(src));

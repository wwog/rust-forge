import { planUpgrades, rewriteVersionValue, planInstall } from '../src/core/deps/write.js';
import { parseDependencies } from '../src/core/cargo/manifestDeps.js';
const text = `[package]
name = "a"
version = "0.1.0"

[dependencies]
serde = "1"          # json
anyhow = { version = "1.0", features = ["backtrace"] }
tokio = { version = "1", features = ["rt"], optional = true }
`;
const decls = parseDependencies(text, '/tmp/a/Cargo.toml');
const res = planUpgrades([{manifestPath:'/tmp/a/Cargo.toml', declaration: decls.find(d=>d.key==='serde')!, newRequirement:'1.0.229', targetVersion:'1.0.229'},
 {manifestPath:'/tmp/a/Cargo.toml', declaration: decls.find(d=>d.key==='anyhow')!, newRequirement:'^1.0.104', targetVersion:'1.0.104'},
 {manifestPath:'/tmp/a/Cargo.toml', declaration: decls.find(d=>d.key==='tokio')!, newRequirement:'^1.47.0', targetVersion:'1.47.0'}],
 new Map([['/tmp/a/Cargo.toml', text]]));
console.log(res.files.get('/tmp/a/Cargo.toml'));
console.log('specs', res.updateSpecs);
console.log('--- install ---');
const plan = planInstall({packageName:'regex', versionReq:'^1', table:'dependencies', features:['std'], workspaceMode:false, memberManifestPath:'/tmp/a/Cargo.toml', memberName:'a', workspaceManifestPath:'/tmp/ws/Cargo.toml', texts:new Map([['/tmp/a/Cargo.toml', text]])});
console.log(plan.files.get('/tmp/a/Cargo.toml'));
console.log('--- install ws ---');
const wsText = '[workspace]\nmembers = ["crates/*"]\n';
const wsPlan = planInstall({packageName:'regex', versionReq:'^1', table:'dependencies', workspaceMode:true, memberManifestPath:'/tmp/a/Cargo.toml', memberName:'a', workspaceManifestPath:'/tmp/ws/Cargo.toml', texts:new Map([['/tmp/a/Cargo.toml', text],['/tmp/ws/Cargo.toml', wsText]])});
console.log('ROOT:\n'+wsPlan.files.get('/tmp/ws/Cargo.toml'));
console.log('MEMBER:\n'+wsPlan.files.get('/tmp/a/Cargo.toml'));

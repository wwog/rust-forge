import { planInstall } from '../src/core/deps/write.js';
const before = `[package]\nname = "it-demo"\nversion = "0.4.0"\nedition = "2021"\n`;
const plan = planInstall({ packageName:'regex', versionReq:'^1', table:'dependencies', features:[], workspaceMode:true, memberManifestPath:'/tmp/x/Cargo.toml', memberName:'it-demo', workspaceManifestPath:'/tmp/x/Cargo.toml', texts:new Map([['/tmp/x/Cargo.toml', before]]) });
console.log('files:', [...plan.files.keys()]);
console.log(plan.files.get('/tmp/x/Cargo.toml'));
console.log(plan.notes);

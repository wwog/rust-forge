import { planConversion, applyConversion } from '../src/core/migration/execute.js';
import { SnapshotStore } from '../src/core/snapshot.js';
import { CargoService } from '../src/core/cargo/cargo.js';
async function main() {
const root = '/tmp/migtest';
const plan = await planConversion({ root, dryRun: true, gitCheck: true });
console.log('ok', plan.ok, 'issues', plan.issues.map(i=>i.id+':'+i.severity));
console.log('ops', plan.operations.map(o=>o.kind+' '+o.path));
console.log('refs', plan.hardCodedReferences);
console.log('=== root manifest preview ==='); console.log(plan.plan?.workspaceManifest);
console.log('=== member manifest preview ==='); console.log(plan.plan?.memberManifest);
const store = new SnapshotStore(root, '/tmp/migtest-snap');
await store.load();
const cargo = new CargoService();
const result = await applyConversion({ root, dryRun:false, gitCheck:true }, cargo, store);
console.log('APPLY', result.ok, result.error, result.warnings);
if (result.report) console.log(result.report.steps.map(s=>`${s.ok?'OK':'FAIL'} ${s.name}`).join('\n'));

}
main().catch(e=>{console.error(e);process.exit(1)});

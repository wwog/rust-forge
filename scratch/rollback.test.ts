import { rollbackLatest } from '../src/core/migration/execute.js';
import { SnapshotStore } from '../src/core/snapshot.js';
async function main(){
  const store = new SnapshotStore('/tmp/migtest', '/tmp/migtest-snap');
  await store.load();
  console.log('snapshots', store.list().map(s=>s.label));
  const r = await rollbackLatest(store);
  console.log('rollback', r.ok, r.restored, r.warnings);
  const store2 = new SnapshotStore('/tmp/migtest', '/tmp/migtest-snap');
  await store2.load();
  console.log('after', store2.list().length);
}
main();

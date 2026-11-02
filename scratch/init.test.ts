import { discoverProject, buildModel } from '../src/core/cargo/project.js';
async function main(){
  const d = await discoverProject('/tmp/rfdemo', { respectMembership: false });
  console.log('discover:', JSON.stringify({ error: d.error, model: d.model && { kind: d.model.kind, root: d.model.root, members: d.model.members.map(m=>m.name) } }, null, 1));
  const b = await buildModel('/tmp/rfdemo');
  console.log('build:', b.error, b.model?.kind);
}
main();

import * as fs from 'node:fs/promises';
import { buildModel } from '../src/core/cargo/project.js';
import { CargoService } from '../src/core/cargo/cargo.js';
import { readDependencies, readWorkspaceDependencies } from '../src/core/cargo/manifestDeps.js';
import { readLockfile } from '../src/core/cargo/lockfile.js';
import { RegistryClient } from '../src/core/deps/registry.js';
import { buildDependencyTree } from '../src/core/deps/tree.js';
import { readProperties, PACKAGE_PROPERTIES, WORKSPACE_PROPERTIES } from '../src/core/properties.js';
import { readRustfmtConfig, RUSTFMT_OPTIONS } from '../src/core/rustfmt.js';
import { analyzeStandardization } from '../src/core/standardize.js';
import { planConversion } from '../src/core/migration/execute.js';

async function main() {
  const root = process.env.RF_ROOT ?? '/tmp/rfdemo';
  const built = await buildModel(root);
  if (!built.model) throw new Error('no model');
  const model = built.model;
  const cargo = new CargoService();
  const meta = await cargo.metadata(root, { noDeps: true });
  const lock = await readLockfile(root);
  const declarations = [];
  for (const m of model.members) declarations.push({ member: m.name, manifestPath: m.manifestPath, deps: await readDependencies(m.manifestPath) });
  const registry = new RegistryClient({ timeoutMs: 9000 });
  const names = new Set(declarations.flatMap(d => d.deps.filter(x => x.kind === 'registry' || x.kind === 'workspace').map(x => x.packageName)));
  const registryData = new Map();
  for (const n of names) registryData.set(n, await registry.crate(n));
  const wsDeps = model.kind === 'workspace' ? await readWorkspaceDependencies(root) : [];
  const tree = buildDependencyTree({
    model, metadata: meta.metadata, declarations,
    workspaceDependencies: wsDeps.map(d => ({key:d.name, packageName:d.name, table:'dependencies', version:d.version, kind:d.kind==='registry'?'registry':d.kind==='path'?'path':d.kind==='git'?'git':'unknown', path:d.path, git:d.git, features:d.features, defaultFeatures:d.defaultFeatures, rawValue:d.rawValue, manifestPath: root+'/Cargo.toml', line:d.line})),
    lockfile: lock, registryData, registryDegraded: false, advisories: new Map(),
  });
  const props = await readProperties(model);
  const fmt = await readRustfmtConfig(root);
  const std = await analyzeStandardization(model);
  const conv = await planConversion({ root, dryRun: true });

  const rows: any[] = [];
  const visit = (n: any) => { if (n.upgrade && n.declaration) rows.push({ id:n.id, label:n.label, member:n.memberName, requirement:n.requirement, locked:n.lockedVersion, latest:n.latestVersion, classification:n.upgrade.classification, reason:n.upgrade.reason, features:n.features??[], optional:!!n.optional, advisories:[], registryUnavailable:!!n.registryUnavailable, isWorkspaceDependency:!!n.isWorkspaceDependency, table:n.table??'dependencies' }); (n.children??[]).forEach(visit); };
  visit(tree.root);

  const fixtures = {
    upgrade: { kind:'upgrade-panel', rows, registryDegraded:false, workspace:false },
    install: { kind:'install-panel', workspace:false, members:[{name:'rfdemo', manifestPath: root+'/Cargo.toml'}], defaultMember:'rfdemo', defaultTable:'dependencies' },
    properties: {
      kind:'properties-panel', workspace:false,
      packageProperties: props.packageProperties.map(p => { const d = PACKAGE_PROPERTIES.find(x=>x.key===p.key)!; return { key:p.key, label:d.label, description:d.description, type:d.type, value:p.value, inherited:p.inherited, workspaceValue:p.workspaceValue, location:p.location, values:d.values, placeholder:d.placeholder, risky:d.risky, memberValues:p.memberValues }; }),
      workspaceProperties: [],
      members:[{name:'rfdemo', manifestPath: root+'/Cargo.toml'}], activeMember:'rfdemo',
    },
    rustfmt: {
      kind:'rustfmt-panel', workspace:false, scope:'workspace', filePath: root+'/rustfmt.toml', fileExists: !!fmt, values: fmt?.values ?? {},
      options: RUSTFMT_OPTIONS.map(o => ({ key:o.key, label:o.label, description:o.description, type:o.type, value:(fmt?.values as any)?.[o.key], default:o.default, values:o.values, stable:o.stable, min:o.min, max:o.max, category:o.category })),
      memberScopeAvailable:false,
    },
    standardize: { kind:'standardize-panel', workspace:false, findings: std.findings.map(f => ({ id:f.id, title:f.title, description:f.description, fixable:f.fixable, diffs: f.changes.map(c => ({ path:c.path.replace(root+'/',''), diff:'', newContent:c.content, original:c.original })) })) },
    convert: {
      kind:'convert-panel', packageName:'rfdemo', targetDir: root+'/crates/rfdemo',
      issues: conv.issues, extractableFields: [ {key:'version',value:'0.1.0',defaultExtract:true,present:true}, {key:'edition',value:'2021',defaultExtract:true,present:true}, {key:'rust-version',value:'1.75',defaultExtract:true,present:true}, {key:'license',value:'MIT',defaultExtract:true,present:true}, {key:'description',value:'Rust Forge demo',defaultExtract:false,present:true} ],
      operations: conv.operations.map(o=>({kind:o.kind,path:o.path.replace(root+'/',''),to:o.to?.replace(root+'/',''),diff:o.diff})),
      promoted: conv.plan?.promoted.map(d=>({name:d.name,workspaceValue:d.workspaceValue,memberValue:d.memberValue,features:d.features})) ?? [],
      kept: conv.plan?.kept ?? [], hardCodedReferences: [], readmeHandling:'keep', canApply:true,
    },
    rollback: { kind:'rollback-panel', snapshots:[{ id:'1', label:'Convert to workspace', createdAt: Date.now(), files:2, moves:[{from:'Cargo.toml',to:'crates/rfdemo/Cargo.toml'},{from:'src',to:'crates/rfdemo/src'}] }] },
  };
  await fs.writeFile('/tmp/rf-fixtures.json', JSON.stringify(fixtures, null, 2));
  console.log('fixtures written; rows', rows.length, 'std findings', std.findings.length, 'ops', conv.operations.length);
}
main().catch(e=>{console.error(e);process.exit(1)});

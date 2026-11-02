import '@vscode-elements/elements/dist/bundled.js';
import { el, badge, banner, button, textfield, checkbox, select, switchRow, field, section, footer, diffBlock } from '../../src/webviews/client/dom.js';

const root = document.getElementById('root')!;
root.appendChild(el('h1', {}, 'Install dependency'));
root.appendChild(el('p', { class: 'subtitle' }, 'Search crates.io, choose a version constraint, then write it into the manifest.'));

const bar = el('div', { class: 'toolbar' });
bar.appendChild(textfield('serde', { placeholder: 'Search crates.io…' }));
bar.appendChild(button('Search', () => {}));
bar.appendChild(button('Cancel', () => {}, { secondary: true }));
root.appendChild(bar);

root.appendChild(section('Version constraint',
  select([{value:'^1',label:'^1 (default)'},{value:'=1.0.229',label:'=1.0.229'},{value:'*',label:'* (any)'}], '^1', ()=>{})
));
root.appendChild(section('Options',
  switchRow('Optional dependency', 'Exposed as a feature of this crate.', true, ()=>{}),
  switchRow('Disable default features', 'Disables the crate default feature set.', false, ()=>{}),
));
root.appendChild(section('Results',
  el('div', {class:'search-result selected'}, el('span',{class:'name'},'serde'), el('span',{class:'desc'},'A generic serialization/deserialization framework'), badge('1.0.229','accent')),
  el('div', {class:'search-result'}, el('span',{class:'name'},'serde_json'), el('span',{class:'desc'},'A JSON serialization file format'), badge('1.0.149','accent')),
));
root.appendChild(section('Dependencies',
  el('div',{class:'card'}, el('div',{class:'card-title'},'serde', badge('safe','safe'), badge('⚠ 1','danger')),
    el('div',{class:'card-meta'}, el('span',{class:'mono'},'^1.0.228'), el('span',{},'→ 1.0.229'), el('span',{},'features: derive, rc'))),
  banner('warning', el('div',{},'Cargo.lock is out of date; the upgrade will run cargo update.')),
));
root.appendChild(diffBlock('--- Cargo.toml\n+++ Cargo.toml\n@@ -1,4 +1,4 @@\n [package]\n-version = "0.1.0"\n+version = "0.2.0"'));
root.appendChild(footer(el('span',{class:'hint'},'Writes Cargo.toml and runs cargo check.'), el('div',{class:'spacer'}), button('Install', ()=>{}), button('Cancel', ()=>{}, {secondary:true})));

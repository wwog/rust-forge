import { generateRustfmtToml, applyRustfmtEdits, unstableOptionsWithoutFlag } from '../src/core/rustfmt.js';
console.log(generateRustfmtToml({edition:'2021', includeImportsGranularity:true}));
console.log('=== edits ===');
const base = generateRustfmtToml({edition:'2021'});
console.log(applyRustfmtEdits(base, [{key:'max_width', value:120},{key:'edition', value:'2024'},{key:'reorder_imports', value:false}]));
console.log('=== add new ===');
console.log(applyRustfmtEdits('# my config\nmax_width = 90\n', [{key:'tab_spaces', value:2}]));
console.log('=== remove ===');
console.log(applyRustfmtEdits('# my config\nmax_width = 90\ntab_spaces = 2\n', [{key:'tab_spaces', value:undefined}]));

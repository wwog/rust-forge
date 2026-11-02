import { parseVersionReq, rewriteRequirement, classifyUpgrade } from '../src/core/deps/versions.js';
for (const r of ['1','1.2','1.2.3','^1.2','~1.2.3','=1.2.3','>=1.2, <2','*','0.3','1.*']) {
  const p = parseVersionReq(r);
  console.log(r, '->', p.kind, p.range, '| min', p.minVersion, '| rewrite 1.5.0 =>', rewriteRequirement(p,'1.5.0'));
}
console.log('---');
for (const input of [
  {declared:'1', locked:'1.0.228', latest:'1.0.229'},
  {declared:'1.0.228', locked:'1.0.228', latest:'1.0.229'},
  {declared:'1.2', locked:'1.2.0', latest:'2.0.0'},
  {declared:'=1.0.0', locked:'1.0.0', latest:'1.0.1'},
  {declared:'>=1, <2', locked:'1.4.0', latest:'1.6.0'},
  {declared:'0.3', locked:'0.3.36', latest:'0.3.47'},
  {declared:'0.2', locked:'0.2.1', latest:'0.3.0'},
]) console.log(JSON.stringify(input), '=>', JSON.stringify(classifyUpgrade(input)));

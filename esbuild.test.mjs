import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/test/suite/runTest.ts'],
  outfile: 'dist/test/runTest.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['vscode', '@vscode/test-electron'],
  logLevel: 'info',
});
await esbuild.build({
  entryPoints: ['src/test/suite/index.ts'],
  outfile: 'dist/test/suite/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['vscode'],
  logLevel: 'info',
});

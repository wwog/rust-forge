import * as esbuild from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const extensionOptions = {
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['vscode'],
  sourcemap: watch,
  minify: !watch,
  logLevel: 'info',
};

/** @type {import('esbuild').BuildOptions} */
const webviewOptions = {
  entryPoints: ['src/webviews/client/app.ts'],
  outfile: 'dist/webview.js',
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'iife',
  sourcemap: watch,
  minify: !watch,
  logLevel: 'info',
};

async function copyAssets() {
  await mkdir('dist', { recursive: true });
  await copyFile('src/webviews/client/style.css', 'dist/webview.css');
}

if (watch) {
  const [ext, web] = await Promise.all([
    esbuild.context(extensionOptions),
    esbuild.context(webviewOptions),
  ]);
  await Promise.all([ext.watch(), web.watch()]);
  await copyAssets();
  console.log('[watch] building extensions...');
} else {
  await Promise.all([esbuild.build(extensionOptions), esbuild.build(webviewOptions)]);
  await copyAssets();
}

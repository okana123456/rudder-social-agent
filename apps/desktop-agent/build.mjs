import { build } from 'esbuild';
import { fileURLToPath, URL } from 'node:url';
await build({
  entryPoints: [fileURLToPath(new URL('src/main.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: fileURLToPath(new URL('dist/main.cjs', import.meta.url)),
  external: ['electron'],
  target: 'node22',
  minify: true,
});

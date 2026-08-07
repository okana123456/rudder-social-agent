import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
const watch = process.argv.includes('--watch');
await rm(new URL('dist', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('dist', import.meta.url), { recursive: true });
const options = {
  entryPoints: ['background', 'content', 'popup', 'options'].map((name) => ({
    in: fileURLToPath(new URL(`src/${name}.ts`, import.meta.url)),
    out: name,
  })),
  bundle: true,
  outdir: fileURLToPath(new URL('dist', import.meta.url)),
  format: 'iife',
  target: 'chrome120',
  sourcemap: watch,
  minify: !watch,
};
if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else await build(options);
for (const file of ['manifest.json', 'popup.html', 'options.html', 'styles.css'])
  await cp(new URL(`public/${file}`, import.meta.url), new URL(`dist/${file}`, import.meta.url));

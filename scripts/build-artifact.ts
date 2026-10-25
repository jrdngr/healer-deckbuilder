// `npm run build:artifact` — bundle the whole game into ONE self-contained HTML file
// that can be published as a Claude Artifact and played on a phone.
//
// An Artifact page runs under a strict CSP: scripts load only from a few CDNs and
// stylesheets only from Google Fonts, so every byte of our JS and CSS has to be inline.
// Vite builds in memory with code-splitting off; this script then writes the single JS
// chunk and the single CSS asset inline into one page.
//
// Output: dist-artifact/bandage-of-brothers.html (see artifact-page.ts for its shape).
import { build } from 'vite';
import type { Rollup } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleArtifactPage } from './artifact-page';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = resolve(ROOT, 'dist-artifact', 'bandage-of-brothers.html');
const TITLE = 'Bandage of Brothers';

const result = await build({
  root: ROOT,
  logLevel: 'warn',
  build: {
    write: false,
    // Everything (fonts excepted, which come from Google Fonts) is inlined as data: URIs.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

const outputs = (Array.isArray(result) ? result : [result]) as Rollup.RollupOutput[];
const files = outputs.flatMap((o) => o.output);
const chunks = files.filter((f): f is Rollup.OutputChunk => f.type === 'chunk');
const css = files.filter((f): f is Rollup.OutputAsset => f.type === 'asset' && f.fileName.endsWith('.css'));
const html = files.find((f): f is Rollup.OutputAsset => f.type === 'asset' && f.fileName.endsWith('.html'));
const stray = files.filter((f) => f !== html && !chunks.includes(f as Rollup.OutputChunk) && !css.includes(f as Rollup.OutputAsset));

if (!html) throw new Error('vite produced no index.html');
if (chunks.length !== 1) throw new Error(`expected one JS chunk, got ${chunks.length}: ${chunks.map((c) => c.fileName).join(', ')}`);
if (stray.length) throw new Error(`assets that would not be inlined: ${stray.map((f) => f.fileName).join(', ')}`);

const js = chunks[0].code;
const styles = css.map((a) => String(a.source)).join('\n');

// The favicon <link> is the only head element worth keeping: the viewport meta is the
// host's, and the hashed script/stylesheet tags are replaced by the inline copies.
const favicon = String(html.source).match(/<link rel="icon"[^>]*>/)?.[0] ?? '';

const page = assembleArtifactPage({ title: TITLE, css: styles, js, head: favicon });

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, page);
console.log(`wrote ${OUT_FILE.slice(ROOT.length + 1)} (${(page.length / 1024).toFixed(0)} KB)`);

// The single-file Artifact page (scripts/artifact-page.ts). Run with:
// tsx test/artifact-page.test.ts (part of npm test).
import { JSDOM } from 'jsdom';
import { assembleArtifactPage } from '../scripts/artifact-page';
import { check, eq, finish } from './harness';

// Bundled code really does contain these sequences: React DOM and the content
// templates carry `</script>`-like strings, and one unescaped occurrence would end the
// inline <script> early and leave the page blank.
const js = 'window.__ran = "a</script><b>" + "</SCRIPT>".length;';
const css = '.x::after { content: "</style>"; } .y { color: red; }';
const page = assembleArtifactPage({ title: 'Bandage of Brothers', css, js, head: '<link rel="icon" href="data:,">' });

{
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${page}</body></html>`, { runScripts: 'outside-only' });
  const doc = dom.window.document;
  const scripts = doc.querySelectorAll('script');
  eq('the page carries exactly one script', scripts.length, 1);
  eq('a `</script` inside the JS does not end the script element', scripts[0]?.textContent?.includes('.length;'), true);
  dom.window.eval(scripts[0]!.textContent!);
  eq('the escaped JS still evaluates to the original strings',
    (dom.window as unknown as { __ran: string }).__ran, 'a</script><b>9');
  const styles = doc.querySelectorAll('style');
  eq('the page carries exactly one stylesheet', styles.length, 1);
  check('a `</style` inside the CSS does not end the style element', styles[0]?.textContent?.includes('.y { color: red; }') ?? false);
  eq('the title is the game name', doc.title, 'Bandage of Brothers');
  check('the #root mount precedes the script', !!doc.querySelector('#root + script'));
}

// The host supplies the document skeleton; a second one would nest documents.
check('the page has no doctype/html/head/body of its own', !/<!doctype|<html|<head|<body/i.test(page));

finish('artifact-page');

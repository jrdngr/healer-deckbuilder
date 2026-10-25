// Pure assembly of the single-file Artifact page, split from build-artifact.ts so the
// escaping rules can be tested without running a Vite build.
//
// The Artifact host wraps the file in its own <!doctype>/<html>/<head>/<body> skeleton,
// so the page is CONTENT only: <title>, <style>, the #root mount and the script.

export interface ArtifactPageParts {
  title: string;
  css: string;
  js: string;
  // Extra head markup kept from Vite's index.html (the inline favicon).
  head?: string;
}

// An inline <script> ends at the first `</script` anywhere in its text, including
// inside a JS string; `<\/script` means the same thing to JS and nothing to HTML.
// Same for `</style` inside a stylesheet.
export const escapeInlineScript = (js: string): string => js.replace(/<\/(script)/gi, '<\\/$1');
export const escapeInlineStyle = (css: string): string => css.replace(/<\/(style)/gi, '<\\/$1');

export function assembleArtifactPage({ title, css, js, head = '' }: ArtifactPageParts): string {
  return [
    `<title>${title}</title>`,
    head,
    // The game ships one deliberate light look; pin it so a dark host leaves form
    // controls and scrollbars alone.
    '<meta name="color-scheme" content="light">',
    `<style>\n${escapeInlineStyle(css)}\n</style>`,
    '<div id="root"></div>',
    // Module scripts are deferred, so #root exists by the time this runs.
    `<script type="module">\n${escapeInlineScript(js)}\n</script>`,
    '',
  ].filter((line, i, all) => line !== '' || i === all.length - 1).join('\n');
}

// Minimal zero-dependency static file server so ES modules load over http.
// Usage: node server.js  (then open http://localhost:8080)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = process.env.PORT || 8080;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/markdown',
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    if (path === '/') path = '/index.html';
    const filePath = normalize(join(ROOT, path));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, () => console.log(`Healer Deckbuilder running at http://localhost:${PORT}`));

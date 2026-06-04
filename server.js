/* Minimal zero-dependency static file server for the Yardi Voyager clone. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

/* Shared ledger store: a single JSON file every browser reads/writes through
   the API below. This is what makes uploaded data visible to ALL browsers
   (including a fresh Playwright Chromium) instead of being trapped in one
   browser's localStorage. */
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'bankrec.json');

function sendJson(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function handleBankRecApi(req, res) {
  if (req.method === 'GET') {
    return fs.readFile(DATA_FILE, 'utf8', (e, txt) => sendJson(res, 200, e ? 'null' : txt));
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 8e6) req.destroy(); });   // 8 MB guard
    req.on('end', () => {
      try { JSON.parse(body); } catch (ex) { return sendJson(res, 400, '{"error":"invalid json"}'); }
      fs.mkdir(DATA_DIR, { recursive: true }, () => {
        fs.writeFile(DATA_FILE, body, (we) => we ? sendJson(res, 500, '{"error":"write failed"}') : sendJson(res, 200, '{"ok":true}'));
      });
    });
    return;
  }
  if (req.method === 'DELETE') {
    return fs.unlink(DATA_FILE, () => sendJson(res, 200, '{"ok":true}'));
  }
  return sendJson(res, 405, '{"error":"method not allowed"}');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject', '.map': 'application/json'
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/api/bankrec') return handleBankRecApi(req, res);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
    // prevent path traversal
    let filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

    fs.stat(filePath, (err, stat) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404 Not Found: ' + urlPath); }
      if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
      fs.readFile(filePath, (e, data) => {
        if (e) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404 Not Found'); }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
    });
  } catch (ex) {
    res.writeHead(500); res.end('Server error');
  }
});

server.listen(PORT, () => {
  console.log('Yardi Voyager clone running at  http://localhost:' + PORT + '/');
});

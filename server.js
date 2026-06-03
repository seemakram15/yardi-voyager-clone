/* Minimal zero-dependency static file server for the Yardi Voyager clone. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

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

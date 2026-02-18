const http = require('http');
const fs = require('fs');
const path = require('path');

const host = '0.0.0.0';
const port = Number(process.env.PORT) || 8000;
const root = __dirname;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function safeJoin(base, target) {
  const targetPath = path.posix.normalize(target).replace(/^\/+/, '');
  const resolved = path.resolve(base, targetPath);
  return resolved.startsWith(base) ? resolved : null;
}

function sendFile(filePath, res) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const requestPath = req.url ? req.url.split('?')[0] : '/';
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const candidatePath = safeJoin(root, normalizedPath);

  if (!candidatePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(candidatePath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(candidatePath, res);
      return;
    }

    const fallbackIndex = path.join(root, 'index.html');
    fs.stat(fallbackIndex, (indexError, indexStats) => {
      if (!indexError && indexStats.isFile()) {
        sendFile(fallbackIndex, res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    });
  });
});

server.listen(port, host, () => {
  console.log(`Kanban dashboard running at http://localhost:${port}`);
});

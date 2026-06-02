const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'web-build');
const portArgIndex = process.argv.indexOf('--port');
const port = Number(process.env.PORT || (portArgIndex >= 0 ? process.argv[portArgIndex + 1] : 19007));

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
};

const sendFile = (res, filePath) => {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const normalizedPath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    const requestedPath = path.join(root, normalizedPath);
    const filePath = requestedPath.startsWith(root) && fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()
      ? requestedPath
      : path.join(root, 'index.html');

    sendFile(res, filePath);
  })
  .listen(port, () => {
    console.log(`JOIN web build running at http://localhost:${port}`);
  });

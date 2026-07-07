const http = require('http');

const PORT = Number(process.env.JOIN_PROXY_PORT || 19100);
const FRONTEND_ORIGIN = process.env.JOIN_FRONTEND_ORIGIN || 'http://localhost:19007';
const BACKEND_ORIGIN = process.env.JOIN_BACKEND_ORIGIN || 'http://localhost:4000';

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
};

const proxyRequest = (req, res, targetOrigin) => {
  const targetUrl = new URL(req.url || '/', targetOrigin);
  const headers = { ...req.headers, host: targetUrl.host };

  const proxy = http.request(
    targetUrl,
    {
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxy.on('error', (error) => {
    sendJson(res, 502, {
      message: 'JOIN dev proxy could not reach local service.',
      target: targetOrigin,
      error: error.message,
    });
  });

  req.pipe(proxy);
};

const server = http.createServer((req, res) => {
  const requestUrl = req.url || '/';

  if (requestUrl.startsWith('/runtime-config.json')) {
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
    const proto = req.headers['x-forwarded-proto'] || (String(host).includes('trycloudflare.com') ? 'https' : 'http');
    return sendJson(res, 200, {
      apiUrl: `${proto}://${host}`,
    });
  }

  if (requestUrl.startsWith('/api/')) {
    return proxyRequest(req, res, BACKEND_ORIGIN);
  }

  return proxyRequest(req, res, FRONTEND_ORIGIN);
});

server.listen(PORT, () => {
  console.log(`JOIN dev proxy running on http://localhost:${PORT}`);
  console.log(`Frontend -> ${FRONTEND_ORIGIN}`);
  console.log(`Backend  -> ${BACKEND_ORIGIN}`);
});

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '7529', 10);
const apiTarget = process.env.API_INTERNAL_URL || 'http://localhost:7530';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function proxyHttpRequest(req, res) {
  const parsedTarget = new URL(apiTarget);
  const options = {
    hostname: parsedTarget.hostname,
    port: parsedTarget.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: parsedTarget.host },
  };

  const proxyReq = require('http').request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway', message: 'API server unavailable' }));
    }
  });

  req.pipe(proxyReq, { end: true });
}

function proxyWebSocket(req, socket, head) {
  const parsedTarget = new URL(apiTarget);
  const options = {
    hostname: parsedTarget.hostname,
    port: parsedTarget.port,
    path: req.url,
    method: 'GET',
    headers: {
      ...req.headers,
      host: parsedTarget.host,
      connection: 'upgrade',
      upgrade: 'websocket',
    },
  };

  const proxyReq = require('http').request(options);

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    proxySocket.on('error', () => {
      try { socket.destroy(); } catch {}
    });
    socket.on('error', () => {
      try { proxySocket.destroy(); } catch {}
    });

    let responseHeaders = 'HTTP/1.1 101 Switching Protocols\r\n';
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      responseHeaders += `${key}: ${value}\r\n`;
    }
    responseHeaders += '\r\n';
    socket.write(responseHeaders);

    if (proxyHead && proxyHead.length > 0) {
      socket.write(proxyHead);
    }

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on('error', () => {
    try { socket.destroy(); } catch {}
  });

  proxyReq.end();
}

function isApiPath(pathname) {
  return pathname.startsWith('/api/') ||
    pathname === '/health' ||
    pathname === '/ready' ||
    pathname === '/live';
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const pathname = parsedUrl.pathname;

    if (isApiPath(pathname)) {
      proxyHttpRequest(req, res);
      return;
    }

    handle(req, res, parsedUrl);
  });

  server.on('upgrade', (req, socket, head) => {
    const parsedUrl = parse(req.url, true);
    const pathname = parsedUrl.pathname;

    if (pathname.startsWith('/ws') || pathname.startsWith('/api/v1/ws')) {
      proxyWebSocket(req, socket, head);
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Paracosm Web ready on http://${hostname}:${port}`);
    console.log(`> API proxy target: ${apiTarget}`);
  });
});

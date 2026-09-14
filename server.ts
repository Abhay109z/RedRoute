import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './backend/routes.js';
import { wsHub } from './backend/websocket.js';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  // Security & standard headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  // Body parser
  app.use(express.json());

  // Remote backend target
  const BACKEND_URL = (process.env.BACKEND_URL || 'https://redroute-tqew.onrender.com').replace(/\/+$/, '');

  // Cloud Run / container orchestration health probes (direct root access)
  app.get(['/health', '/healthz'], (req, res) => {
    res.status(200).json({
      status: 'healthy',
      app: 'RedRoute',
      backendTarget: BACKEND_URL,
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Proxy API requests to the Render backend service: https://redroute-tqew.onrender.com
  app.use('/api', async (req, res, next) => {
    const targetUrl = `${BACKEND_URL}/api${req.url.startsWith('/') ? req.url : '/' + req.url}`;
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'] as string;
      if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'] as string;

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = JSON.stringify(req.body);
        if (!headers['content-type']) headers['content-type'] = 'application/json';
      }

      const remoteRes = await fetch(targetUrl, fetchOptions);
      res.status(remoteRes.status);
      remoteRes.headers.forEach((val, key) => {
        if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
          res.setHeader(key, val);
        }
      });
      const data = await remoteRes.text();
      return res.send(data);
    } catch (err: any) {
      console.warn(`[RedRoute] Remote backend (${targetUrl}) request failed, using local router fallback:`, err.message);
      return next();
    }
  });

  // Local fallback routes if remote proxy encounters an error
  app.use('/api', apiRouter);

  // Initialize Real-time WebSocket Hub on the same port
  wsHub.init(server);

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[RedRoute] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[RedRoute] WebSockets active on ws://0.0.0.0:${PORT}/ws`);
  });

  // Graceful shutdown handling for Cloud Run & container orchestrators
  const handleShutdown = (signal: string) => {
    console.log(`[RedRoute] Received ${signal}. Draining connections for graceful shutdown...`);
    server.close(() => {
      console.log('[RedRoute] HTTP & WebSocket servers closed successfully.');
      process.exit(0);
    });
    // Force shutdown after 10s if connections fail to drain
    setTimeout(() => {
      console.error('[RedRoute] Forcing shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[RedRoute] Failed to start server:', err);
  process.exit(1);
});

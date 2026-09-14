import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './backend/routes.js';
import { wsHub } from './backend/websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Cloud Run / container orchestration health probes (direct root access)
  app.get(['/health', '/healthz'], (req, res) => {
    res.status(200).json({
      status: 'healthy',
      app: 'RedRoute',
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Mount Backend API routes
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

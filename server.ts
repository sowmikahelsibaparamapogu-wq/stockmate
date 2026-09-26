import express from 'express';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/api.ts';
import { seedInitialDatabase } from './src/db/seed.ts';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Graceful process error handlers to prevent unhandled crashes
process.on('unhandledRejection', (reason) => {
  console.warn('[Server] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
});

async function startServer() {
  const app = express();

  // Support both CLI arguments (--port 3000, --host 0.0.0.0) and environment variables
  const portArgIndex = process.argv.indexOf('--port');
  const port =
    portArgIndex !== -1 && process.argv[portArgIndex + 1]
      ? parseInt(process.argv[portArgIndex + 1], 10)
      : process.env.PORT
        ? parseInt(process.env.PORT, 10)
        : 3000;

  const hostArgIndex = process.argv.indexOf('--host');
  const host =
    hostArgIndex !== -1 && process.argv[hostArgIndex + 1]
      ? process.argv[hostArgIndex + 1]
      : process.env.HOST || '0.0.0.0';

  // Immediate health check routes so health probes and proxies succeed instantly
  app.get(['/api/health', '/health', '/healthz'], (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Non-blocking initial database seed with readiness promise
  let dbReady = false;
  const seedPromise = seedInitialDatabase()
    .then(() => {
      dbReady = true;
      console.log('[Server] Database initialization completed.');
    })
    .catch((err) => {
      console.error('[Server] Database seed error:', err);
      dbReady = true; // allow requests to proceed even if seed had partial issues
    });

  // Versioned REST API with DB readiness check
  app.use(
    '/api/v1',
    async (req, res, next) => {
      if (!dbReady) {
        await seedPromise;
      }
      next();
    },
    apiRouter
  );

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  // Bind server immediately to ensure port is open and responsive to health checks
  app.listen(port, host, () => {
    console.log(`StockSense server running on http://${host}:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});

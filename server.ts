import express from 'express';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/api.ts';
import { seedInitialDatabase } from './src/db/seed.ts';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Seed initial data if tables are empty
  await seedInitialDatabase();

  // Versioned REST API
  app.use('/api/v1', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`StockSense server running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});

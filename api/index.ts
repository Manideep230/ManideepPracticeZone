import express from 'express';
import cors from 'cors';
import { createAuthRouter } from '../server/src/routes/auth.js';
import { createExecuteRouter } from '../server/src/routes/execute.js';
import { createDatabaseRouter } from '../server/src/routes/database.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Mount API routes
app.use('/api', createAuthRouter());
app.use('/api', createExecuteRouter());
app.use('/api', createDatabaseRouter());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', storage: 'MongoDB Atlas', mode: 'Vercel Serverless Function' });
});

export default function handler(req: any, res: any) {
  return app(req, res);
}

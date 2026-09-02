import express from 'express';
import cors from 'cors';
import { createAuthRouter } from './routes/auth';
import { createExecuteRouter } from './routes/execute';
import { createDatabaseRouter } from './routes/database';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Mount routers
app.use('/api', createAuthRouter());
app.use('/api', createExecuteRouter());
app.use('/api', createDatabaseRouter());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', storage: 'MongoDB Atlas', mode: 'Serverless Ready' });
});

// Run local dev server if executed directly
if (process.env.NODE_ENV !== 'production' && (!process.env.VERCEL || process.env.VERCEL !== '1')) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`\n🚀 Manideep Practice Zone Server running on http://localhost:${PORT}`);
    console.log(`   MongoDB Atlas Connection Pooled\n`);
  });
}

export default app;

import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { queryRouter } from './routes/query.js';
import { schemaRouter } from './routes/schema.js';
import { graphRouter } from './routes/graph.js';
import { connectionRouter } from './routes/connection.js';
import { errorHandler } from './middleware/errorHandler.js';
import { connectionFromHeaders } from './middleware/connectionFromHeaders.js';

const app = express();

app.use(cors({
  origin: config.frontendOrigin,
  allowedHeaders: ['Content-Type', 'X-Neo4j-Uri', 'X-Neo4j-Username', 'X-Neo4j-Password', 'X-Neo4j-Database'],
}));
app.use(express.json());

// Attach the right Neo4j client to every request based on optional headers/body
app.use('/api', connectionFromHeaders);

// Rate limiting — 120 requests per minute per IP on query-heavy endpoints
const queryLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down', code: 'RATE_LIMITED' },
});
app.use('/api/query', queryLimiter);
app.use('/api/graph', queryLimiter);

app.use('/api/health', healthRouter);
app.use('/api/query', queryRouter);
app.use('/api/schema', schemaRouter);
app.use('/api/graph', graphRouter);
app.use('/api/connection', connectionRouter);
// /api/node/:id and /api/neighbors/:id are registered on graphRouter
app.use('/api', graphRouter);

// Serve frontend static files in production
if (process.env['NODE_ENV'] === 'production') {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const frontendDist = resolve(__dirname, '../../../packages/frontend/dist');
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (_req, res) => {
      res.sendFile(join(frontendDist, 'index.html'));
    });
  }
}

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`GraphView backend running on http://localhost:${config.port}`);
  console.log(`Neo4j target: ${config.neo4j.url}/db/${config.neo4j.database}`);
});

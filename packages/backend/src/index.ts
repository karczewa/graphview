import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { queryRouter } from './routes/query.js';
import { schemaRouter } from './routes/schema.js';
import { graphRouter } from './routes/graph.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/query', queryRouter);
app.use('/api/schema', schemaRouter);
app.use('/api/graph', graphRouter);
// /api/node/:id and /api/neighbors/:id are registered on graphRouter
app.use('/api', graphRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`GraphView backend running on http://localhost:${config.port}`);
  console.log(`Neo4j target: ${config.neo4j.url}/db/${config.neo4j.database}`);
});

import express from 'express';
import cors from 'cors';
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

// Attach the right Neo4j client to every request based on optional headers
app.use('/api', connectionFromHeaders);

app.use('/api/health', healthRouter);
app.use('/api/query', queryRouter);
app.use('/api/schema', schemaRouter);
app.use('/api/graph', graphRouter);
app.use('/api/connection', connectionRouter);
// /api/node/:id and /api/neighbors/:id are registered on graphRouter
app.use('/api', graphRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`GraphView backend running on http://localhost:${config.port}`);
  console.log(`Neo4j target: ${config.neo4j.url}/db/${config.neo4j.database}`);
});

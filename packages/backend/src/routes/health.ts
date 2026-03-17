import { Router } from 'express';
import { neo4jClient } from '../services/neo4jClient.js';
import type { HealthResponse } from '../types.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const neo4jConnected = await neo4jClient.ping();
  const body: HealthResponse = { status: 'ok', neo4jConnected };
  res.json(body);
});

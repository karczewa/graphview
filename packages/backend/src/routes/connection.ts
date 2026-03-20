import { Router } from 'express';
import type { Neo4jClient } from '../services/neo4jClient.js';

export const connectionRouter = Router();

// POST /api/connection/test — validate the credentials supplied via headers
connectionRouter.post('/test', async (req, res, next) => {
  try {
    const client = res.locals['neo4jClient'] as Neo4jClient;
    const ok = await client.ping();
    if (ok) {
      res.json({ ok: true });
    } else {
      res.status(503).json({ ok: false, error: 'Could not connect to Neo4j' });
    }
  } catch (err) {
    next(err);
  }
});

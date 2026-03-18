import { Router } from 'express';
import { neo4jClient } from '../services/neo4jClient.js';
import { transformQueryResult } from '../services/graphTransformer.js';
import { config } from '../config.js';

export const graphRouter = Router();

// GET /api/graph?limit=100
graphRouter.get('/', async (req, res, next) => {
  try {
    const limitParam = parseInt(String(req.query['limit'] ?? config.queryMaxLimit), 10);
    const limit = isNaN(limitParam) ? config.queryMaxLimit : Math.min(limitParam, config.queryMaxLimit);

    const start = Date.now();
    const result = await neo4jClient.run(
      `MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m LIMIT ${limit}`,
    );
    const queryTimeMs = Date.now() - start;

    res.json(transformQueryResult(result, queryTimeMs));
  } catch (err) {
    next(err);
  }
});

// GET /api/node/:id
graphRouter.get('/node/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const start = Date.now();
    const result = await neo4jClient.run(
      'MATCH (n) WHERE elementId(n) = $id OPTIONAL MATCH (n)-[r]-(m) RETURN n, r, m',
      { id },
    );
    const queryTimeMs = Date.now() - start;

    const data = transformQueryResult(result, queryTimeMs);

    if (data.nodes.length === 0) {
      res.status(404).json({ error: `Node with id "${id}" not found`, code: 'NODE_NOT_FOUND' });
      return;
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/neighbors/:id?depth=1
graphRouter.get('/neighbors/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const depthParam = parseInt(String(req.query['depth'] ?? '1'), 10);
    const depth = isNaN(depthParam) || depthParam < 1 ? 1 : Math.min(depthParam, 5);

    const start = Date.now();
    const result = await neo4jClient.run(
      `MATCH (n) WHERE elementId(n) = $id
       MATCH path = (n)-[*1..${depth}]-(m)
       UNWIND relationships(path) AS r
       RETURN startNode(r) AS n, r, endNode(r) AS m`,
      { id },
    );
    const queryTimeMs = Date.now() - start;

    res.json(transformQueryResult(result, queryTimeMs));
  } catch (err) {
    next(err);
  }
});

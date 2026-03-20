import { Router } from 'express';
import type { Neo4jClient } from '../services/neo4jClient.js';
import { transformQueryResult } from '../services/graphTransformer.js';
import { config } from '../config.js';

export const queryRouter = Router();

queryRouter.post('/', async (req, res, next) => {
  try {
    const { cypher, params = {}, limit } = req.body as {
      cypher?: unknown;
      params?: unknown;
      limit?: unknown;
    };

    if (typeof cypher !== 'string' || !cypher.trim()) {
      res.status(400).json({ error: 'Request body must include a non-empty "cypher" string', code: 'VALIDATION_ERROR' });
      return;
    }

    if (params !== null && typeof params !== 'object' || Array.isArray(params)) {
      res.status(400).json({ error: '"params" must be an object', code: 'VALIDATION_ERROR' });
      return;
    }

    const resolvedLimit =
      typeof limit === 'number' ? Math.min(limit, config.queryMaxLimit) : config.queryMaxLimit;

    // Strip trailing semicolons — neo4j-driver treats them as statement separators
    const cleanCypher = cypher.trim().replace(/;+$/, '');

    const finalCypher = /\bLIMIT\b/i.test(cleanCypher)
      ? cleanCypher
      : `${cleanCypher} LIMIT ${resolvedLimit}`;

    const client = res.locals['neo4jClient'] as Neo4jClient;
    const start = Date.now();
    const result = await client.run(finalCypher, params as Record<string, unknown>);
    const queryTimeMs = Date.now() - start;

    res.json(transformQueryResult(result, queryTimeMs));
  } catch (err) {
    next(err);
  }
});

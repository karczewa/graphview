import { Router } from 'express';
import { neo4jClient } from '../services/neo4jClient.js';
import { transformGraphResponse } from '../services/graphTransformer.js';
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

    const resolvedLimit = typeof limit === 'number' ? Math.min(limit, config.queryMaxLimit) : config.queryMaxLimit;

    // Append LIMIT if not already in the query
    const finalCypher = /\bLIMIT\b/i.test(cypher)
      ? cypher
      : `${cypher.trimEnd()} LIMIT ${resolvedLimit}`;

    const start = Date.now();
    const raw = await neo4jClient.query(finalCypher, params as Record<string, unknown>);
    const queryTimeMs = Date.now() - start;

    res.json(transformGraphResponse(raw, queryTimeMs));
  } catch (err) {
    next(err);
  }
});

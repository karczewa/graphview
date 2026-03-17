import { Router } from 'express';
import { neo4jClient } from '../services/neo4jClient.js';
import { extractStringColumn } from '../services/graphTransformer.js';
import type { SchemaResponse } from '../types.js';

export const schemaRouter = Router();

// Simple in-memory cache with 60s TTL
let cache: { data: SchemaResponse; expiresAt: number } | null = null;

schemaRouter.get('/', async (_req, res, next) => {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      res.json(cache.data);
      return;
    }

    const [labelsRaw, relTypesRaw, nodePropRaw, relPropRaw] = await Promise.all([
      neo4jClient.query('CALL db.labels() YIELD label RETURN label', {}, ['row']),
      neo4jClient.query('CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType', {}, ['row']),
      neo4jClient.query(
        'MATCH (n) UNWIND labels(n) AS lbl UNWIND keys(n) AS key RETURN DISTINCT lbl, key',
        {},
        ['row'],
      ),
      neo4jClient.query(
        'MATCH ()-[r]-() UNWIND keys(r) AS key RETURN DISTINCT type(r) AS t, key',
        {},
        ['row'],
      ),
    ]);

    const nodeLabels = extractStringColumn(labelsRaw, 0);
    const relationshipTypes = extractStringColumn(relTypesRaw, 0);

    const propertyKeys: Record<string, string[]> = {};

    for (const result of nodePropRaw.results) {
      for (const row of result.data) {
        const lbl = row.row?.[0];
        const key = row.row?.[1];
        if (typeof lbl === 'string' && typeof key === 'string') {
          (propertyKeys[lbl] ??= []).push(key);
        }
      }
    }

    for (const result of relPropRaw.results) {
      for (const row of result.data) {
        const t = row.row?.[0];
        const key = row.row?.[1];
        if (typeof t === 'string' && typeof key === 'string') {
          (propertyKeys[t] ??= []).push(key);
        }
      }
    }

    const data: SchemaResponse = { nodeLabels, relationshipTypes, propertyKeys };
    cache = { data, expiresAt: Date.now() + 60_000 };

    res.json(data);
  } catch (err) {
    next(err);
  }
});

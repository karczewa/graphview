import { Router } from 'express';
import type { Neo4jClient } from '../services/neo4jClient.js';
import type { SchemaResponse } from '../types.js';

export const schemaRouter = Router();

let cache: { data: SchemaResponse; expiresAt: number } | null = null;

// POST /api/schema/invalidate — flush the schema cache
schemaRouter.post('/invalidate', (_req, res) => {
  cache = null;
  res.json({ ok: true });
});

schemaRouter.get('/', async (_req, res, next) => {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      res.json(cache.data);
      return;
    }

    const client = res.locals['neo4jClient'] as Neo4jClient | undefined;
    if (!client) { res.status(500).json({ error: 'Neo4j client not initialised', code: 'INTERNAL_ERROR' }); return; }
    const [labelsResult, relTypesResult, nodePropResult, relPropResult] = await Promise.all([
      client.run('CALL db.labels() YIELD label RETURN label'),
      client.run('CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType'),
      client.run('MATCH (n) UNWIND labels(n) AS lbl UNWIND keys(n) AS key RETURN DISTINCT lbl, key'),
      client.run('MATCH ()-[r]-() UNWIND keys(r) AS key RETURN DISTINCT type(r) AS t, key'),
    ]);

    const nodeLabels = labelsResult.records.map((r) => r.get('label') as string);
    const relationshipTypes = relTypesResult.records.map((r) => r.get('relationshipType') as string);

    const propertyKeys: Record<string, string[]> = {};

    for (const record of nodePropResult.records) {
      const lbl = record.get('lbl') as string;
      const key = record.get('key') as string;
      (propertyKeys[lbl] ??= []).push(key);
    }

    for (const record of relPropResult.records) {
      const t = record.get('t') as string;
      const key = record.get('key') as string;
      (propertyKeys[t] ??= []).push(key);
    }

    const data: SchemaResponse = { nodeLabels, relationshipTypes, propertyKeys };
    cache = { data, expiresAt: Date.now() + 60_000 };

    res.json(data);
  } catch (err) {
    next(err);
  }
});

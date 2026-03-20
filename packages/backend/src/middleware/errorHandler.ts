import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { Neo4jError } from '../services/neo4jClient.js';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof Neo4jError) {
    const status = err.statusCode ?? 502;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof Error) {
    console.error('[GraphView] Internal error:', err);
    res.status(500).json({ error: 'An internal server error occurred', code: 'INTERNAL_ERROR' });
    return;
  }

  res.status(500).json({ error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' });
};

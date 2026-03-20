import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { getClientForCredentials } from '../services/neo4jClient.js';

/**
 * Reads optional connection headers sent by the frontend settings panel.
 * Falls back to env-var defaults when headers are absent.
 * Attaches the resolved Neo4jClient to res.locals.neo4jClient.
 */
export function connectionFromHeaders(req: Request, res: Response, next: NextFunction) {
  const url      = (req.headers['x-neo4j-uri']      as string | undefined) || config.neo4j.url;
  const username = (req.headers['x-neo4j-username'] as string | undefined) || config.neo4j.username;
  const password = (req.headers['x-neo4j-password'] as string | undefined) || config.neo4j.password;
  const database = (req.headers['x-neo4j-database'] as string | undefined) || config.neo4j.database;
  res.locals['neo4jClient'] = getClientForCredentials(url, username, password, database);
  next();
}

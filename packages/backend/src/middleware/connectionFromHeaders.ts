import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { getClientForCredentials } from '../services/neo4jClient.js';

/**
 * Resolves the Neo4j connection credentials for a request.
 *
 * For POST requests credentials may arrive in `req.body._neo4j` so that the
 * password is never sent as an HTTP header (where it would appear in access
 * logs). GET requests fall back to headers only (no body on GET).
 * All fields fall back to env-var defaults when absent.
 */
export function connectionFromHeaders(req: Request, res: Response, next: NextFunction) {
  const bodyConn = req.method !== 'GET'
    ? (req.body?._neo4j as { url?: string; username?: string; password?: string; database?: string } | undefined)
    : undefined;

  const url      = bodyConn?.url      || (req.headers['x-neo4j-uri']      as string | undefined) || config.neo4j.url;
  const username = bodyConn?.username || (req.headers['x-neo4j-username'] as string | undefined) || config.neo4j.username;
  const password = bodyConn?.password || (req.headers['x-neo4j-password'] as string | undefined) || config.neo4j.password;
  const database = bodyConn?.database || (req.headers['x-neo4j-database'] as string | undefined) || config.neo4j.database;

  res.locals['neo4jClient'] = getClientForCredentials(url, username, password, database);
  next();
}

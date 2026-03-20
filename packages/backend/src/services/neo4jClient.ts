import neo4j, { type Driver, type QueryResult } from 'neo4j-driver';
import { config } from '../config.js';

export class Neo4jError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'Neo4jError';
  }
}

export class Neo4jClient {
  private readonly driver: Driver;
  private readonly database: string;

  constructor(
    url     = config.neo4j.url,
    username = config.neo4j.username,
    password = config.neo4j.password,
    database = config.neo4j.database,
  ) {
    this.database = database;
    this.driver = neo4j.driver(
      url,
      neo4j.auth.basic(username, password),
      { connectionTimeout: config.requestTimeoutMs },
    );
  }

  async run(cypher: string, params: Record<string, unknown> = {}): Promise<QueryResult> {
    const session = this.driver.session({ database: this.database });
    try {
      return await session.run(cypher, params);
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message;
        if (msg.includes('authentication') || msg.includes('Unauthorized')) {
          throw new Neo4jError('Neo4j authentication failed — check credentials', 'NEO4J_AUTH_ERROR', 401);
        }
        if (msg.includes('timed out') || msg.includes('ECONNREFUSED')) {
          throw new Neo4jError(`Cannot connect to Neo4j at ${config.neo4j.url}`, 'NEO4J_CONNECTION_ERROR');
        }
        throw new Neo4jError(msg, (err as { code?: string }).code ?? 'NEO4J_ERROR');
      }
      throw new Neo4jError('Unknown Neo4j error', 'NEO4J_ERROR');
    } finally {
      await session.close();
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.run('RETURN 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}

// Default client from env vars
export const neo4jClient = new Neo4jClient();

// Cache drivers keyed by connection params so we don't reconnect on every request
const clientCache = new Map<string, Neo4jClient>();

export function getClientForCredentials(
  url: string,
  username: string,
  password: string,
  database: string,
): Neo4jClient {
  // If credentials match defaults, reuse the singleton
  if (
    url === config.neo4j.url &&
    username === config.neo4j.username &&
    database === config.neo4j.database
  ) {
    return neo4jClient;
  }
  const key = `${url}::${username}::${database}`;
  if (!clientCache.has(key)) {
    clientCache.set(key, new Neo4jClient(url, username, password, database));
  }
  return clientCache.get(key)!;
}

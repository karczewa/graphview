import { config } from '../config.js';
import type { Neo4jRawResponse } from '../types.js';

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
  private readonly endpoint: string;
  private readonly authHeader: string;

  constructor() {
    this.endpoint = `${config.neo4j.url}/db/${config.neo4j.database}/tx/commit`;
    this.authHeader =
      'Basic ' +
      Buffer.from(`${config.neo4j.username}:${config.neo4j.password}`).toString('base64');
  }

  async query(
    cypher: string,
    params: Record<string, unknown> = {},
    resultDataContents: string[] = ['graph'],
  ): Promise<Neo4jRawResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: this.authHeader,
        },
        body: JSON.stringify({
          statements: [{ statement: cypher, parameters: params, resultDataContents }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 401) {
        throw new Neo4jError('Neo4j authentication failed — check credentials', 'NEO4J_AUTH_ERROR', 401);
      }

      if (!response.ok) {
        throw new Neo4jError(
          `Neo4j returned HTTP ${response.status}: ${response.statusText}`,
          'NEO4J_HTTP_ERROR',
          response.status,
        );
      }

      const data = (await response.json()) as Neo4jRawResponse;

      if (data.errors && data.errors.length > 0) {
        const err = data.errors[0]!;
        throw new Neo4jError(err.message, err.code);
      }

      return data;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Neo4jError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Neo4jError(
          `Neo4j request timed out after ${config.requestTimeoutMs}ms`,
          'NEO4J_TIMEOUT',
        );
      }
      throw new Neo4jError(
        `Cannot connect to Neo4j at ${config.neo4j.url}: ${err instanceof Error ? err.message : String(err)}`,
        'NEO4J_CONNECTION_ERROR',
      );
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.query('RETURN 1', {}, ['row']);
      return true;
    } catch {
      return false;
    }
  }
}

export const neo4jClient = new Neo4jClient();

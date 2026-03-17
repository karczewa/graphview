import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

function optionalInt(name: string, defaultValue: number): number {
  const val = process.env[name];
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${val}`);
  }
  return parsed;
}

export const config = {
  neo4j: {
    url: required('NEO4J_URL'),
    database: required('NEO4J_DATABASE'),
    username: required('NEO4J_USERNAME'),
    password: required('NEO4J_PASSWORD'),
  },
  port: optionalInt('BACKEND_PORT', 3001),
  queryMaxLimit: optionalInt('QUERY_MAX_LIMIT', 500),
  requestTimeoutMs: optionalInt('REQUEST_TIMEOUT_MS', 30000),
  frontendOrigin: process.env['FRONTEND_ORIGIN'] ?? 'http://localhost:5173',
};

import type { GraphData, SchemaResponse } from '../types.ts';
import { useSettingsStore } from '../store/settingsStore.ts';

const BASE = '/api';

function connectionHeaders(): Record<string, string> {
  const { url, username, password, database } = useSettingsStore.getState();
  const headers: Record<string, string> = {};
  if (url)      headers['X-Neo4j-Uri']      = url;
  if (username) headers['X-Neo4j-Username'] = username;
  if (password) headers['X-Neo4j-Password'] = password;
  if (database) headers['X-Neo4j-Database'] = database;
  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      ...connectionHeaders(),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed', code: 'NETWORK_ERROR' }));
    throw new Error((body as { error: string }).error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export const api = {
  graph: (limit?: number) => {
    const maxNodes = limit ?? useSettingsStore.getState().maxNodes;
    return request<GraphData>(`/graph?limit=${maxNodes}`);
  },
  query: (cypher: string, params?: Record<string, unknown>) => {
    const maxNodes = useSettingsStore.getState().maxNodes;
    return request<GraphData>('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cypher, params, limit: maxNodes }),
    });
  },
  schema: () => request<SchemaResponse>('/schema'),
  node: (id: string) => request<GraphData>(`/node/${encodeURIComponent(id)}`),
  neighbors: (id: string, depth = 1) =>
    request<GraphData>(`/neighbors/${encodeURIComponent(id)}?depth=${depth}`),
  testConnection: (url: string, username: string, password: string, database: string) =>
    fetch(`${BASE}/connection/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(url      ? { 'X-Neo4j-Uri':      url }      : {}),
        ...(username ? { 'X-Neo4j-Username': username } : {}),
        ...(password ? { 'X-Neo4j-Password': password } : {}),
        ...(database ? { 'X-Neo4j-Database': database } : {}),
      },
    }).then(async (r) => {
      const body = await r.json().catch(() => ({ ok: false, error: 'Unknown error' }));
      return body as { ok: boolean; error?: string };
    }),
};

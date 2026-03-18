import type { GraphData, SchemaResponse } from '../types.ts';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed', code: 'NETWORK_ERROR' }));
    throw new Error((body as { error: string }).error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export const api = {
  graph: (limit = 200) => request<GraphData>(`/graph?limit=${limit}`),
  query: (cypher: string, params?: Record<string, unknown>) =>
    request<GraphData>('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cypher, params }),
    }),
  schema: () => request<SchemaResponse>('/schema'),
  node: (id: string) => request<GraphData>(`/node/${encodeURIComponent(id)}`),
  neighbors: (id: string, depth = 1) =>
    request<GraphData>(`/neighbors/${encodeURIComponent(id)}?depth=${depth}`),
};

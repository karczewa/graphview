import { create } from 'zustand';
import { api } from '../api/client.ts';
import { useUiStore } from './uiStore.ts';
import type { GraphNode, GraphEdge, GraphData } from '../types.ts';

// Exponential backoff retry: 1s, 2s, 4s
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, Math.min(Math.pow(2, attempt) * 1000, 10_000)));
      }
    }
  }
  throw lastError;
}

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: GraphData['metadata'] | null;
  loading: boolean;
  error: string | null;
  fetchGraph: (limit?: number) => Promise<void>;
  runQuery: (cypher: string) => Promise<void>;
  expandNode: (id: string, depth?: number) => Promise<void>;
  clear: () => void;
}

function handleError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : fallback;
  useUiStore.getState().addToast(msg, 'error');
  return msg;
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  metadata: null,
  loading: false,
  error: null,

  fetchGraph: async (limit = 200) => {
    set({ loading: true, error: null });
    try {
      const data = await withRetry(() => api.graph(limit));
      set({ nodes: data.nodes, edges: data.edges, metadata: data.metadata, loading: false });
    } catch (err) {
      const error = handleError(err, 'Failed to load graph');
      set({ error, loading: false });
    }
  },

  runQuery: async (cypher) => {
    set({ loading: true, error: null });
    try {
      const data = await withRetry(() => api.query(cypher));
      set({ nodes: data.nodes, edges: data.edges, metadata: data.metadata, loading: false });
    } catch (err) {
      const error = handleError(err, 'Query failed');
      set({ error, loading: false });
    }
  },

  expandNode: async (id, depth = 1) => {
    set({ loading: true, error: null });
    try {
      const data = await withRetry(() => api.neighbors(id, depth));
      set((state) => {
        const existingNodeIds = new Set(state.nodes.map((n) => n.id));
        const existingEdgeIds = new Set(state.edges.map((e) => e.id));
        const newNodes = data.nodes.filter((n) => !existingNodeIds.has(n.id));
        const newEdges = data.edges.filter((e) => !existingEdgeIds.has(e.id));
        return { nodes: [...state.nodes, ...newNodes], edges: [...state.edges, ...newEdges], loading: false };
      });
    } catch (err) {
      const error = handleError(err, 'Expand failed');
      set({ error, loading: false });
    }
  },

  clear: () => set({ nodes: [], edges: [], metadata: null, error: null }),
}));

import { create } from 'zustand';
import { api } from '../api/client.ts';
import type { GraphNode, GraphEdge, GraphData } from '../types.ts';

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: GraphData['metadata'] | null;
  loading: boolean;
  error: string | null;
  fetchGraph: (limit?: number) => Promise<void>;
  runQuery: (cypher: string) => Promise<void>;
  clear: () => void;
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
      const data = await api.graph(limit);
      set({ nodes: data.nodes, edges: data.edges, metadata: data.metadata, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load graph', loading: false });
    }
  },

  runQuery: async (cypher) => {
    set({ loading: true, error: null });
    try {
      const data = await api.query(cypher);
      set({ nodes: data.nodes, edges: data.edges, metadata: data.metadata, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Query failed', loading: false });
    }
  },

  clear: () => set({ nodes: [], edges: [], metadata: null, error: null }),
}));

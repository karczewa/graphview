import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSettingsStore } from './settingsStore.ts';

const MAX_HISTORY = 20;

function connectionKey(): string {
  const { url, username, database } = useSettingsStore.getState();
  return `${url || '_'}::${username || '_'}::${database || '_'}`;
}

export type LayoutAlgorithm = 'force' | 'circular' | 'grid' | 'radial';

export interface Toast {
  id: string;
  message: string;
  type: 'error' | 'info';
}

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
}

interface UiState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  highlightedLabel: string | null;
  searchQuery: string;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  historyByConnection: Record<string, string[]>;
  savedQueries: SavedQuery[];
  contextMenu: ContextMenuState | null;
  mindmapNodeId: string | null;
  pinnedNodeIds: Set<string>;
  hiddenNodeIds: Set<string>;
  hiddenEdgeTypes: Set<string>;
  toasts: Toast[];
  layoutAlgorithm: LayoutAlgorithm;

  setSelectedNode: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  setHighlightedLabel: (label: string | null) => void;
  setSearchQuery: (q: string) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  addToHistory: (query: string) => void;
  saveQuery: (name: string, query: string) => void;
  deleteSavedQuery: (id: string) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  setMindmapNode: (id: string | null) => void;
  togglePin: (nodeId: string) => void;
  hideNode: (nodeId: string) => void;
  showAllNodes: () => void;
  toggleEdgeType: (type: string) => void;
  addToast: (message: string, type?: 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  setLayoutAlgorithm: (layout: LayoutAlgorithm) => void;
}

export const useUiStore = create<UiState>()(persist((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  highlightedLabel: null,
  searchQuery: '',
  leftPanelOpen: true,
  rightPanelOpen: true,
  historyByConnection: {} as Record<string, string[]>,
  savedQueries: [],
  contextMenu: null,
  mindmapNodeId: null,
  pinnedNodeIds: new Set(),
  hiddenNodeIds: new Set(),
  hiddenEdgeTypes: new Set(),
  toasts: [],
  layoutAlgorithm: 'force',

  setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  setHighlightedLabel: (label) =>
    set((s) => ({ highlightedLabel: s.highlightedLabel === label ? null : label })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  addToHistory: (query) =>
    set((s) => {
      const key = connectionKey();
      const prev = s.historyByConnection[key] ?? [];
      return {
        historyByConnection: {
          ...s.historyByConnection,
          [key]: [query, ...prev.filter((q) => q !== query)].slice(0, MAX_HISTORY),
        },
      };
    }),


  saveQuery: (name, query) =>
    set((s) => ({
      savedQueries: [...s.savedQueries, { id: `${Date.now()}`, name, query }],
    })),

  deleteSavedQuery: (id) =>
    set((s) => ({ savedQueries: s.savedQueries.filter((q) => q.id !== id) })),

  setContextMenu: (menu) => set({ contextMenu: menu }),
  setMindmapNode: (id) => set({ mindmapNodeId: id }),

  togglePin: (nodeId) =>
    set((s) => {
      const next = new Set(s.pinnedNodeIds);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return { pinnedNodeIds: next };
    }),

  hideNode: (nodeId) =>
    set((s) => {
      const next = new Set(s.hiddenNodeIds);
      next.add(nodeId);
      return {
        hiddenNodeIds: next,
        selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
      };
    }),

  showAllNodes: () => set({ hiddenNodeIds: new Set() }),

  toggleEdgeType: (type) =>
    set((s) => {
      const next = new Set(s.hiddenEdgeTypes);
      next.has(type) ? next.delete(type) : next.add(type);
      return { hiddenEdgeTypes: next };
    }),

  addToast: (message, type = 'error') => {
    const id = `${Date.now()}-${Math.random()}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      useUiStore.getState().dismissToast(id);
    }, 5000);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setLayoutAlgorithm: (layoutAlgorithm) => set({ layoutAlgorithm }),
}), {
  name: 'graphview-ui',
  partialize: (s) => ({
    hiddenEdgeTypes: [...s.hiddenEdgeTypes],
    pinnedNodeIds: [...s.pinnedNodeIds],
    savedQueries: s.savedQueries,
  }),
  merge: (persisted: unknown, current) => {
    const p = persisted as { hiddenEdgeTypes?: string[]; pinnedNodeIds?: string[]; savedQueries?: SavedQuery[] };
    return {
      ...current,
      hiddenEdgeTypes: new Set(p.hiddenEdgeTypes ?? []),
      pinnedNodeIds: new Set(p.pinnedNodeIds ?? []),
      savedQueries: p.savedQueries ?? [],
    };
  },
}));

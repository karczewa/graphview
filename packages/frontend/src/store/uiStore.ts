import { create } from 'zustand';

const MAX_HISTORY = 20;

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

interface UiState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  highlightedLabel: string | null;
  searchQuery: string;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  queryHistory: string[];
  contextMenu: ContextMenuState | null;
  pinnedNodeIds: Set<string>;
  hiddenNodeIds: Set<string>;
  toasts: Toast[];
  layoutAlgorithm: LayoutAlgorithm;

  setSelectedNode: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  setHighlightedLabel: (label: string | null) => void;
  setSearchQuery: (q: string) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  addToHistory: (query: string) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  togglePin: (nodeId: string) => void;
  hideNode: (nodeId: string) => void;
  showAllNodes: () => void;
  addToast: (message: string, type?: 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  setLayoutAlgorithm: (layout: LayoutAlgorithm) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  highlightedLabel: null,
  searchQuery: '',
  leftPanelOpen: true,
  rightPanelOpen: true,
  queryHistory: [],
  contextMenu: null,
  pinnedNodeIds: new Set(),
  hiddenNodeIds: new Set(),
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
    set((s) => ({
      queryHistory: [query, ...s.queryHistory.filter((q) => q !== query)].slice(0, MAX_HISTORY),
    })),

  setContextMenu: (menu) => set({ contextMenu: menu }),

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
}));

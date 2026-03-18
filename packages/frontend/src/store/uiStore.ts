import { create } from 'zustand';

const MAX_HISTORY = 20;

interface UiState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  highlightedLabel: string | null;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  queryHistory: string[];
  setSelectedNode: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  setHighlightedLabel: (label: string | null) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  addToHistory: (query: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  highlightedLabel: null,
  leftPanelOpen: true,
  rightPanelOpen: true,
  queryHistory: [],

  setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  setHighlightedLabel: (label) =>
    set((s) => ({ highlightedLabel: s.highlightedLabel === label ? null : label })),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  addToHistory: (query) =>
    set((s) => ({
      queryHistory: [query, ...s.queryHistory.filter((q) => q !== query)].slice(0, MAX_HISTORY),
    })),
}));

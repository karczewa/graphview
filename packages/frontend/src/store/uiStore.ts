import { create } from 'zustand';

interface UiState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  setSelectedNode: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  leftPanelOpen: true,
  rightPanelOpen: true,

  setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
}));

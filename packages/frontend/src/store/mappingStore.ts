import { create } from 'zustand';
import type { ShapeType } from '../components/shapes/index.ts';

export interface VisualConfig {
  color: string;
  shape: ShapeType;
  size: number; // diameter in px
}

export interface EdgeVisualConfig {
  color: string;
  width: number;
}

interface MappingState {
  labelConfig: Record<string, VisualConfig>;
  edgeConfig: Record<string, EdgeVisualConfig>;
  assignDefaults: (labels: string[], edgeTypes: string[]) => void;
  setLabelConfig: (label: string, config: Partial<VisualConfig>) => void;
  setEdgeConfig: (type: string, config: Partial<EdgeVisualConfig>) => void;
}

const COLORS = [
  '#60a5fa', // blue
  '#34d399', // emerald
  '#f59e0b', // amber
  '#f87171', // red
  '#a78bfa', // violet
  '#fb923c', // orange
  '#38bdf8', // sky
  '#4ade80', // green
  '#e879f9', // fuchsia
  '#facc15', // yellow
];

const SHAPES: ShapeType[] = [
  'circle', 'square', 'hexagon', 'diamond', 'triangle', 'pentagon', 'ellipse', 'star',
];

const EDGE_COLORS = ['#6b7280', '#9ca3af', '#4b5563', '#d1d5db'];

export const useMapping = create<MappingState>((set, get) => ({
  labelConfig: {},
  edgeConfig: {},

  assignDefaults: (labels, edgeTypes) => {
    const { labelConfig, edgeConfig } = get();
    const newLabelConfig = { ...labelConfig };
    const newEdgeConfig = { ...edgeConfig };
    let colorIdx = Object.keys(labelConfig).length;
    let shapeIdx = Object.keys(labelConfig).length;

    for (const label of labels) {
      if (!newLabelConfig[label]) {
        newLabelConfig[label] = {
          color: COLORS[colorIdx % COLORS.length]!,
          shape: SHAPES[shapeIdx % SHAPES.length]!,
          size: 40,
        };
        colorIdx++;
        shapeIdx++;
      }
    }

    let edgeColorIdx = Object.keys(edgeConfig).length;
    for (const type of edgeTypes) {
      if (!newEdgeConfig[type]) {
        newEdgeConfig[type] = {
          color: EDGE_COLORS[edgeColorIdx % EDGE_COLORS.length]!,
          width: 1.5,
        };
        edgeColorIdx++;
      }
    }

    set({ labelConfig: newLabelConfig, edgeConfig: newEdgeConfig });
  },

  setLabelConfig: (label, config) =>
    set((s) => ({
      labelConfig: {
        ...s.labelConfig,
        [label]: { ...s.labelConfig[label]!, ...config },
      },
    })),

  setEdgeConfig: (type, config) =>
    set((s) => ({
      edgeConfig: {
        ...s.edgeConfig,
        [type]: { ...s.edgeConfig[type]!, ...config },
      },
    })),
}));

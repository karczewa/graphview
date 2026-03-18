import { create } from 'zustand';
import type { ShapeType } from '../components/shapes/index.ts';
import type { GraphNode } from '../types.ts';

export interface VisualConfig {
  color: string;
  shape: ShapeType;
  size: number;
}

export interface EdgeVisualConfig {
  color: string;
  width: number;
}

interface MappingState {
  // Which node properties drive color and shape
  colorByProperty: string;
  shapeByProperty: string;

  // Maps: property value → color/shape
  colorMap: Record<string, string>;
  shapeMap: Record<string, ShapeType>;

  // Uniform node size
  nodeSize: number;

  // Edge styling (unchanged)
  edgeConfig: Record<string, EdgeVisualConfig>;

  // Actions
  setColorByProperty: (prop: string) => void;
  setShapeByProperty: (prop: string) => void;
  setColorForValue: (value: string, color: string) => void;
  setShapeForValue: (value: string, shape: ShapeType) => void;
  setNodeSize: (size: number) => void;
  assignFromNodes: (nodes: GraphNode[]) => void;
  assignEdgeDefaults: (edgeTypes: string[]) => void;
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
  colorByProperty: 'database_type',
  shapeByProperty: 'domain',
  colorMap: {},
  shapeMap: {},
  nodeSize: 40,
  edgeConfig: {},

  setColorByProperty: (colorByProperty) => set({ colorByProperty }),
  setShapeByProperty: (shapeByProperty) => set({ shapeByProperty }),

  setColorForValue: (value, color) =>
    set((s) => ({ colorMap: { ...s.colorMap, [value]: color } })),

  setShapeForValue: (value, shape) =>
    set((s) => ({ shapeMap: { ...s.shapeMap, [value]: shape } })),

  setNodeSize: (nodeSize) => set({ nodeSize }),

  assignFromNodes: (nodes) => {
    const { colorByProperty, shapeByProperty, colorMap, shapeMap } = get();

    const newColorMap = { ...colorMap };
    const newShapeMap = { ...shapeMap };

    let colorIdx = Object.keys(newColorMap).length;
    let shapeIdx = Object.keys(newShapeMap).length;

    for (const node of nodes) {
      const colorVal = String(node.properties[colorByProperty] ?? '');
      if (colorVal && !newColorMap[colorVal]) {
        newColorMap[colorVal] = COLORS[colorIdx % COLORS.length]!;
        colorIdx++;
      }

      const shapeVal = String(node.properties[shapeByProperty] ?? '');
      if (shapeVal && !newShapeMap[shapeVal]) {
        newShapeMap[shapeVal] = SHAPES[shapeIdx % SHAPES.length]!;
        shapeIdx++;
      }
    }

    set({ colorMap: newColorMap, shapeMap: newShapeMap });
  },

  assignEdgeDefaults: (edgeTypes) => {
    const { edgeConfig } = get();
    const newEdgeConfig = { ...edgeConfig };
    let idx = Object.keys(edgeConfig).length;
    for (const type of edgeTypes) {
      if (!newEdgeConfig[type]) {
        newEdgeConfig[type] = {
          color: EDGE_COLORS[idx % EDGE_COLORS.length]!,
          width: 1.5,
        };
        idx++;
      }
    }
    set({ edgeConfig: newEdgeConfig });
  },

  setEdgeConfig: (type, config) =>
    set((s) => ({
      edgeConfig: {
        ...s.edgeConfig,
        [type]: { ...s.edgeConfig[type]!, ...config },
      },
    })),
}));

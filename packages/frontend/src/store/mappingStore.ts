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

// Shape is determined by node label — only these three are mapped
export const LABEL_SHAPES: Record<string, ShapeType> = {
  Table:     'square',
  View:      'hexagon',
  Procedure: 'diamond',
};

// Color is determined by the 'domain' property value
export const COLOR_PROPERTY = 'domain';

const DEFAULT_COLOR = '#94a3b8'; // grey — used when domain is missing
const NODE_SIZE = 40;

// 20 visually distinct colors (Tableau 20 palette)
export const COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
  '#499894', '#e4a321', '#a0cbe8', '#ffbe7d', '#d4a6c8',
  '#8cd17d', '#b6992d', '#f1ce63', '#86bcb6', '#d7b5a6',
];

const EDGE_COLORS = ['#6b7280', '#9ca3af', '#4b5563', '#d1d5db'];

interface MappingState {
  colorMap: Record<string, string>;   // domain value → hex color
  edgeConfig: Record<string, EdgeVisualConfig>;

  assignFromNodes: (nodes: GraphNode[]) => void;
  assignEdgeDefaults: (edgeTypes: string[]) => void;
  setEdgeConfig: (type: string, config: Partial<EdgeVisualConfig>) => void;
}

export const useMapping = create<MappingState>((set, get) => ({
  colorMap: {},
  edgeConfig: {},

  assignFromNodes: (nodes) => {
    const { colorMap } = get();
    const newColorMap = { ...colorMap };
    let colorIdx = Object.keys(newColorMap).length;

    for (const node of nodes) {
      const domain = String(node.properties[COLOR_PROPERTY] ?? '');
      if (domain && !newColorMap[domain]) {
        newColorMap[domain] = COLORS[colorIdx % COLORS.length]!;
        colorIdx++;
      }
    }

    set({ colorMap: newColorMap });
  },

  assignEdgeDefaults: (edgeTypes) => {
    const { edgeConfig } = get();
    const newEdgeConfig = { ...edgeConfig };
    let idx = Object.keys(edgeConfig).length;
    for (const type of edgeTypes) {
      if (!newEdgeConfig[type]) {
        newEdgeConfig[type] = { color: EDGE_COLORS[idx % EDGE_COLORS.length]!, width: 1.5 };
        idx++;
      }
    }
    set({ edgeConfig: newEdgeConfig });
  },

  setEdgeConfig: (type, config) =>
    set((s) => ({
      edgeConfig: { ...s.edgeConfig, [type]: { ...s.edgeConfig[type]!, ...config } },
    })),
}));

// Resolve final VisualConfig for a single node
export function resolveNodeConfig(
  node: GraphNode,
  colorMap: Record<string, string>,
): VisualConfig {
  const shape = LABEL_SHAPES[node.primaryLabel] ?? 'circle';
  const domain = String(node.properties[COLOR_PROPERTY] ?? '');
  const color = domain ? (colorMap[domain] ?? DEFAULT_COLOR) : DEFAULT_COLOR;
  return { color, shape, size: NODE_SIZE };
}

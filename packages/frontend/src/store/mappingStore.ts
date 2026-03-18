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

// Per-label visual mapping rules
export interface LabelConfig {
  colorByProperty: string | null;  // which property drives color
  shapeByProperty: string | null;  // which property drives shape (null = fixed defaultShape)
  defaultShape: ShapeType;         // shape used when shapeByProperty is null
  size: number;                    // node diameter in px
}

// Hardcoded per-label configs — add new labels here as the schema grows
export const LABEL_CONFIGS: Record<string, LabelConfig> = {
  Table:  { colorByProperty: 'database_type', shapeByProperty: 'domain', defaultShape: 'hexagon', size: 44 },
  Column: { colorByProperty: 'type',          shapeByProperty: null,     defaultShape: 'circle',  size: 28 },
};

const FALLBACK_LABEL_CONFIG: LabelConfig = {
  colorByProperty: null, shapeByProperty: null, defaultShape: 'circle', size: 36,
};

// 20 visually distinct colors (Tableau 20 palette)
export const COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
  '#499894', '#e4a321', '#a0cbe8', '#ffbe7d', '#d4a6c8',
  '#8cd17d', '#b6992d', '#f1ce63', '#86bcb6', '#d7b5a6',
];

// Shapes used for property-based shape mapping.
// 'circle' is reserved as the fixed default shape for Column nodes,
// so it is excluded here to prevent visual overlap with tables.
const MAPPING_SHAPES: ShapeType[] = [
  'square', 'hexagon', 'diamond', 'triangle', 'pentagon', 'ellipse', 'star',
];

const EDGE_COLORS = ['#6b7280', '#9ca3af', '#4b5563', '#d1d5db'];

interface MappingState {
  // "propName:value" → hex color (shared pool across all labels)
  colorMap: Record<string, string>;
  // "propName:value" → shape
  shapeMap: Record<string, ShapeType>;
  // Edge styling
  edgeConfig: Record<string, EdgeVisualConfig>;

  assignFromNodes: (nodes: GraphNode[]) => void;
  assignEdgeDefaults: (edgeTypes: string[]) => void;
  setEdgeConfig: (type: string, config: Partial<EdgeVisualConfig>) => void;
}

export const useMapping = create<MappingState>((set, get) => ({
  colorMap: {},
  shapeMap: {},
  edgeConfig: {},

  assignFromNodes: (nodes) => {
    const { colorMap, shapeMap } = get();
    const newColorMap = { ...colorMap };
    const newShapeMap = { ...shapeMap };

    // Color index continues from however many values are already assigned
    // so new values never reuse an existing color slot
    let colorIdx = Object.keys(newColorMap).length;
    let shapeIdx = Object.keys(newShapeMap).length;

    for (const node of nodes) {
      const cfg = LABEL_CONFIGS[node.primaryLabel];
      if (!cfg) continue;

      if (cfg.colorByProperty) {
        const val = String(node.properties[cfg.colorByProperty] ?? '');
        if (val) {
          const key = `${cfg.colorByProperty}:${val}`;
          if (!newColorMap[key]) {
            newColorMap[key] = COLORS[colorIdx % COLORS.length]!;
            colorIdx++;
          }
        }
      }

      if (cfg.shapeByProperty) {
        const val = String(node.properties[cfg.shapeByProperty] ?? '');
        if (val) {
          const key = `${cfg.shapeByProperty}:${val}`;
          if (!newShapeMap[key]) {
            newShapeMap[key] = MAPPING_SHAPES[shapeIdx % MAPPING_SHAPES.length]!;
            shapeIdx++;
          }
        }
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
  shapeMap: Record<string, ShapeType>,
): VisualConfig {
  const cfg = LABEL_CONFIGS[node.primaryLabel] ?? FALLBACK_LABEL_CONFIG;

  let color = '#94a3b8';
  if (cfg.colorByProperty) {
    const val = String(node.properties[cfg.colorByProperty] ?? '');
    color = colorMap[`${cfg.colorByProperty}:${val}`] ?? '#94a3b8';
  }

  let shape: ShapeType = cfg.defaultShape;
  if (cfg.shapeByProperty) {
    const val = String(node.properties[cfg.shapeByProperty] ?? '');
    shape = shapeMap[`${cfg.shapeByProperty}:${val}`] ?? cfg.defaultShape;
  }

  return { color, shape, size: cfg.size };
}

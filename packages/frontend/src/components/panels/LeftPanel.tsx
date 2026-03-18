import { useState } from 'react';
import { useMapping } from '../../store/mappingStore.ts';
import { useGraphStore } from '../../store/graphStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import type { ShapeType } from '../shapes/index.ts';

const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
  '#94a3b8', '#64748b', '#e2e8f0', '#ffffff',
];

const SHAPES: ShapeType[] = [
  'circle', 'ellipse', 'square', 'diamond', 'triangle', 'pentagon', 'hexagon', 'star',
];

// ── Color value editor ────────────────────────────────────────────────────────

function ColorEditor({ value }: { value: string }) {
  const { colorMap, setColorForValue } = useMapping();
  const current = colorMap[value] ?? '#94a3b8';
  return (
    <div className="mx-2 mb-1 p-2 bg-gray-800 rounded border border-gray-700">
      <p className="text-xs text-gray-500 mb-1.5">Color for "{value}"</p>
      <div className="grid grid-cols-8 gap-1">
        {PALETTE.map((color) => (
          <button
            key={color}
            onClick={() => setColorForValue(value, color)}
            className="w-5 h-5 rounded-sm border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: color,
              borderColor: current === color ? '#f59e0b' : 'transparent',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Shape value editor ────────────────────────────────────────────────────────

function ShapeEditor({ value }: { value: string }) {
  const { shapeMap, setShapeForValue } = useMapping();
  const current = shapeMap[value] ?? 'circle';
  return (
    <div className="mx-2 mb-1 p-2 bg-gray-800 rounded border border-gray-700">
      <p className="text-xs text-gray-500 mb-1.5">Shape for "{value}"</p>
      <div className="flex flex-wrap gap-1">
        {SHAPES.map((shape) => (
          <button
            key={shape}
            onClick={() => setShapeForValue(value, shape)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              current === shape
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {shape}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── LeftPanel ─────────────────────────────────────────────────────────────────

export function LeftPanel() {
  const {
    colorByProperty, shapeByProperty, colorMap, shapeMap, nodeSize,
    setColorByProperty, setShapeByProperty, setNodeSize,
  } = useMapping();
  const { nodes, metadata } = useGraphStore();
  const { highlightedLabel, setHighlightedLabel, searchQuery, setSearchQuery, hiddenNodeIds, showAllNodes } = useUiStore();
  const [editingColorVal, setEditingColorVal] = useState<string | null>(null);
  const [editingShapeVal, setEditingShapeVal] = useState<string | null>(null);

  // Collect all unique property keys from visible nodes (for dropdowns)
  const propKeys = Array.from(
    new Set(nodes.flatMap((n) => Object.keys(n.properties)))
  ).sort();

  // Unique values currently present in the graph for each mapped property
  const colorValues = Array.from(new Set(
    nodes.map((n) => String(n.properties[colorByProperty] ?? '')).filter(Boolean)
  )).sort();
  const shapeValues = Array.from(new Set(
    nodes.map((n) => String(n.properties[shapeByProperty] ?? '')).filter(Boolean)
  )).sort();

  const toggleColorEdit = (val: string) =>
    setEditingColorVal((prev) => (prev === val ? null : val));
  const toggleShapeEdit = (val: string) =>
    setEditingShapeVal((prev) => (prev === val ? null : val));

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800">
      <div className="px-3 py-2 border-b border-gray-800 space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Visual Mapping</h2>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search nodes…"
          className="w-full bg-gray-800 text-gray-200 text-xs px-2 py-1.5 rounded border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-600"
        />
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-4">
        {nodes.length === 0 ? (
          <p className="text-xs text-gray-600 px-4 py-4 text-center">No data loaded</p>
        ) : (
          <>
            {/* ── Color section ─────────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 px-3 mb-1">
                <p className="text-xs text-gray-500">Color by</p>
                <select
                  value={colorByProperty}
                  onChange={(e) => setColorByProperty(e.target.value)}
                  className="flex-1 bg-gray-800 text-gray-300 text-xs px-1.5 py-0.5 rounded border border-gray-700 focus:outline-none"
                >
                  {propKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              {colorValues.map((val) => (
                <div key={val}>
                  <div
                    className={`flex items-center gap-2 px-3 py-1 mx-1 rounded cursor-pointer transition-colors ${
                      highlightedLabel === val ? 'bg-gray-700' : 'hover:bg-gray-800'
                    }`}
                    onClick={() => setHighlightedLabel(val)}
                  >
                    <button
                      className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-600 hover:scale-125 transition-transform"
                      style={{ backgroundColor: colorMap[val] ?? '#94a3b8' }}
                      onClick={(e) => { e.stopPropagation(); toggleColorEdit(val); }}
                      title="Edit color"
                    />
                    <span className="text-sm text-gray-300 flex-1 truncate">{val}</span>
                  </div>
                  {editingColorVal === val && <ColorEditor value={val} />}
                </div>
              ))}
            </div>

            {/* ── Shape section ─────────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 px-3 mb-1">
                <p className="text-xs text-gray-500">Shape by</p>
                <select
                  value={shapeByProperty}
                  onChange={(e) => setShapeByProperty(e.target.value)}
                  className="flex-1 bg-gray-800 text-gray-300 text-xs px-1.5 py-0.5 rounded border border-gray-700 focus:outline-none"
                >
                  {propKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              {shapeValues.map((val) => (
                <div key={val}>
                  <div
                    className={`flex items-center gap-2 px-3 py-1 mx-1 rounded cursor-pointer transition-colors ${
                      highlightedLabel === val ? 'bg-gray-700' : 'hover:bg-gray-800'
                    }`}
                    onClick={() => setHighlightedLabel(val)}
                  >
                    <span className="text-xs text-gray-500 flex-shrink-0 w-12 truncate">
                      {shapeMap[val] ?? 'circle'}
                    </span>
                    <span className="text-sm text-gray-300 flex-1 truncate">{val}</span>
                  </div>
                  {editingShapeVal === val && <ShapeEditor value={val} />}
                </div>
              ))}
              {shapeValues.length > 0 && (
                <button
                  className="mx-3 mt-1 text-xs text-gray-600 hover:text-gray-400"
                  onClick={() => setEditingShapeVal(editingShapeVal ? null : shapeValues[0]!)}
                >
                  {editingShapeVal ? '▴ close editor' : '▾ edit shapes'}
                </button>
              )}
            </div>

            {/* ── Node size ─────────────────────────────────────────────── */}
            <div className="px-3">
              <p className="text-xs text-gray-500 mb-1">Node size: {nodeSize}px</p>
              <input
                type="range" min={20} max={70} value={nodeSize}
                onChange={(e) => setNodeSize(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            {/* ── Relationships ─────────────────────────────────────────── */}
            {metadata && metadata.edgeTypes.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 px-3 mb-1">Relationships</p>
                {metadata.edgeTypes.map((type) => (
                  <div key={type} className="flex items-center gap-2 px-3 py-1 mx-1">
                    <span className="w-3 h-0.5 bg-gray-600 flex-shrink-0" />
                    <span className="text-sm text-gray-400 truncate">{type}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {(highlightedLabel || hiddenNodeIds.size > 0) && (
        <div className="px-3 py-2 border-t border-gray-800 flex flex-col gap-1">
          {highlightedLabel && (
            <button onClick={() => setHighlightedLabel(null)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left">
              ✕ Clear highlight
            </button>
          )}
          {hiddenNodeIds.size > 0 && (
            <button onClick={showAllNodes} className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left">
              ↺ Show {hiddenNodeIds.size} hidden node{hiddenNodeIds.size > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

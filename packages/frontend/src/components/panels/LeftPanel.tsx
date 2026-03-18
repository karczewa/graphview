import { useState } from 'react';
import { useMapping } from '../../store/mappingStore.ts';
import { useGraphStore } from '../../store/graphStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import type { ShapeType } from '../shapes/index.ts';

// ── Mapping editor ─────────────────────────────────────────────────────────────

const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
  '#94a3b8', '#64748b', '#e2e8f0', '#ffffff',
];

const SHAPES: ShapeType[] = [
  'circle', 'ellipse', 'square', 'diamond', 'triangle', 'pentagon', 'hexagon', 'star',
];

function MappingEditor({ label }: { label: string }) {
  const { labelConfig, setLabelConfig } = useMapping();
  const cfg = labelConfig[label];
  if (!cfg) return null;

  return (
    <div className="mx-2 mb-1 p-2 bg-gray-800 rounded border border-gray-700">
      {/* Color palette */}
      <p className="text-xs text-gray-500 mb-1.5">Color</p>
      <div className="grid grid-cols-8 gap-1 mb-2">
        {PALETTE.map((color) => (
          <button
            key={color}
            onClick={() => setLabelConfig(label, { color })}
            className="w-5 h-5 rounded-sm border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: color,
              borderColor: cfg.color === color ? '#f59e0b' : 'transparent',
            }}
          />
        ))}
      </div>

      {/* Shape picker */}
      <p className="text-xs text-gray-500 mb-1.5">Shape</p>
      <div className="flex flex-wrap gap-1">
        {SHAPES.map((shape) => (
          <button
            key={shape}
            onClick={() => setLabelConfig(label, { shape })}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              cfg.shape === shape
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {shape}
          </button>
        ))}
      </div>

      {/* Size slider */}
      <p className="text-xs text-gray-500 mt-2 mb-1">Size: {cfg.size}px</p>
      <input
        type="range"
        min={20}
        max={70}
        value={cfg.size}
        onChange={(e) => setLabelConfig(label, { size: Number(e.target.value) })}
        className="w-full accent-blue-500"
      />
    </div>
  );
}

// ── LeftPanel ─────────────────────────────────────────────────────────────────

export function LeftPanel() {
  const { labelConfig } = useMapping();
  const { nodes, metadata } = useGraphStore();
  const { highlightedLabel, setHighlightedLabel } = useUiStore();
  const [editingLabel, setEditingLabel] = useState<string | null>(null);

  const labels = metadata?.nodeLabels ?? Object.keys(labelConfig);

  // Node count per label
  const labelCounts = nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.primaryLabel] = (acc[n.primaryLabel] ?? 0) + 1;
    return acc;
  }, {});

  const toggleEdit = (label: string) =>
    setEditingLabel((prev) => (prev === label ? null : label));

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Schema</h2>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {labels.length === 0 ? (
          <p className="text-xs text-gray-600 px-4 py-4 text-center">No data loaded</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 px-4 mb-1">Node labels</p>

            {labels.map((label) => {
              const cfg = labelConfig[label];
              const isHighlighted = highlightedLabel === label;
              const isEditing = editingLabel === label;

              return (
                <div key={label}>
                  <div
                    className={`flex items-center gap-2 px-3 py-1 mx-1 rounded cursor-pointer transition-colors ${
                      isHighlighted ? 'bg-gray-700' : 'hover:bg-gray-800'
                    }`}
                    onClick={() => setHighlightedLabel(label)}
                  >
                    {/* Color dot — click to open mapping editor */}
                    <button
                      className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-600 hover:scale-125 transition-transform"
                      style={{ backgroundColor: cfg?.color ?? '#94a3b8' }}
                      onClick={(e) => { e.stopPropagation(); toggleEdit(label); }}
                      title="Edit appearance"
                    />
                    <span className="text-sm text-gray-300 flex-1 truncate">{label}</span>
                    {labelCounts[label] !== undefined && (
                      <span className="text-xs text-gray-600">{labelCounts[label]}</span>
                    )}
                  </div>

                  {isEditing && <MappingEditor label={label} />}
                </div>
              );
            })}

            {metadata && metadata.edgeTypes.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 px-4 mb-1">Relationships</p>
                {metadata.edgeTypes.map((type) => (
                  <div
                    key={type}
                    className="flex items-center gap-2 px-3 py-1 mx-1 rounded hover:bg-gray-800 cursor-default"
                  >
                    <span className="w-3 h-0.5 bg-gray-600 flex-shrink-0" />
                    <span className="text-sm text-gray-400 truncate">{type}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {highlightedLabel && (
        <div className="px-4 py-2 border-t border-gray-800">
          <button
            onClick={() => setHighlightedLabel(null)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ✕ Clear filter
          </button>
        </div>
      )}
    </div>
  );
}

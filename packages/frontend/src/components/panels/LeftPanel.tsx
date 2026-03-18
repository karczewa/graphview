import { useMapping, LABEL_CONFIGS } from '../../store/mappingStore.ts';
import { useGraphStore } from '../../store/graphStore.ts';
import { useUiStore } from '../../store/uiStore.ts';

// ── LeftPanel — read-only legend ──────────────────────────────────────────────

export function LeftPanel() {
  const { colorMap, shapeMap } = useMapping();
  const { nodes, metadata } = useGraphStore();
  const { highlightedLabel, setHighlightedLabel, searchQuery, setSearchQuery, hiddenNodeIds, showAllNodes } = useUiStore();

  // Build legend entries from nodes currently in the graph
  // colorEntries: { label, property, value, color }[]
  // shapeEntries: { label, property, value, shape }[]
  const colorEntries: { label: string; property: string; value: string; color: string }[] = [];
  const shapeEntries: { label: string; property: string; value: string; shape: string }[] = [];

  const seenColorKeys = new Set<string>();
  const seenShapeKeys = new Set<string>();

  for (const node of nodes) {
    const cfg = LABEL_CONFIGS[node.primaryLabel];
    if (!cfg) continue;

    if (cfg.colorByProperty) {
      const val = String(node.properties[cfg.colorByProperty] ?? '');
      const key = `${cfg.colorByProperty}:${val}`;
      if (val && !seenColorKeys.has(key)) {
        seenColorKeys.add(key);
        colorEntries.push({
          label: node.primaryLabel,
          property: cfg.colorByProperty,
          value: val,
          color: colorMap[key] ?? '#94a3b8',
        });
      }
    }

    if (cfg.shapeByProperty) {
      const val = String(node.properties[cfg.shapeByProperty] ?? '');
      const key = `${cfg.shapeByProperty}:${val}`;
      if (val && !seenShapeKeys.has(key)) {
        seenShapeKeys.add(key);
        shapeEntries.push({
          label: node.primaryLabel,
          property: cfg.shapeByProperty,
          value: val,
          shape: shapeMap[key] ?? 'circle',
        });
      }
    }
  }

  // Sort entries: group by label then alphabetically by value
  colorEntries.sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value));
  shapeEntries.sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value));

  // Group by label for display
  const colorGroups = groupBy(colorEntries, (e) => `${e.label} — ${e.property}`);
  const shapeGroups = groupBy(shapeEntries, (e) => `${e.label} — ${e.property}`);

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800">
      <div className="px-3 py-2 border-b border-gray-800 space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Legend</h2>
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
            {/* ── Color legend ───────────────────────────────────────────── */}
            {Object.entries(colorGroups).map(([groupLabel, entries]) => (
              <div key={groupLabel}>
                <p className="text-xs text-gray-500 px-3 mb-1">{groupLabel}</p>
                {entries.map((entry) => (
                  <div
                    key={entry.value}
                    className={`flex items-center gap-2 px-3 py-1 mx-1 rounded cursor-pointer transition-colors ${
                      highlightedLabel === entry.value ? 'bg-gray-700' : 'hover:bg-gray-800'
                    }`}
                    onClick={() => setHighlightedLabel(highlightedLabel === entry.value ? null : entry.value)}
                    title={`Highlight all ${entry.label} nodes with ${entry.property} = ${entry.value}`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-600"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-gray-300 truncate">{entry.value}</span>
                  </div>
                ))}
              </div>
            ))}

            {/* ── Shape legend ───────────────────────────────────────────── */}
            {Object.entries(shapeGroups).map(([groupLabel, entries]) => (
              <div key={groupLabel}>
                <p className="text-xs text-gray-500 px-3 mb-1">{groupLabel}</p>
                {entries.map((entry) => (
                  <div
                    key={entry.value}
                    className={`flex items-center gap-2 px-3 py-1 mx-1 rounded cursor-pointer transition-colors ${
                      highlightedLabel === entry.value ? 'bg-gray-700' : 'hover:bg-gray-800'
                    }`}
                    onClick={() => setHighlightedLabel(highlightedLabel === entry.value ? null : entry.value)}
                    title={`Highlight all ${entry.label} nodes with ${entry.property} = ${entry.value}`}
                  >
                    <span className="text-xs text-gray-500 w-12 flex-shrink-0">{entry.shape}</span>
                    <span className="text-sm text-gray-300 truncate">{entry.value}</span>
                  </div>
                ))}
              </div>
            ))}

            {/* ── Relationships ──────────────────────────────────────────── */}
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
            <button
              onClick={() => setHighlightedLabel(null)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left"
            >
              ✕ Clear highlight
            </button>
          )}
          {hiddenNodeIds.size > 0 && (
            <button
              onClick={showAllNodes}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left"
            >
              ↺ Show {hiddenNodeIds.size} hidden node{hiddenNodeIds.size > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

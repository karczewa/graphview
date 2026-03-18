import { useMapping, LABEL_SHAPES, COLOR_PROPERTY } from '../../store/mappingStore.ts';
import { useGraphStore } from '../../store/graphStore.ts';
import { useUiStore } from '../../store/uiStore.ts';

export function LeftPanel() {
  const { colorMap } = useMapping();
  const { nodes, metadata } = useGraphStore();
  const { highlightedLabel, setHighlightedLabel, searchQuery, setSearchQuery, hiddenNodeIds, showAllNodes } = useUiStore();

  // Unique domain values present in the current graph
  const domainEntries: { value: string; color: string }[] = [];
  const seenDomains = new Set<string>();
  for (const node of nodes) {
    const domain = String(node.properties[COLOR_PROPERTY] ?? '');
    if (domain && !seenDomains.has(domain)) {
      seenDomains.add(domain);
      domainEntries.push({ value: domain, color: colorMap[domain] ?? '#94a3b8' });
    }
  }
  domainEntries.sort((a, b) => a.value.localeCompare(b.value));

  // Which of the three known labels are present in the current graph
  const presentLabels = Array.from(new Set(nodes.map((n) => n.primaryLabel)))
    .filter((l) => l in LABEL_SHAPES)
    .sort();

  const highlight = (val: string) =>
    setHighlightedLabel(highlightedLabel === val ? null : val);

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
            {/* ── Color legend (domain) ───────────────────────────────── */}
            {domainEntries.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 px-3 mb-1">Color — domain</p>
                {domainEntries.map(({ value, color }) => (
                  <div
                    key={value}
                    onClick={() => highlight(value)}
                    className={`flex items-center gap-2 px-3 py-1 mx-1 rounded cursor-pointer transition-colors ${
                      highlightedLabel === value ? 'bg-gray-700' : 'hover:bg-gray-800'
                    }`}
                    title={`Highlight nodes with domain = ${value}`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-600"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-gray-300 truncate">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Shape legend (label) ────────────────────────────────── */}
            {presentLabels.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 px-3 mb-1">Shape — label</p>
                {presentLabels.map((label) => (
                  <div
                    key={label}
                    onClick={() => highlight(label)}
                    className={`flex items-center gap-2 px-3 py-1 mx-1 rounded cursor-pointer transition-colors ${
                      highlightedLabel === label ? 'bg-gray-700' : 'hover:bg-gray-800'
                    }`}
                    title={`Highlight ${label} nodes`}
                  >
                    <span className="text-xs text-gray-500 w-14 flex-shrink-0">
                      {LABEL_SHAPES[label]}
                    </span>
                    <span className="text-sm text-gray-300">{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Relationships ───────────────────────────────────────── */}
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

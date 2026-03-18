import { useMapping } from '../../store/mappingStore.ts';
import { useGraphStore } from '../../store/graphStore.ts';

export function LeftPanel() {
  const { labelConfig } = useMapping();
  const { metadata } = useGraphStore();

  const labels = metadata?.nodeLabels ?? Object.keys(labelConfig);

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Schema</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {labels.length === 0 ? (
          <p className="text-xs text-gray-600 px-2 py-4 text-center">No data loaded</p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 px-2 mb-2">Node labels</p>
            {labels.map((label) => {
              const cfg = labelConfig[label];
              return (
                <div key={label} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 cursor-default">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cfg?.color ?? '#94a3b8' }}
                  />
                  <span className="text-sm text-gray-300 truncate">{label}</span>
                </div>
              );
            })}
          </div>
        )}

        {metadata && metadata.edgeTypes.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs text-gray-500 px-2 mb-2">Relationship types</p>
            {metadata.edgeTypes.map((type) => (
              <div key={type} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 cursor-default">
                <span className="w-3 h-0.5 bg-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-400 truncate">{type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

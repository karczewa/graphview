import { useUiStore } from '../../store/uiStore.ts';
import { useGraphStore } from '../../store/graphStore.ts';

export function RightPanel() {
  const { selectedNodeId } = useUiStore();
  const { nodes } = useGraphStore();

  const node = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!node ? (
          <p className="text-xs text-gray-600 text-center py-4">Click a node to inspect it</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Labels</p>
              <div className="flex flex-wrap gap-1">
                {node.labels.map((l) => (
                  <span key={l} className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-xs">
                    {l}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Properties</p>
              <div className="space-y-1">
                {Object.entries(node.properties).map(([key, val]) => (
                  <div key={key} className="grid grid-cols-2 gap-2 text-xs">
                    <span className="text-gray-500 truncate">{key}</span>
                    <span className="text-gray-300 truncate" title={String(val)}>
                      {String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

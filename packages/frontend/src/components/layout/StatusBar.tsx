import { useGraphStore } from '../../store/graphStore.ts';
import { useUiStore } from '../../store/uiStore.ts';

export function StatusBar() {
  const { metadata, loading, error } = useGraphStore();
  const { selectedNodeId, toggleLeftPanel, toggleRightPanel } = useUiStore();

  return (
    <div className="h-8 flex items-center justify-between px-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
      <div className="flex items-center gap-4">
        <button onClick={toggleLeftPanel} className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
          ☰ Schema
        </button>
        {metadata && (
          <span>
            {metadata.totalNodes} nodes · {metadata.totalEdges} edges
            {metadata.queryTimeMs > 0 && ` · ${metadata.queryTimeMs}ms`}
          </span>
        )}
        {loading && <span className="text-blue-400">Loading…</span>}
        {error && <span className="text-red-400 truncate max-w-xs" title={error}>⚠ {error}</span>}
      </div>

      <div className="flex items-center gap-4">
        {selectedNodeId && (
          <span className="text-gray-500 truncate max-w-48" title={selectedNodeId}>
            {selectedNodeId}
          </span>
        )}
        <button onClick={toggleRightPanel} className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
          Details ☰
        </button>
      </div>
    </div>
  );
}

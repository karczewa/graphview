import { useState } from 'react';
import { useUiStore } from '../../store/uiStore.ts';
import { useGraphStore } from '../../store/graphStore.ts';

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-sm text-gray-500 mb-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <span>{title}</span>
        <span className="text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && children}
    </div>
  );
}

export function RightPanel() {
  const { selectedNodeId } = useUiStore();
  const { nodes, expandNode, loading } = useGraphStore();

  const node = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!node ? (
          <p className="text-sm text-gray-500 dark:text-gray-600 text-center py-4">Click a node to inspect it</p>
        ) : (
          <div className="space-y-4">
            <Section title="Labels">
              <div className="flex flex-wrap gap-1">
                {node.labels.map((l) => (
                  <span key={l} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-sm">
                    {l}
                  </span>
                ))}
              </div>
            </Section>

            <Section title={`Properties (${Object.keys(node.properties).length})`}>
              <div className="space-y-1">
                {Object.entries(node.properties).map(([key, val]) => (
                  <div key={key} className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-500 truncate">{key}</span>
                    <span className="text-gray-700 dark:text-gray-300 break-all" title={String(val)}>
                      {String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Expand neighbors">
              <div className="flex gap-1">
                {[1, 2, 3].map((depth) => (
                  <button
                    key={depth}
                    disabled={loading}
                    onClick={() => expandNode(node.id, depth)}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-700 dark:text-gray-300 text-sm rounded transition-colors"
                  >
                    {depth} hop{depth > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="ID" defaultOpen={false}>
              <p className="text-sm text-gray-500 dark:text-gray-600 break-all font-mono">{node.id}</p>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

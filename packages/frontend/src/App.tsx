import { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { useGraphStore } from './store/graphStore.ts';
import { useMapping } from './store/mappingStore.ts';
import { useUiStore } from './store/uiStore.ts';
import { api } from './api/client.ts';
import { canvasActions } from './lib/canvasActions.ts';

export default function App() {
  const { fetchGraph, nodes } = useGraphStore();
  const { assignFromNodes, assignEdgeDefaults } = useMapping();

  useEffect(() => {
    api.schema()
      .then((schema) => {
        assignEdgeDefaults(schema.relationshipTypes);
        return fetchGraph(200);
      })
      .catch(() => fetchGraph(200));
  }, [fetchGraph, assignEdgeDefaults]);

  // Assign visual mapping whenever graph data changes
  useEffect(() => {
    if (nodes.length > 0) assignFromNodes(nodes);
  }, [nodes, assignFromNodes]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const { selectedNodeId, setSelectedNode, hideNode, togglePin } = useUiStore.getState();

      switch (e.key) {
        case 'f': case 'F':
          e.preventDefault();
          canvasActions.call('fitToScreen');
          break;
        case 'Escape':
          setSelectedNode(null);
          break;
        case 'Delete': case 'h': case 'H':
          if (selectedNodeId) hideNode(selectedNodeId);
          break;
        case 'p': case 'P':
          if (selectedNodeId) togglePin(selectedNodeId);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return <AppLayout />;
}

import { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { useGraphStore } from './store/graphStore.ts';
import { useMapping } from './store/mappingStore.ts';
import { useUiStore } from './store/uiStore.ts';
import { useSettingsStore } from './store/settingsStore.ts';
import { api } from './api/client.ts';
import { canvasActions } from './lib/canvasActions.ts';

export default function App() {
  const { nodes } = useGraphStore();
  const { assignFromNodes, assignEdgeDefaults } = useMapping();
  const { addToast } = useUiStore();
  const isDark = useSettingsStore((s) => s.isDark);

  // Sync dark/light class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Load schema on startup for edge style defaults — no auto graph fetch
  useEffect(() => {
    api.schema()
      .then((schema) => { assignEdgeDefaults(schema.relationshipTypes); })
      .catch((err) => {
        console.error('[GraphView] Failed to load schema:', err);
        addToast('Could not load schema — edge styles may be missing', 'info');
      });
  }, [assignEdgeDefaults, addToast]);

  // Assign visual mapping whenever graph data changes
  useEffect(() => {
    if (nodes.length > 0) assignFromNodes(nodes);
  }, [nodes, assignFromNodes]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const { selectedNodeId, setSelectedNode, hideNode, togglePin, undoHide, hideHistory, addToast } = useUiStore.getState();

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
        case 'z': case 'Z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (hideHistory.length > 0) {
              undoHide();
              addToast('Undo — node visibility restored', 'info');
            }
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return <AppLayout />;
}

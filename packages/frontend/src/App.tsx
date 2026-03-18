import { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { useGraphStore } from './store/graphStore.ts';
import { useMapping } from './store/mappingStore.ts';
import { api } from './api/client.ts';

export default function App() {
  const { fetchGraph } = useGraphStore();
  const { assignDefaults } = useMapping();

  useEffect(() => {
    // Load schema first to set up visual mapping, then fetch graph
    api.schema()
      .then((schema) => {
        assignDefaults(schema.nodeLabels, schema.relationshipTypes);
        return fetchGraph(200);
      })
      .catch(() => fetchGraph(200)); // schema optional — graph still loads
  }, [fetchGraph, assignDefaults]);

  return <AppLayout />;
}

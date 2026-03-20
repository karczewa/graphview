import { useUiStore } from '../../store/uiStore.ts';
import { useGraphStore } from '../../store/graphStore.ts';
import { GraphCanvas } from '../GraphCanvas/GraphCanvas.tsx';
import { LeftPanel } from '../panels/LeftPanel.tsx';
import { RightPanel } from '../panels/RightPanel.tsx';
import { StatusBar } from './StatusBar.tsx';
import { Toolbar } from '../Toolbar/Toolbar.tsx';
import { ContextMenu } from '../ContextMenu/ContextMenu.tsx';
import { ToastContainer } from '../ui/Toast.tsx';

export function AppLayout() {
  const { leftPanelOpen, rightPanelOpen } = useUiStore();
  const { loading } = useGraphStore();

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white">
      <StatusBar />
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {leftPanelOpen && <div className="w-72 flex-shrink-0 overflow-hidden"><LeftPanel /></div>}
        <div className="flex-1 overflow-hidden relative">
          <GraphCanvas />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/60 dark:bg-gray-950/60 pointer-events-none">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        {rightPanelOpen && <div className="w-80 flex-shrink-0 overflow-hidden"><RightPanel /></div>}
      </div>
      <ContextMenu />
      <ToastContainer />
    </div>
  );
}

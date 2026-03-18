import { useUiStore } from '../../store/uiStore.ts';
import { GraphCanvas } from '../GraphCanvas/GraphCanvas.tsx';
import { LeftPanel } from '../panels/LeftPanel.tsx';
import { RightPanel } from '../panels/RightPanel.tsx';
import { StatusBar } from './StatusBar.tsx';
import { Toolbar } from '../Toolbar/Toolbar.tsx';

export function AppLayout() {
  const { leftPanelOpen, rightPanelOpen } = useUiStore();

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white">
      <StatusBar />
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {leftPanelOpen && <div className="w-56 flex-shrink-0 overflow-hidden"><LeftPanel /></div>}
        <div className="flex-1 overflow-hidden">
          <GraphCanvas />
        </div>
        {rightPanelOpen && <div className="w-64 flex-shrink-0 overflow-hidden"><RightPanel /></div>}
      </div>
    </div>
  );
}

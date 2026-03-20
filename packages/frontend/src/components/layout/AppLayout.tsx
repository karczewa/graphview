import { useRef, useState, useEffect, useCallback } from 'react';
import { useUiStore } from '../../store/uiStore.ts';
import { useGraphStore } from '../../store/graphStore.ts';
import { GraphCanvas } from '../GraphCanvas/GraphCanvas.tsx';
import { LeftPanel } from '../panels/LeftPanel.tsx';
import { RightPanel } from '../panels/RightPanel.tsx';
import { StatusBar } from './StatusBar.tsx';
import { Toolbar } from '../Toolbar/Toolbar.tsx';
import { ContextMenu } from '../ContextMenu/ContextMenu.tsx';
import { ToastContainer } from '../ui/Toast.tsx';
import { MindmapModal } from '../Mindmap/MindmapModal.tsx';

const MIN_PANEL = 200;
const MAX_PANEL = 520;
const DEFAULT_LEFT  = 288; // w-72
const DEFAULT_RIGHT = 320; // w-80

export function AppLayout() {
  const { leftPanelOpen, rightPanelOpen } = useUiStore();
  const { loading } = useGraphStore();

  const [leftWidth,  setLeftWidth]  = useState(DEFAULT_LEFT);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);

  const dragging = useRef<{
    side: 'left' | 'right';
    startX: number;
    startWidth: number;
  } | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const { side, startX, startWidth } = dragging.current;
    const delta = e.clientX - startX;
    const next = Math.max(MIN_PANEL, Math.min(MAX_PANEL,
      side === 'left' ? startWidth + delta : startWidth - delta,
    ));
    if (side === 'left') setLeftWidth(next);
    else                 setRightWidth(next);
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',  onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',  onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const dragHandle = (side: 'left' | 'right') => (
    <div
      className="w-1 flex-shrink-0 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors"
      onMouseDown={(e) => {
        dragging.current = {
          side,
          startX: e.clientX,
          startWidth: side === 'left' ? leftWidth : rightWidth,
        };
        e.preventDefault();
      }}
    />
  );

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white">
      <StatusBar />
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {leftPanelOpen && (
          <>
            <div style={{ width: leftWidth }} className="flex-shrink-0 overflow-hidden">
              <LeftPanel />
            </div>
            {dragHandle('left')}
          </>
        )}
        <div className="flex-1 overflow-hidden relative">
          <GraphCanvas />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/60 dark:bg-gray-950/60 pointer-events-none">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        {rightPanelOpen && (
          <>
            {dragHandle('right')}
            <div style={{ width: rightWidth }} className="flex-shrink-0 overflow-hidden">
              <RightPanel />
            </div>
          </>
        )}
      </div>
      <ContextMenu />
      <MindmapModal />
      <ToastContainer />
    </div>
  );
}

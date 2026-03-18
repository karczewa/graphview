import { useEffect, useRef } from 'react';
import { useUiStore } from '../../store/uiStore.ts';
import { useGraphStore } from '../../store/graphStore.ts';

export function ContextMenu() {
  const { contextMenu, setContextMenu, togglePin, hideNode, pinnedNodeIds } = useUiStore();
  const { expandNode } = useGraphStore();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on any outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;

  const { nodeId, x, y } = contextMenu;
  const isPinned = pinnedNodeIds.has(nodeId);

  // Clamp to viewport so menu never partially renders off-screen
  const menuW = 180, menuH = 220;
  const left = Math.min(x, window.innerWidth  - menuW - 8);
  const top  = Math.min(y, window.innerHeight - menuH - 8);

  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      key={label}
      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-700 transition-colors ${
        danger ? 'text-red-400' : 'text-gray-300'
      }`}
      onClick={(e) => { e.stopPropagation(); onClick(); setContextMenu(null); }}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left, top, zIndex: 50, width: menuW }}
      className="bg-gray-800 border border-gray-700 rounded shadow-xl py-1"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-3 py-1 text-xs text-gray-500 border-b border-gray-700 mb-1 truncate">
        {nodeId.split(':').pop()}
      </p>

      {item('Expand 1 hop',  () => expandNode(nodeId, 1))}
      {item('Expand 2 hops', () => expandNode(nodeId, 2))}
      {item('Expand 3 hops', () => expandNode(nodeId, 3))}

      <div className="border-t border-gray-700 my-1" />

      {item(isPinned ? '⊘ Unpin node' : '📌 Pin node', () => togglePin(nodeId))}
      {item('✕ Hide node', () => hideNode(nodeId), true)}
    </div>
  );
}

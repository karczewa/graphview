import { useState, useRef, useEffect } from 'react';
import { useGraphStore } from '../../store/graphStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { canvasActions } from '../../lib/canvasActions.ts';
import type { LayoutAlgorithm } from '../../store/uiStore.ts';
import { SettingsModal } from '../Settings/SettingsModal.tsx';

const LAYOUTS: { value: LayoutAlgorithm; label: string }[] = [
  { value: 'force',    label: 'Force' },
  { value: 'circular', label: 'Circular' },
  { value: 'grid',     label: 'Grid' },
  { value: 'radial',   label: 'Radial' },
];

export function Toolbar() {
  const [query, setQuery] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { runQuery, loading } = useGraphStore();
  const { queryHistory, addToHistory, layoutAlgorithm, setLayoutAlgorithm,
          savedQueries, saveQuery, deleteSavedQuery } = useUiStore();
  const historyRef = useRef<HTMLDivElement>(null);
  const savedRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveNameRef = useRef<HTMLInputElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const run = () => {
    const q = query.trim().replace(/\s+/g, ' ');
    if (!q || loading) return;
    addToHistory(q);
    runQuery(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      run();
    }
  };

  const handleSave = () => {
    const name = saveName.trim();
    const q = query.trim().replace(/\s+/g, ' ');
    if (!name || !q) return;
    saveQuery(name, q);
    setSaveName('');
    setSaveDialogOpen(false);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node))
        setHistoryOpen(false);
      if (savedRef.current && !savedRef.current.contains(e.target as Node))
        setSavedOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus save name input when dialog opens
  useEffect(() => {
    if (saveDialogOpen) setTimeout(() => saveNameRef.current?.focus(), 0);
  }, [saveDialogOpen]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0">
      <div className="flex-1">
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          placeholder="MATCH (n) RETURN n LIMIT 50    —    Ctrl+Enter to run"
          className="w-full bg-gray-800 text-gray-200 text-sm px-3 py-1.5 rounded border border-gray-700 focus:border-blue-500 focus:outline-none resize-none font-mono placeholder-gray-600 overflow-hidden"
          rows={1}
          style={{ minHeight: '2rem', maxHeight: '12rem' }}
          spellCheck={false}
        />
      </div>

      <button
        onClick={run}
        disabled={loading || !query.trim()}
        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded flex-shrink-0 transition-colors"
      >
        {loading ? '…' : 'Run'}
      </button>

      {/* Save query */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => { setSaveDialogOpen((o) => !o); setSavedOpen(false); }}
          disabled={!query.trim()}
          className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-400 text-sm rounded transition-colors"
          title="Save current query"
        >
          ★
        </button>
        {saveDialogOpen && (
          <div className="absolute left-0 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded shadow-xl z-20 p-2 flex gap-2">
            <input
              ref={saveNameRef}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaveDialogOpen(false); }}
              placeholder="Query name…"
              className="flex-1 bg-gray-900 text-gray-200 text-sm px-2 py-1 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm rounded transition-colors"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* Saved queries dropdown */}
      {savedQueries.length > 0 && (
        <div className="relative flex-shrink-0" ref={savedRef}>
          <button
            onClick={() => { setSavedOpen((o) => !o); setHistoryOpen(false); }}
            className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded transition-colors"
            title="Saved queries"
          >
            ☆ Saved
          </button>
          {savedOpen && (
            <div className="absolute right-0 top-full mt-1 w-[480px] bg-gray-800 border border-gray-700 rounded shadow-xl z-20 max-h-72 overflow-y-auto">
              {savedQueries.map((sq) => (
                <div key={sq.id} className="flex items-center border-b border-gray-700 last:border-0 hover:bg-gray-700 group">
                  <button
                    className="flex-1 text-left px-3 py-2 text-sm text-gray-300 font-mono truncate"
                    onClick={() => {
                      setQuery(sq.query);
                      setSavedOpen(false);
                      setTimeout(autoResize, 0);
                    }}
                  >
                    <span className="text-gray-400 font-sans mr-2">{sq.name}</span>
                    {sq.query}
                  </button>
                  <button
                    onClick={() => deleteSavedQuery(sq.id)}
                    className="px-3 py-2 text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    title="Delete saved query"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History dropdown */}
      {queryHistory.length > 0 && (
        <div className="relative flex-shrink-0" ref={historyRef}>
          <button
            onClick={() => { setHistoryOpen((o) => !o); setSavedOpen(false); }}
            className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded transition-colors"
            title="Query history"
          >
            ▾ History
          </button>
          {historyOpen && (
            <div className="absolute right-0 top-full mt-1 w-[480px] bg-gray-800 border border-gray-700 rounded shadow-xl z-20 max-h-72 overflow-y-auto">
              {queryHistory.map((q, i) => (
                <button
                  key={i}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 font-mono truncate border-b border-gray-700 last:border-0"
                  onClick={() => {
                    setQuery(q);
                    setHistoryOpen(false);
                    setTimeout(autoResize, 0);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Layout picker */}
      <select
        value={layoutAlgorithm}
        onChange={(e) => setLayoutAlgorithm(e.target.value as LayoutAlgorithm)}
        className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded border border-gray-700 focus:outline-none flex-shrink-0"
        title="Layout algorithm"
      >
        {LAYOUTS.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>

      <button
        onClick={() => canvasActions.call('fitToScreen')}
        className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded transition-colors flex-shrink-0"
        title="Fit to screen (F)"
      >
        ⊡ Fit
      </button>

      <button
        onClick={() => canvasActions.call('exportPNG')}
        className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded transition-colors flex-shrink-0"
        title="Export as PNG"
      >
        PNG
      </button>

      <button
        onClick={() => canvasActions.call('exportSVG')}
        className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded transition-colors flex-shrink-0"
        title="Export as SVG"
      >
        SVG
      </button>

      <button
        onClick={() => setSettingsOpen(true)}
        className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded transition-colors flex-shrink-0"
        title="Settings"
      >
        ⚙
      </button>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

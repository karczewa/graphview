import { useState, useRef, useEffect } from 'react';
import { useGraphStore } from '../../store/graphStore.ts';
import { useUiStore } from '../../store/uiStore.ts';

export function Toolbar() {
  const [query, setQuery] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const { runQuery, loading } = useGraphStore();
  const { queryHistory, addToHistory } = useUiStore();
  const historyRef = useRef<HTMLDivElement>(null);

  const run = () => {
    const q = query.trim();
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

  // Close history dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0">
      <div className="flex-1">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="MATCH (n) RETURN n LIMIT 50    —    Ctrl+Enter to run"
          className="w-full bg-gray-800 text-gray-200 text-sm px-3 py-1.5 rounded border border-gray-700 focus:border-blue-500 focus:outline-none resize-none font-mono placeholder-gray-600"
          rows={1}
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

      {queryHistory.length > 0 && (
        <div className="relative flex-shrink-0" ref={historyRef}>
          <button
            onClick={() => setHistoryOpen((o) => !o)}
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
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

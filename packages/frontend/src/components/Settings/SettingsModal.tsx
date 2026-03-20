import { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore.ts';
import { api } from '../../api/client.ts';

interface Props {
  onClose: () => void;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

export function SettingsModal({ onClose }: Props) {
  const { url, username, password, database, maxNodes, setConnection, setMaxNodes } =
    useSettingsStore();

  const [localUrl,      setLocalUrl]      = useState(url);
  const [localUsername, setLocalUsername] = useState(username);
  const [localPassword, setLocalPassword] = useState(password);
  const [localDatabase, setLocalDatabase] = useState(database);
  const [localMaxNodes, setLocalMaxNodes] = useState(String(maxNodes));
  const [testStatus,    setTestStatus]    = useState<TestStatus>('idle');
  const [testError,     setTestError]     = useState('');
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleTest = async () => {
    setTestStatus('testing');
    setTestError('');
    try {
      const result = await api.testConnection(localUrl, localUsername, localPassword, localDatabase);
      if (result.ok) {
        setTestStatus('ok');
      } else {
        setTestStatus('error');
        setTestError(result.error ?? 'Connection failed');
      }
    } catch (e) {
      setTestStatus('error');
      setTestError(e instanceof Error ? e.message : 'Connection failed');
    }
  };

  const handleSave = () => {
    setConnection(localUrl, localUsername, localPassword, localDatabase);
    const parsed = parseInt(localMaxNodes, 10);
    if (!isNaN(parsed) && parsed > 0) setMaxNodes(parsed);
    onClose();
  };

  const inputClass =
    'w-full bg-gray-900 text-gray-200 text-sm px-3 py-1.5 rounded border border-gray-700 focus:border-blue-500 focus:outline-none';
  const labelClass = 'text-xs text-gray-500 mb-1';

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-[420px] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto">
          {/* Connection section */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Connection
            </p>
            <div className="space-y-3">
              <div>
                <p className={labelClass}>Neo4j URL</p>
                <input
                  value={localUrl}
                  onChange={(e) => { setLocalUrl(e.target.value); setTestStatus('idle'); }}
                  placeholder="bolt://localhost:7687"
                  className={inputClass}
                  spellCheck={false}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={labelClass}>Username</p>
                  <input
                    value={localUsername}
                    onChange={(e) => { setLocalUsername(e.target.value); setTestStatus('idle'); }}
                    placeholder="neo4j"
                    className={inputClass}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <p className={labelClass}>Password</p>
                  <input
                    type="password"
                    value={localPassword}
                    onChange={(e) => { setLocalPassword(e.target.value); setTestStatus('idle'); }}
                    placeholder="••••••••"
                    className={inputClass}
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <div>
                <p className={labelClass}>Database</p>
                <input
                  value={localDatabase}
                  onChange={(e) => { setLocalDatabase(e.target.value); setTestStatus('idle'); }}
                  placeholder="neo4j"
                  className={inputClass}
                  spellCheck={false}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTest}
                  disabled={testStatus === 'testing'}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm rounded transition-colors"
                >
                  {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
                </button>
                {testStatus === 'ok' && (
                  <span className="text-sm text-green-400">✓ Connected</span>
                )}
                {testStatus === 'error' && (
                  <span className="text-sm text-red-400 truncate" title={testError}>
                    ✕ {testError}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                Leave blank to use server defaults (env vars).
              </p>
            </div>
          </div>

          {/* Graph section */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Graph
            </p>
            <div>
              <p className={labelClass}>Max nodes per query</p>
              <input
                type="number"
                min={1}
                max={5000}
                value={localMaxNodes}
                onChange={(e) => setLocalMaxNodes(e.target.value)}
                className={`${inputClass} w-32`}
              />
              <p className="text-xs text-gray-600 mt-1">
                Caps how many nodes are returned. Lower values improve performance.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

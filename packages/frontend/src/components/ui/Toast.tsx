import { useUiStore } from '../../store/uiStore.ts';

export function ToastContainer() {
  const { toasts, dismissToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 px-4 py-3 rounded shadow-lg border text-sm ${
            toast.type === 'error'
              ? 'bg-red-950 border-red-800 text-red-200'
              : 'bg-gray-800 border-gray-700 text-gray-200'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-gray-500 hover:text-gray-300 flex-shrink-0 leading-none"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

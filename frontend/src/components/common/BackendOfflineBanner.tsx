import { useEffect, useState } from 'react';
import { checkBackendHealth, API_BASE_URL } from '../../services/api';

export function BackendOfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleOffline = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string; code?: string }>;
      setIsOffline(true);
      setOfflineMessage(
        customEvent.detail?.message ||
          `Backend connection refused at ${API_BASE_URL}. Ensure the FastAPI server is running.`
      );
    };

    window.addEventListener('gatecode:backend_offline', handleOffline);
    return () => {
      window.removeEventListener('gatecode:backend_offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setIsChecking(true);
    try {
      await checkBackendHealth();
      setIsOffline(false);
      setOfflineMessage(null);
    } catch {
      setIsOffline(true);
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOffline) return null;

  return (
    <aside
      aria-label="Backend connectivity alert"
      className="bg-amber-600 text-white px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-medium z-50 sticky top-0"
    >
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 flex-shrink-0 text-amber-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>
          {offlineMessage ||
            `Backend service is unreachable at ${API_BASE_URL}. Please ensure FastAPI is running on port 8000.`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded transition-colors disabled:opacity-50 font-semibold cursor-pointer"
        >
          {isChecking ? 'Checking...' : 'Retry Connection'}
        </button>
        <button
          onClick={() => setIsOffline(false)}
          className="text-amber-200 hover:text-white transition-colors px-1 cursor-pointer"
          title="Dismiss banner"
          aria-label="Dismiss banner"
        >
          ✕
        </button>
      </div>
    </aside>
  );
}

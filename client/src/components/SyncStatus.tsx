import { useState } from 'react';
import { getSyncStatus, syncAll } from '../sync/syncEngine';

export const SyncStatus: React.FC = () => {
  const [status, setStatus] = useState<{ lastSyncAt: string | null }>(() => {
    const { lastSyncAt } = getSyncStatus();
    return { lastSyncAt };
  });
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await syncAll('');
      const { lastSyncAt } = getSyncStatus();
      setStatus({ lastSyncAt });
    } catch (err) {
      setError('Sync failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex items-center gap-2 bg-surface-container-lowest/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-outline-variant text-label-sm">
      <div className={`w-2 h-2 rounded-full ${error ? 'bg-error' : status.lastSyncAt ? 'bg-green-500' : 'bg-outline'}`} />
      <span className="text-on-surface-variant">
        {error
          ? error
          : status.lastSyncAt
            ? `Synced ${new Date(status.lastSyncAt).toLocaleTimeString()}`
            : 'Not synced'}
      </span>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="ml-1 px-2 py-0.5 bg-primary text-on-primary rounded-full text-label-sm font-bold hover:brightness-110 transition-all"
      >
        {syncing ? '...' : 'Sync'}
      </button>
    </div>
  );
};

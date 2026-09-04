import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncEngine } from './syncEngine';
import { db } from '../db/database';

vi.mock('./mergeEngine', () => ({
  mergeLastWriteWins: vi.fn().mockResolvedValue({
    mergedPayload: { version: 1, exportedAt: new Date().toISOString() },
    stats: { inserted: 0, updated: 0, deleted: 0 }
  }),
  getLocalMasterPayload: vi.fn().mockResolvedValue({ version: 1 })
}));

describe('DecentralizedSyncEngine - Auto-Sync and Pending Changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    syncEngine.stopAutoSync();
  });

  afterEach(() => {
    syncEngine.stopAutoSync();
  });

  it('notifica mutación local marcando hasPendingChanges en true', () => {
    let observedPending = false;
    const unsubscribe = syncEngine.subscribe(({ hasPendingChanges }) => {
      observedPending = hasPendingChanges;
    });

    syncEngine.notifyLocalMutation();

    expect(syncEngine.getHasPendingChanges()).toBe(true);
    expect(observedPending).toBe(true);
    expect(localStorage.getItem('ieba_sync_pending_changes')).toBe('true');

    unsubscribe();
  });

  it('resetea hasPendingChanges tras executeSync exitoso', async () => {
    syncEngine.notifyLocalMutation();
    expect(syncEngine.getHasPendingChanges()).toBe(true);

    const mockProvider = {
      type: 'local_file' as const,
      name: 'Mock Provider',
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(undefined),
      readMasterPayload: vi.fn().mockResolvedValue(null),
      writeMasterPayload: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(syncEngine, 'getProvider').mockReturnValue(mockProvider as any);
    vi.spyOn(db.config, 'toArray').mockResolvedValue([]);

    const result = await syncEngine.executeSync();

    expect(result.success).toBe(true);
    expect(syncEngine.getHasPendingChanges()).toBe(false);
    expect(localStorage.getItem('ieba_sync_pending_changes')).toBe('false');
    expect(localStorage.getItem('ieba_last_sync_time')).toBeTruthy();
  });

  it('inicia y detiene auto-sync correctamente', () => {
    const docAddSpy = vi.spyOn(document, 'addEventListener');
    const docRemoveSpy = vi.spyOn(document, 'removeEventListener');
    const winAddSpy = vi.spyOn(window, 'addEventListener');
    const winRemoveSpy = vi.spyOn(window, 'removeEventListener');

    syncEngine.startAutoSync(10);
    expect(docAddSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(winAddSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(winAddSpy).toHaveBeenCalledWith('online', expect.any(Function));

    syncEngine.stopAutoSync();
    expect(docRemoveSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(winRemoveSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(winRemoveSpy).toHaveBeenCalledWith('online', expect.any(Function));
  });
});

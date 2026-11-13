import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadDatabaseJSONBackup } from './backupUtils';
import * as databaseModule from '../db/database';

describe('backupUtils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exporta JSON y dispara la descarga del archivo de respaldo', async () => {
    vi.spyOn(databaseModule, 'exportDatabaseJSON').mockResolvedValue('{"schemaVersion":9}');

    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    const result = await downloadDatabaseJSONBackup();

    expect(result.filename).toMatch(/^Cotizador-IEBA-Backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(result.json).toBe('{"schemaVersion":9}');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

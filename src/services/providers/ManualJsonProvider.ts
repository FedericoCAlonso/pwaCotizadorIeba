import { SyncProvider, MasterDatabasePayload } from '../syncTypes';

export class ManualJsonProvider implements SyncProvider {
  readonly type = 'manual_json' as const;
  readonly name = 'Respaldo Manual (Archivo JSON)';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async connect(): Promise<boolean> {
    return true;
  }

  async disconnect(): Promise<void> {}

  async readMasterPayload(): Promise<MasterDatabasePayload | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          resolve(parsed as MasterDatabasePayload);
        } catch {
          resolve(null);
        }
      };
      input.click();
    });
  }

  async writeMasterPayload(payload: MasterDatabasePayload): Promise<boolean> {
    try {
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Cotizador-IEBA-Master-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }

  getStatus(): { isConfigured: boolean; label: string; details?: string } {
    return {
      isConfigured: true,
      label: 'Respaldo Manual Disponible',
      details: 'Exporta o restaura archivos JSON manualmente cuando lo desees.'
    };
  }
}

import { SyncProvider, MasterDatabasePayload } from '../syncTypes';

const DRIVE_FILE_NAME = 'cotizador_ieba_master.json';
const TOKEN_KEY = 'ieba_gdrive_access_token';
const TOKEN_EXPIRY_KEY = 'ieba_gdrive_token_expires_at';
const USER_EMAIL_KEY = 'ieba_gdrive_user_email';

export class GoogleDriveProvider implements SyncProvider {
  readonly type = 'google_drive' as const;
  readonly name = 'Google Drive (Personal del Usuario)';
  private cachedFileId: string | null = null;

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined';
  }

  getAccessToken(): string | null {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const expiresAtStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (!token) return null;
      if (expiresAtStr) {
        const expiresAt = parseInt(expiresAtStr, 10);
        if (Date.now() > expiresAt) {
          // Token expirado
          return null;
        }
      }
      return token;
    } catch {
      return null;
    }
  }

  setAccessToken(token: string, expiresInSeconds = 3600, email?: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + (expiresInSeconds - 60) * 1000));
    if (email) {
      localStorage.setItem(USER_EMAIL_KEY, email);
    }
  }

  async connect(): Promise<boolean> {
    const token = this.getAccessToken();
    if (token) return true;

    // Si no hay token, solicitar autorización usando Google Identity Services si está disponible
    return new Promise((resolve) => {
      if (typeof (window as any).google?.accounts?.oauth2?.initTokenClient === 'function') {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '1088497258359-dummy.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (response: any) => {
            if (response.access_token) {
              this.setAccessToken(response.access_token, response.expires_in || 3600);
              resolve(true);
            } else {
              resolve(false);
            }
          },
          error_callback: () => resolve(false)
        });
        client.requestAccessToken();
      } else {
        // Fallback: Si el usuario ingresa su token o autentica con popup
        const manualToken = prompt('Ingresa tu Google Drive OAuth Token (o inicia sesión con Google en la app):');
        if (manualToken && manualToken.trim().length > 10) {
          this.setAccessToken(manualToken.trim(), 3600);
          resolve(true);
        } else {
          resolve(false);
        }
      }
    });
  }

  async disconnect(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    this.cachedFileId = null;
  }

  private async findMasterFileId(token: string): Promise<string | null> {
    if (this.cachedFileId) return this.cachedFileId;

    const q = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      if (res.status === 401) {
        this.disconnect();
        throw new Error('Sesión de Google Drive expirada. Por favor vuelve a conectar tu cuenta.');
      }
      throw new Error(`Error al buscar archivo en Google Drive: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      this.cachedFileId = data.files[0].id;
      return this.cachedFileId;
    }

    return null;
  }

  async readMasterPayload(): Promise<MasterDatabasePayload | null> {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const fileId = await this.findMasterFileId(token);
      if (!fileId) return null;

      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        console.warn('[GDriveProvider] No se pudo leer el contenido del archivo maestro:', res.status);
        return null;
      }

      const text = await res.text();
      if (!text || text.trim().length === 0) return null;
      return JSON.parse(text) as MasterDatabasePayload;
    } catch (err) {
      console.warn('[GDriveProvider] Error al leer payload desde Google Drive:', err);
      return null;
    }
  }

  async writeMasterPayload(payload: MasterDatabasePayload): Promise<boolean> {
    const token = this.getAccessToken();
    if (!token) {
      const ok = await this.connect();
      if (!ok) return false;
    }
    const validToken = this.getAccessToken();
    if (!validToken) return false;

    const jsonStr = JSON.stringify(payload, null, 2);

    try {
      const fileId = await this.findMasterFileId(validToken);

      if (fileId) {
        // Actualizar archivo existente (PATCH)
        const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${validToken}`,
            'Content-Type': 'application/json'
          },
          body: jsonStr
        });

        if (!res.ok) {
          throw new Error(`Error al actualizar archivo en Google Drive: HTTP ${res.status}`);
        }
        return true;
      } else {
        // Crear nuevo archivo (Multipart POST)
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const metadata = {
          name: DRIVE_FILE_NAME,
          mimeType: 'application/json'
        };

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          jsonStr +
          closeDelimiter;

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        });

        if (!res.ok) {
          throw new Error(`Error al crear archivo en Google Drive: HTTP ${res.status}`);
        }

        const data = await res.json();
        this.cachedFileId = data.id;
        return true;
      }
    } catch (err) {
      console.error('[GDriveProvider] Error al escribir en Google Drive:', err);
      throw err;
    }
  }

  getStatus(): { isConfigured: boolean; label: string; details?: string } {
    const token = this.getAccessToken();
    const email = localStorage.getItem(USER_EMAIL_KEY);
    return {
      isConfigured: token !== null,
      label: token ? (email ? `Conectado: ${email}` : 'Google Drive Conectado') : 'Google Drive No Conectado',
      details: token
        ? 'Sincronización directa en tu cuenta personal de Google Drive.'
        : 'Haz clic para vincular tu cuenta de Google.'
    };
  }
}

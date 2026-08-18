import { SyncProvider, MasterDatabasePayload } from '../syncTypes';
import { auth, googleProvider } from '../../config/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

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

    // 1. Re-obtener token de Google mediante Firebase Auth Popup
    if (auth) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          this.setAccessToken(credential.accessToken, 3600, result.user.email || undefined);
          return true;
        }
      } catch (err: any) {
        console.warn('[GoogleDriveProvider] Autenticación con Google cancelada o fallida:', err);
        if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
          return false;
        }
      }
    }

    // 2. Si Google Identity Services (GIS) está presente en window
    if (typeof (window as any).google?.accounts?.oauth2?.initTokenClient === 'function') {
      return new Promise((resolve) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '1088497258359-dummy.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata',
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
      });
    }

    return false;
  }

  async disconnect(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    this.cachedFileId = null;
  }

  private async handleDriveError(res: Response, defaultAction: string): Promise<never> {
    if (res.status === 401) {
      this.disconnect();
      throw new Error('Sesión de Google Drive expirada. Por favor vuelve a iniciar sesión con Google.');
    }

    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson.error?.message || errJson.message || '';
    } catch {
      // ignore
    }

    if (res.status === 403) {
      if (detail.toLowerCase().includes('not been used') || detail.toLowerCase().includes('disabled') || detail.toLowerCase().includes('activation')) {
        throw new Error(
          `Google Drive API no está habilitada en tu proyecto de Google Cloud (${detail}). Puedes habilitarla en https://console.cloud.google.com o cambiar el método a "📁 Carpeta Local" para sincronizar sin APIs.`
        );
      }
      if (detail.toLowerCase().includes('scope') || detail.toLowerCase().includes('insufficient') || detail.toLowerCase().includes('permission')) {
        this.disconnect();
        throw new Error(
          'Permisos insuficientes para Google Drive. Vuelve a iniciar sesión con Google para conceder permisos de lectura y escritura.'
        );
      }
      throw new Error(
        `Error 403 en Google Drive: ${detail || 'Permisos insuficientes o API deshabilitada'}. Puedes usar "📁 Carpeta Local" para sincronizar tus datos en disco.`
      );
    }

    throw new Error(`${defaultAction}: HTTP ${res.status}${detail ? ` (${detail})` : ''}`);
  }

  private async findMasterFileId(token: string): Promise<string | null> {
    if (this.cachedFileId) return this.cachedFileId;

    const q = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&spaces=drive`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      await this.handleDriveError(res, 'Error al buscar archivo en Google Drive');
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      this.cachedFileId = data.files[0].id;
      return this.cachedFileId;
    }

    return null;
  }

  async readMasterPayload(): Promise<MasterDatabasePayload | null> {
    let token = this.getAccessToken();
    if (!token) {
      const ok = await this.connect();
      if (!ok) {
        console.warn('[GDriveProvider] No se pudo obtener token para leer archivo maestro');
        return null;
      }
      token = this.getAccessToken();
    }
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
      throw err;
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
          await this.handleDriveError(res, 'Error al actualizar archivo en Google Drive');
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
          await this.handleDriveError(res, 'Error al crear archivo en Google Drive');
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

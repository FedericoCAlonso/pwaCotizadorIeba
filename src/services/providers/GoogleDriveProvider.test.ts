import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDriveProvider } from './GoogleDriveProvider';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: {
    credentialFromResult: vi.fn()
  }
}));

vi.mock('../../config/firebase', () => ({
  auth: { currentUser: null },
  googleProvider: {}
}));

describe('GoogleDriveProvider - Authentication and Token Management', () => {
  let provider: GoogleDriveProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    provider = new GoogleDriveProvider();
  });

  it('retorna null cuando no hay token en localStorage', () => {
    expect(provider.getAccessToken()).toBeNull();
  });

  it('almacena el token y calcula la expiración con setAccessToken', () => {
    provider.setAccessToken('mock_token_123', 3600, 'test@ieba.com');
    expect(provider.getAccessToken()).toBe('mock_token_123');
    expect(localStorage.getItem('ieba_gdrive_access_token')).toBe('mock_token_123');
    expect(localStorage.getItem('ieba_gdrive_user_email')).toBe('test@ieba.com');
  });

  it('retorna null cuando el token ha expirado', () => {
    // Expirado hace 10 segundos
    localStorage.setItem('ieba_gdrive_access_token', 'expired_token');
    localStorage.setItem('ieba_gdrive_token_expires_at', String(Date.now() - 10000));

    expect(provider.getAccessToken()).toBeNull();
  });

  it('lanza un error claro en readMasterPayload si el token expiró sin abrir popup', async () => {
    // Token expirado
    localStorage.setItem('ieba_gdrive_access_token', 'expired_token');
    localStorage.setItem('ieba_gdrive_token_expires_at', String(Date.now() - 10000));

    await expect(provider.readMasterPayload()).rejects.toThrow(
      'Sesión de Google Drive expirada o no iniciada'
    );

    // Debe garantizar que NO se ejecutó signInWithPopup en segundo plano
    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  it('lanza un error claro en writeMasterPayload si el token expiró sin abrir popup', async () => {
    // Token expirado
    localStorage.setItem('ieba_gdrive_access_token', 'expired_token');
    localStorage.setItem('ieba_gdrive_token_expires_at', String(Date.now() - 10000));

    const mockPayload: any = { version: 1 };
    await expect(provider.writeMasterPayload(mockPayload)).rejects.toThrow(
      'Sesión de Google Drive expirada o no iniciada'
    );

    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  it('disconnect limpia todos los tokens y estado de almacenamiento', async () => {
    provider.setAccessToken('token_to_remove', 3600, 'user@test.com');
    expect(provider.getAccessToken()).toBe('token_to_remove');

    await provider.disconnect();

    expect(provider.getAccessToken()).toBeNull();
    expect(localStorage.getItem('ieba_gdrive_access_token')).toBeNull();
    expect(localStorage.getItem('ieba_gdrive_token_expires_at')).toBeNull();
    expect(localStorage.getItem('ieba_gdrive_user_email')).toBeNull();
  });

  it('getStatus refleja con precisión el estado conectado vs expirado', () => {
    const statusBefore = provider.getStatus();
    expect(statusBefore.isConfigured).toBe(false);
    expect(statusBefore.label).toContain('Desconectado');

    provider.setAccessToken('valid_token', 3600, 'operador@ieba.com');

    const statusAfter = provider.getStatus();
    expect(statusAfter.isConfigured).toBe(true);
    expect(statusAfter.label).toBe('Conectado: operador@ieba.com');
  });

  it('connect() interactivo obtiene token de Google exitosamente', async () => {
    const mockUser = { email: 'login@ieba.com' };
    (signInWithPopup as any).mockResolvedValue({ user: mockUser });
    (GoogleAuthProvider.credentialFromResult as any).mockReturnValue({
      accessToken: 'fresh_google_token_777'
    });

    const success = await provider.connect();

    expect(success).toBe(true);
    expect(provider.getAccessToken()).toBe('fresh_google_token_777');
    expect(localStorage.getItem('ieba_gdrive_user_email')).toBe('login@ieba.com');
  });

  it('connect() retorna false si el usuario cierra el popup sin autenticar', async () => {
    (signInWithPopup as any).mockRejectedValue({ code: 'auth/popup-closed-by-user' });

    const success = await provider.connect();

    expect(success).toBe(false);
    expect(provider.getAccessToken()).toBeNull();
  });
});

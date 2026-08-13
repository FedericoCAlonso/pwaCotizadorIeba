import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, UserPlus, Mail, Lock, AlertCircle, X, Check, ShieldCheck, KeyRound } from 'lucide-react';
import { saveCustomFirebaseConfig, getFirebaseConfig } from '../config/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { isConfigured, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'setupConfig'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Custom Firebase Setup state
  const currentConfig = getFirebaseConfig();
  const [cfgApiKey, setCfgApiKey] = useState(currentConfig?.apiKey || '');
  const [cfgAuthDomain, setCfgAuthDomain] = useState(currentConfig?.authDomain || '');
  const [cfgProjectId, setCfgProjectId] = useState(currentConfig?.projectId || '');
  const [cfgAppId, setCfgAppId] = useState(currentConfig?.appId || '');

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        onClose();
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password);
        onClose();
      } else if (mode === 'reset') {
        await resetPassword(email);
        setSuccessMsg('Te enviamos un correo para restablecer tu contraseña. Revisá tu casilla.');
      }
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfgApiKey || !cfgProjectId || !cfgAppId) {
      setError('Por favor completá los campos obligatorios: API Key, Project ID y App ID.');
      return;
    }
    saveCustomFirebaseConfig({
      apiKey: cfgApiKey.trim(),
      authDomain: cfgAuthDomain.trim() || `${cfgProjectId.trim()}.firebaseapp.com`,
      projectId: cfgProjectId.trim(),
      appId: cfgAppId.trim()
    });
  };

  function getErrorMessage(err: any): string {
    const code = err?.code || '';
    if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) {
      return 'Correo electrónico o contraseña incorrectos.';
    }
    if (code.includes('auth/email-already-in-use')) {
      return 'Ya existe una cuenta registrada con este correo electrónico.';
    }
    if (code.includes('auth/weak-password')) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (code.includes('auth/invalid-email')) {
      return 'El formato del correo electrónico no es válido.';
    }
    if (code.includes('auth/popup-closed-by-user')) {
      return 'Se cerró la ventana de inicio de sesión con Google.';
    }
    return err.message || 'Ocurrió un error inesperado al autenticar.';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-surface border-t sm:border border-outline-variant/30 text-on-surface rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] pb-safe">
        {/* Mobile Drag indicator */}
        <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2.5 font-bold text-primary">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="text-base sm:text-lg">Acceso Multidispositivo</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {/* Unconfigured Alert */}
          {!isConfigured && mode !== 'setupConfig' && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Configuración de Firebase requerida</span>
              </div>
              <p>
                Para habilitar el inicio de sesión y sincronización multidispositivo, podés cargar las credenciales de tu proyecto Firebase.
              </p>
              <button
                type="button"
                onClick={() => setMode('setupConfig')}
                className="self-start underline font-bold mt-1 text-primary hover:text-primary/80"
              >
                Configurar credenciales de Firebase →
              </button>
            </div>
          )}

          {mode === 'setupConfig' ? (
            /* Setup Config Form */
            <form onSubmit={handleSaveConfig} className="flex flex-col gap-4">
              <h3 className="font-bold text-sm text-on-surface">Credenciales de Tu Proyecto Firebase</h3>
              <p className="text-xs text-on-surface-variant">
                Ingresá las claves de tu proyecto Firebase (consola Firebase &gt; Configuración del proyecto).
              </p>

              <div>
                <label className="block text-xs font-semibold mb-1">API Key *</label>
                <input
                  type="text"
                  required
                  placeholder="AIzaSy..."
                  value={cfgApiKey}
                  onChange={(e) => setCfgApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-high border border-outline-variant/40 text-xs font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Project ID *</label>
                <input
                  type="text"
                  required
                  placeholder="ieba-cotizador"
                  value={cfgProjectId}
                  onChange={(e) => setCfgProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-high border border-outline-variant/40 text-xs font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">App ID *</label>
                <input
                  type="text"
                  required
                  placeholder="1:123456789:web:abcdef..."
                  value={cfgAppId}
                  onChange={(e) => setCfgAppId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-high border border-outline-variant/40 text-xs font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Auth Domain (Opcional)</label>
                <input
                  type="text"
                  placeholder="ieba-cotizador.firebaseapp.com"
                  value={cfgAuthDomain}
                  onChange={(e) => setCfgAuthDomain(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-high border border-outline-variant/40 text-xs font-mono focus:outline-none focus:border-primary"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary text-on-primary py-2.5 rounded-xl text-xs font-semibold shadow-sm hover:bg-primary/90 transition-colors"
                >
                  Guardar y Recargar
                </button>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="px-4 py-2.5 rounded-xl border border-outline-variant/40 text-xs font-semibold hover:bg-surface-variant transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            /* Auth Form (Login / Signup / Reset) */
            <>
              {/* Mode Tabs */}
              {mode !== 'reset' && (
                <div className="flex bg-surface-container-high p-1 rounded-2xl mb-6 border border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null); }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                      mode === 'login'
                        ? 'bg-surface text-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Iniciar Sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('signup'); setError(null); }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                      mode === 'signup'
                        ? 'bg-surface text-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Crear Cuenta
                  </button>
                </div>
              )}

              {/* Google Auth Button */}
              {isConfigured && mode !== 'reset' && (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full mb-4 py-2.5 px-4 bg-surface-container-high border border-outline-variant/40 text-on-surface hover:bg-surface-container-highest rounded-2xl text-xs font-semibold flex items-center justify-center gap-3 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continuar con Google</span>
                </button>
              )}

              {isConfigured && mode !== 'reset' && (
                <div className="relative my-4 text-center">
                  <hr className="border-outline-variant/30" />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface px-3 text-[11px] text-on-surface-variant font-medium">
                    o con correo
                  </span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-on-surface">Correo Electrónico</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="email"
                      required
                      placeholder="electricista@ieba.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-surface-container-high border border-outline-variant/40 text-xs focus:outline-none focus:border-primary text-on-surface"
                    />
                  </div>
                </div>

                {mode !== 'reset' && (
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-on-surface">Contraseña</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-surface-container-high border border-outline-variant/40 text-xs focus:outline-none focus:border-primary text-on-surface"
                      />
                    </div>
                  </div>
                )}

                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError(null); setSuccessMsg(null); }}
                    className="self-end text-[11px] font-medium text-primary hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}

                {error && (
                  <div className="p-3 rounded-2xl bg-error-container text-on-error-container text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 rounded-2xl bg-tertiary-container text-on-tertiary-container text-xs font-medium flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0 text-tertiary" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !isConfigured}
                  className="w-full mt-2 py-3 bg-primary text-on-primary font-semibold rounded-2xl text-xs shadow-md hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  ) : mode === 'login' ? (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Iniciar Sesión</span>
                    </>
                  ) : mode === 'signup' ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Crear Cuenta</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Restablecer Contraseña</span>
                    </>
                  )}
                </button>
              </form>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
                  className="w-full mt-3 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface underline text-center"
                >
                  ← Volver a Iniciar Sesión
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

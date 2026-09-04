import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../config/firebase';
import { syncEngine } from '../services/syncEngine';
import { SyncProviderType } from '../core/types';
import { SyncExecutionResult } from '../services/syncTypes';

export type SyncStatusState = 'idle' | 'syncing' | 'pending' | 'synced' | 'error';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  syncState: SyncStatusState;
  syncErrorMessage: string | null;
  lastSyncTime: Date | null;
  lastResult?: SyncExecutionResult;
  activeProvider: SyncProviderType;
  hasPendingChanges: boolean;
  setActiveProvider: (type: SyncProviderType) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (e: string, p: string) => Promise<void>;
  signUpWithEmail: (e: string, p: string) => Promise<void>;
  resetPassword: (e: string) => Promise<void>;
  logout: () => Promise<void>;
  triggerSync: (provider?: SyncProviderType) => Promise<SyncExecutionResult>;
  triggerCleanup: () => Promise<SyncExecutionResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(() => syncEngine.getHasPendingChanges());
  const [syncState, setSyncState] = useState<SyncStatusState>(() => {
    if (syncEngine.getHasPendingChanges()) return 'pending';
    const saved = localStorage.getItem('ieba_last_sync_time');
    return saved ? 'synced' : 'idle';
  });
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    try {
      const saved = localStorage.getItem('ieba_last_sync_time');
      return saved ? new Date(saved) : null;
    } catch {
      return null;
    }
  });
  const [lastResult, setLastResult] = useState<SyncExecutionResult | undefined>(undefined);
  const [activeProvider, setActiveProviderState] = useState<SyncProviderType>(() => syncEngine.getActiveProviderType());
  const isConfigured = isFirebaseConfigured();

  const setActiveProvider = (type: SyncProviderType) => {
    setActiveProviderState(type);
    syncEngine.setActiveProviderType(type);
  };

  useEffect(() => {
    // Iniciar temporizador y listeners reactivos de sincronización en segundo plano
    syncEngine.startAutoSync(5);

    const unsubscribeSync = syncEngine.subscribe(({ isSyncing, hasPendingChanges: pending, lastResult }) => {
      setHasPendingChanges(pending);
      if (isSyncing) {
        setSyncState('syncing');
      } else if (lastResult && !lastResult.success) {
        setSyncState('error');
        setSyncErrorMessage(lastResult.message || lastResult.error || 'Error al sincronizar');
      } else if (pending) {
        setSyncState('pending');
        setSyncErrorMessage(null);
      } else if (lastResult?.success) {
        setSyncState('synced');
        setLastSyncTime(new Date(lastResult.timestamp));
        setSyncErrorMessage(null);
      } else if (localStorage.getItem('ieba_last_sync_time')) {
        setSyncState('synced');
        setSyncErrorMessage(null);
      } else {
        setSyncState('idle');
      }
    });

    if (!auth) {
      setLoading(false);
      return () => {
        syncEngine.stopAutoSync();
        unsubscribeSync();
      };
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      syncEngine.stopAutoSync();
      unsubscribeSync();
      unsubscribeAuth();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase no está configurado');
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential && credential.accessToken) {
      syncEngine.getGoogleDriveProvider().setAccessToken(
        credential.accessToken,
        3600,
        result.user.email || undefined
      );
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    if (!auth) throw new Error('Firebase no está configurado');
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    if (!auth) throw new Error('Firebase no está configurado');
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error('Firebase no está configurado');
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    syncEngine.getGoogleDriveProvider().disconnect();
    setSyncState('idle');
  };

  const triggerSync = async (provider?: SyncProviderType): Promise<SyncExecutionResult> => {
    setSyncState('syncing');
    setSyncErrorMessage(null);
    try {
      const res = await syncEngine.executeSync(provider || activeProvider);
      setSyncState('synced');
      setLastSyncTime(new Date());
      setLastResult(res);
      return res;
    } catch (err: any) {
      setSyncState('error');
      const msg = err.message || 'Error al ejecutar sincronización.';
      setSyncErrorMessage(msg);
      throw err;
    }
  };

  const triggerCleanup = async (): Promise<SyncExecutionResult> => {
    setSyncState('syncing');
    setSyncErrorMessage(null);
    try {
      const res = await syncEngine.executeDataCleanup();
      setSyncState('synced');
      setLastSyncTime(new Date());
      setLastResult(res);
      return res;
    } catch (err: any) {
      setSyncState('error');
      const msg = err.message || 'Error al ejecutar limpieza de datos.';
      setSyncErrorMessage(msg);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured,
        hasPendingChanges,
        syncState,
        syncErrorMessage,
        lastSyncTime,
        lastResult,
        activeProvider,
        setActiveProvider,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        logout,
        triggerSync,
        triggerCleanup
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};

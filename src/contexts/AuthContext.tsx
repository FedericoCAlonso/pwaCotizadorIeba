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

export type SyncStatusState = 'idle' | 'syncing' | 'synced' | 'error';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  syncState: SyncStatusState;
  syncErrorMessage: string | null;
  lastSyncTime: Date | null;
  lastResult?: SyncExecutionResult;
  activeProvider: SyncProviderType;
  setActiveProvider: (type: SyncProviderType) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (e: string, p: string) => Promise<void>;
  signUpWithEmail: (e: string, p: string) => Promise<void>;
  resetPassword: (e: string) => Promise<void>;
  logout: () => Promise<void>;
  triggerSync: (provider?: SyncProviderType) => Promise<SyncExecutionResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncState, setSyncState] = useState<SyncStatusState>('idle');
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
    const unsubscribeSync = syncEngine.subscribe(({ isSyncing, lastResult }) => {
      if (isSyncing) {
        setSyncState('syncing');
      } else if (lastResult) {
        setSyncState(lastResult.success ? 'synced' : 'error');
        setLastResult(lastResult);
        if (lastResult.success) {
          setLastSyncTime(new Date(lastResult.timestamp));
          setSyncErrorMessage(null);
        } else {
          setSyncErrorMessage(lastResult.message || lastResult.error || 'Error al sincronizar');
        }
      }
    });

    if (!auth) {
      setLoading(false);
      return unsubscribeSync;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured,
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
        triggerSync
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

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../config/firebase';
import { syncUserData, startRealtimeSync, setupDexieHooks, stopRealtimeSync, isQuotaError, resetQuotaExceededState, SyncState } from '../services/syncService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  syncState: SyncState;
  lastSyncTime: Date | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (e: string, p: string) => Promise<void>;
  signUpWithEmail: (e: string, p: string) => Promise<void>;
  resetPassword: (e: string) => Promise<void>;
  logout: () => Promise<void>;
  triggerSync: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const isConfigured = isFirebaseConfigured();

  const handleSync = async (currentUser: User) => {
    if (!navigator.onLine) {
      setSyncState('offline');
      return;
    }

    try {
      setSyncState('syncing');
      await syncUserData(currentUser.uid);
      setSyncState('synced');
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error('Error durante la sincronización con Firebase:', err);
      if (isQuotaError(err)) {
        setSyncState('quota_exceeded');
      } else {
        setSyncState('error');
      }
    }
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let activeStopRealtimeListener: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (activeStopRealtimeListener) {
        activeStopRealtimeListener();
        activeStopRealtimeListener = null;
      }

      if (currentUser) {
        setupDexieHooks(currentUser.uid);
        await handleSync(currentUser);

        // Start realtime sync listener for multi-device sync
        activeStopRealtimeListener = startRealtimeSync(
          currentUser.uid,
          () => {
            setLastSyncTime(new Date());
            setSyncState('synced');
          },
          (err) => {
            if (isQuotaError(err)) {
              setSyncState('quota_exceeded');
            } else {
              setSyncState('error');
            }
          }
        );
      } else {
        setupDexieHooks(null);
        stopRealtimeSync();
        setSyncState('idle');
      }
    });

    // Network status change sync handler
    const handleOnline = () => {
      if (auth?.currentUser) {
        handleSync(auth.currentUser);
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      unsubscribeAuth();
      if (activeStopRealtimeListener) {
        activeStopRealtimeListener();
      }
      stopRealtimeSync();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase no está configurado');
    await signInWithPopup(auth, googleProvider);
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
    setupDexieHooks(null);
    stopRealtimeSync();
    await firebaseSignOut(auth);
  };

  const triggerSync = async () => {
    if (user) {
      resetQuotaExceededState();
      await handleSync(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured,
        syncState,
        lastSyncTime,
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

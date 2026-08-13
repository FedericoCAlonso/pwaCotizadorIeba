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
import {
  syncUserData,
  flushPendingSync,
  startSyncScheduler,
  stopSyncScheduler,
  setupDexieHooks,
  resetQuotaExceededState,
  isCircuitBreakerActive,
  getPendingSyncCount,
  SyncState
} from '../services/syncService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  syncState: SyncState;
  lastSyncTime: Date | null;
  pendingCount: number;
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
  const [pendingCount, setPendingCount] = useState<number>(0);
  const isConfigured = isFirebaseConfigured();

  const updatePendingCount = async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  };

  const handleSync = async (currentUser: User) => {
    if (!navigator.onLine) {
      setSyncState('offline');
      await updatePendingCount();
      return;
    }

    if (isCircuitBreakerActive()) {
      setSyncState('quota_exceeded');
      await updatePendingCount();
      return;
    }

    try {
      setSyncState('syncing');
      const resultState = await syncUserData(currentUser.uid);
      setSyncState(resultState);
      if (resultState === 'synced') {
        setLastSyncTime(new Date());
      }
      await updatePendingCount();
    } catch (err: any) {
      console.error('Error durante la sincronización con Firebase:', err);
      if (isCircuitBreakerActive()) {
        setSyncState('quota_exceeded');
      } else {
        setSyncState('error');
      }
      await updatePendingCount();
    }
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        setupDexieHooks(currentUser.uid);
        startSyncScheduler(currentUser.uid, 5);
        await handleSync(currentUser);
      } else {
        setupDexieHooks(null);
        stopSyncScheduler();
        setSyncState('idle');
        setPendingCount(0);
      }
    });

    const handleOnline = () => {
      if (auth?.currentUser) {
        handleSync(auth.currentUser);
      }
    };

    window.addEventListener('online', handleOnline);

    // Dynamic pending items counter polling (unintrusive every 10s)
    const pendingTimer = setInterval(updatePendingCount, 10000);

    return () => {
      unsubscribeAuth();
      stopSyncScheduler();
      clearInterval(pendingTimer);
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
    stopSyncScheduler();
    await firebaseSignOut(auth);
    setSyncState('idle');
    setPendingCount(0);
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
        pendingCount,
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

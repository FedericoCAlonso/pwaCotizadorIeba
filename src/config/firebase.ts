import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { localFirebaseConfig } from './firebaseCredentials';

export interface FirebaseConfigParams {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

// Default fallback config from env vars, localStorage custom config, or localFirebaseConfig
export const getFirebaseConfig = (): FirebaseConfigParams | null => {
  const savedCustomConfig = localStorage.getItem('ieba_custom_firebase_config');
  if (savedCustomConfig) {
    try {
      return JSON.parse(savedCustomConfig);
    } catch {
      // Invalid JSON fallback
    }
  }

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;

  if (apiKey && projectId && appId) {
    return {
      apiKey,
      authDomain: authDomain || `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId
    };
  }

  // Fallback a configuración local si está disponible
  if (typeof localFirebaseConfig !== 'undefined' && localFirebaseConfig.apiKey) {
    return localFirebaseConfig;
  }

  return null;
};

// Initialize Firebase App
const currentConfig = getFirebaseConfig();

export const app = currentConfig
  ? (getApps().length === 0 ? initializeApp(currentConfig) : getApp())
  : null;

export const auth = app ? getAuth(app) : null;
export const dbFirestore = app ? getFirestore(app) : null;
export const googleProvider = new GoogleAuthProvider();

export const isFirebaseConfigured = (): boolean => {
  return currentConfig !== null && auth !== null && dbFirestore !== null;
};

export const saveCustomFirebaseConfig = (config: FirebaseConfigParams): void => {
  localStorage.setItem('ieba_custom_firebase_config', JSON.stringify(config));
  window.location.reload();
};

export const clearCustomFirebaseConfig = (): void => {
  localStorage.removeItem('ieba_custom_firebase_config');
  window.location.reload();
};

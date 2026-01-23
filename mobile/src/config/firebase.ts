import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
//@ts-ignore - getReactNativePersistence exists in react-native bundle
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCgnAJArcnq8SXkWta_f61S05Z2Wue03bc",
  authDomain: "voicenote-pro-f6a9d.firebaseapp.com",
  projectId: "voicenote-pro-f6a9d",
  storageBucket: "voicenote-pro-f6a9d.firebasestorage.app",
  messagingSenderId: "433638665102",
  appId: "1:433638665102:web:53d2d07be98062628dd2df"
};

// Initialize Firebase app (avoid re-initializing)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage persistence for React Native
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error: any) {
  // If auth is already initialized, get the existing instance
  auth = getAuth(app);
}

export { auth };
export default app;

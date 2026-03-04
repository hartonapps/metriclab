import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyABazc2-zAJ0vV0WornddTiu4KHNXrdLmI',
  authDomain: 'metric-lab.firebaseapp.com',
  projectId: 'metric-lab',
  storageBucket: 'metric-lab.firebasestorage.app',
  messagingSenderId: '664213844113',
  appId: '1:664213844113:web:64ddc7d2ea1216cbe54f30',
  measurementId: 'G-CRZGVF8VGF',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

export const FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyDSBakDHYareqA_z8p-Byb3u893FY5GyKQ',
  authDomain: 'cediflow-62b48.firebaseapp.com',
  projectId: 'cediflow-62b48',
  storageBucket: 'cediflow-62b48.firebasestorage.app',
  messagingSenderId: '398501263147',
  appId: '1:398501263147:web:015a2c5a869513fa49b76e'
});

const firebaseApp = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

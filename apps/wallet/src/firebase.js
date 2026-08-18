import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config={apiKey:'AIzaSyDSBakDHYareqA_z8p-Byb3u893FY5GyKQ',authDomain:'cediflow-62b48.firebaseapp.com',projectId:'cediflow-62b48',storageBucket:'cediflow-62b48.firebasestorage.app',messagingSenderId:'398501263147',appId:'1:398501263147:web:015a2c5a869513fa49b76e'};
const app=initializeApp(config);
export const auth=getAuth(app);
export const db=getFirestore(app);

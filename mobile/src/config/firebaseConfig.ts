import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA4grIhtefq92GLacX4h3W1KXsA7gVoqJg',
  authDomain: 'decox-3a9ba.firebaseapp.com',
  projectId: 'decox-3a9ba',
  storageBucket: 'decox-3a9ba.firebasestorage.app',
  messagingSenderId: '1053813152812',
  appId: '1:1053813152812:web:44dd9713755e7b4d9c8589',
  measurementId: 'G-RMTPG96ZWQ',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export default app;

// src/firebase.jsx
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBVs39nQSA-r-AMG-f-iQlDvvcwcrMegxY",
  authDomain: "avacrm-6900e.firebaseapp.com",
  projectId: "avacrm-6900e",
  storageBucket: "avacrm-6900e.firebasestorage.app",
  messagingSenderId: "813051412328",
  appId: "1:813051412328:web:50ae8a080ea9aaff6c20dd",
  measurementId: "G-CDVZT070VS",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Set authentication persistence to 'local'
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    // console.log('Auth persistence set to local');
  })
  .catch((error) => {
    console.error('Error setting auth persistence:', error);
  });
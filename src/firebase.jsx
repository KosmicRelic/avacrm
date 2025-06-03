import { initializeApp } from 'firebase/app';
// import { getAnalytics } from 'firebase/analytics';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBVs39nQSA-r-AMG-f-iQlDvvcwcrMegxY",
  authDomain: "avacrm-6900e.firebaseapp.com",
  projectId: "avacrm-6900e",
  storageBucket: "avacrm-6900e.firebasestorage.app",
  messagingSenderId: "813051412328",
  appId: "1:813051412328:web:50ae8a080ea9aaff6c20dd",
  measurementId: "G-CDVZT070VS",
};

const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'us-central1'); // Specify your region, e.g., 'us-central1'

setPersistence(auth, browserLocalPersistence)
  .then(() => {
    // Auth persistence set to local
  })
  .catch((error) => {
    console.error('Error setting auth persistence:', error);
  });

export { app, auth, db, functions };
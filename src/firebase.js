// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBVs39nQSA-r-AMG-f-iQlDvvcwcrMegxY",
  authDomain: "avacrm-6900e.firebaseapp.com",
  projectId: "avacrm-6900e",
  storageBucket: "avacrm-6900e.firebasestorage.app",
  messagingSenderId: "813051412328",
  appId: "1:813051412328:web:50ae8a080ea9aaff6c20dd",
  measurementId: "G-CDVZT070VS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
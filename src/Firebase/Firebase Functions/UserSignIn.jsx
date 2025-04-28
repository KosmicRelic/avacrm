// src/Firebase/Firebase Functions/UserSignIn.js
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase.jsx'; // Added db import

export const UserSignIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      const error = new Error('User data not found');
      error.code = 'auth/user-data-not-found'; // Added custom error code
      throw error;
    }

    const userData = userDoc.data();
    return {
      uid: user.uid,
      email: user.email,
      businessName: userData.businessName,
      userType: userData.userType,
    };
  } catch (error) {
    throw error;
  }
};
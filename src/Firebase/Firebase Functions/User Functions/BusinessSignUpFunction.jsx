// src/Firebase Functions/User Functions/BusinessSignUp.js
import { auth, db } from '../../../firebase.jsx'; // Adjust path to your Firebase config
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export const BusinessSignUp = async ({
  email,
  password,
  businessName,
  invitationCode,
  userType,
}) => {
  try {
    // Validate invitation code (hardcoded for now)
    if (invitationCode !== '0000') {
      throw new Error('Invalid invitation code');
    }

    // Create user with Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Store user data in Firestore
    const userData = {
      uid: user.uid,
      email: user.email,
      businessName,
      userType, // "business" or "teamMember" for future extensibility
      invitationCode,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'users', user.uid), userData);

    return userData; // Return user data to store in MainContext
  } catch (error) {
    // Handle Firebase errors
    let errorMessage = 'Failed to create account';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Email is already in use';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak';
    } else if (error.message) {
      errorMessage = error.message; // Use custom error (e.g., invalid invitation code)
    }
    throw new Error(errorMessage);
  }
};
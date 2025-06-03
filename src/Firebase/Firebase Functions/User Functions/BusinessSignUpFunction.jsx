// src/Firebase/Firebase Functions/User Functions/BusinessSignUpFunction.jsx
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../../firebase.jsx';

export const BusinessSignUp = async ({
  email,
  password,
  businessName,
  invitationCode,
  userType,
  name, // new
  surname, // new
}) => {
  try {
    const functions = getFunctions(app);
    const businessSignUp = httpsCallable(functions, 'businessSignUp');
    const result = await businessSignUp({
      email,
      password,
      businessName,
      invitationCode,
      userType,
      name, // new
      surname, // new
    });

    return result.data.userData;
  } catch (error) {
    // Log full error for debugging
    console.error('BusinessSignUp error:', {
      code: error.code,
      message: error.message,
      details: error.details,
    });

    let errorMessage = 'Failed to create account';
    if (error.code === 'already-exists') {
      errorMessage = 'Email is already in use';
    } else if (error.code === 'invalid-argument') {
      errorMessage = error.message; // e.g., "Missing required fields"
    } else if (error.message) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};
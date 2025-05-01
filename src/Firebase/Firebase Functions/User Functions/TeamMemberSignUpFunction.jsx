import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../../firebase';

export const TeamMemberSignUpFunction = async ({ email, password, phone, invitationCode }) => {
  try {
    console.log('Sending to teamMemberSignUp:', {
      email,
      password: '[REDACTED]',
      phone,
      invitationCode,
    });

    const functions = getFunctions(app);
    const teamMemberSignUp = httpsCallable(functions, 'teamMemberSignUp');
    const result = await teamMemberSignUp({
      email,
      password,
      phone,
      invitationCode,
    });

    console.log('teamMemberSignUp response:', result.data);
    return result.data.userData;
  } catch (error) {
    console.error('TeamMemberSignUp error:', {
      code: error.code,
      message: error.message,
      details: error.details,
    });

    let errorMessage = 'Failed to create account';
    if (error.code === 'already-exists') {
      errorMessage = 'Email is already in use';
    } else if (error.code === 'invalid-argument' || error.code === 'not-found' || error.code === 'failed-precondition') {
      errorMessage = error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};
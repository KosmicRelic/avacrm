import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { app, db } from '../../../firebase';

export const TeamMemberSignUpFunction = async ({ email, password, phone, name, surname, invitationCode }) => {
  try {
    const normalizedEmail = email.toLowerCase();
    const functions = getFunctions(app);
    const teamMemberSignUp = httpsCallable(functions, 'teamMemberSignUp');
    const result = await teamMemberSignUp({
      email: normalizedEmail,
      password,
      phone,
      name,
      surname,
      invitationCode,
    });

    // Attempt to delete the invitation client-side as a fallback
    try {
      const invitationsQuery = query(
        collection(db, 'invitations'),
        where('invitationCode', '==', invitationCode), // Fixed 'code' to 'invitationCode'
        where('email', '==', normalizedEmail)
      );
      const invitationsSnap = await getDocs(invitationsQuery);
      if (!invitationsSnap.empty) {
        const invitationDoc = invitationsSnap.docs[0];
        await deleteDoc(doc(db, 'invitations', invitationDoc.id));
      }
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      // Proceed even if deletion fails, as Cloud Function should have handled it
    }

    return result.data.userData;
  } catch (_error) {
    let errorMessage = 'Failed to create account';
    if (_error.code === 'already-exists') {
      errorMessage = 'Email is already in use';
    } else if (_error.code === 'invalid-argument' || _error.code === 'not-found' || _error.code === 'failed-precondition') {
      errorMessage = _error.message;
    } else if (_error.message) {
      errorMessage = _error.message;
    }
    throw new Error(errorMessage);
  }
};
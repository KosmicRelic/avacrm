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
    } catch (error) {
      // Proceed even if deletion fails, as Cloud Function should have handled it
    }

    return result.data.userData;
  } catch (error) {
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
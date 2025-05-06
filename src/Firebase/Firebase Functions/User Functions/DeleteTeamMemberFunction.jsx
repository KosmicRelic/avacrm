import { getAuth } from 'firebase/auth';
import { app } from '../../../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

export const DeleteTeamMemberFunction = async ({
  callerUid,
  businessId,
  teamMemberUid,
  email,
  phone,
  invitationCode,
  name,
  surname,
}) => {
  try {
    const auth = getAuth(app);
    const token = await auth.currentUser?.getIdToken(true);

    if (!token) {
      throw new Error('User is not authenticated');
    }

    const functions = getFunctions(app);
    const deleteTeamMember = httpsCallable(functions, 'deleteTeamMember');

    // Send all props for consistency, even if not all are used
    const result = await deleteTeamMember({
      callerUid,
      businessId,
      teamMemberUid,
      email,
      phone,
      invitationCode,
      name,
      surname,
    });

    return result.data;
  } catch (error) {
    throw new Error(error.message || 'Failed to delete team member');
  }
};
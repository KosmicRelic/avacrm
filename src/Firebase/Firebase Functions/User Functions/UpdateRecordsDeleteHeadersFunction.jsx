import { getAuth } from 'firebase/auth';
import { app } from '../../../firebase';

export const UpdateRecordsDeleteHeadersFunction = async ({ businessId, updates }) => {
  try {
    const auth = getAuth(app);
    const token = await auth.currentUser?.getIdToken();

    if (!token) {
      throw new Error('User is not authenticated');
    }

    const response = await fetch(
      'https://updaterecordsdeleteheaders-lsdm7txq6q-uc.a.run.app', // Replace with your actual Firebase Functions URL
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ businessId, updates }),
      }
    );

    if (!response.ok) {
      let errorMessage = 'Failed to update records';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (jsonError) {
        console.error('Failed to parse error response:', jsonError);
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('UpdateRecordsDeleteHeaders error:', {
      message: error.message,
      details: error.details,
    });
    throw new Error(error.message || 'Failed to update records');
  }
};
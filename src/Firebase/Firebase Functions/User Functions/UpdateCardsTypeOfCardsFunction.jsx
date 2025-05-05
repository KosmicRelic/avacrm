import { getAuth } from 'firebase/auth';
import { app } from '../../../firebase'; // Adjust path to your Firebase config

export const UpdateCardsTypeOfCardsFunction = async ({ businessId, updates }) => {
  try {
    // console.log('Sending to updateCardsTypeOfCards:', {
    //   businessId,
    //   updates,
    // });

    const auth = getAuth(app);
    const token = await auth.currentUser?.getIdToken();

    if (!token) {
      throw new Error('User is not authenticated');
    }

    const response = await fetch(
      'https://updatecardstypeofcards-lsdm7txq6q-uc.a.run.app', // Replace with correct Firebase Functions URL
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
      let errorMessage = 'Failed to update cards';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (jsonError) {
        functions.logger.error('Failed to parse error response:', jsonError);
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    // console.log('updateCardsTypeOfCards response:', result);
    return result;
  } catch (error) {
    console.error('UpdateCardsTypeOfCards error:', {
      message: error.message,
      details: error.details,
    });
    throw new Error(error.message || 'Failed to update cards');
  }
};
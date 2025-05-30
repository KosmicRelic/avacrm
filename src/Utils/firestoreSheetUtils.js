import { db } from '../firebase.jsx';
import { doc, deleteDoc } from 'firebase/firestore';

export async function deleteSheetFromFirestore(businessId, sheetDocId) {
  if (!businessId || !sheetDocId) return;
  try {
    await deleteDoc(doc(db, 'businesses', businessId, 'sheets', sheetDocId));
  } catch (error) {
    console.error('Error deleting sheet from Firestore:', error);
    throw error;
  }
}

import { db } from '../../../firebase';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

export const syncLinkedRecordBasicFieldsFunction = async (businessId, updatedRecord) => {
  try {
    if (!updatedRecord.linkId) {
      console.log('No linkId found, skipping sync');
      return { success: true, message: 'No linkId to sync' };
    }

    // Get the template object to determine basic fields
    const templateObjectsRef = collection(db, 'businesses', businessId, 'templateObjects');
    const templateObjectsQuery = query(templateObjectsRef);
    const templateObjectsSnapshot = await getDocs(templateObjectsQuery);

    let basicFields = [];
    let foundObject = null;

    // Find the template object that matches the record's typeOfObject
    for (const doc of templateObjectsSnapshot.docs) {
      const objectData = doc.data();
      if (objectData.name === updatedRecord.typeOfObject) {
        foundObject = objectData;
        basicFields = objectData.basicFields || [];
        break;
      }
    }

    if (!foundObject || basicFields.length === 0) {
      console.log('No basic fields found for object:', updatedRecord.typeOfObject);
      return { success: true, message: 'No basic fields to sync' };
    }

    // Filter out system fields that shouldn't trigger sync
    const systemFields = ['updatedAt', 'createdAt', 'lastModifiedBy', 'history'];
    const syncableBasicFields = basicFields.filter(field => !systemFields.includes(field.key));

    // Get all records with the same linkId
    const recordsRef = collection(db, 'businesses', businessId, 'records');
    const linkedRecordsQuery = query(recordsRef, where('linkId', '==', updatedRecord.linkId));
    const linkedRecordsSnapshot = await getDocs(linkedRecordsQuery);

    const batch = writeBatch(db);
    let updatedCount = 0;

    // Update each linked record (except the one that was just updated)
    linkedRecordsSnapshot.docs.forEach((recordDoc) => {
      const recordData = recordDoc.data();

      // Skip the record that triggered the update
      if (recordDoc.id === updatedRecord.docId) {
        return;
      }

      // Prepare update data with basic fields from the updated record
      const updateData = {};

      // Copy basic field values from the updated record
      syncableBasicFields.forEach(field => {
        const fieldKey = field.key;
        if (fieldKey in updatedRecord && updatedRecord[fieldKey] !== recordData[fieldKey]) {
          updateData[fieldKey] = updatedRecord[fieldKey];
        }
      });

      updateData.updatedAt = new Date().toISOString();

      if (Object.keys(updateData).length > 1) { // More than just updatedAt
        batch.update(recordDoc.ref, updateData);
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`Synced basic fields to ${updatedCount} linked records`);
      return {
        success: true,
        message: `Successfully synced basic fields to ${updatedCount} linked records`,
        updatedCount
      };
    } else {
      return { success: true, message: 'No linked records to update' };
    }

  } catch (error) {
    console.error('Error syncing linked record basic fields:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to sync linked record basic fields'
    };
  }
};

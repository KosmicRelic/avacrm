import { collection, doc, getDocs, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';

const fetchUserData = async ({
  businessId,
  route,
  setSheets,
  setCards,
  setCardTemplates,
  setMetrics,
  setDashboards,
}) => {
  // Helper to fetch collection data with error handling
  const fetchCollection = async (path, setState, defaultValue, errorMessage) => {
    console.log('Fetching data for path:', path.path, 'with businessId:', businessId);
    try {
      const snapshot = await getDocs(path);
      const data = snapshot.docs.map((doc) => ({
        docId: doc.id,
        ...doc.data(),
      }));
      console.log('Data received for', path.path, ':', data);
      setState(data);
    } catch (error) {
      console.error(errorMessage, {
        code: error.code,
        message: error.message,
        businessId,
        path: path.path,
        userId: auth.currentUser?.uid || 'unknown',
        timestamp: new Date().toISOString(),
      });
      setState(defaultValue);
    }
  };

  // Check if user is a team member
  const isTeamMember = async () => {
    const user = auth.currentUser;
    if (!user || user.uid === businessId) return false; // Business owner
    const teamMemberDoc = await getDoc(doc(db, 'businesses', businessId, 'teamMembers', user.uid));
    return teamMemberDoc.exists();
  };

  // Fetch allowedSheetIds for team members
  const getAllowedSheetIds = async () => {
    const user = auth.currentUser;
    if (!user || user.uid === businessId) return null; // Business owner
    const teamMemberDoc = await getDoc(doc(db, 'businesses', businessId, 'teamMembers', user.uid));
    if (teamMemberDoc.exists()) {
      return teamMemberDoc.data().allowedSheetIds || [];
    }
    return [];
  };

  // Fetch data based on the route
  if (route === '/sheets') {
    console.log('Fetching sheets for businessId:', businessId);
    try {
      // Fetch sheets
      const sheetsSnapshot = await getDocs(collection(db, 'businesses', businessId, 'sheets'));
      const allSheets = sheetsSnapshot.docs.map((doc) => ({
        docId: doc.id,
        ...doc.data(),
      }));
      console.log('Sheets data received:', allSheets);

      // Determine if user is a team member and get allowedSheetIds
      const allowedSheetIds = await getAllowedSheetIds();

      // Fetch sheets structure
      const structureDoc = await getDoc(doc(db, 'businesses', businessId, 'sheetsStructure', 'structure'));
      let structureData = structureDoc.exists() ? structureDoc.data().structure : [];
      console.log('Sheets structure data received (raw):', structureData);

      // Filter structure for team members
      if (allowedSheetIds) {
        const sheetIdToName = new Map(
          allSheets.map((sheet) => [sheet.docId.toLowerCase(), sheet.sheetName?.toLowerCase()])
        );
        structureData = structureData.filter((entry) => {
          const sheetId = [...sheetIdToName.entries()].find(
            ([, name]) => name === entry.sheetName.toLowerCase()
          )?.[0];
          return sheetId && allowedSheetIds.includes(sheetId);
        });
        console.log('Filtered sheets structure for team member:', structureData);
      }

      setSheets({ allSheets, structure: structureData });

      // Fetch all cards
      await fetchCollection(
        collection(db, 'businesses', businessId, 'cards'),
        setCards,
        [],
        'Error fetching cards:'
      );

      // Fetch card templates
      await fetchCollection(
        collection(db, 'businesses', businessId, 'cardTemplates'),
        setCardTemplates,
        [],
        'Error fetching card templates:'
      );
    } catch (error) {
      console.error('Error fetching sheets:', {
        code: error.code,
        message: error.message,
        businessId,
        path: `businesses/${businessId}/sheets`,
        userId: auth.currentUser?.uid || 'unknown',
        timestamp: new Date().toISOString(),
      });
      setSheets({ allSheets: [], structure: [] });
      setCards([]);
    }
  } else if (route === '/dashboard' || route === '/metrics') {
    // Fetch dashboards
    await fetchCollection(
      collection(db, 'businesses', businessId, 'dashboards'),
      setDashboards,
      [],
      'Error fetching dashboards:'
    );

    // Fetch metrics
    await fetchCollection(
      collection(db, 'businesses', businessId, 'metrics'),
      setMetrics,
      [],
      'Error fetching metrics:'
    );

    // Fetch all cards
    await fetchCollection(
      collection(db, 'businesses', businessId, 'cards'),
      setCards,
      [],
      'Error fetching cards:'
    );
  }

  // Return an empty cleanup function since no listeners are set up
  return () => {
    console.log('No Firestore listeners to clean up for businessId:', businessId);
  };
};

export default fetchUserData;
import { collection, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';

const fetchUserData = ({
  businessId,
  route,
  setSheets,
  setCards,
  setCardTemplates,
  setMetrics,
  setDashboards,
}) => {
  const unsubscribeFunctions = [];

  // Helper to set up snapshot listener with error handling
  const setupSnapshot = (path, setState, defaultValue, errorMessage) => {
    console.log('Setting up snapshot for path:', path.path, 'with businessId:', businessId);
    const unsubscribe = onSnapshot(
      path,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          docId: doc.id,
          ...doc.data(),
        }));
        console.log('Snapshot data received for', path.path, ':', data);
        setState(data);
      },
      (error) => {
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
    );
    unsubscribeFunctions.push(unsubscribe);
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
    // Fetch sheets
    console.log('Fetching sheets for businessId:', businessId);
    const sheetsUnsubscribe = onSnapshot(
      collection(db, 'businesses', businessId, 'sheets'),
      async (sheetsSnapshot) => {
        const allSheets = sheetsSnapshot.docs.map((doc) => ({
          docId: doc.id,
          ...doc.data(),
        }));
        console.log('Sheets data received:', allSheets);

        // Determine if user is a team member and get allowedSheetIds
        const allowedSheetIds = await getAllowedSheetIds();

        // Fetch sheets structure
        const structureUnsubscribe = onSnapshot(
          doc(db, 'businesses', businessId, 'sheetsStructure', 'structure'),
          (structureSnapshot) => {
            let structureData = structureSnapshot.exists() ? structureSnapshot.data().structure : [];
            console.log('Sheets structure data received (raw):', structureData);

            // Filter structure for team members
            if (allowedSheetIds) {
              // Map sheetName to sheetId (assuming sheetName corresponds to docId)
              const sheetIdToName = new Map(
                allSheets.map((sheet) => [sheet.docId.toLowerCase(), sheet.sheetName?.toLowerCase()])
              );
              structureData = structureData.filter((entry) => {
                // Find the sheetId corresponding to the sheetName
                const sheetId = [...sheetIdToName.entries()].find(
                  ([, name]) => name === entry.sheetName.toLowerCase()
                )?.[0];
                return sheetId && allowedSheetIds.includes(sheetId);
              });
              console.log('Filtered sheets structure for team member:', structureData);
            }

            setSheets({ allSheets, structure: structureData });
          },
          (error) => {
            console.error('Error fetching sheets structure:', {
              code: error.code,
              message: error.message,
              businessId,
              path: `businesses/${businessId}/sheetsStructure/structure`,
              userId: auth.currentUser?.uid || 'unknown',
              timestamp: new Date().toISOString(),
            });
            setSheets({ allSheets, structure: [] });
          }
        );
        unsubscribeFunctions.push(structureUnsubscribe);

        // Fetch all cards
        setupSnapshot(
          collection(db, 'businesses', businessId, 'cards'),
          setCards,
          [],
          'Error fetching cards:'
        );

        // Fetch card templates
        setupSnapshot(
          collection(db, 'businesses', businessId, 'cardTemplates'),
          setCardTemplates,
          [],
          'Error fetching card templates:'
        );
      },
      (error) => {
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
    );
    unsubscribeFunctions.push(sheetsUnsubscribe);
  } else if (route === '/dashboard') {
    // Fetch dashboards
    setupSnapshot(
      collection(db, 'businesses', businessId, 'dashboards'),
      setDashboards,
      [],
      'Error fetching dashboards:'
    );

    // Fetch metrics
    setupSnapshot(
      collection(db, 'businesses', businessId, 'metrics'),
      setMetrics,
      [],
      'Error fetching metrics:'
    );

    // Fetch all cards
    setupSnapshot(
      collection(db, 'businesses', businessId, 'cards'),
      setCards,
      [],
      'Error fetching cards:'
    );
  } else if (route === '/metrics') {
    setupSnapshot(
      collection(db, 'businesses', businessId, 'metrics'),
      setMetrics,
      [],
      'Error fetching metrics:'
    );
  }

  // Return cleanup function
  return () => {
    unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
  };
};

export default fetchUserData;
import { collection, doc, getDocs, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';

// Module-level cache to track fetched sheet IDs and current businessId
const fetchedSheetIds = new Set();
let currentBusinessId = null;

const fetchUserData = async ({
  businessId,
  route,
  setSheets,
  setCards,
  setCardTemplates,
  setMetrics,
  setDashboards,
  activeSheetName,
  updateSheets = false,
}) => {
  // Helper to fetch collection data with error handling
  const fetchCollection = async (path, setState, defaultValue, errorMessage) => {
    // console.log('Fetching data for path:', path.path, 'with businessId:', businessId);
    try {
      const snapshot = await getDocs(path);
      const data = snapshot.docs.map((doc) => ({
        docId: doc.id,
        ...doc.data(),
      }));
      // console.log('Data received for', path.path, ':', data);
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

  // Reset cache only if businessId changes
  if (businessId !== currentBusinessId && fetchedSheetIds.size > 0) {
    // console.log('Resetting fetchedSheetIds cache due to businessId change:', { old: currentBusinessId, new: businessId });
    fetchedSheetIds.clear();
    currentBusinessId = businessId;
  }

  // Fetch data based on the route
  if (route === '/sheets') {
    let allSheets = [];
    if (updateSheets) {
      // console.log('Fetching sheets for businessId:', businessId);
      try {
        // Fetch sheets
        const sheetsSnapshot = await getDocs(collection(db, 'businesses', businessId, 'sheets'));
        allSheets = sheetsSnapshot.docs.map((doc) => ({
          docId: doc.id,
          ...doc.data(),
        }));
        // console.log('Sheets data received:', allSheets);

        // Determine if user is a team member and get allowedSheetIds
        const allowedSheetIds = await getAllowedSheetIds();

        // Fetch sheets structure
        const structureDoc = await getDoc(doc(db, 'businesses', businessId, 'sheetsStructure', 'structure'));
        let structureData = structureDoc.exists() ? structureDoc.data().structure : [];
        // console.log('Sheets structure data received (raw):', structureData);

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
          // console.log('Filtered sheets structure for team member:', structureData);
        }

        setSheets && setSheets({ allSheets, structure: structureData });

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
        setSheets && setSheets({ allSheets: [], structure: [] });
        setCards && setCards([]);
        return () => {};
      }
    } else {
      // Fetch sheets only to get active sheet's rows
      try {
        const sheetsSnapshot = await getDocs(collection(db, 'businesses', businessId, 'sheets'));
        allSheets = sheetsSnapshot.docs.map((doc) => ({
          docId: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error('Error fetching sheets for active sheet:', {
          code: error.code,
          message: error.message,
          businessId,
          path: `businesses/${businessId}/sheets`,
          userId: auth.currentUser?.uid || 'unknown',
          timestamp: new Date().toISOString(),
        });
        setCards && setCards([]);
        return () => {};
      }
    }

    // Log the received activeSheetName
    // console.log('Received activeSheetName:', activeSheetName);

    // Determine which sheet to use
    let sheetNameToUse = activeSheetName;
    if (!sheetNameToUse && updateSheets) {
      // console.log('No activeSheetName provided, falling back to first sheet in structure');
      const structureDoc = await getDoc(doc(db, 'businesses', businessId, 'sheetsStructure', 'structure'));
      const structureData = structureDoc.exists() ? structureDoc.data().structure : [];
      if (structureData?.length > 0) {
        if (structureData[0].sheetName) {
          sheetNameToUse = structureData[0].sheetName;
        } else if (structureData[0].folderName && structureData[0].sheets?.length > 0) {
          sheetNameToUse = structureData[0].sheets[0];
        }
      }
    }

    // If no sheetNameToUse, default to "Leads" if available
    if (!sheetNameToUse) {
      // console.log('No sheetNameToUse determined, defaulting to "Leads" if available');
      const leadsSheet = allSheets.find((s) => s.sheetName === 'Leads');
      sheetNameToUse = leadsSheet ? 'Leads' : allSheets[0]?.sheetName;
    }

    // console.log('Selected sheetNameToUse:', sheetNameToUse);

    const activeSheet = allSheets.find((s) => s.sheetName === sheetNameToUse);
    if (!activeSheet) {
      // console.log(`No active sheet found for sheetName: ${sheetNameToUse}`);
      setCards && setCards([]);
      return () => {};
    }

    const sheetId = activeSheet.docId;
    // console.log('Active sheet ID:', sheetId);

    // Check if cards for this sheet have already been fetched
    if (fetchedSheetIds.has(sheetId)) {
      // Already fetched, do not fetch again
      return () => {};
    }
    // Mark as fetched before fetching to avoid race conditions
    fetchedSheetIds.add(sheetId);

    // Fetch cards for the active sheet
    // console.log(`[FetchUserData] Fetching cards for sheet: ${sheetNameToUse} (id: ${sheetId})`);
    try {
      const cardsSnapshot = await getDocs(collection(db, 'businesses', businessId, 'cards'));
      const allCards = cardsSnapshot.docs.map((doc) => ({
        docId: doc.id,
        ...doc.data(),
      }));

      // Only include cards whose docId is in the active sheet's rows
      let filteredCards = [];
      if (activeSheet && Array.isArray(activeSheet.rows)) {
        const rowIdsSet = new Set(activeSheet.rows.map(String));
        filteredCards = allCards.filter((card) => rowIdsSet.has(String(card.docId)));
      }
      // console.log('Filtered cards:', filteredCards);
      // Merge cards for this sheet into the cards array, removing old ones for this sheet
      setCards && setCards(prevCards => {
        // Remove cards that belong to this sheet (by docId in activeSheet.rows)
        const sheetRowIds = new Set(activeSheet.rows.map(String));
        const otherCards = prevCards.filter(card => !sheetRowIds.has(String(card.docId)));
        // Add the new cards for this sheet
        return [...otherCards, ...filteredCards];
      });
    } catch (error) {
      console.error('Error fetching cards:', {
        code: error.code,
        message: error.message,
        businessId,
        sheetId,
        sheetName: sheetNameToUse,
        userId: auth.currentUser?.uid || 'unknown',
        timestamp: new Date().toISOString(),
      });
      setCards && setCards([]);
    }
  } else if (route === '/dashboard' || route === '/metrics') {
    await fetchCollection(
      collection(db, 'businesses', businessId, 'dashboards'),
      setDashboards,
      [],
      'Error fetching dashboards:'
    );
    await fetchCollection(
      collection(db, 'businesses', businessId, 'metrics'),
      setMetrics,
      [],
      'Error fetching metrics:'
    );
  }

  return () => {
    // console.log('No Firestore listeners to clean up for businessId:', businessId);
  };
};

export const resetFetchedSheetIds = () => {
  // console.log('Resetting fetchedSheetIds cache');
  fetchedSheetIds.clear();
  currentBusinessId = null;
};

export default fetchUserData;
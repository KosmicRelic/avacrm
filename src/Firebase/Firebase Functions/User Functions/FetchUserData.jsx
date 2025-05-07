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
    try {
      const snapshot = await getDocs(path);
      const data = snapshot.docs.map((doc) => ({
        docId: doc.id,
        ...doc.data(),
      }));
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
    fetchedSheetIds.clear();
    currentBusinessId = businessId;
  }

  // Fetch data based on the route
  if (route === '/sheets') {
    let allSheets = [];
    let structureData = [];
    let allowedSheetIds = null;

    if (updateSheets) {
      try {
        // Parallel fetch: sheets, structure, allowedSheetIds, cardTemplates
        const [
          sheetsSnapshot,
          structureDoc,
          allowedSheetIdsResult,
          cardTemplatesSnapshot
        ] = await Promise.all([
          getDocs(collection(db, 'businesses', businessId, 'sheets')),
          getDoc(doc(db, 'businesses', businessId, 'sheetsStructure', 'structure')),
          getAllowedSheetIds(),
          getDocs(collection(db, 'businesses', businessId, 'cardTemplates'))
        ]);

        allSheets = sheetsSnapshot.docs.map((doc) => ({
          docId: doc.id,
          ...doc.data(),
        }));

        allowedSheetIds = allowedSheetIdsResult;

        structureData = structureDoc.exists() ? structureDoc.data().structure : [];

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
        }

        // Set sheets and cardTemplates in a single batch update
        setSheets && setSheets({ allSheets, structure: structureData });
        setCardTemplates && setCardTemplates(
          cardTemplatesSnapshot.docs.map((doc) => ({
            docId: doc.id,
            ...doc.data(),
          }))
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
      try {
        // Only fetch sheets for active sheet's rows
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

    // Determine which sheet to use
    let sheetNameToUse = activeSheetName;
    if (!sheetNameToUse && updateSheets) {
      // Use already fetched structureData if available
      const structure = structureData || [];
      if (structure?.length > 0) {
        if (structure[0].sheetName) {
          sheetNameToUse = structure[0].sheetName;
        } else if (structure[0].folderName && structure[0].sheets?.length > 0) {
          sheetNameToUse = structure[0].sheets[0];
        }
      }
    }
    if (!sheetNameToUse) {
      const leadsSheet = allSheets.find((s) => s.sheetName === 'Leads');
      sheetNameToUse = leadsSheet ? 'Leads' : allSheets[0]?.sheetName;
    }

    const activeSheet = allSheets.find((s) => s.sheetName === sheetNameToUse);
    if (!activeSheet) {
      setCards && setCards([]);
      return () => {};
    }

    const sheetId = activeSheet.docId;
    if (fetchedSheetIds.has(sheetId)) {
      return () => {};
    }
    fetchedSheetIds.add(sheetId);

    // Fetch cards for the active sheet
    try {
      // Fetch all cards for the business, then filter for the active sheet
      const cardsSnapshot = await getDocs(collection(db, 'businesses', businessId, 'cards'));
      const allCards = cardsSnapshot.docs.map((doc) => ({
        docId: doc.id,
        ...doc.data(),
      }));

      let filteredCards = [];
      if (activeSheet && Array.isArray(activeSheet.rows)) {
        const rowIdsSet = new Set(activeSheet.rows.map(String));
        filteredCards = allCards.filter((card) => rowIdsSet.has(String(card.docId)));
      }
      setCards && setCards(prevCards => {
        const sheetRowIds = new Set(activeSheet.rows.map(String));
        const otherCards = prevCards.filter(card => !sheetRowIds.has(String(card.docId)));
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
    // Fetch dashboards and metrics in parallel
    await Promise.all([
      fetchCollection(
        collection(db, 'businesses', businessId, 'dashboards'),
        setDashboards,
        [],
        'Error fetching dashboards:'
      ),
      fetchCollection(
        collection(db, 'businesses', businessId, 'metrics'),
        setMetrics,
        [],
        'Error fetching metrics:'
      )
    ]);
  }

  return () => {
    // No Firestore listeners to clean up for businessId
  };
};

export const resetFetchedSheetIds = () => {
  fetchedSheetIds.clear();
  currentBusinessId = null;
};

export default fetchUserData;
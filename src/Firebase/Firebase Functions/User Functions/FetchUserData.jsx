import { collection, doc, getDocs, getDoc, query, where } from 'firebase/firestore';
import { db, auth } from '../../../firebase';

// Module-level cache to track fetched sheet IDs, card types, and current businessId
const fetchedSheetIds = new Set();
const fetchedCardTypes = new Set();
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
    console.debug('Team member document fetched', {
      exists: teamMemberDoc.exists(),
      data: teamMemberDoc.exists() ? teamMemberDoc.data() : null,
      userId: user.uid,
      businessId,
      timestamp: new Date().toISOString(),
    });
    if (teamMemberDoc.exists()) {
      const data = teamMemberDoc.data();
      const allowedSheetIds = data.allowedSheetIds || data.permissions?.sheets?.allowedSheetIds || [];
      console.debug('Allowed sheet IDs retrieved', {
        allowedSheetIds,
        userId: user.uid,
        businessId,
        timestamp: new Date().toISOString(),
      });
      return allowedSheetIds;
    }
    return [];
  };

  // Derive structure from sheets
  const deriveStructureFromSheets = (sheets) => {
    const structure = sheets.map((sheet) => ({
      sheetName: sheet.sheetName,
    }));
    console.debug('Derived structure from sheets', {
      structure,
      sheetsCount: sheets.length,
      timestamp: new Date().toISOString(),
    });
    return structure;
  };

  // Reset cache only if businessId changes
  if (businessId !== currentBusinessId && (fetchedSheetIds.size > 0 || fetchedCardTypes.size > 0)) {
    fetchedSheetIds.clear();
    fetchedCardTypes.clear();
    currentBusinessId = businessId;
  }

  // Fetch data based on the route
  if (route === '/sheets') {
    let allSheets = [];
    let structureData = [];
    let allowedSheetIds = null;

    if (updateSheets) {
      try {
        const isBusinessUser = auth.currentUser?.uid === businessId;
        allowedSheetIds = await getAllowedSheetIds();

        // Parallelize fetching sheets and cardTemplates
        let sheetsPromise, structureDocPromise, cardTemplatesPromise;
        if (!isBusinessUser) {
          // Team member: Fetch only allowed sheets
          if (allowedSheetIds && allowedSheetIds.length > 0) {
            sheetsPromise = Promise.all(
              allowedSheetIds.map((sheetId) =>
                getDoc(doc(db, 'businesses', businessId, 'sheets', sheetId))
              )
            );
          } else {
            sheetsPromise = Promise.resolve([]);
          }
          structureDocPromise = Promise.resolve(null); // No structure doc for team member
        } else {
          // Business user: Fetch all sheets and structure doc in parallel
          sheetsPromise = getDocs(collection(db, 'businesses', businessId, 'sheets'));
          structureDocPromise = getDoc(doc(db, 'businesses', businessId, 'sheetsStructure', 'structure'));
        }
        cardTemplatesPromise = getDocs(collection(db, 'businesses', businessId, 'cardTemplates'));

        // Await all in parallel
        const [sheetsResult, structureDoc, cardTemplatesSnapshot] = await Promise.all([
          sheetsPromise,
          structureDocPromise,
          cardTemplatesPromise,
        ]);

        if (!isBusinessUser) {
          // Team member
          allSheets = sheetsResult
            .filter((doc) => doc && doc.exists && doc.exists())
            .map((doc) => ({
              docId: doc.id,
              ...doc.data(),
            }));
          structureData = deriveStructureFromSheets(allSheets);
        } else {
          // Business user
          allSheets = sheetsResult.docs.map((doc) => ({
            docId: doc.id,
            ...doc.data(),
          }));
          if (structureDoc && structureDoc.exists()) {
            const structure = structureDoc.data().structure;
            structureData = Array.isArray(structure) && structure.length > 0
              ? structure
              : deriveStructureFromSheets(allSheets);
          } else {
            structureData = deriveStructureFromSheets(allSheets);
          }
        }

        setSheets && setSheets({ allSheets, structure: structureData });
        setCardTemplates &&
          setCardTemplates(
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
        // Only fetch sheets for active sheet
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
      console.warn('Active sheet not found', { sheetNameToUse, allSheets });
      setCards && setCards([]);
      return () => {};
    }

    const sheetId = activeSheet.docId;
    if (fetchedSheetIds.has(sheetId)) {
      console.debug('Sheet cards already fetched', { sheetId, sheetName: sheetNameToUse });
      return () => {};
    }
    fetchedSheetIds.add(sheetId);

    // Fetch cards based on typeOfCardsToDisplay
    try {
      const typeOfCardsToDisplay = activeSheet.typeOfCardsToDisplay || [];
      if (!Array.isArray(typeOfCardsToDisplay) || typeOfCardsToDisplay.length === 0) {
        console.warn('No typeOfCardsToDisplay defined for active sheet', {
          sheetName: sheetNameToUse,
          sheetId,
          activeSheet,
        });
        setCards && setCards([]);
        return () => {};
      }

      let filteredCards = [];
      const cardsToFetch = typeOfCardsToDisplay.filter((type) => !fetchedCardTypes.has(type));

      if (cardsToFetch.length > 0) {
        // Fetch cards for each type that hasn't been fetched yet
        const cardQueries = cardsToFetch.map((type) =>
          getDocs(
            query(
              collection(db, 'businesses', businessId, 'cards'),
              where('typeOfCards', '==', type)
            )
          )
        );

        const querySnapshots = await Promise.all(cardQueries);
        const newCards = querySnapshots.flatMap((snapshot) =>
          snapshot.docs.map((doc) => ({
            docId: doc.id,
            ...doc.data(),
          }))
        );

        // Update cache
        cardsToFetch.forEach((type) => fetchedCardTypes.add(type));

        // Combine with existing cards
        filteredCards = newCards;
        console.debug('Fetched cards for types', {
          sheetName: sheetNameToUse,
          sheetId,
          types: cardsToFetch,
          cardsFetched: newCards.length,
        });
      } else {
        console.debug('All card types already fetched', {
          sheetName: sheetNameToUse,
          sheetId,
          types: typeOfCardsToDisplay,
        });
      }

      // Merge with previously fetched cards for other sheets
      setCards &&
        setCards((prevCards) => {
          const existingCardIds = new Set(prevCards.map((card) => card.docId));
          const newCards = filteredCards.filter((card) => !existingCardIds.has(card.docId));
          return [...prevCards, ...newCards];
        });
    } catch (error) {
      console.error('Error fetching cards:', {
        code: error.code,
        message: error.message,
        businessId,
        sheetId,
        sheetName: sheetNameToUse,
        typeOfCardsToDisplay,
        userId: auth.currentUser?.uid || 'unknown',
        timestamp: new Date().toISOString(),
      });
      setCards && setCards([]);
    }
  } else if (route === '/dashboard' || route === '/metrics') {
    // Parallelize dashboard and metrics fetches
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
      ),
    ]);
  }

  return () => {};
};

export const resetFetchedSheetIds = () => {
  fetchedSheetIds.clear();
  fetchedCardTypes.clear();
  currentBusinessId = null;
};

export default fetchUserData;
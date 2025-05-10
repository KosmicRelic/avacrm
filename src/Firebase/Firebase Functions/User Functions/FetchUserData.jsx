import { collection, doc, getDocs, getDoc, query, where } from 'firebase/firestore';
import { db, auth } from '../../../firebase';

// Module-level cache to track fetched sheets and current businessId
const fetchedSheets = new Map(); // Maps sheetId to Map of typeOfCards to { filters }
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
  if (businessId !== currentBusinessId && fetchedSheets.size > 0) {
    fetchedSheets.clear();
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
    const typeOfCardsToDisplay = activeSheet.typeOfCardsToDisplay || [];
    const cardTypeFilters = activeSheet.cardTypeFilters || {};

    // Initialize cache for this sheetId if not present
    if (!fetchedSheets.has(sheetId)) {
      fetchedSheets.set(sheetId, new Map());
    }

    // Fetch cards based on typeOfCardsToDisplay and cardTypeFilters
    try {
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
      for (const type of typeOfCardsToDisplay) {
        // Invalidate cache if cardTypeFilters have changed
        const cacheKey = `${sheetId}:${type}`;
        const cachedFilters = fetchedSheets.get(sheetId)?.get(type)?.filters;
        const currentFilters = cardTypeFilters[type] || {};
        if (cachedFilters && JSON.stringify(cachedFilters) !== JSON.stringify(currentFilters)) {
          console.debug('Card type filters changed, invalidating cache', {
            sheetName: sheetNameToUse,
            sheetId,
            type,
            previousFilters: cachedFilters,
            currentFilters,
          });
          fetchedSheets.get(sheetId).delete(type);
        }

        // Check if this card type has already been fetched for this sheet
        if (fetchedSheets.get(sheetId).has(type)) {
          console.debug('Card type already fetched for this sheet', {
            sheetName: sheetNameToUse,
            sheetId,
            type,
          });
          continue;
        }
        fetchedSheets.get(sheetId).set(type, { filters: currentFilters });

        let cardQuery = query(
          collection(db, 'businesses', businessId, 'cards'),
          where('typeOfCards', '==', type)
        );

        // Apply cardTypeFilters for this card type
        const filters = cardTypeFilters[type] || {};
        const clientSideFilters = [];

        // Handle userFilter (restrictByUser)
        if (filters.userFilter && filters.userFilter.headerKey && filters.userFilter.condition === 'equals') {
          const { headerKey, value } = filters.userFilter;
          if (value) {
            cardQuery = query(cardQuery, where(headerKey, '==', value));
            console.debug('Applied userFilter', {
              sheetName: sheetNameToUse,
              sheetId,
              type,
              headerKey,
              value,
              condition: 'equals',
            });
          } else {
            console.warn('userFilter value missing, skipping', {
              sheetName: sheetNameToUse,
              sheetId,
              type,
              headerKey,
              condition: 'equals',
            });
          }
        }

        // Apply other cardTypeFilters
        Object.entries(filters).forEach(([field, filter]) => {
          if (field === 'userFilter') return; // Skip userFilter as it's handled above
          if (filter.start || filter.end) {
            // Range filter
            if (filter.start) {
              cardQuery = query(cardQuery, where(field, '>=', filter.start));
            }
            if (filter.end) {
              cardQuery = query(cardQuery, where(field, '<=', filter.end));
            }
          } else if (filter.value && filter.order) {
            // Single value filter
            const operatorMap = {
              equals: '==',
              greater: '>',
              less: '<',
              greaterOrEqual: '>=',
              lessOrEqual: '<=',
              on: '==',
              before: '<',
              after: '>',
            };
            const operator = operatorMap[filter.order] || '==';
            cardQuery = query(cardQuery, where(field, operator, filter.value));
          } else if (filter.values && filter.values.length > 0) {
            // Dropdown (array contains) filter
            cardQuery = query(cardQuery, where(field, 'in', filter.values));
          } else if (filter.condition && filter.value) {
            // Text filter
            if (filter.condition === 'equals') {
              cardQuery = query(cardQuery, where(field, '==', filter.value));
            } else {
              // Non-equals text filters (contains, startsWith, endsWith) are handled client-side
              clientSideFilters.push({ field, filter });
            }
          }
        });

        console.debug('Applying Firestore query with filters', {
          sheetName: sheetNameToUse,
          sheetId,
          type,
          queryFilters: Object.keys(filters).filter((f) => f !== 'userFilter'),
          clientSideFilters: clientSideFilters.map((f) => f.field),
        });

        const snapshot = await getDocs(cardQuery);
        let newCards = snapshot.docs.map((doc) => ({
          docId: doc.id,
          ...doc.data(),
        }));

        // Apply client-side filtering for text conditions not supported by Firestore
        if (clientSideFilters.length > 0) {
          newCards = newCards.filter((card) => {
            return clientSideFilters.every(({ field, filter }) => {
              const cardValue = String(card[field] || '').toLowerCase();
              const filterValue = filter.value?.toLowerCase() || '';
              switch (filter.condition) {
                case 'contains':
                  return cardValue.includes(filterValue);
                case 'startsWith':
                  return cardValue.startsWith(filterValue);
                case 'endsWith':
                  return cardValue.endsWith(filterValue);
                default:
                  return true;
              }
            });
          });
        }

        filteredCards.push(...newCards);
        console.debug('Fetched and filtered cards for type', {
          sheetName: sheetNameToUse,
          sheetId,
          type,
          cardsFetched: newCards.length,
          filtersApplied: cardTypeFilters[type] || {},
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
        cardTypeFilters,
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
  fetchedSheets.clear();
  currentBusinessId = null;
};

export default fetchUserData;
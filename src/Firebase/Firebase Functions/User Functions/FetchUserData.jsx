import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';

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
    const unsubscribe = onSnapshot(
      path,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          docId: doc.id,
          ...doc.data()
        }));
        setState(data);
      },
      (error) => {
        console.error(errorMessage, error);
        setState(defaultValue);
      }
    );
    unsubscribeFunctions.push(unsubscribe);
  };
  console.log("time to fetch")

  // Fetch data based on the route
  if (route === '/sheets') {
    // Fetch sheets
    const sheetsUnsubscribe = onSnapshot(
      collection(db, 'businesses', businessId, 'sheets'),
      (sheetsSnapshot) => {
        const allSheets = sheetsSnapshot.docs.map((doc) => ({
          docId: doc.id,
          ...doc.data()
        }));
        const structureUnsubscribe = onSnapshot(
          doc(db, 'businesses', businessId, 'sheetsStructure', 'structure'),
          (structureSnapshot) => {
            const structureData = structureSnapshot.exists() ? structureSnapshot.data().structure : [];
            setSheets({ allSheets, structure: structureData });
          },
          (error) => {
            console.error('Error fetching sheets structure:', error);
            setSheets({ allSheets, structure: [] });
          }
        );
        unsubscribeFunctions.push(structureUnsubscribe);
      },
      (error) => {
        console.error('Error fetching sheets:', error);
        setSheets({ allSheets: [], structure: [] });
      }
    );
    unsubscribeFunctions.push(sheetsUnsubscribe);

    // Fetch cards (needed for resolvedRows in Sheets component)
    setupSnapshot(
      collection(db, 'businesses', businessId, 'cards'),
      setCards,
      [],
      'Error fetching cards:'
    );

    // Fetch card templates (needed for card editing in Sheets)
    setupSnapshot(
      collection(db, 'businesses', businessId, 'cardTemplates'),
      setCardTemplates,
      [],
      'Error fetching card templates:'
    );
  } else if (route === '/dashboard') {
    // Fetch dashboards
    setupSnapshot(
      collection(db, 'businesses', businessId, 'dashboards'),
      setDashboards,
      [],
      'Error fetching dashboards:'
    );

    // Fetch metrics (needed for dashboard widgets)
    setupSnapshot(
      collection(db, 'businesses', businessId, 'metrics'),
      setMetrics,
      [],
      'Error fetching metrics:'
    );

    // Fetch cards (may be needed for dashboard widgets)
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
// src/utils/FetchUserData.js
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';

const fetchUserData = ({
  businessId,
  setSheets,
  setCards,
  setCardTemplates,
  setMetrics,
  setDashboards,
}) => {
  const unsubscribeFunctions = [];
  // Fetch Sheets
  const sheetsUnsubscribe = onSnapshot(
    collection(db, 'businesses', businessId, 'sheets'),
    (sheetsSnapshot) => {
      const allSheets = sheetsSnapshot.docs.map((doc) => doc.data());
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

  // Fetch Cards
  const cardsUnsubscribe = onSnapshot(
    collection(db, 'businesses', businessId, 'cards'),
    (cardsSnapshot) => {
      const cards = cardsSnapshot.docs.map((doc) => doc.data());
      setCards(cards);
    },
    (error) => {
      console.error('Error fetching cards:', error);
      setCards([]);
    }
  );
  unsubscribeFunctions.push(cardsUnsubscribe);

  // Fetch Card Templates
  const cardTemplatesUnsubscribe = onSnapshot(
    collection(db, 'businesses', businessId, 'cardTemplates'),
    (templatesSnapshot) => {
      const cardTemplates = templatesSnapshot.docs.map((doc) => doc.data());
      setCardTemplates(cardTemplates);
    },
    (error) => {
      console.error('Error fetching card templates:', error);
      setCardTemplates([]);
    }
  );
  unsubscribeFunctions.push(cardTemplatesUnsubscribe);

  // Fetch Metrics
  const metricsUnsubscribe = onSnapshot(
    collection(db, 'businesses', businessId, 'metrics'),
    (metricsSnapshot) => {
      const metrics = metricsSnapshot.docs.map((doc) => doc.data());
      setMetrics(metrics);
    },
    (error) => {
      console.error('Error fetching metrics:', error);
      setMetrics([]);
    }
  );
  unsubscribeFunctions.push(metricsUnsubscribe);

  // Fetch Dashboards
  const dashboardsUnsubscribe = onSnapshot(
    collection(db, 'businesses', businessId, 'dashboards'),
    (dashboardsSnapshot) => {
      const dashboards = dashboardsSnapshot.docs.map((doc) => doc.data());
      setDashboards(dashboards);
    },
    (error) => {
      console.error('Error fetching dashboards:', error);
      setDashboards([]);
    }
  );
  unsubscribeFunctions.push(dashboardsUnsubscribe);

  // Return cleanup function
  return () => {
    unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
  };
};

export default fetchUserData;
import { useContext, useEffect, useRef } from 'react';
import { MainContext } from '../Contexts/MainContext';
import { db } from '../firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import PropTypes from 'prop-types';

const UpdateUserData = () => {
  const {
    user,
    sheets,
    setSheets,
    cards,
    setCards,
    cardTemplates,
    setCardTemplates,
    metrics,
    setMetrics,
    dashboards,
    setDashboards,
  } = useContext(MainContext);

  // Use refs to track initial load and previous state values
  const isInitialLoad = useRef(true);
  const prevSheets = useRef(sheets);
  const prevCards = useRef(cards);
  const prevCardTemplates = useRef(cardTemplates);
  const prevMetrics = useRef(metrics);
  const prevDashboards = useRef(dashboards);

  useEffect(() => {
    // Skip updates if no user is logged in
    if (!user || !user.uid) return;

    // Skip updates during initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      prevSheets.current = sheets;
      prevCards.current = cards;
      prevCardTemplates.current = cardTemplates;
      prevMetrics.current = metrics;
      prevDashboards.current = dashboards;
      return;
    }

    // Function to check if two objects/arrays are deeply equal
    const isEqual = (a, b) => {
      if (a === b) return true;
      if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false;
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) => isEqual(a[key], b[key]));
    };

    // Check for meaningful changes
    const sheetsChanged = !isEqual(sheets, prevSheets.current);
    const cardsChanged = !isEqual(cards, prevCards.current);
    const cardTemplatesChanged = !isEqual(cardTemplates, prevCardTemplates.current);
    const metricsChanged = !isEqual(metrics, prevMetrics.current);
    const dashboardsChanged = !isEqual(dashboards, prevDashboards.current);

    // If no changes, skip Firestore update
    if (!sheetsChanged && !cardsChanged && !cardTemplatesChanged && !metricsChanged && !dashboardsChanged) {
      return;
    }

    // Perform Firestore batch update
    const updateFirestore = async () => {
      try {
        const batch = writeBatch(db);
        const businessId = user.uid;

        // Update sheets
        if (sheetsChanged) {
          sheets.allSheets.forEach((sheet) => {
            const sheetRef = doc(collection(db, 'businesses', businessId, 'sheets'), sheet.id);
            batch.set(sheetRef, sheet);
          });
          const structureRef = doc(collection(db, 'businesses', businessId, 'sheetsStructure'), 'structure');
          batch.set(structureRef, { structure: sheets.structure });
        }

        // Update cards
        if (cardsChanged) {
          cards.forEach((card) => {
            const cardRef = doc(collection(db, 'businesses', businessId, 'cards'), card.id);
            batch.set(cardRef, card);
          });
        }

        // Update card templates
        if (cardTemplatesChanged) {
          cardTemplates.forEach((template) => {
            const templateRef = doc(collection(db, 'businesses', businessId, 'cardTemplates'), template.name);
            batch.set(templateRef, template);
          });
        }

        // Update metrics
        if (metricsChanged) {
          metrics.forEach((category) => {
            const metricRef = doc(collection(db, 'businesses', businessId, 'metrics'), category.category);
            batch.set(metricRef, category);
          });
        }

        // Update dashboards
        if (dashboardsChanged) {
          dashboards.forEach((dashboard) => {
            const dashboardRef = doc(collection(db, 'businesses', businessId, 'dashboards'), dashboard.id);
            batch.set(dashboardRef, dashboard);
          });
        }

        // Commit the batch
        await batch.commit();
        console.log('Firestore updated successfully');

        // Update refs with new state
        prevSheets.current = sheets;
        prevCards.current = cards;
        prevCardTemplates.current = cardTemplates;
        prevMetrics.current = metrics;
        prevDashboards.current = dashboards;
      } catch (error) {
        console.error('Error updating Firestore:', error);
      }
    };

    updateFirestore();
  }, [user, sheets, cards, cardTemplates, metrics, dashboards]);

  return null; // This component doesn't render anything
};

UpdateUserData.propTypes = {
  // No props are passed directly, as it uses context
};

export default UpdateUserData;
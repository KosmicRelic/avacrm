import { createContext, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, doc, writeBatch } from 'firebase/firestore';
import fetchUserData from '../Firebase/Firebase Functions/User Functions/FetchUserData';

export const MainContext = createContext();

export const MainContextProvider = ({ children }) => {
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) return storedTheme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [user, setUser] = useState(null);
  const [userAuthChecked, setUserAuthChecked] = useState(false);
  const [sheets, setSheets] = useState({ allSheets: [], structure: [] });
  const [cards, setCards] = useState([]);
  const [cardTemplates, setCardTemplates] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [tempData, setTempData] = useState(null);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  const themeRef = useRef(isDarkTheme ? 'dark' : 'light');
  const hasFetched = useRef({ sheets: false, dashboard: false, metrics: false });
  const navigate = useNavigate();
  const location = useLocation();

  // Refs to track state
  const isInitialLoad = useRef(true);
  const prevStates = useRef({
    sheets: { allSheets: [], structure: [] },
    cards: [],
    cardTemplates: [],
    metrics: [],
    dashboards: [],
  });
  const isUpdatingCardsFromTemplate = useRef(false);
  const isBatchProcessing = useRef(false); // New ref to prevent re-entrant batch operations

  // Theme effect
  useEffect(() => {
    themeRef.current = isDarkTheme ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', themeRef.current);
    document.body.style.backgroundColor = isDarkTheme ? 'black' : 'rgb(243, 242, 248)';
    document.body.style.color = isDarkTheme ? 'rgb(243, 242, 248)' : 'rgb(0, 0, 0)';
    if (localStorage.getItem('theme') !== null) {
      localStorage.setItem('theme', themeRef.current);
    }
  }, [isDarkTheme]);

  // Auth state and route-based data fetching effect
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
        });

        if (isSignup) {
          setIsSignup(false);
          navigate('/dashboard');
          setUserAuthChecked(true);
          return;
        }

        const currentRoute = location.pathname;
        let cleanupFetch = () => {};

        if (
          (currentRoute === '/sheets' && !hasFetched.current.sheets) ||
          (currentRoute === '/dashboard' && !hasFetched.current.dashboard) ||
          (currentRoute === '/metrics' && !hasFetched.current.metrics)
        ) {
          cleanupFetch = fetchUserData({
            businessId: firebaseUser.uid,
            route: currentRoute,
            setSheets,
            setCards,
            setCardTemplates,
            setMetrics,
            setDashboards,
          });

          if (currentRoute === '/sheets') hasFetched.current.sheets = true;
          if (currentRoute === '/dashboard') hasFetched.current.dashboard = true;
          if (currentRoute === '/metrics') hasFetched.current.metrics = true;
        }

        return cleanupFetch;
      } else {
        setUser(null);
        setSheets({ allSheets: [], structure: [] });
        setCards([]);
        setCardTemplates([]);
        setMetrics([]);
        setDashboards([]);
        hasFetched.current = { sheets: false, dashboard: false, metrics: false };
        isInitialLoad.current = true;
        prevStates.current = {
          sheets: { allSheets: [], structure: [] },
          cards: [],
          cardTemplates: [],
          metrics: [],
          dashboards: [],
        };
      }
      setUserAuthChecked(true);
    });

    return () => unsubscribeAuth();
  }, [navigate, isSignup, location.pathname]);

  // Firestore update effect
  useEffect(() => {
    if (!user || !user.uid || isBatchProcessing.current) return;

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      prevStates.current = { sheets, cards, cardTemplates, metrics, dashboards };
      return;
    }

    // Skip Firestore updates for cards if they were just updated due to typeOfCards changes
    if (isUpdatingCardsFromTemplate.current) {
      isUpdatingCardsFromTemplate.current = false;
      prevStates.current = { sheets, cards, cardTemplates, metrics, dashboards };
      return;
    }

    // Helper function for deep comparison
    const isEqual = (a, b) => {
      if (a === b) return true;
      if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false;
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      for (const key of keysA) {
        if (!keysB.includes(key) || !isEqual(a[key], b[key])) return false;
      }
      return true;
    };

    // Helper function to detect changes in a collection
    const detectCollectionChanges = (currentItems, prevItems) => {
      const changes = { added: [], updated: [], removed: [] };
      const currentMap = new Map(currentItems.map((item) => [item.docId, item]));
      const prevMap = new Map(prevItems.map((item) => [item.docId, item]));

      currentItems.forEach((item) => {
        if (!prevMap.has(item.docId)) {
          changes.added.push(item);
        } else if (!isEqual(item, prevMap.get(item.docId))) {
          changes.updated.push(item);
        }
      });

      prevItems.forEach((item) => {
        if (!currentMap.has(item.docId)) {
          changes.removed.push(item.docId);
        }
      });

      return changes;
    };

    // Configuration mapping state to Firestore paths
    const stateConfig = {
      sheets: {
        collectionPath: (uid) => collection(db, 'businesses', uid, 'sheets'),
        singleDoc: {
          path: (uid) => doc(db, 'businesses', uid, 'sheetsStructure', 'structure'),
          field: 'structure',
          getData: (state) => state.structure,
          setData: (state, data) => ({ ...state, structure: data }),
        },
        getCollectionData: (state) => state.allSheets,
        setCollectionData: (state, data) => ({ ...state, allSheets: data }),
      },
      cards: {
        collectionPath: (uid) => collection(db, 'businesses', uid, 'cards'),
        getCollectionData: (state) => state,
        setCollectionData: (state, data) => data,
      },
      cardTemplates: {
        collectionPath: (uid) => collection(db, 'businesses', uid, 'cardTemplates'),
        getCollectionData: (state) => state,
        setCollectionData: (state, data) => data,
      },
      metrics: {
        collectionPath: (uid) => collection(db, 'businesses', uid, 'metrics'),
        getCollectionData: (state) => state,
        setCollectionData: (state, data) => data,
      },
      dashboards: {
        collectionPath: (uid) => collection(db, 'businesses', uid, 'dashboards'),
        getCollectionData: (state) => state,
        setCollectionData: (state, data) => data,
      },
    };

    // Process updates
    const processUpdates = async () => {
      isBatchProcessing.current = true; // Prevent re-entrant updates
      const batch = writeBatch(db);
      let hasChanges = false;

      try {
        // Detect typeOfCards changes in cardTemplates
        const templateChanges = detectCollectionChanges(cardTemplates, prevStates.current.cardTemplates);
        const typeOfCardsChanges = [];

        templateChanges.updated.forEach((currentTemplate) => {
          const prevTemplate = prevStates.current.cardTemplates.find(
            (t) => t.docId === currentTemplate.docId
          );
          if (prevTemplate && prevTemplate.typeOfCards !== currentTemplate.typeOfCards) {
            typeOfCardsChanges.push({
              docId: currentTemplate.docId,
              oldTypeOfCards: prevTemplate.typeOfCards,
              newTypeOfCards: currentTemplate.typeOfCards,
            });
          }
        });

        // Collect updated cards for local state update
        let updatedCards = [...cards];

        // Queue Firestore updates for typeOfCards changes
        if (typeOfCardsChanges.length > 0) {
          isUpdatingCardsFromTemplate.current = true;
          updatedCards = cards.map((card) => {
            const change = typeOfCardsChanges.find(
              (c) => c.oldTypeOfCards === card.typeOfCards
            );
            if (change) {
              const cardDocRef = doc(stateConfig.cards.collectionPath(user.uid), card.docId);
              batch.set(cardDocRef, { typeOfCards: change.newTypeOfCards }, { merge: true });
              hasChanges = true;
              return { ...card, typeOfCards: change.newTypeOfCards };
            }
            return card;
          });
        }

        // Process each state
        Object.entries(stateConfig).forEach(([stateKey, config]) => {
          const currentState = { sheets, cards, cardTemplates, metrics, dashboards }[stateKey];
          const prevState = prevStates.current[stateKey];

          // Handle collection data
          const currentCollectionData = config.getCollectionData(currentState);
          const prevCollectionData = config.getCollectionData(prevState);
          const collectionChanges = detectCollectionChanges(currentCollectionData, prevCollectionData);

          // Process added items
          collectionChanges.added.forEach((item) => {
            const docRef = doc(config.collectionPath(user.uid), item.docId);
            const { docId, ...data } = item;
            batch.set(docRef, data);
            hasChanges = true;
          });

          // Process updated items
          collectionChanges.updated.forEach((item) => {
            // Skip cards updates if they were handled by typeOfCards changes
            if (stateKey === 'cards' && typeOfCardsChanges.some((change) => change.oldTypeOfCards === item.typeOfCards)) {
              return;
            }
            const docRef = doc(config.collectionPath(user.uid), item.docId);
            const { docId, ...data } = item;
            batch.set(docRef, data, { merge: true });
            hasChanges = true;
          });

          // Process removed items
          collectionChanges.removed.forEach((docId) => {
            const docRef = doc(config.collectionPath(user.uid), docId);
            batch.delete(docRef);
            hasChanges = true;
          });

          // Handle single document (e.g., sheets.structure)
          if (config.singleDoc) {
            const currentSingleData = config.singleDoc.getData(currentState);
            const prevSingleData = config.singleDoc.getData(prevState);
            if (!isEqual(currentSingleData, prevSingleData)) {
              const docRef = config.singleDoc.path(user.uid);
              batch.set(docRef, { [config.singleDoc.field]: currentSingleData });
              hasChanges = true;
            }
          }
        });

        // Commit batch if there are changes
        if (hasChanges) {
          console.log('Committing batch with operations:', { typeOfCardsChanges });
          await batch.commit();
        }

        // Update cards state after batch is committed
        if (typeOfCardsChanges.length > 0) {
          setCards(updatedCards);
        }
      } catch (error) {
        console.error('Error processing Firestore updates:', error);
      } finally {
        isBatchProcessing.current = false; // Allow next update
        prevStates.current = { sheets, cards, cardTemplates, metrics, dashboards };
      }
    };

    // Run updates
    processUpdates();
  }, [user, sheets, cards, cardTemplates, metrics, dashboards]);

  return (
    <MainContext.Provider
      value={{
        sheets,
        setSheets,
        cards,
        setCards,
        isDarkTheme,
        setIsDarkTheme,
        themeRef,
        cardTemplates,
        setCardTemplates,
        tempData,
        setTempData,
        selectedTemplateIndex,
        setSelectedTemplateIndex,
        currentSectionIndex,
        setCurrentSectionIndex,
        editMode,
        setEditMode,
        dashboards,
        setDashboards,
        metrics,
        setMetrics,
        user,
        setUser,
        userAuthChecked,
        setUserAuthChecked,
        isSignup,
        setIsSignup,
      }}
    >
      {children}
    </MainContext.Provider>
  );
};

MainContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default MainContextProvider;
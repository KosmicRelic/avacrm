import { createContext, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, doc, writeBatch, getDoc } from 'firebase/firestore';
import fetchUserData from '../Firebase/Firebase Functions/User Functions/FetchUserData';

export const MainContext = createContext();

export const MainContextProvider = ({ children }) => {
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) return storedTheme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [user, setUser] = useState(null);
  const [businessId, setBusinessId] = useState(null);
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

  const isInitialLoad = useRef(true);
  const prevStates = useRef({
    sheets: { allSheets: [], structure: [] },
    cards: [],
    cardTemplates: [],
    metrics: [],
    dashboards: [],
  });
  const isUpdatingCardsFromTemplate = useRef(false);
  const isBatchProcessing = useRef(false);

  useEffect(() => {
    themeRef.current = isDarkTheme ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', themeRef.current);
    document.body.style.backgroundColor = isDarkTheme ? 'black' : 'rgb(243, 242, 248)';
    document.body.style.color = isDarkTheme ? 'rgb(243, 242, 248)' : 'rgb(0, 0, 0)';
    if (localStorage.getItem('theme') !== null) {
      localStorage.setItem('theme', themeRef.current);
    }
  }, [isDarkTheme]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
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

        let fetchedBusinessId = firebaseUser.uid;
        console.log('Fetching user document for UID:', firebaseUser.uid);
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('User document data:', userData);
            if (userData.businessId) {
              fetchedBusinessId = userData.businessId;
              console.log('Using businessId from user document:', fetchedBusinessId);
            } else {
              console.log('No businessId found in user document, using UID as businessId:', fetchedBusinessId);
            }

            setBusinessId(fetchedBusinessId);

            if (fetchedBusinessId !== firebaseUser.uid) {
              const teamMemberDocRef = doc(db, 'businesses', fetchedBusinessId, 'teamMembers', firebaseUser.uid);
              const teamMemberDoc = await getDoc(teamMemberDocRef);
              if (teamMemberDoc.exists()) {
                const teamMemberData = teamMemberDoc.data();
                console.log('Team member document data:', teamMemberData);
              } else {
                console.error('Team member document does not exist for UID:', firebaseUser.uid, 'in business:', fetchedBusinessId);
              }
            }
          } else {
            console.error('User document does not exist for UID:', firebaseUser.uid);
          }
        } catch (error) {
          console.error('Error fetching user or team member document:', {
            uid: firebaseUser.uid,
            errorCode: error.code,
            errorMessage: error.message,
          });
        }

        if (
          (currentRoute === '/sheets' && !hasFetched.current.sheets) ||
          (currentRoute === '/dashboard' && !hasFetched.current.dashboard) ||
          (currentRoute === '/metrics' && !hasFetched.current.metrics)
        ) {
          console.log('Fetching data for route:', currentRoute, 'with businessId:', fetchedBusinessId);
          cleanupFetch = fetchUserData({
            businessId: fetchedBusinessId,
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
        console.log('No authenticated user, clearing state');
        setUser(null);
        setBusinessId(null);
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

  useEffect(() => {
    if (!user || !businessId || isBatchProcessing.current) return;

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      prevStates.current = { sheets, cards, cardTemplates, metrics, dashboards };
      return;
    }

    if (isUpdatingCardsFromTemplate.current) {
      isUpdatingCardsFromTemplate.current = false;
      prevStates.current = { sheets, cards, cardTemplates, metrics, dashboards };
      return;
    }

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

    const stateConfig = {
      sheets: {
        collectionPath: () => collection(db, 'businesses', businessId, 'sheets'),
        singleDoc: {
          path: () => doc(db, 'businesses', businessId, 'sheetsStructure', 'structure'),
          field: 'structure',
          getData: (state) => state.structure,
          setData: (state, data) => ({ ...state, structure: data }),
        },
        getCollectionData: (state) => state.allSheets,
        setCollectionData: (state, data) => ({ ...state, allSheets: data }),
      },
      cards: {
        collectionPath: () => collection(db, 'businesses', businessId, 'cards'),
        getCollectionData: (state) => state,
        setCollectionData: (state, data) => data,
      },
      cardTemplates: {
        collectionPath: () => collection(db, 'businesses', businessId, 'cardTemplates'),
        getCollectionData: (state) => state,
        setCollectionData: (state, data) => data,
      },
      metrics: {
        collectionPath: () => collection(db, 'businesses', businessId, 'metrics'),
        getCollectionData: (state) => state,
        setCollectionData: (state, data) => data,
      },
      dashboards: {
        collectionPath: () => collection(db, 'businesses', businessId, 'dashboards'),
        getCollectionData: (state) => state,
        setCollectionData: (state, data) => data,
      },
    };

    const processUpdates = async () => {
      isBatchProcessing.current = true;
      const batch = writeBatch(db);
      let hasChanges = false;
      let typeOfCardsChanges = [];

      try {
        const templateChanges = detectCollectionChanges(cardTemplates, prevStates.current.cardTemplates);
        typeOfCardsChanges = [];

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

        let updatedCards = [...cards];

        if (typeOfCardsChanges.length > 0) {
          isUpdatingCardsFromTemplate.current = true;
          updatedCards = cards.map((card) => {
            const change = typeOfCardsChanges.find(
              (c) => c.oldTypeOfCards === card.typeOfCards
            );
            if (change) {
              const cardDocRef = doc(stateConfig.cards.collectionPath(), card.docId);
              console.log('Adding batch update for card:', { docId: card.docId, newTypeOfCards: change.newTypeOfCards });
              batch.set(cardDocRef, { typeOfCards: change.newTypeOfCards }, { merge: true });
              hasChanges = true;
              return { ...card, typeOfCards: change.newTypeOfCards };
            }
            return card;
          });
        }

        Object.entries(stateConfig).forEach(([stateKey, config]) => {
          const currentState = { sheets, cards, cardTemplates, metrics, dashboards }[stateKey];
          const prevState = prevStates.current[stateKey];

          const currentCollectionData = config.getCollectionData(currentState);
          const prevCollectionData = config.getCollectionData(prevState);
          const collectionChanges = detectCollectionChanges(currentCollectionData, prevCollectionData);

          collectionChanges.added.forEach((item) => {
            const docRef = doc(config.collectionPath(), item.docId);
            const { docId, ...data } = item;
            console.log('Adding batch set for:', { path: docRef.path, data });
            batch.set(docRef, data);
            hasChanges = true;
          });

          collectionChanges.updated.forEach((item) => {
            if (stateKey === 'cards' && typeOfCardsChanges.some((change) => change.oldTypeOfCards === item.typeOfCards)) {
              return;
            }
            const docRef = doc(config.collectionPath(), item.docId);
            const { docId, ...data } = item;
            console.log('Adding batch update for:', { path: docRef.path, data });
            batch.set(docRef, data, { merge: true });
            hasChanges = true;
          });

          collectionChanges.removed.forEach((docId) => {
            const docRef = doc(config.collectionPath(), docId);
            console.log('Adding batch delete for:', { path: docRef.path });
            batch.delete(docRef);
            hasChanges = true;
          });

          if (config.singleDoc) {
            const currentSingleData = config.singleDoc.getData(currentState);
            const prevSingleData = config.singleDoc.getData(prevState);
            if (!isEqual(currentSingleData, prevSingleData)) {
              const docRef = config.singleDoc.path();
              console.log('Adding batch set for single doc:', { path: docRef.path, data: { [config.singleDoc.field]: currentSingleData } });
              batch.set(docRef, { [config.singleDoc.field]: currentSingleData });
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          console.log('Committing batch with operations:', { typeOfCardsChanges, hasChanges });
          await batch.commit();
        } else {
          console.log('No changes to commit, skipping batch');
        }

        if (typeOfCardsChanges.length > 0) {
          setCards(updatedCards);
        }
      } catch (error) {
        console.error('Error processing Firestore updates:', error, { typeOfCardsChanges, hasChanges });
      } finally {
        isBatchProcessing.current = false;
        prevStates.current = { sheets, cards, cardTemplates, metrics, dashboards };
      }
    };

    processUpdates();
  }, [user, businessId, sheets, cards, cardTemplates, metrics, dashboards]);

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
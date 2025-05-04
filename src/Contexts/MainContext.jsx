import { createContext, useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase'; // Adjust the import path as needed
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, doc, writeBatch, getDoc } from 'firebase/firestore';
import fetchUserData from '../Firebase/Firebase Functions/User Functions/FetchUserData'; // Adjust the import path as needed

export const MainContext = createContext();

export const MainContextProvider = ({ children }) => {
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const storedTheme = localStorage.getItem('theme') || 'device';
    return storedTheme === 'device'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : storedTheme === 'dark';
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
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const themeRef = useRef(isDarkTheme ? 'dark' : 'light');
  const hasFetched = useRef({ sheets: false, dashboard: false, metrics: false });
  const prevStates = useRef({
    sheets: { allSheets: [], structure: [] },
    cards: [],
    cardTemplates: [],
    metrics: [],
    dashboards: [],
  });
  const isUpdatingCardsFromTemplate = useRef(false);
  const isBatchProcessing = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Memoize state to prevent unnecessary re-renders
  const memoizedSheets = useMemo(() => sheets, [sheets]);
  const memoizedCards = useMemo(() => cards, [cards]);
  const memoizedCardTemplates = useMemo(() => cardTemplates, [cardTemplates]);
  const memoizedMetrics = useMemo(() => metrics, [metrics]);
  const memoizedDashboards = useMemo(() => dashboards, [dashboards]);

  // Theme-related effects
  useEffect(() => {
    themeRef.current = isDarkTheme ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', themeRef.current);
    document.body.style.backgroundColor = isDarkTheme ? 'black' : 'rgb(243, 242, 248)';
    document.body.style.color = isDarkTheme ? 'rgb(243, 242, 248)' : 'rgb(0, 0, 0)';
  }, [isDarkTheme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (localStorage.getItem('theme') === 'device') {
        setIsDarkTheme(mediaQuery.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Authentication and initial data fetching
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email });

        if (isSignup) {
          setIsSignup(false);
          navigate('/dashboard');
          setUserAuthChecked(true);
          return;
        }

        const currentRoute = location.pathname;
        let fetchedBusinessId = firebaseUser.uid;
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists() && userDoc.data().businessId) {
            fetchedBusinessId = userDoc.data().businessId;
          }
          setBusinessId(fetchedBusinessId);

          if (
            (currentRoute === '/sheets' && !hasFetched.current.sheets) ||
            (currentRoute === '/dashboard' && !hasFetched.current.dashboard) ||
            (currentRoute === '/metrics' && !hasFetched.current.metrics)
          ) {
            fetchUserData({
              businessId: fetchedBusinessId,
              route: currentRoute,
              setSheets,
              setCards,
              setCardTemplates,
              setMetrics,
              setDashboards,
            });

            if (currentRoute === '/sheets') hasFetched.current.sheets = true;
            if (currentRoute === '/dashboard' || currentRoute === '/metrics') {
              hasFetched.current.dashboard = true;
              hasFetched.current.metrics = true;
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }

        setIsDataLoaded(true);
      } else {
        setUser(null);
        setBusinessId(null);
        setSheets({ allSheets: [], structure: [] });
        setCards([]);
        setCardTemplates([]);
        setMetrics([]);
        setDashboards([]);
        hasFetched.current = { sheets: false, dashboard: false, metrics: false };
        prevStates.current = {
          sheets: { allSheets: [], structure: [] },
          cards: [],
          cardTemplates: [],
          metrics: [],
          dashboards: [],
        };
        setIsDataLoaded(false);
      }
      setUserAuthChecked(true);
    });

    return () => unsubscribeAuth();
  }, [navigate, isSignup, location.pathname]);

  // Batch update effect for Firebase synchronization
  useEffect(() => {
    if (!user || !businessId || !isDataLoaded || isBatchProcessing.current) return;

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
      return keysA.every((key) => keysB.includes(key) && isEqual(a[key], b[key]));
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

      try {
        // Process cards with explicit modifications
        const modifiedCards = cards.filter((card) => card.isModified);
        for (const card of modifiedCards) {
          const docRef = doc(stateConfig.cards.collectionPath(), card.docId);
          if (card.action === 'remove') {
            batch.delete(docRef);
            hasChanges = true;
          } else if (card.action === 'add' || card.action === 'update') {
            const { isModified, action, docId, ...cardData } = card;
            batch.set(docRef, cardData);
            hasChanges = true;
          }
        }

        // Process dashboards with explicit modifications
        const modifiedDashboards = dashboards.filter((dashboard) => dashboard.isModified);
        for (const dashboard of modifiedDashboards) {
          const docRef = doc(stateConfig.dashboards.collectionPath(), dashboard.docId);
          if (dashboard.action === 'remove') {
            batch.delete(docRef);
            hasChanges = true;
          } else if (dashboard.action === 'add' || dashboard.action === 'update') {
            const { isModified, action, docId, ...dashboardData } = dashboard;
            batch.set(docRef, dashboardData);
            hasChanges = true;
          }
        }

        // Process cardTemplates with explicit modifications
        const modifiedCardTemplates = cardTemplates.filter((template) => template.isModified);
        for (const template of modifiedCardTemplates) {
          const docRef = doc(stateConfig.cardTemplates.collectionPath(), template.docId);
          if (template.action === 'remove') {
            batch.delete(docRef);
            hasChanges = true;
          } else if (template.action === 'add' || template.action === 'update') {
            const { isModified, action, docId, ...templateData } = template;
            batch.set(docRef, templateData);
            hasChanges = true;
          }
        }

        // Handle template changes affecting cards
        const templateChanges = modifiedCardTemplates.filter(
          (template) => template.isModified && (template.action === 'add' || template.action === 'update')
        );
        const typeOfCardsChanges = templateChanges
          .filter((current) => {
            const prev = prevStates.current.cardTemplates.find((t) => t.docId === current.docId);
            return prev && prev.typeOfCards !== current.typeOfCards;
          })
          .map((current) => ({
            docId: current.docId,
            oldTypeOfCards: prevStates.current.cardTemplates.find((t) => t.docId === current.docId)?.typeOfCards,
            newTypeOfCards: current.typeOfCards,
          }));

        let updatedCards = [...cards];
        if (typeOfCardsChanges.length > 0) {
          isUpdatingCardsFromTemplate.current = true;
          updatedCards = cards.map((card) => {
            const change = typeOfCardsChanges.find((c) => c.oldTypeOfCards === card.typeOfCards);
            if (change) {
              const cardDocRef = doc(stateConfig.cards.collectionPath(), card.docId);
              batch.set(cardDocRef, { typeOfCards: change.newTypeOfCards }, { merge: true });
              hasChanges = true;
              return { ...card, typeOfCards: change.newTypeOfCards, isModified: true, action: 'update' };
            }
            return card;
          });
        }

        // Process other collections only for explicit changes
        const collectionsToCheck = ['sheets', 'metrics'];
        for (const stateKey of collectionsToCheck) {
          const config = stateConfig[stateKey];
          const currentState = { sheets, cards, cardTemplates, metrics, dashboards }[stateKey];
          const prevState = prevStates.current[stateKey];

          const currentCollectionData = config.getCollectionData(currentState);
          const prevCollectionData = config.getCollectionData(prevState);
          const collectionChanges = detectCollectionChanges(currentCollectionData, prevCollectionData);

          collectionChanges.added.forEach((item) => {
            const docRef = doc(config.collectionPath(), item.docId);
            const { docId, ...data } = item;
            batch.set(docRef, data);
            hasChanges = true;
          });

          collectionChanges.updated.forEach((item) => {
            const docRef = doc(config.collectionPath(), item.docId);
            const { docId, ...data } = item;
            batch.set(docRef, data, { merge: true });
            hasChanges = true;
          });

          collectionChanges.removed.forEach((docId) => {
            const docRef = doc(config.collectionPath(), docId);
            batch.delete(docRef);
            hasChanges = true;
          });

          if (config.singleDoc) {
            const currentSingleData = config.singleDoc.getData(currentState);
            const prevSingleData = config.singleDoc.getData(prevState);
            if (!isEqual(currentSingleData, prevSingleData)) {
              const docRef = config.singleDoc.path();
              batch.set(docRef, { [config.singleDoc.field]: currentSingleData });
              hasChanges = true;
            }
          }
        }

        if (hasChanges) {
          await batch.commit();
          setCards((prev) =>
            prev
              .filter((card) => !(card.isModified && card.action === 'remove'))
              .map((card) => {
                if (card.isModified) {
                  const { isModified, action, ...cleanCard } = card;
                  return cleanCard;
                }
                return card;
              })
          );
          setDashboards((prev) =>
            prev
              .filter((dashboard) => !(dashboard.isModified && dashboard.action === 'remove'))
              .map((dashboard) => {
                if (dashboard.isModified) {
                  const { isModified, action, ...cleanDashboard } = dashboard;
                  return cleanDashboard;
                }
                return dashboard;
              })
          );
          setCardTemplates((prev) =>
            prev
              .filter((template) => !(template.isModified && template.action === 'remove'))
              .map((template) => {
                if (template.isModified) {
                  const { isModified, action, ...cleanTemplate } = template;
                  return cleanTemplate;
                }
                return template;
              })
          );
          if (typeOfCardsChanges.length > 0) {
            setCards(updatedCards);
          }
        }
      } catch (error) {
        console.error('Error processing Firestore updates:', error);
        alert('Failed to save changes. Please try again.');
      } finally {
        isBatchProcessing.current = false;
        prevStates.current = { sheets, cards, cardTemplates, metrics, dashboards };
      }
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
        if (!currentMap.has(item.docId) && item.action === 'remove' && item.isModified) {
          changes.removed.push(item.docId);
        }
      });

      return changes;
    };

    processUpdates();
  }, [user, businessId, memoizedSheets, memoizedCards, memoizedCardTemplates, memoizedMetrics, memoizedDashboards, isDataLoaded]);

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
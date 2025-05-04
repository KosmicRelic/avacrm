import { createContext, useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, doc, writeBatch, getDoc } from 'firebase/firestore';
import fetchUserData, { resetFetchedSheetIds } from '../Firebase/Firebase Functions/User Functions/FetchUserData';

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
  const [activeSheetName, setActiveSheetName] = useState(null);
  const [sheetCardsFetched, setSheetCardsFetched] = useState({});
  const fetchingSheetIdsRef = useRef(new Set());

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
  const lastFetchedSheetId = useRef(null);
  const isFetching = useRef(false); // Track ongoing fetches
  const navigate = useNavigate();
  const location = useLocation();

  const memoizedSheets = useMemo(() => sheets, [sheets]);
  const memoizedCards = useMemo(() => cards, [cards]);
  const memoizedCardTemplates = useMemo(() => cardTemplates, [cardTemplates]);
  const memoizedMetrics = useMemo(() => metrics, [metrics]);
  const memoizedDashboards = useMemo(() => dashboards, [dashboards]);

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
            if (currentRoute === '/sheets' && !activeSheetName) {
              console.log('Setting default activeSheetName to "Leads"');
              setActiveSheetName('Leads');
            }

            if (isFetching.current) {
              console.log('Skipping fetch: another fetch is in progress');
              return;
            }

            console.log('Initial fetch with activeSheetName:', activeSheetName || 'Leads');
            isFetching.current = true;
            await fetchUserData({
              businessId: fetchedBusinessId,
              route: currentRoute,
              setSheets,
              setCards,
              setCardTemplates,
              setMetrics,
              setDashboards,
              activeSheetName: currentRoute === '/sheets' ? activeSheetName || 'Leads' : null,
              updateSheets: true,
            });
            isFetching.current = false;

            if (currentRoute === '/sheets') hasFetched.current.sheets = true;
            if (currentRoute === '/dashboard' || currentRoute === '/metrics') {
              hasFetched.current.dashboard = true;
              hasFetched.current.metrics = true;
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          isFetching.current = false;
        }

        setIsDataLoaded(true);
      } else {
        console.log('User logged out, resetting state and cache');
        setUser(null);
        setBusinessId(null);
        setSheets({ allSheets: [], structure: [] });
        setCards([]);
        setCardTemplates([]);
        setMetrics([]);
        setDashboards([]);
        setActiveSheetName(null);
        hasFetched.current = { sheets: false, dashboard: false, metrics: false };
        prevStates.current = {
          sheets: { allSheets: [], structure: [] },
          cards: [],
          cardTemplates: [],
          metrics: [],
          dashboards: [],
        };
        setIsDataLoaded(false);
        resetFetchedSheetIds();
      }
      setUserAuthChecked(true);
    });

    return () => unsubscribeAuth();
  }, [navigate, isSignup, location.pathname]);

  useEffect(() => {
    if (
      user &&
      businessId &&
      location.pathname === '/sheets' &&
      activeSheetName
    ) {
      const sheetObj = sheets.allSheets.find(s => s.sheetName === activeSheetName);
      const sheetId = sheetObj?.docId;
      if (
        !sheetId ||
        sheetCardsFetched[sheetId] ||
        fetchingSheetIdsRef.current.has(sheetId)
      ) {
        // Already fetched or currently fetching for this sheetId
        return;
      }
      // Mark as fetching to avoid race conditions
      fetchingSheetIdsRef.current.add(sheetId);
      fetchUserData({
        businessId,
        route: '/sheets',
        setCards,
        setCardTemplates,
        setMetrics,
        setDashboards,
        activeSheetName,
        updateSheets: false,
      }).then(() => {
        setSheetCardsFetched(prev => ({ ...prev, [sheetId]: true }));
        fetchingSheetIdsRef.current.delete(sheetId);
      }).catch(() => {
        fetchingSheetIdsRef.current.delete(sheetId);
      });
    }
    // DO NOT include sheetCardsFetched in the dependency array!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, businessId, activeSheetName, location.pathname, sheets.allSheets]);

  useEffect(() => {
    if (location.pathname.startsWith('/sheets/')) {
      const sheetName = location.pathname.split('/sheets/')[1];
      if (sheetName && sheetName !== activeSheetName) {
        console.log('Setting activeSheetName from URL:', decodeURIComponent(sheetName));
        setActiveSheetName(decodeURIComponent(sheetName));
      }
    }
  }, [location.pathname]);

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
        } else {
          const prevItem = prevMap.get(item.docId);
          const keys = new Set([...Object.keys(item), ...Object.keys(prevItem)]);
          let diff = false;
          for (const key of keys) {
            if (key === 'isActive') continue;
            if (!isEqual(item[key], prevItem[key])) {
              diff = true;
              break;
            }
          }
          if (diff) {
            changes.updated.push(item);
          }
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
        activeSheetName,
        setActiveSheetName,
        sheetCardsFetched,
        setSheetCardsFetched,
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
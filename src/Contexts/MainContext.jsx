import { createContext, useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, doc, writeBatch, getDoc, onSnapshot, query, where, updateDoc, getDocs } from 'firebase/firestore';
import fetchUserData from '../Firebase/Firebase Functions/User Functions/FetchUserData';

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
  const [sheets, setSheets] = useState({ allSheets: [], structure: [], deletedSheetId: null });
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
  const [pendingInvitations, setPendingInvitations] = useState(0);
  const [teamMembers, setTeamMembers] = useState([]);
  const [bannerQueue, setBannerQueue] = useState([]);
  const fetchingSheetIdsRef = useRef(new Set());
  const themeRef = useRef(isDarkTheme ? 'dark' : 'light');
  const hasFetched = useRef({ sheets: false, dashboard: false, metrics: false });
  const prevStates = useRef({
    sheets: { allSheets: [], structure: [], deletedSheetId: null },
    cards: [],
    cardTemplates: [],
    metrics: [],
    dashboards: [],
  });
  const isUpdatingCardsFromTemplate = useRef(false);
  const isBatchProcessing = useRef(false);
  const processedTeamMembers = useRef(new Set());
  const displayedMessages = useRef(new Set());
  const navigate = useNavigate();
  const location = useLocation();

  const memoizedSheets = useMemo(() => sheets, [sheets]);
  const memoizedCards = useMemo(() => cards, [cards]);
  const memoizedCardTemplates = useMemo(() => cardTemplates, [cardTemplates]);
  const memoizedMetrics = useMemo(() => metrics, [metrics]);
  const memoizedDashboards = useMemo(() => dashboards, [dashboards]);

  const addBannerMessage = (message, type = 'success') => {
    const messageId = `${message}-${type}-${Date.now()}`;
    if (displayedMessages.current.has(messageId)) return;
    displayedMessages.current.add(messageId);
    setBannerQueue((prev) => [...prev, { message, type, id: messageId }]);
  };

  useEffect(() => {
    themeRef.current = isDarkTheme ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', themeRef.current);
    document.body.style.backgroundColor = isDarkTheme ? 'black' : 'rgb(243, 242, 248)';
    document.body.style.color = isDarkTheme ? 'rgb(0, 0, 0)' : 'rgb(243, 242, 248)';
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
        let userPermissions = {
          dashboard: 'editor',
          metrics: 'editor',
          sheets: { role: 'editor', allowedSheetIds: [] },
          actions: 'editor',
          financials: 'editor',
        };
        let userType = 'business';
        let fetchedBusinessId = firebaseUser.uid;
        let userData = null;
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists() && userDoc.data().businessId) {
            fetchedBusinessId = userDoc.data().businessId;
            userType = userDoc.data().userType || 'business';
            userData = userDoc.data();
          }
          setBusinessId(fetchedBusinessId);

          // If not business user, fetch permissions from teamMembers
          if (firebaseUser.uid !== fetchedBusinessId) {
            const teamMemberDoc = await getDoc(doc(db, 'businesses', fetchedBusinessId, 'teamMembers', firebaseUser.uid));
            if (teamMemberDoc.exists()) {
              const perms = teamMemberDoc.data().permissions;
              userPermissions = {
                dashboard: perms?.dashboard?.role || 'none',
                metrics: perms?.metrics?.role || 'none',
                sheets: perms?.sheets || { role: 'none', allowedSheetIds: [] },
                actions: perms?.actions?.role || 'none',
                financials: perms?.financials?.role || 'none',
              };
              userType = 'team_member';
            }
          }
        } catch (e) {
          // fallback: treat as business user
        }
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          businessId: fetchedBusinessId,
          userType,
          permissions: userPermissions,
          ...userData,
        });

        if (isSignup) {
          setIsSignup(false);
          if (userType === 'business') {
            navigate('/dashboard');
          } else {
            navigate('/sheets');
          }
          setUserAuthChecked(true);
          return;
        }

        const currentRoute = location.pathname;
        try {
          const fetches = [];
          if (currentRoute === '/sheets' && !hasFetched.current.sheets) {
            if (!activeSheetName) setActiveSheetName('Leads');
            fetches.push(
              fetchUserData({
                businessId: fetchedBusinessId,
                route: '/sheets',
                setSheets,
                setCards,
                setCardTemplates,
                setMetrics,
                setDashboards,
                activeSheetName: activeSheetName || 'Leads',
                updateSheets: true,
              })
            );
          }
          if (currentRoute === '/dashboard' && !hasFetched.current.dashboard) {
            fetches.push(
              fetchUserData({
                businessId: fetchedBusinessId,
                route: '/dashboard',
                setSheets,
                setCards,
                setCardTemplates,
                setMetrics,
                setDashboards,
                updateSheets: false,
              })
            );
          }
          if (currentRoute === '/metrics' && !hasFetched.current.metrics) {
            fetches.push(
              fetchUserData({
                businessId: fetchedBusinessId,
                route: '/metrics',
                setSheets,
                setCards,
                setCardTemplates,
                setMetrics,
                setDashboards,
                updateSheets: false,
              })
            );
          }
          await Promise.all(fetches);

          if (currentRoute === '/sheets') hasFetched.current.sheets = true;
          if (currentRoute === '/dashboard') hasFetched.current.dashboard = true;
          if (currentRoute === '/metrics') hasFetched.current.metrics = true;
        } catch (error) {
          console.error('Error fetching user data:', error);
        }

        setIsDataLoaded(true);
      } else {
        setUser(null);
        setBusinessId(null);
        setSheets({ allSheets: [], structure: [], deletedSheetId: null });
        setCards([]);
        setCardTemplates([]);
        setMetrics([]);
        setDashboards([]);
        setTeamMembers([]);
        setActiveSheetName(null);
        setPendingInvitations(0);
        setBannerQueue([]);
        processedTeamMembers.current.clear();
        displayedMessages.current.clear();
        hasFetched.current = { sheets: false, dashboard: false, metrics: false };
        prevStates.current = {
          sheets: { allSheets: [], structure: [], deletedSheetId: null },
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

  useEffect(() => {
    if (!user || !user.uid) return;

    const setupListener = () => {
      const invitationsQuery = query(
        collection(db, 'invitations'),
        where('status', '==', 'pending'),
        where('invitedBy', '==', user.uid)
      );

      const unsubscribe = onSnapshot(invitationsQuery, (snapshot) => {
        const invitationCount = snapshot.size;
        setPendingInvitations(invitationCount);
      }, (error) => {
        console.error('Error listening to invitations:', error);
        if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
          setTimeout(setupListener, 5000);
        }
      });

      return unsubscribe;
    };

    const unsubscribe = setupListener();
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !businessId || user.uid !== businessId) {
      setTeamMembers([]);
      setBannerQueue([]);
      return;
    }

    const setupListener = () => {
      const teamMembersRef = collection(db, 'businesses', businessId, 'teamMembers');
      const unsubscribe = onSnapshot(teamMembersRef, async (snapshot) => {
        const members = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
        setTeamMembers(members);

        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            const newMember = { uid: change.doc.id, ...change.doc.data() };

            if (!newMember.displayJoinedMessage) continue;
            if (processedTeamMembers.current.has(newMember.uid)) continue;
            processedTeamMembers.current.add(newMember.uid);

            addBannerMessage(`${newMember.name} ${newMember.surname} has joined the team!`, 'success');

            try {
              const teamMemberDocRef = doc(db, 'businesses', businessId, 'teamMembers', newMember.uid);
              await updateDoc(teamMemberDocRef, { displayJoinedMessage: null });
            } catch (error) {
              console.error('Error removing displayJoinedMessage:', error);
            }
          }
        }
      }, (error) => {
        console.error('Error listening to team members:', error);
        if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
          setTimeout(setupListener, 5000);
        }
      });

      return unsubscribe;
    };

    const unsubscribe = setupListener();
    return () => unsubscribe();
  }, [user, businessId]);

  useEffect(() => {
    if (user && businessId && location.pathname === '/sheets' && activeSheetName) {
      const sheetObj = sheets.allSheets.find((s) => s.sheetName === activeSheetName);
      const sheetId = sheetObj?.docId;
      if (!sheetId || fetchingSheetIdsRef.current.has(sheetId) || sheetCardsFetched[sheetId]) {
        return;
      }
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
        setSheetCardsFetched((prev) => ({ ...prev, [sheetId]: true }));
        fetchingSheetIdsRef.current.delete(sheetId);
      }).catch(() => {
        fetchingSheetIdsRef.current.delete(sheetId);
      });
    }
  }, [user, businessId, activeSheetName, location.pathname, sheets.allSheets, sheetCardsFetched]);

  useEffect(() => {
    if (location.pathname.startsWith('/sheets/')) {
      const sheetName = decodeURIComponent(location.pathname.split('/sheets/')[1] || '');
      if (sheetName && sheetName !== activeSheetName) {
        console.debug('Updating activeSheetName from URL', { sheetName, currentActiveSheetName: activeSheetName });
        setActiveSheetName(sheetName);
      }
    }
  }, [location.pathname, activeSheetName]);

  useEffect(() => {
    if (!user || !businessId || !isDataLoaded) return;

    const currentSheet = sheets.allSheets.find((s) => s.sheetName === activeSheetName);
    const currentCardTypeFilters = currentSheet?.cardTypeFilters || {};
    const prevCardTypeFilters = prevStates.current.sheets.allSheets.find(
      (s) => s.sheetName === activeSheetName
    )?.cardTypeFilters || {};

    if (JSON.stringify(currentCardTypeFilters) !== JSON.stringify(prevCardTypeFilters)) {
      if (currentSheet?.docId) {
        setSheetCardsFetched((prev) => {
          const newFetched = { ...prev };
          delete newFetched[currentSheet.docId];
          return newFetched;
        });
      }
    }
  }, [sheets, activeSheetName, user, businessId, isDataLoaded]);

  useEffect(() => {
    if (!user || !businessId || !isDataLoaded || isBatchProcessing.current) return;

    if (isUpdatingCardsFromTemplate.current) {
      isUpdatingCardsFromTemplate.current = false;
      prevStates.current = { sheets, cards, cardTemplates, metrics, dashboards };
      return;
    }

    if (sheets.allSheets.length === 0 && sheets.structure.length === 0 && !sheets.deletedSheetId) {
      prevStates.current = { sheets, cards, cardTemplates, metrics, dashboards };
      return;
    }

    const isEqual = (a, b, ignoreKeys = []) => {
      if (a === b) return true;
      if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false;
      const keysA = Object.keys(a).filter((key) => !ignoreKeys.includes(key));
      const keysB = Object.keys(b).filter((key) => !ignoreKeys.includes(key));
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) => isEqual(a[key], b[key], ignoreKeys));
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
        const isBusinessUser = user.uid === businessId;

        const modifiedCards = cards.filter((card) => card.isModified);
        const accessibleSheets = sheets.allSheets;
        const accessibleCardTypes = new Set(
          accessibleSheets.flatMap((sheet) =>
            Array.isArray(sheet.typeOfCardsToDisplay) ? sheet.typeOfCardsToDisplay : []
          )
        );

        for (const card of modifiedCards) {
          const isCardAccessible = isBusinessUser || accessibleCardTypes.has(card.typeOfCards);
          if (!isCardAccessible) {
            console.warn('User not authorized to modify card', {
              cardId: card.docId,
              cardType: card.typeOfCards,
              userId: user.uid,
              businessId,
              accessibleCardTypes: Array.from(accessibleCardTypes),
            });
            continue;
          }

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

        if (isBusinessUser) {
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

          const modifiedMetrics = metrics.filter((metric) => metric.isModified);
          for (const metric of modifiedMetrics) {
            const docRef = doc(stateConfig.metrics.collectionPath(), metric.category);
            if (metric.action === 'remove') {
              batch.delete(docRef);
              hasChanges = true;
            } else if (metric.action === 'add' || metric.action === 'update') {
              const { isModified, action, ...metricData } = metric;
              batch.set(docRef, metricData);
              hasChanges = true;
            }
          }

          const collectionsToCheck = ['sheets'];
          for (const stateKey of collectionsToCheck) {
            const config = stateConfig[stateKey];
            const currentState = { sheets, cards, cardTemplates, metrics, dashboards }[stateKey];
            const prevState = prevStates.current[stateKey];

            const currentCollectionData = config.getCollectionData(currentState);
            const prevCollectionData = config.getCollectionData(prevState);
            const collectionChanges = detectCollectionChanges(
              currentCollectionData,
              prevCollectionData,
              stateKey === 'sheets' ? ['filters'] : []
            );

            collectionChanges.added.forEach((item) => {
              const docRef = doc(config.collectionPath(), item.docId);
              const { docId, isModified, action, filters, ...data } = item;
              batch.set(docRef, data);
              hasChanges = true;
            });

            collectionChanges.updated.forEach((item) => {
              if (item.isModified && item.action !== 'filter') {
                const docRef = doc(config.collectionPath(), item.docId);
                const { docId, isModified, action, filters, ...data } = item;
                batch.set(docRef, data, { merge: true });
                hasChanges = true;
              }
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

          if (sheets.deletedSheetId) {
            const teamMembersSnapshot = await getDocs(
              collection(db, 'businesses', businessId, 'teamMembers')
            );
            teamMembersSnapshot.forEach((teamMemberDoc) => {
              const teamMemberData = teamMemberDoc.data();
              const allowedSheetIds = teamMemberData.permissions?.sheets?.allowedSheetIds || [];
              if (allowedSheetIds.includes(sheets.deletedSheetId)) {
                const updatedAllowedSheetIds = allowedSheetIds.filter(
                  (id) => id !== sheets.deletedSheetId
                );
                const docRef = doc(db, 'businesses', businessId, 'teamMembers', teamMemberDoc.id);
                batch.update(docRef, {
                  'permissions.sheets.allowedSheetIds': updatedAllowedSheetIds,
                });
                hasChanges = true;
              }
            });
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

          if (isBusinessUser) {
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

            setMetrics((prev) =>
              prev
                .filter((metric) => !(metric.isModified && metric.action === 'remove'))
                .map((metric) => {
                  if (metric.isModified) {
                    const { isModified, action, ...cleanMetric } = metric;
                    return cleanMetric;
                  }
                  return metric;
                })
            );

            setSheets((prev) => ({
              ...prev,
              allSheets: prev.allSheets.map((sheet) => {
                if (sheet.isModified && sheet.action !== 'filter') {
                  const { isModified, action, ...cleanSheet } = sheet;
                  return cleanSheet;
                }
                return sheet;
              }),
              structure: prev.structure.map((item) => {
                if (item.isModified) {
                  const { isModified, action, ...cleanItem } = item;
                  return cleanItem;
                }
                return item;
              }),
              deletedSheetId: null,
            }));

            if (sheets.deletedSheetId) {
              setSheets((prev) => ({ ...prev, deletedSheetId: null }));
            }
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

    const detectCollectionChanges = (currentItems, prevItems, ignoreKeys = []) => {
      const changes = { added: [], updated: [], removed: [] };
      const currentMap = new Map(currentItems.map((item) => [item.docId || item.category || item.id, item]));
      const prevMap = new Map(prevItems.map((item) => [item.docId || item.category || item.id, item]));

      currentItems.forEach((item) => {
        const key = item.docId || item.category || item.id;
        if (!prevMap.has(key)) {
          changes.added.push(item);
        } else {
          const prevItem = prevMap.get(key);
          const keys = new Set([...Object.keys(item), ...Object.keys(prevItem)]);
          let diff = false;
          for (const k of keys) {
            if (k === 'isActive' || k === 'isModified' || k === 'action' || ignoreKeys.includes(k)) {
              continue;
            }
            if (!isEqual(item[k], prevItem[k], ignoreKeys)) {
              diff = true;
              break;
            }
          }
          if (diff && item.isModified) {
            changes.updated.push(item);
          }
        }
      });

      prevItems.forEach((item) => {
        const key = item.docId || item.category || item.id;
        if (!currentMap.has(key) && item.action === 'remove' && item.isModified) {
          changes.removed.push(key);
        }
      });

      return changes;
    };

    processUpdates();
  }, [user, businessId, memoizedSheets, memoizedCards, memoizedCardTemplates, memoizedMetrics, memoizedDashboards, isDataLoaded]);


  useEffect(() => {
    console.log(metrics);
  }, [metrics]);
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
        businessId,
        pendingInvitations,
        teamMembers,
        setTeamMembers,
        bannerQueue,
        setBannerQueue,
        addBannerMessage,
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
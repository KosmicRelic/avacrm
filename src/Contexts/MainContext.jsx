import { createContext, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import fetchUserData from '../Firebase/Firebase Functions/User Functions/fetchUserData';
import { useNavigate } from 'react-router-dom';
import { collection, doc, writeBatch } from 'firebase/firestore';

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
  const hasFetched = useRef(false);
  const navigate = useNavigate();

  // Refs to track initial load and previous state values for updates
  const isInitialLoad = useRef(true);
  const prevSheets = useRef(sheets);
  const prevCards = useRef(cards);
  const prevCardTemplates = useRef(cardTemplates);
  const prevMetrics = useRef(metrics);
  const prevDashboards = useRef(dashboards);

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

  // Auth state effect
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

        if (!hasFetched.current) {
          hasFetched.current = true;
          const cleanupFetch = fetchUserData({
            businessId: firebaseUser.uid,
            setSheets,
            setCards,
            setCardTemplates,
            setMetrics,
            setDashboards,
          });
          return cleanupFetch;
        }
      } else {
        setUser(null);
        setSheets({ allSheets: [], structure: [] });
        setCards([]);
        setCardTemplates([]);
        setMetrics([]);
        setDashboards([]);
        hasFetched.current = false;
      }
      setUserAuthChecked(true);
    });

    return () => unsubscribeAuth();
  }, [navigate, isSignup]);

  // Firestore update effect
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
      for (const key of keysA) {
        if (!keysB.includes(key) || !isEqual(a[key], b[key])) return false;
      }
      return true;
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
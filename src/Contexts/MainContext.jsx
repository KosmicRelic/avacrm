import { createContext, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import fetchUserData from '../Firebase/Firebase Functions/User Functions/fetchUserData';
import { useNavigate } from 'react-router-dom';

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
  const [isSignup, setIsSignup] = useState(false); // New state to track signup

  const themeRef = useRef(isDarkTheme ? 'dark' : 'light');
  const hasFetched = useRef(false);
  const navigate = useNavigate();

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
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
        });

        // If it's a signup, navigate to dashboard but skip data fetching
        if (isSignup) {
          setIsSignup(false); // Reset signup flag
          navigate('/dashboard');
          setUserAuthChecked(true);
          return;
        }

        // Fetch data only if not already fetched and not a signup
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

          // Cleanup Firestore subscriptions on auth state change
          return cleanupFetch;
        }
      } else {
        // Reset states if no user
        setUser(null);
        setSheets({ allSheets: [], structure: [] });
        setCards([]);
        setCardTemplates([]);
        setMetrics([]);
        setDashboards([]);
        hasFetched.current = false; // Allow re-fetching if user logs in again
      }
      setUserAuthChecked(true);
    });

    // Cleanup auth listener on unmount
    return () => unsubscribeAuth();
  }, [navigate, isSignup]);

  useEffect(() => {
    // console.log(sheets);
  }, [sheets]);

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
        setIsSignup, // Expose isSignup for signup component
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
import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './AppHeader.module.css';
import { CgProfile } from 'react-icons/cg';
import { FaBullhorn, FaChartBar, FaMoneyBillWave, FaChevronDown, FaProjectDiagram } from 'react-icons/fa';
import { SiGoogleadsense } from 'react-icons/si';
import { RiDashboard2Fill } from 'react-icons/ri';
import { MdFilterAlt } from 'react-icons/md';
import { IoSearch } from 'react-icons/io5';
import { MainContext } from '../Contexts/MainContext';
import BackButton from '../Components/Reusable Buttons/BackButton';
import { addDebugLog } from '../Utils/DebugPanel';

export default function AppHeader({ setIsProfileModalOpen, activeOption, setActiveOption, onEditSheet, onFilter }) {
  const { isDarkTheme, user, activeSheetName, setActiveSheetName } = useContext(MainContext);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Sync activeOption with current route
  useEffect(() => {
    const path = location.pathname;
    if (path === '/dashboard') setActiveOption('dashboard');
    else if (path === '/workflows') setActiveOption('workflows');
    else if (path.startsWith('/sheets')) {
      setActiveOption('sheets');
    }
    else if (path === '/metrics') setActiveOption('metrics');
    else if (path === '/financials') setActiveOption('financials');
    else if (path === '/actions') setActiveOption('actions');
    else setActiveOption('dashboard');
  }, [location.pathname, setActiveOption, activeSheetName]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle navigation and option change
  const handleOptionClick = (option) => {
    setActiveOption(option);
    setIsMenuOpen(false);
    const routes = {
      dashboard: '/dashboard',
      workflows: '/workflows',
      sheets: '/sheets',
      metrics: '/metrics',
      financials: '/financials',
      actions: '/actions',
    };
    navigate(routes[option]);
  };

  const toggleMenu = () => {
    setIsMenuOpen((prev) => {
      const newState = !prev;
      addDebugLog('AppHeader', 'Menu toggle', {
        from: prev,
        to: newState,
        isMobile,
        menuDropdownZIndex: '1100 (above modals)'
      });
      return newState;
    });
  };

  const isMobile = windowWidth <= 1024;

  // Debug logging for z-index and stacking context
  useEffect(() => {
    addDebugLog('AppHeader', 'Component mounted or window resized', {
      isMobile,
      windowWidth,
      activeOption,
      headerContainerZIndex: '50 (reduced for mobile UI)'
    });
  }, [isMobile, windowWidth, activeOption]);

  // Debug logging for rendering
  useEffect(() => {
    addDebugLog('AppHeader', 'Component rendered', {
      isMobile,
      windowWidth,
      activeOption,
      activeSheetName,
      headerZIndex: '50 (reduced for mobile UI)',
      bodyZIndex: getComputedStyle(document.body)?.zIndex || 'not set'
    });
  });

  // Map of options to their icons, labels, and routes
  const navOptions = {
    dashboard: { icon: <RiDashboard2Fill size={20} />, label: 'Dashboard' },
    sheets: { icon: <SiGoogleadsense size={20} />, label: 'Sheets' },
    workflows: { icon: <FaProjectDiagram size={20} />, label: 'Workflows' },
    actions: { icon: <FaBullhorn size={20} />, label: 'Actions' },
    metrics: { icon: <FaChartBar size={20} />, label: 'Metrics' },
    financials: { icon: <FaMoneyBillWave size={20} />, label: 'Financials' },
  };

  // Permission helpers
  const canAccess = (section) => {
    if (!user) return false;
    if (user.uid === user.businessId) return true;
    if (section === 'dashboard' || section === 'workflows' || section === 'financials' || section === 'actions' || section === 'metrics') {
      return (
        user.permissions?.[section] === 'editor' || user.permissions?.[section] === 'viewer'
      );
    }
    if (section === 'sheets') {
      return user.permissions?.sheets?.role === 'editor' || user.permissions?.sheets?.role === 'viewer';
    }
    return false;
  };

  // Filter navOptions based on permissions
  const visibleNavOptions = Object.keys(navOptions).filter((option) => canAccess(option));

  // Get the active option's details
  const activeNav = navOptions[activeOption] || navOptions.dashboard;

  return (
    <header className={`${styles.headerContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={`${styles.headerTop} ${activeSheetName ? styles.sheetView : ''}`}>
        {activeSheetName ? (
          <>
            <BackButton
              onClick={() => {
                setActiveSheetName(null);
                navigate('/sheets');
              }}
              isDarkTheme={isDarkTheme}
              ariaLabel="Back to Sheets"
            >
              <span>Sheets</span>
            </BackButton>
            <h1 className={`${styles.avaTitle} ${styles.centeredTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>AVA</h1>
            {activeOption === 'sheets' && (
              <div className={`${styles.sheetActions} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <button
                  className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  onClick={() => {/* TODO: Implement search functionality */}}
                  aria-label="Search"
                >
                  <IoSearch size={26} />
                </button>
                <button
                  className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  onClick={onFilter}
                  aria-label="Filter"
                >
                  <MdFilterAlt size={26} />
                </button>
                <button
                  className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  onClick={onEditSheet}
                  aria-label="Edit Sheet"
                >
                  Edit
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className={styles.logoContainer}>
              <h1 className={`${styles.avaTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>AVA</h1>
              {isMobile && (
                <>
                  <button
                    className={`${styles.menuButton} ${styles.navButton} ${
                      activeOption === 'dashboard'
                        ? styles.activeDashboard
                        : activeOption === 'workflows'
                        ? styles.activeWorkflows
                        : activeOption === 'sheets'
                        ? styles.activeSheets
                        : activeOption === 'financials'
                        ? styles.activeFinancials
                        : activeOption === 'actions'
                        ? styles.activeActions
                        : styles.activeMetrics
                    } ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={toggleMenu}
                    aria-label={`Toggle Menu, Current: ${activeNav.label}`}
                  >
                    {activeOption === 'sheets' ? (
                      <span className={styles.iconWrapper}>{activeNav.icon}</span>
                    ) : (
                      activeNav.icon
                    )}
                    <span>{activeNav.label}</span>
                    <span className={`${styles.chevronWrapper} ${isMenuOpen ? styles.chevronUp : ''} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      <FaChevronDown size={14} />
                    </span>
                  </button>
                </>
              )}
            </div>
            {!isMobile && (
              <nav className={styles.desktopNav}>
                {visibleNavOptions.map((option) => (
                  <button
                    key={option}
                    className={`${styles.navButton} ${
                      activeOption === option
                        ? styles[`active${option.charAt(0).toUpperCase() + option.slice(1)}`]
                        : ''
                    } ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => handleOptionClick(option)}
                  >
                    {option === 'sheets' ? (
                      <span className={styles.iconWrapper}>{navOptions[option].icon}</span>
                    ) : (
                      navOptions[option].icon
                    )}
                    <span>{navOptions[option].label}</span>
                  </button>
                ))}
              </nav>
            )}
            {!activeSheetName && (
              <button
                className={`${styles.objectButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                onClick={() => setIsProfileModalOpen(true)}
                aria-label="Profile"
              >
                <CgProfile size={26} />
              </button>
            )}
          </>
        )}
      </div>
      {isMobile && (
        <div
          ref={menuRef}
          className={`${styles.menuDropdown} ${isMenuOpen ? styles.open : styles.closed} ${isDarkTheme ? styles.darkTheme : ''}`}
        >
          {visibleNavOptions.map((option) => (
            <button
              key={option}
              className={`${styles.navButton} ${
                activeOption === option
                  ? styles[`active${option.charAt(0).toUpperCase() + option.slice(1)}`]
                  : ''
              } ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={() => handleOptionClick(option)}
            >
              {option === 'sheets' ? (
                <span className={styles.iconWrapper}>{navOptions[option].icon}</span>
              ) : (
                navOptions[option].icon
              )}
              <span>{navOptions[option].label}</span>
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
import { CgDarkMode } from "react-icons/cg";
import { useState, useEffect, useRef, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // Added useNavigate, useLocation
import styles from "./AppHeader.module.css";
import { CgProfile } from "react-icons/cg";
import { FaBullhorn, FaChartBar, FaMoneyBillWave, FaChevronDown } from "react-icons/fa";
import { SiGoogleadsense } from "react-icons/si";
import { RiDashboard2Fill } from "react-icons/ri";
import { MainContext } from "../Contexts/MainContext";

export default function AppHeader({ setIsProfileModalOpen, activeOption, setActiveOption }) {
  const { isDarkTheme, setIsDarkTheme } = useContext(MainContext);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate(); // For navigation
  const location = useLocation(); // To get current route

  // Sync activeOption with current route
  useEffect(() => {
    const path = location.pathname;
    if (path === "/dashboard") setActiveOption("dashboard");
    else if (path === "/sheets") setActiveOption("sheets");
    else if (path === "/metrics") setActiveOption("metrics");
    else if (path === "/financials") setActiveOption("financials");
    else if (path === "/marketing") setActiveOption("marketing");
    else setActiveOption("dashboard"); // Default to dashboard
  }, [location.pathname, setActiveOption]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle navigation and option change
  const handleOptionClick = (option) => {
    setActiveOption(option);
    setIsMenuOpen(false);
    // Navigate to corresponding route
    const routes = {
      dashboard: "/dashboard",
      sheets: "/sheets",
      metrics: "/metrics",
      financials: "/financials",
      marketing: "/marketing",
    };
    navigate(routes[option]);
  };

  const toggleTheme = () => {
    setIsDarkTheme((prev) => !prev);
  };

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const isMobile = windowWidth <= 1024;

  // Map of options to their icons, labels, and routes
  const navOptions = {
    dashboard: { icon: <RiDashboard2Fill size={20} />, label: "Dashboard" },
    sheets: { icon: <SiGoogleadsense size={20} />, label: "Sheets" },
    financials: { icon: <FaMoneyBillWave size={20} />, label: "Financials" },
    marketing: { icon: <FaBullhorn size={20} />, label: "Marketing" },
    metrics: { icon: <FaChartBar size={20} />, label: "Metrics" },
  };

  // Get the active option's details
  const activeNav = navOptions[activeOption] || navOptions.dashboard;

  return (
    <header className={`${styles.headerContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.headerTop}>
        <div className={styles.logoContainer}>
          <h1 className={styles.avaTitle}>AVA</h1>
          {isMobile && (
            <>
              <button
                className={`${styles.menuButton} ${styles.navButton} ${
                  activeOption === "dashboard"
                    ? styles.activeDashboard
                    : activeOption === "sheets"
                    ? styles.activeSheets
                    : activeOption === "financials"
                    ? styles.activeFinancials
                    : activeOption === "marketing"
                    ? styles.activeMarketing
                    : styles.activeMetrics
                } ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={toggleMenu}
                aria-label={`Toggle Menu, Current: ${activeNav.label}`}
              >
                {activeOption === "sheets" ? (
                  <span className={styles.iconWrapper}>{activeNav.icon}</span>
                ) : (
                  activeNav.icon
                )}
                <span>{activeNav.label}</span>
                <span className={`${styles.chevronWrapper} ${isMenuOpen ? styles.chevronUp : ""}`}>
                  <FaChevronDown size={14} />
                </span>
              </button>
              {isMenuOpen && (
                <div ref={menuRef} className={`${styles.menuDropdown} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  {Object.keys(navOptions).map((option) => (
                    <button
                      key={option}
                      className={`${styles.navButton} ${
                        activeOption === option ? styles[`active${option.charAt(0).toUpperCase() + option.slice(1)}`] : ""
                      }`}
                      onClick={() => handleOptionClick(option)}
                    >
                      {option === "sheets" ? (
                        <span className={styles.iconWrapper}>{navOptions[option].icon}</span>
                      ) : (
                        navOptions[option].icon
                      )}
                      <span>{navOptions[option].label}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <button
            className={`${styles.themeButton} ${isDarkTheme ? styles.darkTheme : ""}`}
            onClick={toggleTheme}
            aria-label="Toggle Theme"
          >
            <CgDarkMode size={18} />
          </button>
        </div>
        {!isMobile && (
          <nav className={styles.desktopNav}>
            {Object.keys(navOptions).map((option) => (
              <button
                key={option}
                className={`${styles.navButton} ${
                  activeOption === option ? styles[`active${option.charAt(0).toUpperCase() + option.slice(1)}`] : ""
                }`}
                onClick={() => handleOptionClick(option)}
              >
                {option === "sheets" ? (
                  <span className={styles.iconWrapper}>{navOptions[option].icon}</span>
                ) : (
                  navOptions[option].icon
                )}
                <span>{navOptions[option].label}</span>
              </button>
            ))}
          </nav>
        )}
        <button
          className={styles.profileButton}
          onClick={() => setIsProfileModalOpen(true)}
          aria-label="Profile"
        >
          <CgProfile size={24} />
        </button>
      </div>
    </header>
  );
}
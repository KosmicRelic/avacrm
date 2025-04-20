import { CgDarkMode } from "react-icons/cg";
import { useState, useEffect, useRef, useContext } from "react";
import styles from "./AppHeader.module.css";
import { CgProfile } from "react-icons/cg";
import { FaBullhorn, FaChartBar, FaMoneyBillWave, FaChevronDown } from "react-icons/fa"; // Added FaChevronDown
import { SiGoogleadsense } from "react-icons/si";
import { RiDashboard2Fill } from "react-icons/ri";
import { MainContext } from "../Contexts/MainContext";

export default function AppHeader({ setIsProfileModalOpen, activeOption, setActiveOption }) {
  const { isDarkTheme, setIsDarkTheme } = useContext(MainContext);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOptionClick = (option) => {
    setActiveOption(option);
    setIsMenuOpen(false);
  };

  const toggleTheme = () => {
    setIsDarkTheme((prev) => !prev);
  };

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const isMobile = windowWidth <= 1024;

  // Map of options to their icons and labels
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
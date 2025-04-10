import { CgDarkMode } from "react-icons/cg";
import { useState, useEffect, useRef, useContext } from "react";
import styles from "./AppHeader.module.css";
import { CgProfile } from "react-icons/cg";
import { FaBullhorn, FaChartBar, FaMoneyBillWave } from "react-icons/fa"; // Replaced FaAddressCard with FaMoneyBillWave
import { SiGoogleadsense } from "react-icons/si";
import { RiDashboard2Fill } from "react-icons/ri";
import { MainContext } from "../Contexts/MainContext";

export default function AppHeader({ setIsProfileModalOpen, activeOption, setActiveOption }) {
  const { isDarkTheme, setIsDarkTheme } = useContext(MainContext);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const mobileNavRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile && mobileNavRef.current && activeOption) {
      const activeElement = mobileNavRef.current.querySelector(
        `.${styles.navButton}.${styles[`active${activeOption.charAt(0).toUpperCase() + activeOption.slice(1)}`]}`
      );
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: "smooth", inline: "center" });
      }
    }
  }, [activeOption]);

  const handleOptionClick = (option) => {
    setActiveOption(option);
  };

  const toggleTheme = () => {
    setIsDarkTheme((prev) => !prev);
  };

  const isMobile = windowWidth <= 1024;

  return (
    <header className={`${styles.headerContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.headerTop}>
        <div className={styles.logoContainer}>
          <h1 className={styles.avaTitle}>AVA</h1>
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
            <button
              className={`${styles.navButton} ${activeOption === "dashboard" ? styles.activeDashboard : ""}`}
              onClick={() => handleOptionClick("dashboard")}
            >
              <RiDashboard2Fill size={20} />
              <span>Dashboard</span>
            </button>
            <button
              className={`${styles.navButton} ${activeOption === "sheets" ? styles.activeSheets : ""}`}
              onClick={() => handleOptionClick("sheets")}
            >
              <span className={styles.iconWrapper}>
                <SiGoogleadsense size={20} />
              </span>
              <span>Sheets</span>
            </button>
            <button
              className={`${styles.navButton} ${activeOption === "financials" ? styles.activeFinancials : ""}`}
              onClick={() => handleOptionClick("financials")}
            >
              <FaMoneyBillWave size={20} />
              <span>Financials</span>
            </button>
            <button
              className={`${styles.navButton} ${activeOption === "marketing" ? styles.activeMarketing : ""}`}
              onClick={() => handleOptionClick("marketing")}
            >
              <FaBullhorn size={20} />
              <span>Marketing</span>
            </button>
            <button
              className={`${styles.navButton} ${activeOption === "metrics" ? styles.activeMetrics : ""}`}
              onClick={() => handleOptionClick("metrics")}
            >
              <FaChartBar size={20} />
              <span>Metrics</span>
            </button>
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
      {isMobile && (
        <nav ref={mobileNavRef} className={styles.mobileNav}>
          <button
            className={`${styles.navButton} ${activeOption === "dashboard" ? styles.activeDashboard : ""}`}
            onClick={() => handleOptionClick("dashboard")}
          >
            <RiDashboard2Fill size={20} />
            <span>Dashboard</span>
          </button>
          <button
            className={`${styles.navButton} ${activeOption === "sheets" ? styles.activeSheets : ""}`}
            onClick={() => handleOptionClick("sheets")}
          >
            <span className={styles.iconWrapper}>
              <SiGoogleadsense size={20} />
            </span>
            <span>Sheets</span>
          </button>
          <button
            className={`${styles.navButton} ${activeOption === "financials" ? styles.activeFinancials : ""}`}
            onClick={() => handleOptionClick("financials")}
          >
            <FaMoneyBillWave size={20} />
            <span>Financials</span>
          </button>
          <button
            className={`${styles.navButton} ${activeOption === "marketing" ? styles.activeMarketing : ""}`}
            onClick={() => handleOptionClick("marketing")}
          >
            <FaBullhorn size={20} />
            <span>Marketing</span>
          </button>
          <button
            className={`${styles.navButton} ${activeOption === "metrics" ? styles.activeMetrics : ""}`}
            onClick={() => handleOptionClick("metrics")}
          >
            <FaChartBar size={20} />
            <span>Metrics</span>
          </button>
        </nav>
      )}
    </header>
  );
}
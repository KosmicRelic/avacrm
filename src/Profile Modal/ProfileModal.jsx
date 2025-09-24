// src/ProfileModal/ProfileModal.jsx
import { useNavigate } from 'react-router-dom';
import styles from "./ProfileModal.module.css";
import { FaUser, FaFolder, FaChartBar, FaCog } from "react-icons/fa"; // Added FaCog for Settings
import { useContext, useState, useRef, useEffect } from "react";
import { MainContext } from "../Contexts/MainContext";
import PropTypes from "prop-types";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import ThemeSelector from "./ThemeSelector/ThemeSelector";

const ProfileModal = ({
  isOpen,
  onClose,
  setActiveOption,
  onOpenSheetsModal,
  onOpenMetricsModal, // Added prop
}) => {
  const { isDarkTheme, setIsDarkTheme, user } = useContext(MainContext);
  const [isAnimating, setIsAnimating] = useState(false);
  const overlayRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const handleBackgroundClick = (e) => {
    if (e.target === overlayRef.current) {
      handleClose();
    }
  };

  const handleButtonClick = (action) => {
    action();
    handleClose();
  };

  const handleSettingsClick = () => {
    handleButtonClick(() => {
      setActiveOption('settings');
      navigate('/settings');
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/signin');
      window.location.reload();
      return true;
    } catch (error) {
      console.error("Error signing out:", error.message);
      throw error;
    }
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <div
      ref={overlayRef}
      className={`${styles.objectOverlay} ${isAnimating ? styles.open : styles.closed} ${
        isDarkTheme ? styles.darkTheme : ""
      }`}
      onClick={handleBackgroundClick}
    >
      <div
        className={`${styles.objectContent} ${isAnimating ? styles.slideIn : styles.slideOut} ${
          isDarkTheme ? styles.darkTheme : ""
        }`}
      >
        <div className={`${styles.header} ${isDarkTheme ? styles.darkTheme : ""}`}>
          <h2 className={`${styles.settingsTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Profile</h2>
          <button className={`${styles.closeButton} ${isDarkTheme ? styles.darkTheme : ""}`} onClick={handleClose}>
            ✕
          </button>
        </div>
        {user?.userType === 'business' && (
          <button
            className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
            onClick={handleSettingsClick}
          >
            <FaCog size={16} style={{ marginRight: "8px" }} />
            Settings
          </button>
        )}
        <div className={styles.section}>
          {user?.userType === 'business' ? (
            <>
              <h3 className={isDarkTheme ? styles.darkTheme : ""}>Manage</h3>
              <button
                className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={handleSignOut}
              >
                <FaUser size={16} style={{ marginRight: "8px" }} />
                Sign Out
              </button>
            </>
          ) : (
            <button
              className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              onClick={handleSignOut}
            >
              <FaUser size={16} style={{ marginRight: "8px" }} />
              Sign Out
            </button>
          )}
        </div>
        <div className={styles.section}>
          <h3 className={isDarkTheme ? styles.darkTheme : ""}>Appearance</h3>
          <ThemeSelector />
        </div>
        <div className={`${styles.buildInfo} ${isDarkTheme ? styles.darkTheme : ""}`}>
          <span className={`${styles.buildNumber} ${isDarkTheme ? styles.darkTheme : ""}`}>
            Build v0.0.0 - {new Date().toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};

ProfileModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  setActiveOption: PropTypes.func.isRequired,
  onOpenSheetsModal: PropTypes.func.isRequired,
  onOpenMetricsModal: PropTypes.func.isRequired,
};

export default ProfileModal;
import React, { useState, useEffect, useRef } from "react";
import styles from "./ProfileModal.module.css";
import { FaAddressCard, FaFolder, FaChartBar } from "react-icons/fa"; // Added FaChartBar
import { useContext } from "react";
import { MainContext } from "../Contexts/MainContext";
import { CgArrowsExchangeAlt } from "react-icons/cg";
import PropTypes from "prop-types"; // Added for propTypes

const ProfileModal = ({
  isOpen,
  onClose,
  onOpenHeadersModal,
  setActiveOption,
  onOpenCardsTemplateModal,
  onOpenSheetsModal,
  onOpenMetricsModal, // Added prop
}) => {
  const { isDarkTheme } = useContext(MainContext);
  const [isAnimating, setIsAnimating] = useState(false);
  const overlayRef = useRef(null);

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

  const handleCardsClick = () => {
    handleButtonClick(onOpenCardsTemplateModal);
  };

  const handleSheetsOrderClick = () => {
    handleButtonClick(onOpenSheetsModal);
  };

  const handleMetricsClick = () => {
    handleButtonClick(onOpenMetricsModal); // Added handler
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <div
      ref={overlayRef}
      className={`${styles.profileOverlay} ${isAnimating ? styles.open : styles.closed} ${
        isDarkTheme ? styles.darkTheme : ""
      }`}
      onClick={handleBackgroundClick}
    >
      <div
        className={`${styles.profileContent} ${isAnimating ? styles.slideIn : styles.slideOut} ${
          isDarkTheme ? styles.darkTheme : ""
        }`}
      >
        <div className={styles.header}>
          <h2 className={`${styles.settingsTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>Settings</h2>
          <button className={`${styles.closeButton} ${isDarkTheme ? styles.darkTheme : ""}`} onClick={handleClose}>
            ✕
          </button>
        </div>
        <div className={styles.section}>
          <h3 className={isDarkTheme ? styles.darkTheme : ""}>Templates</h3>
          <button
            className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
            onClick={() => handleButtonClick(onOpenHeadersModal)}
          >
            Manage Headers
          </button>
          <button
            className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
            onClick={handleCardsClick}
          >
            <FaAddressCard size={16} style={{ marginRight: "8px" }} />
            Cards
          </button>
          <button
            className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
            onClick={handleMetricsClick}
          >
            <FaChartBar size={16} style={{ marginRight: "8px" }} />
            Metrics
          </button>
        </div>
      </div>
    </div>
  );
};

ProfileModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onOpenHeadersModal: PropTypes.func.isRequired,
  setActiveOption: PropTypes.func.isRequired,
  onOpenCardsTemplateModal: PropTypes.func.isRequired,
  onOpenSheetsModal: PropTypes.func.isRequired,
  onOpenMetricsModal: PropTypes.func.isRequired, // Added propType
};

export default ProfileModal;
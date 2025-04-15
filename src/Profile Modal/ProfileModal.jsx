import React, { useState, useEffect, useRef } from "react";
import styles from "./ProfileModal.module.css";
import { FaAddressCard, FaFolder } from "react-icons/fa";
import { useContext } from "react";
import { MainContext } from "../Contexts/MainContext";
import { CgArrowsExchangeAlt } from "react-icons/cg";

const ProfileModal = ({
  isOpen,
  onClose,
  onOpenHeadersModal,
  setActiveOption,
  onOpenCardsTemplateModal,
  onOpenSheetsModal,
  onOpenSheetFolderModal,
  onOpenFolderOperationsModal,
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

  const handleSheetFolderClick = () => {
    handleButtonClick(onOpenSheetFolderModal);
  };

  const handleFolderOperationsClick = () => {
    handleButtonClick(onOpenFolderOperationsModal);
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
        </div>
        <div className={styles.section}>
          <h3 className={isDarkTheme ? styles.darkTheme : ""}>Sheets</h3>
          <button
            className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
            onClick={handleSheetFolderClick}
          >
            <FaFolder size={16} style={{ marginRight: "8px" }} />
            Create Sheets & Folders
          </button>
          <button
            className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
            onClick={handleFolderOperationsClick}
          >
            <FaFolder size={16} style={{ marginRight: "8px" }} />
            Manage Folders
          </button>
          <button
            className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
            onClick={handleSheetsOrderClick}
          >
            <CgArrowsExchangeAlt size={16} style={{ marginRight: "8px" }} />
            Re-order Sheet Tabs
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
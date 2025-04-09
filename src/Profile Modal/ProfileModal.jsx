import React, { useState, useEffect, useRef } from "react";
import styles from "./ProfileModal.module.css";
import { FaAddressCard } from "react-icons/fa";
import { useContext } from "react";
import { MainContext } from "../Contexts/MainContext";

const ProfileModal = ({ isOpen, onClose, onOpenHeadersModal, setActiveOption }) => {
  const { isDarkTheme } = useContext(MainContext);
  const [isAnimating, setIsAnimating] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 400); // Match animation duration
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
    setActiveOption("cards");
    handleClose();
  };

  return (
    <div
      ref={overlayRef}
      className={`${styles.profileOverlay} ${isOpen ? styles.open : ""} ${isDarkTheme ? styles.darkTheme : ""}`}
      onClick={handleBackgroundClick}
    >
      <div
        className={`${styles.profileContent} ${isAnimating ? styles.slideIn : styles.slideOut} ${isDarkTheme ? styles.darkTheme : ""}`}
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
      </div>
    </div>
  );
};

export default ProfileModal;
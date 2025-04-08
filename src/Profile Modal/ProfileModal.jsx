import React, { useState, useEffect } from "react";
import styles from "./ProfileModal.module.css";

const ProfileModal = ({ isOpen, onClose, onOpenHeadersModal }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300); // Match animation duration
  };

  // Handle button clicks and close the modal
  const handleButtonClick = (action) => {
    action(); // Execute the button's action (e.g., open HeadersModal)
    handleClose(); // Close ProfileModal after action
  };

  return (
    <div className={`${styles.profileOverlay} ${isOpen ? styles.open : ""}`}>
      <div
        className={`${styles.profileContent} ${isAnimating ? styles.slideIn : styles.slideOut}`}
      >
        <div className={styles.header}>
          <button className={styles.settingsButton}>Settings</button>
          <button className={styles.closeButton} onClick={handleClose}>
            ✕
          </button>
        </div>
        <div className={styles.section}>
          <h3>Templates</h3>
          <button
            className={styles.actionButton}
            onClick={() => handleButtonClick(onOpenHeadersModal)}
          >
            Manage Headers
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
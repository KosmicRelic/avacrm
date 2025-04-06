import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./SettingsModal.module.css";

const SettingsModal = ({ onClose, onManageHeaders }) => {
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) handleClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClose]);

  const handleManageHeadersClick = useCallback(() => {
    onManageHeaders();
    handleClose();
  }, [onManageHeaders, handleClose]);

  return (
    <div className={`${styles.modalOverlay} ${isClosing ? styles.closing : ""}`}>
      <div className={styles.modalContent} ref={modalRef}>
        <button className={styles.closeButton} onClick={handleClose}>
          ✕
        </button>
        <div className={styles.buttonContainer}>
          <button className={styles.modalButton} onClick={handleManageHeadersClick}>
            Manage Headers
          </button>
          <button className={styles.modalButton} onClick={() => {}}>
            Invite Agents
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
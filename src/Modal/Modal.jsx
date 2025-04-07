import { useEffect, useRef, useState } from "react";
import styles from "./Modal.module.css";

const Modal = ({ children, onClose, title, showHandleBar = true }) => {
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);

  const handleClose = () => {
    if (window.innerWidth <= 767) {
      setIsClosing(true);
      setTimeout(() => onClose(), 300);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${isClosing ? styles.closing : ""}`} ref={modalRef}>
        {showHandleBar && window.innerWidth <= 767 && <div className={styles.handleBar} />}
        {title && (
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>{title}</h2>
            <button className={styles.doneButton} onClick={handleClose}>
              Done
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default Modal;
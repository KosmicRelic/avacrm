import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import styles from "./Modal.module.css";
import { useContext } from "react";
import { MainContext } from "../Contexts/MainContext";
import { FaChevronLeft } from "react-icons/fa";

const Modal = ({ children, onClose, onSave, modalType, rightButton }) => {
  const { isDarkTheme, modalConfig, goToStep, currentStep, goBack } = useContext(MainContext);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);

  const handleClose = (options = {}) => {
    if (currentStep !== 1) return;
    setIsClosing(true);
    const timeoutDuration = window.innerWidth <= 767 ? 300 : 200;
    setTimeout(() => {
      setIsClosing(false);
      onClose({ animationComplete: true, ...options });
      if (modalType !== "transport" && onSave && !options.fromSave) {
        onSave();
      }
    }, timeoutDuration);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClose]);

  return (
    <div
      className={`${styles.modalOverlay} ${isDarkTheme ? styles.darkTheme : ""} ${
        isClosing ? styles.closing : ""
      }`}
    >
      <div
        className={`${styles.modalContent} ${isClosing ? styles.closing : ""} ${
          isDarkTheme ? styles.darkTheme : ""
        }`}
        ref={modalRef}
      >
        {(modalConfig.showTitle || modalConfig.showBackButton || modalConfig.showDoneButton || rightButton) && (
          <div className={styles.modalHeader}>
            {modalConfig.showBackButton && (
              <button
                className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={goBack}
              >
                <span className={styles.chevron}><FaChevronLeft /></span> {modalConfig.backButtonTitle}
              </button>
            )}
            {modalConfig.showTitle && (
              <h2 className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                {modalConfig.title}
              </h2>
            )}
            {modalConfig.showDoneButton && !rightButton && (
              <button
                className={`${styles.doneButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={() => handleClose()} // Changed to handleClose
              >
                Done
              </button>
            )}
            {rightButton && (
              <button
                className={`${styles.doneButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={rightButton.onClick}
              >
                {rightButton.label}
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

Modal.propTypes = {
  children: PropTypes.node,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  modalType: PropTypes.string.isRequired,
  rightButton: PropTypes.shape({
    label: PropTypes.string,
    onClick: PropTypes.func,
  }),
};

Modal.defaultProps = {
  onSave: null,
  rightButton: null,
};

export default Modal;
import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import styles from "./Modal.module.css";
import { useContext } from "react";
import { MainContext } from "../Contexts/MainContext";
import { FaChevronLeft } from "react-icons/fa";

const Modal = ({ children, onClose, onSave, initialData, modalType, rightButton }) => {
  const { isDarkTheme, modalConfig, goToStep, currentStep, goBack } = useContext(MainContext);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);

  const handleClose = () => {
    if (currentStep !== 1) return;
    setIsClosing(true);
    const timeoutDuration = window.innerWidth <= 767 ? 300 : 200;
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, timeoutDuration);
  };

  const handleSaveAndClose = () => {
    if (currentStep !== 1) return;
    if (modalType !== "transport") {
      onSave();
    }
    handleClose();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        if (modalType === "transport") {
          handleClose();
        } else {
          handleSaveAndClose();
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modalType, handleSaveAndClose, handleClose]);

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
            {modalConfig.showDoneButton && !rightButton && modalType !== "transport" ? (
              <button
                className={`${styles.doneButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={handleSaveAndClose}
              >
                Done
              </button>
            ) : rightButton && (
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
  initialData: PropTypes.object,
  modalType: PropTypes.string.isRequired,
  rightButton: PropTypes.shape({
    label: PropTypes.string,
    onClick: PropTypes.func,
  }),
};

Modal.defaultProps = {};

export default Modal;
import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import styles from "./Modal.module.css";
import { useContext } from "react";
import { MainContext } from "../Contexts/MainContext";
import { ModalNavigatorContext } from "../Contexts/ModalNavigator";
import { FaChevronLeft } from "react-icons/fa";

const Modal = ({ children, onClose, onSave, modalType }) => {
  const { isDarkTheme } = useContext(MainContext);
  const { modalConfig, goBack, currentStep } = useContext(ModalNavigatorContext);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);
  const [isClickOutsideEnabled, setIsClickOutsideEnabled] = useState(false);

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

  const handleSave = () => {
    if (onSave) {
      onSave();
      handleClose({ fromSave: true });
    }
  };

  useEffect(() => {
    // Enable click-outside after a short delay to prevent immediate closure
    const timer = setTimeout(() => {
      setIsClickOutsideEnabled(true);
    }, 100);

    const handleClickOutside = (event) => {
      if (
        isClickOutsideEnabled &&
        modalRef.current &&
        !modalRef.current.contains(event.target) &&
        currentStep === 1
      ) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [currentStep, isClickOutsideEnabled, handleClose]);

  // Fallback if modalConfig is undefined
  if (!modalConfig) {
    return null;
  }

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
        {(modalConfig.showTitle ||
          modalConfig.showBackButton ||
          modalConfig.showDoneButton ||
          modalConfig.rightButton ||
          modalConfig.onSave) && (
          <div className={styles.modalHeader}>
            {modalConfig.showBackButton && (
              <button
                className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={goBack}
              >
                <span className={styles.chevron}>
                  <FaChevronLeft />
                </span>{" "}
                {modalConfig.backButtonTitle}
              </button>
            )}
            {modalConfig.showTitle && (
              <h2 className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                {modalConfig.title}
              </h2>
            )}
            <div className={styles.headerButtons}>
              {modalConfig.rightButton && (
                <button
                  className={`${styles.doneButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={modalConfig.rightButton.onClick}
                >
                  {modalConfig.rightButton.label}
                </button>
              )}
              {modalConfig.onSave && (
                <button
                  className={`${styles.doneButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={handleSave}
                >
                  Save
                </button>
              )}
              {modalConfig.showDoneButton && !modalConfig.rightButton && !modalConfig.onSave && (
                <button
                  className={`${styles.doneButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={modalType === "sheet" ? handleSave : () => handleClose()}
                >
                  Done
                </button>
              )}
            </div>
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
};

Modal.defaultProps = {
  onSave: null,
};

export default Modal;
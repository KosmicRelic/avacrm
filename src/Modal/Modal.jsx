import React, { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import styles from "./Modal.module.css";
import { useContext } from "react";
import { ModalNavigatorContext } from "../Contexts/ModalNavigator";
import { FaChevronLeft } from "react-icons/fa";
import { MainContext } from "../Contexts/MainContext";

const Modal = ({ children, onClose, onSave, onLeftButtonClick }) => {
  const { isDarkTheme } = useContext(MainContext);
  const { modalConfig, goBack, currentStep } = useContext(ModalNavigatorContext);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);
  const [isClickOutsideEnabled, setIsClickOutsideEnabled] = useState(false);

  useEffect(() => {
    // Disable body scrolling when modal is open
    document.body.style.overflow = 'hidden';

    // Re-enable body scrolling when modal unmounts
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleClose = useCallback((options = {}) => {
    if (currentStep !== 1) {
      return;
    }
    setIsClosing(true);
    const timeoutDuration = window.innerWidth <= 767 ? 300 : 200;
    setTimeout(() => {
      setIsClosing(false);
      onClose({ animationComplete: true, ...options });
      if (onSave && !options.fromSave && !options.fromDelete) {
        onSave();
      }
    }, timeoutDuration);
  }, [currentStep, onClose, onSave]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClickOutsideEnabled(true);
    }, 100);

    const handleClickOutside = (event) => {
      if (
        isClickOutsideEnabled &&
        modalRef.current &&
        !modalRef.current.contains(event.target) &&
        currentStep === 1 &&
        modalConfig.allowClose !== false
      ) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [currentStep, isClickOutsideEnabled, handleClose, modalConfig.allowClose]);

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
        onMouseDown={e => e.stopPropagation()} // Prevent modal from closing on inside click
      >
        {(modalConfig.showTitle ||
          modalConfig.showBackButton ||
          modalConfig.showDoneButton ||
          modalConfig.rightButton ||
          modalConfig.leftButton ||
          onLeftButtonClick) && (
          <div className={styles.modalHeader}>
            {modalConfig.leftButton ? (
              <button
                className={`${styles.leftButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={modalConfig.leftButton.onClick}
              >
                {modalConfig.leftButton.label}
              </button>
            ) : (
              onLeftButtonClick && (
                <button
                  className={`${styles.leftButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={onLeftButtonClick}
                >
                  Create
                </button>
              )
            )}
            {modalConfig.showBackButton && (
              <button
                className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={() => {
                  if (currentStep === 1) {
                    handleClose();
                  } else {
                    goBack(); // Use goBack to navigate to the previous step in history
                  }
                }}
              >
                <span className={styles.chevron}>
                  <FaChevronLeft />
                </span>{" "}
                {modalConfig.backButtonTitle}
              </button>
            )}
            {modalConfig.showTitle && (
              <h2 className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                {typeof modalConfig.title === "function" ? modalConfig.title() : modalConfig.title}
              </h2>
            )}
            <div className={styles.headerButtons}>
              {modalConfig.rightButton ? (
                <button
                  className={`${styles.doneButton} ${isDarkTheme ? styles.darkTheme : ""} ${
                    modalConfig.rightButton.color === "red" || modalConfig.rightButton.isRemove
                      ? modalConfig.rightButton.isActive
                        ? styles.activeRemove
                        : styles.inactiveRemove
                      : modalConfig.rightButton.color === "blue" || !modalConfig.rightButton.color
                      ? modalConfig.rightButton.isActive
                        ? styles.activeAction
                        : styles.inactiveAction
                      : ""
                  }`}
                  onClick={modalConfig.rightButton.onClick}
                  disabled={!modalConfig.rightButton.isActive}
                >
                  {modalConfig.rightButton.label}
                </button>
              ) : (
                modalConfig.showDoneButton && (
                  <button
                    className={`${styles.doneButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    onClick={() => handleClose()}
                  >
                    Done
                  </button>
                )
              )}
            </div>
          </div>
        )}
        {React.Children.map(children, (child) =>
          React.cloneElement(child, { handleClose })
        )}
      </div>
    </div>
  );
};

Modal.propTypes = {
  children: PropTypes.node,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  onLeftButtonClick: PropTypes.func,
};

Modal.defaultProps = {
  onSave: null,
  onLeftButtonClick: null,
};

export default Modal;
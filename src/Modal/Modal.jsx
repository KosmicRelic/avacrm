import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import styles from "./Modal.module.css";
import { useContext } from "react";
import { MainContext } from "../Contexts/MainContext";
import { ModalNavigatorContext } from "../Contexts/ModalNavigator";
import { FaChevronLeft } from "react-icons/fa";

const Modal = ({ children, onClose, onSave, modalType, tempData }) => {
  const { isDarkTheme, sheets, setSheets } = useContext(MainContext);
  const { modalConfig, goBack, currentStep } = useContext(ModalNavigatorContext);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);
  const [isClickOutsideEnabled, setIsClickOutsideEnabled] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState("");

  const handleClose = (options = {}) => {
    if (currentStep !== 1) return;
    setIsClosing(true);
    const timeoutDuration = window.innerWidth <= 767 ? 300 : 200;
    setTimeout(() => {
      setIsClosing(false);
      onClose({ animationComplete: true, ...options });
      if (modalType !== "transport" && onSave && !options.fromSave && !options.fromDelete) {
        onSave();
      }
    }, timeoutDuration);
  };

  const handleTransportSave = () => {
    if (!selectedSheet) {
      alert("Please select a sheet.");
      return;
    }
    console.log("handleTransportSave with selectedSheet:", selectedSheet);
    setSheets((prevSheets) => {
      const newSheets = { ...prevSheets, allSheets: [...prevSheets.allSheets] };
      const sourceSheetIndex = newSheets.allSheets.findIndex((s) => s.isActive);
      const targetSheetIndex = newSheets.allSheets.findIndex((s) => s.sheetName === selectedSheet);

      if (sourceSheetIndex === -1 || targetSheetIndex === -1) {
        console.warn("Invalid sheet indices:", { sourceSheetIndex, targetSheetIndex });
        return prevSheets;
      }

      const sourceSheet = newSheets.allSheets[sourceSheetIndex];
      const targetSheet = newSheets.allSheets[targetSheetIndex];
      const { action, selectedRowIds } = tempData;

      const newTargetRows = [
        ...targetSheet.rows,
        ...selectedRowIds.filter((id) => !targetSheet.rows.includes(id)),
      ];
      newSheets.allSheets[targetSheetIndex] = { ...targetSheet, rows: newTargetRows };

      if (action === "move") {
        newSheets.allSheets[sourceSheetIndex] = {
          ...sourceSheet,
          rows: sourceSheet.rows.filter((id) => !selectedRowIds.includes(id)),
        };
      }

      console.log("Updated sheets:", newSheets);
      return newSheets;
    });

    if (tempData.onComplete) {
      console.log("Calling onComplete");
      tempData.onComplete();
    }
    if (onSave) {
      console.log("Calling onSave");
      onSave();
    }
  };

  useEffect(() => {
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

  if (modalType === "transport" && tempData) {
    console.log("Rendering transport modal with tempData:", tempData);
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
          <div className={styles.modalHeader}>
            <h2 className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
              {tempData.action === "move" ? "Move to Sheet" : "Copy to Sheet"}
            </h2>
            <div className={styles.headerButtons}>
              <button
                className={`${styles.doneButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={handleTransportSave}
              >
                Done
              </button>
            </div>
          </div>
          <div className={styles.sheetList}>
            {sheets.allSheets.map((sheet) => (
              <button
                key={sheet.sheetName}
                className={`${styles.sheetButton} ${isDarkTheme ? styles.darkTheme : ""} ${
                  selectedSheet === sheet.sheetName ? styles.selected : ""
                }`}
                onClick={() => {
                  console.log("Selected sheet:", sheet.sheetName);
                  setSelectedSheet(sheet.sheetName);
                }}
                disabled={sheet.isActive}
              >
                {sheet.sheetName}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!modalConfig) {
    return null;
  }

  console.log("Modal rendering with config:", modalConfig);

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
          modalConfig.rightButtons?.length > 0) && (
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
              {modalConfig.rightButtons?.length > 0 ? (
                modalConfig.rightButtons.map((button, index) => (
                  <button
                    key={index}
                    className={`${styles.doneButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    onClick={() => {
                      console.log("Right button clicked:", button.label);
                      button.onClick();
                    }}
                  >
                    {button.label}
                  </button>
                ))
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
  tempData: PropTypes.object,
};

Modal.defaultProps = {
  onSave: null,
  tempData: null,
};

export default Modal;
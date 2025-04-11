import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import styles from "./Modal.module.css";
import { useContext } from "react";
import { MainContext } from "../Contexts/MainContext";
import { FaChevronLeft } from "react-icons/fa";

const Modal = ({ children, onClose, showHandleBar = true, onSave, initialData, modalType, rightButton }) => {
  const { setSheets, setHeaders, isDarkTheme, modalConfig, goBack, showBackButton } = useContext(MainContext);
  const [isClosing, setIsClosing] = useState(false);
  const [tempData, setTempData] = useState(initialData || {});
  const modalRef = useRef(null);

  const handleClose = () => {
    setIsClosing(true);
    const timeoutDuration = window.innerWidth <= 767 ? 300 : 200;
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, timeoutDuration);
  };

  const handleSaveAndClose = () => {
    switch (modalType) {
      case "sheet":
        setSheets((prevSheets) => {
          const updatedSheets = prevSheets.allSheets.map((sheet) => {
            if (sheet.sheetName === initialData.sheetName) {
              return {
                ...sheet,
                sheetName: tempData.sheetName,
                headers: tempData.currentHeaders,
                rows: tempData.rows || sheet.rows,
                pinnedHeaders: sheet.pinnedHeaders,
                isActive: sheet.isActive,
              };
            }
            return sheet;
          });

          if (!updatedSheets.some((sheet) => sheet.sheetName === tempData.sheetName)) {
            updatedSheets.push({
              sheetName: tempData.sheetName,
              headers: tempData.currentHeaders,
              rows: tempData.rows || [],
              pinnedHeaders: [],
              isActive: true,
            });
            return {
              ...prevSheets,
              allSheets: updatedSheets.map((sheet) => ({
                ...sheet,
                isActive: sheet.sheetName === tempData.sheetName,
              })),
              structure: prevSheets.structure
                .map((item) =>
                  item.sheetName === initialData.sheetName ? { sheetName: tempData.sheetName } : item
                )
                .concat(
                  !prevSheets.structure.some((item) => item.sheetName === tempData.sheetName)
                    ? [{ sheetName: tempData.sheetName }]
                    : []
                ),
            };
          }

          return {
            ...prevSheets,
            allSheets: updatedSheets,
            structure: prevSheets.structure.map((item) =>
              item.sheetName === initialData.sheetName ? { sheetName: tempData.sheetName } : item
            ),
          };
        });
        break;
      case "filter":
        onSave(tempData.filterValues);
        break;
      case "headers":
        setHeaders(tempData.currentHeaders);
        break;
      case "sheets":
        setSheets((prevSheets) => ({
          ...prevSheets,
          structure: tempData.newOrder,
        }));
        break;
      case "transport":
        break;
      case "cardsTemplate":
        break;
      default:
        break;
    }
    handleClose();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        if (modalType !== "transport") {
          handleSaveAndClose();
        } else {
          handleClose();
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tempData, handleSaveAndClose, modalType]);

  const enhancedChildren = React.Children.map(children, (child) =>
    React.cloneElement(child, {
      tempData,
      setTempData,
      onSave: modalType === "transport" ? handleClose : handleSaveAndClose,
    })
  );

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
        {showHandleBar && window.innerWidth <= 767 && (
          <div className={`${styles.handleBar} ${isDarkTheme ? styles.darkTheme : ""}`} />
        )}
        {(modalConfig.showTitle || showBackButton || modalConfig.showDoneButton || rightButton) && (
          <div className={styles.modalHeader}>
            {showBackButton && (
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
            {modalConfig.showDoneButton && modalType !== "transport" && !rightButton ? (
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
        {enhancedChildren}
      </div>
    </div>
  );
};

Modal.propTypes = {
  children: PropTypes.node,
  onClose: PropTypes.func.isRequired,
  showHandleBar: PropTypes.bool,
  onSave: PropTypes.func,
  initialData: PropTypes.object,
  modalType: PropTypes.string.isRequired,
  rightButton: PropTypes.shape({
    label: PropTypes.string,
    onClick: PropTypes.func,
  }),
};

Modal.defaultProps = {
  showHandleBar: true,
};

export default Modal;
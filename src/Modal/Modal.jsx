import React, { useEffect, useRef, useState } from "react";
import styles from "./Modal.module.css";
import { useContext } from "react";
import { MainContext } from "../Contexts/MainContext";

const Modal = ({ children, onClose, title, showHandleBar = true, onSave, initialData, modalType }) => {
  const { setSheets, setHeaders, isDarkTheme } = useContext(MainContext);
  const [isClosing, setIsClosing] = useState(false);
  const [tempData, setTempData] = useState(initialData || {});
  const modalRef = useRef(null);

  const handleClose = () => {
    if (window.innerWidth <= 767) {
      setIsClosing(true);
      setTimeout(() => onClose(), 300);
    } else {
      onClose();
    }
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
        // No explicit save action here; handled by CardsTransportationModal
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
          handleSaveAndClose(); // Transport modal closes on sheet selection, not outside click
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
      onSave: modalType === "transport" ? handleClose : handleSaveAndClose, // Transport modal uses handleClose directly
    })
  );

  return (
    <div className={`${styles.modalOverlay} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div
        className={`${styles.modalContent} ${isClosing ? styles.closing : ""} ${
          isDarkTheme ? styles.darkTheme : ""
        }`}
        ref={modalRef}
      >
        {showHandleBar && window.innerWidth <= 767 && (
          <div className={`${styles.handleBar} ${isDarkTheme ? styles.darkTheme : ""}`} />
        )}
        {title && (
          <div className={styles.modalHeader}>
            <h2 className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
              {title}
            </h2>
            {modalType !== "transport" && ( // Hide "Done" button for transport modal
              <button
                className={`${styles.doneButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={handleSaveAndClose}
              >
                Done
              </button>
            )}
          </div>
        )}
        {enhancedChildren}
      </div>
    </div>
  );
};

export default Modal;
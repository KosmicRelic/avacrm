import React, { useEffect, useRef, useState } from "react";
import styles from "./Modal.module.css";
import { useContext } from "react";
import { MainContext } from "../Contexts/MainContext";

const Modal = ({ children, onClose, title, showHandleBar = true, onSave, initialData, modalType }) => {
  const { setSheets, setHeaders } = useContext(MainContext);
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
              // Merge existing sheet data with updated tempData
              return {
                ...sheet,
                sheetName: tempData.sheetName,
                headers: tempData.currentHeaders,
                rows: tempData.rows || sheet.rows, // Preserve rows if not in tempData
                pinnedHeaders: sheet.pinnedHeaders, // Preserve pinnedHeaders
                isActive: sheet.isActive,
              };
            }
            return sheet;
          });

          // If it's a new sheet, add it with defaults
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
              structure: prevSheets.structure.map((item) =>
                item.sheetName === initialData.sheetName ? { sheetName: tempData.sheetName } : item
              ).concat(
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
          structure: tempData.newOrder.map((name) =>
            prevSheets.structure.find((item) => item.sheetName === name || item.folderName === name) || { sheetName: name }
          ),
        }));
        break;
      default:
        break;
    }
    handleClose();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleSaveAndClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tempData, handleSaveAndClose]);

  const enhancedChildren = React.Children.map(children, (child) =>
    React.cloneElement(child, {
      tempData,
      setTempData,
      onSave: handleSaveAndClose,
    })
  );

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${isClosing ? styles.closing : ""}`} ref={modalRef}>
        {showHandleBar && window.innerWidth <= 767 && <div className={styles.handleBar} />}
        {title && (
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>{title}</h2>
            <button className={styles.doneButton} onClick={handleSaveAndClose}>
              Done
            </button>
          </div>
        )}
        {enhancedChildren}
      </div>
    </div>
  );
};

export default Modal;
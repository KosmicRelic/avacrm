import React, { useState, useContext, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import styles from "./FolderModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { IoIosCheckmark } from "react-icons/io";

const FolderModal = ({ folderName, onSheetSelect, handleClose, tempData, setTempData }) => {
  const { sheets, isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, setModalConfig } = useContext(ModalNavigatorContext);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState(tempData?.selectedSheets || []);
  const [displayedSheets, setDisplayedSheets] = useState([]);
  const hasInitialized = useRef(false);

  const folder = sheets.structure.find((item) => item.folderName === folderName);
  const folderSheets = folder ? folder.sheets : [];

  // Move useCallback hooks before useEffect
  const handleRemoveSheets = useCallback(() => {
    if (selectedSheets.length === 0) {
      setIsEditMode(false);
      setSelectedSheets([]);
      setTempData({});
      return;
    }

    const confirmMessage = `Are you sure you want to remove the following sheet${selectedSheets.length > 1 ? "s" : ""}: ${selectedSheets.join(", ")}?`;
    if (window.confirm(confirmMessage)) {
      const newTempData = {
        selectedSheets,
        action: "removeSheets",
        folderName,
      };
      setTempData(newTempData);
      // Update displayedSheets to exclude removed sheets
      setDisplayedSheets((prev) => prev.filter((sheet) => !selectedSheets.includes(sheet)));
      setIsEditMode(false);
      setSelectedSheets([]);
    }
  }, [selectedSheets, folderName, setTempData]);

  const toggleSheetSelection = useCallback(
    (sheetName) => {
      setSelectedSheets((prev) => {
        const newSelected = prev.includes(sheetName)
          ? prev.filter((name) => name !== sheetName)
          : [...prev, sheetName];
        const newTempData = { ...tempData, selectedSheets: newSelected };
        setTempData(newTempData);
        return newSelected;
      });
    },
    [setTempData, tempData]
  );

  const handleDeleteFolder = useCallback(() => {
    if (window.confirm(`Are you sure you want to delete the folder "${folderName}"?`)) {
      const newTempData = {
        folderName,
        action: "deleteFolder",
      };
      handleClose({ fromDelete: true, tempData: newTempData });
    }
  }, [folderName, handleClose]);

  const handleSheetClick = useCallback(
    (sheetName) => {
      if (isEditMode) {
        toggleSheetSelection(sheetName);
      } else {
        onSheetSelect(sheetName);
        handleClose();
      }
    },
    [isEditMode, onSheetSelect, handleClose, toggleSheetSelection]
  );

  // Initialize displayedSheets with all folder sheets
  useEffect(() => {
    setDisplayedSheets(folderSheets);
  }, [folderSheets]);

  useEffect(() => {
    if (!hasInitialized.current) {
      const editButton = {
        label: "Edit",
        onClick: () => {
          setIsEditMode(true);
        },
      };

      registerModalSteps({
        steps: [
          {
            title: folderName,
            rightButton: null,
            leftButton: editButton,
          },
        ],
      });

      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: folderName,
        rightButton: null,
        leftButton: editButton,
        allowClose: true,
      });

      hasInitialized.current = true;
    }
  }, [folderName, registerModalSteps, setModalConfig]);

  useEffect(() => {
    if (isEditMode) {
      setModalConfig((prev) => ({
        ...prev,
        showDoneButton: false,
        allowClose: false, // Prevent click-outside closing
        leftButton: {
          label: "Cancel",
          onClick: () => {
            setIsEditMode(false);
            setSelectedSheets([]);
            setTempData({});
            // Reset displayedSheets to original folderSheets
            setDisplayedSheets(folderSheets);
          },
        },
        rightButton: {
          label: "Remove",
          onClick: handleRemoveSheets,
          isActive: selectedSheets.length > 0,
          isRemove: true,
          color: "red",
        },
      }));
    } else {
      setModalConfig((prev) => ({
        ...prev,
        showDoneButton: true,
        allowClose: true, // Allow closing when not in edit mode
        rightButton: null,
        leftButton: {
          label: "Edit",
          onClick: () => {
            setIsEditMode(true);
          },
        },
      }));
    }
  }, [isEditMode, selectedSheets, setModalConfig, handleRemoveSheets, folderSheets]);

  return (
    <div className={`${styles.folderModal} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.sheetList}>
        {displayedSheets.length === 0 ? (
          <div className={`${styles.noSheets} ${isDarkTheme ? styles.darkTheme : ""}`}>
            No sheets in this folder
          </div>
        ) : (
          displayedSheets.map((sheetName, index) => (
            <div
              key={`${sheetName}-${index}`}
              className={`${styles.sheetItem} ${isDarkTheme ? styles.darkTheme : ""}`}
              onClick={() => handleSheetClick(sheetName)}
            >
              <div className={styles.sheetRow}>
                {isEditMode && (
                  <span
                    className={`${styles.selectionCircle} ${
                      selectedSheets.includes(sheetName) ? styles.selected : ""
                    } ${isDarkTheme ? styles.darkTheme : ""}`}
                  >
                    <IoIosCheckmark
                      className={styles.checkmark}
                      style={{
                        opacity: selectedSheets.includes(sheetName) ? 1 : 0,
                      }}
                    />
                  </span>
                )}
                <span className={`${styles.sheetName} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  {sheetName}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
        {isEditMode && <button
          onClick={handleDeleteFolder}
          className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
        >
          Delete Folder
        </button>}
    </div>
  );
};

FolderModal.propTypes = {
  folderName: PropTypes.string.isRequired,
  onSheetSelect: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
  tempData: PropTypes.object,
  setTempData: PropTypes.func.isRequired,
};

FolderModal.defaultProps = {
  tempData: {},
};

export default FolderModal;
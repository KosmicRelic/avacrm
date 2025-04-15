import React, { useState, useContext, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import styles from "./FolderModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { IoIosCheckmark } from "react-icons/io";

const FolderModal = ({ folderName, onSheetSelect, handleClose }) => {
  const { sheets, setSheets, isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, setModalConfig, currentStep } = useContext(ModalNavigatorContext);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const hasInitialized = useRef(false);

  // Find the folder's sheets from the structure
  const folder = sheets.structure.find((item) => item.folderName === folderName);
  const folderSheets = folder ? folder.sheets : [];

  // Initialize modal configuration
  useEffect(() => {
    if (!hasInitialized.current) {
      const editButton = {
        label: "Edit",
        onClick: () => setIsEditMode(true),
      };

      registerModalSteps({
        steps: [
          {
            title: folderName,
            rightButton: null, // Default Done button
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
      });

      hasInitialized.current = true;
    }
  }, [folderName, registerModalSteps, setModalConfig]);

  // Update modal config when edit mode changes
  useEffect(() => {
    if (isEditMode) {
      setModalConfig((prev) => ({
        ...prev,
        showDoneButton: false,
        leftButton: {
          label: "Cancel",
          onClick: () => {
            setIsEditMode(false);
            setSelectedSheets([]);
          },
        },
        rightButton: {
          label: "Remove",
          onClick: handleRemoveSheets,
          isActive: selectedSheets.length > 0, // Pass active state
        },
      }));
    } else {
      setModalConfig((prev) => ({
        ...prev,
        showDoneButton: true,
        rightButton: null,
        leftButton: {
          label: "Edit",
          onClick: () => setIsEditMode(true),
        },
      }));
    }
  }, [isEditMode, selectedSheets, setModalConfig]);

  // Handle sheet selection for removal
  const toggleSheetSelection = useCallback(
    (sheetName) => {
      setSelectedSheets((prev) =>
        prev.includes(sheetName)
          ? prev.filter((name) => name !== sheetName)
          : [...prev, sheetName]
      );
    },
    []
  );

  // Handle sheet removal with confirmation
  const handleRemoveSheets = useCallback(() => {
    if (selectedSheets.length === 0) {
      setIsEditMode(false);
      setSelectedSheets([]);
      return;
    }

    const confirmMessage = `Are you sure you want to remove the following sheet${selectedSheets.length > 1 ? "s" : ""}: ${selectedSheets.join(", ")}?`;
    if (window.confirm(confirmMessage)) {
      setSheets((prev) => {
        // Remove sheets from folder and add to root
        const folderSheets = folder?.sheets || [];
        const remainingSheets = folderSheets.filter((sheet) => !selectedSheets.includes(sheet));
        const removedSheets = folderSheets.filter((sheet) => selectedSheets.includes(sheet));

        return {
          ...prev,
          structure: [
            ...prev.structure.filter((item) => item.folderName !== folderName),
            { folderName, sheets: remainingSheets },
            ...removedSheets.map((sheetName) => ({ sheetName })),
          ].filter((item) => !item.folderName || item.sheets.length > 0), // Remove empty folders
        };
      });
      setIsEditMode(false);
      setSelectedSheets([]);
    }
  }, [selectedSheets, folderName, folder, setSheets]);

  // Handle folder deletion and transfer sheets to root
  const handleDeleteFolder = useCallback(() => {
    if (window.confirm(`Are you sure you want to delete the folder "${folderName}"?`)) {
      setSheets((prev) => {
        // Filter out the folder and add its sheets to the root
        const folderSheets = folder?.sheets || [];
        const newStructure = [
          ...prev.structure.filter((item) => item.folderName !== folderName),
          ...folderSheets.map((sheetName) => ({ sheetName })),
        ];

        return {
          ...prev,
          structure: newStructure,
        };
      });
      handleClose();
    }
  }, [folderName, folder, setSheets, handleClose]);

  // Handle sheet click
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

  return (
    <div className={`${styles.folderModal} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.sheetList}>
        {folderSheets.length === 0 ? (
          <div className={`${styles.noSheets} ${isDarkTheme ? styles.darkTheme : ""}`}>
            No sheets in this folder
          </div>
        ) : (
          folderSheets.map((sheetName, index) => (
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
                <span className={`${styles.sheetName} ${isDarkTheme?styles.darkTheme:""}`}>{sheetName}</span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className={`${styles.deleteFolder} ${isDarkTheme ? styles.darkTheme : ""}`}>
        <button
          onClick={handleDeleteFolder}
          className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
        >
          Delete Folder
        </button>
      </div>
    </div>
  );
};

FolderModal.propTypes = {
  folderName: PropTypes.string.isRequired,
  onSheetSelect: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default FolderModal;
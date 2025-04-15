import React, { useState, useContext, useCallback, useEffect, useRef, useMemo } from "react";
import PropTypes from "prop-types";
import styles from "./FolderOperations.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { IoIosCheckmark } from "react-icons/io";

const FolderOperations = ({ tempData, setTempData, handleClose }) => {
  const { isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, goToStep, currentStep, setModalConfig } = useContext(ModalNavigatorContext);

  // Initialize tempStructure with fallback
  const initialStructure = tempData?.sheets?.structure ? JSON.parse(JSON.stringify(tempData.sheets.structure)) : [];
  const [tempStructure, setTempStructure] = useState(initialStructure);
  const hasInitialized = useRef(false);
  const selectedSheetsRef = useRef([]);
  const [selectedFolderIndex, setSelectedFolderIndex] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState([]);

  // Sync ref with state
  useEffect(() => {
    selectedSheetsRef.current = selectedSheets;
  }, [selectedSheets]);

  // Reset selectedFolderIndex and selectedSheets when returning to step 1
  useEffect(() => {
    if (currentStep === 1) {
      setSelectedFolderIndex(null);
      setSelectedSheets([]);
    }
  }, [currentStep]);

  // Initialize modal steps
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const steps = [
      {
        title: "Organize Sheets",
        rightButton: null,
      },
      {
        title: "Select Sheets",
        rightButton: null,
      },
    ];

    registerModalSteps({ steps });
    setModalConfig({
      showTitle: true,
      showDoneButton: true,
      showBackButton: false,
      title: "Organize Sheets",
      backButtonTitle: "",
      rightButton: null,
      onDone: handleClose,
    });
  }, [registerModalSteps, setModalConfig, handleClose]);

  // Memoized handleConfirm
  const handleConfirm = useCallback(() => {
    const currentSheets = selectedSheetsRef.current;
    if (currentSheets.length === 0 || selectedFolderIndex === null) {
      return;
    }

    setTempStructure((prev) => {
      const newStructure = JSON.parse(JSON.stringify(prev));
      const folder = newStructure[selectedFolderIndex];
      if (!folder?.folderName) return prev;

      folder.sheets = [...new Set([...folder.sheets, ...currentSheets])];
      newStructure.forEach((item, index) => {
        if (currentSheets.includes(item.sheetName)) {
          newStructure[index] = null;
        }
      });

      const updatedStructure = newStructure.filter((item) => item !== null);
      return updatedStructure;
    });

    setSelectedSheets([]);
    goToStep(1);
  }, [selectedFolderIndex, goToStep]);

  // Update modal config
  useEffect(() => {
    setModalConfig((prev) => {
      const newTitle = currentStep === 1 ? "Organize Sheets" : "Select Sheets";
      const newRightButton =
        currentStep === 2 && selectedSheets.length > 0
          ? { label: "Confirm", onClick: handleConfirm }
          : null;

      if (
        prev.title === newTitle &&
        prev.showDoneButton === (currentStep === 1) &&
        prev.showBackButton === (currentStep > 1) &&
        JSON.stringify(prev.rightButton) === JSON.stringify(newRightButton)
      ) {
        return prev;
      }

      return {
        ...prev,
        title: newTitle,
        rightButton: newRightButton,
        showDoneButton: currentStep === 1,
        showBackButton: currentStep > 1,
        onDone: handleClose,
      };
    });
  }, [currentStep, selectedSheets, handleConfirm, handleClose]);

  const handleSelectFolder = useCallback((index) => {
    setSelectedFolderIndex(index);
    setSelectedSheets([]);
    goToStep(2); // Navigate directly to step 2
  }, [goToStep]);

  const toggleSheetSelection = useCallback((sheetName) => {
    setSelectedSheets((prev) => {
      return prev.includes(sheetName)
        ? prev.filter((s) => s !== sheetName)
        : [...prev, sheetName];
    });
  }, []);

  const availableSheets = useMemo(() => {
    return (tempStructure || [])
      .filter((item) => item.sheetName && !item.folderName)
      .map((item) => item.sheetName);
  }, [tempStructure]);

  return (
    <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.viewContainer}>
        {[1, 2].map((step) => (
          <div
            key={step}
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ""} ${
              step !== currentStep ? styles.hidden : ""
            }`}
            style={{ display: step !== currentStep ? "none" : "block" }}
          >
            {step === 1 && (
              <div className={styles.list}>
                {tempStructure
                  ?.map((item, index) => ({ item, index }))
                  .filter(({ item }) => item.folderName)
                  .map(({ item, index }) => (
                    <div
                      key={index}
                      className={`${styles.listItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => handleSelectFolder(index)}
                    >
                      <span className={styles.listItemText}>{item.folderName}</span>
                    </div>
                  ))}
              </div>
            )}

            {step === 2 && (
              <div className={styles.list}>
                {availableSheets.length > 0 ? (
                  availableSheets.map((sheetName, index) => (
                    <div
                      key={index}
                      className={`${styles.listItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => toggleSheetSelection(sheetName)}
                    >
                      <span
                        className={`${styles.customCheckbox} ${
                          selectedSheets.includes(sheetName) ? styles.checked : ""
                        } ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        <IoIosCheckmark
                          style={{
                            color: selectedSheets.includes(sheetName) ? "#ffffff" : "transparent",
                          }}
                          size={18}
                        />
                      </span>
                      <span className={styles.listItemText}>{sheetName}</span>
                    </div>
                  ))
                ) : (
                  <div className={`${styles.emptyText} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    No sheets available
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

FolderOperations.propTypes = {
  tempData: PropTypes.shape({
    sheets: PropTypes.shape({
      allSheets: PropTypes.arrayOf(
        PropTypes.shape({
          sheetName: PropTypes.string.isRequired,
        })
      ),
      structure: PropTypes.arrayOf(
        PropTypes.oneOfType([
          PropTypes.shape({ sheetName: PropTypes.string }),
          PropTypes.shape({
            folderName: PropTypes.string,
            sheets: PropTypes.arrayOf(PropTypes.string),
          }),
        ])
      ),
    }),
  }),
  setTempData: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
};

FolderOperations.defaultProps = {
  tempData: { sheets: { structure: [] } },
};

export default FolderOperations;
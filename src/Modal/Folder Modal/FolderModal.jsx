import React, { useState, useContext, useEffect, useRef, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import styles from "./FolderModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { FaRegCircle, FaRegCheckCircle } from "react-icons/fa";

const FolderModal = ({ folderName, onSheetSelect, tempData, setTempData, handleClose }) => {
  const { sheets, isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, setModalConfig, goToStep, goBack, currentStep } = useContext(ModalNavigatorContext);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState(tempData?.selectedSheets || []);
  const [displayedSheets, setDisplayedSheets] = useState([]);
  const [navigationDirection, setNavigationDirection] = useState(null);
  const prevStepRef = useRef(currentStep);
  const hasInitialized = useRef(false);

  const folder = sheets.structure.find((item) => item.folderName === folderName);
  const folderSheets = folder ? folder.sheets : [];

  // Compute set of all nested sheets across all folders
  const nestedSheetsSet = useMemo(() => {
    return new Set(
      sheets.structure
        .filter((item) => item.folderName)
        .flatMap((folder) => folder.sheets || [])
    );
  }, [sheets.structure]);

  // Calculate available sheets (standalone sheets only)
  const availableSheets = useMemo(() => {
    return sheets.allSheets
      .filter(
        (sheet) =>
          !nestedSheetsSet.has(sheet.sheetName) && // Exclude sheets nested in any folder
          sheet.sheetName !== "All Cards"           // Exclude special "All Cards" sheet
      )
      .map((sheet) => sheet.sheetName);
  }, [sheets.allSheets, nestedSheetsSet]);

  const handleRemoveSheets = useCallback(() => {
    if (selectedSheets.length === 0) {
      setIsEditMode(false);
      setSelectedSheets([]);
      setTempData({ actions: tempData?.actions || [] });
      return;
    }

    const newAction = {
      action: "removeSheets",
      selectedSheets,
      folderName,
    };
    setTempData({
      actions: [...(tempData?.actions || []), newAction],
    });
    setDisplayedSheets((prev) => prev.filter((sheet) => !selectedSheets.includes(sheet)));
    setSelectedSheets([]);
    setIsEditMode(false);
  }, [selectedSheets, folderName, setTempData, tempData]);

  const handleAddSheets = useCallback(() => {
    if (selectedSheets.length === 0) {
      setSelectedSheets([]);
      setTempData({ actions: tempData?.actions || [] });
      goBack();
      return;
    }

    const newAction = {
      action: "addSheets",
      selectedSheets,
      folderName,
    };
    setTempData({
      actions: [...(tempData?.actions || []), newAction],
    });
    setDisplayedSheets((prev) => [...new Set([...prev, ...selectedSheets])]);
    setSelectedSheets([]);
    setNavigationDirection("backward");
    goBack();
  }, [selectedSheets, folderName, setTempData, goBack, tempData]);

  const handleDeleteFolder = useCallback(() => {
    if (window.confirm(`Are you sure you want to delete the folder "${folderName}"? This will move all its sheets to the top level.`)) {
      const newAction = {
        action: "deleteFolder",
        folderName,
      };
      setTempData({
        actions: [...(tempData?.actions || []), newAction],
      });
      handleClose({ fromSave: true, tempData: { actions: [...(tempData?.actions || []), newAction] } });
    }
  }, [folderName, setTempData, tempData, handleClose]);

  const toggleSheetSelection = useCallback((sheetName) => {
    setSelectedSheets((prev) =>
      prev.includes(sheetName)
        ? prev.filter((name) => name !== sheetName)
        : [...prev, sheetName]
    );
  }, []);

  const handleSheetClick = useCallback(
    (sheetName) => {
      if (isEditMode || currentStep === 2) {
        toggleSheetSelection(sheetName);
      } else {
        onSheetSelect(sheetName);
        handleClose({ fromSave: false });
      }
    },
    [isEditMode, currentStep, onSheetSelect, toggleSheetSelection, handleClose]
  );

  // Initialize displayedSheets
  useEffect(() => {
    setDisplayedSheets(folderSheets);
  }, [folderSheets]);

  // Initialize modal steps (run once)
  useEffect(() => {
    if (!hasInitialized.current) {
      const steps = [
        { title: folderName, rightButton: null },
        { title: "Add Sheets", rightButton: null },
      ];
      registerModalSteps({ steps });
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: folderName,
        rightButton: null,
        leftButton: { label: "Edit", onClick: () => setIsEditMode(true) },
      });
      hasInitialized.current = true;
    }
  }, [folderName, registerModalSteps, setModalConfig]);

  // Update navigation direction
  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      setNavigationDirection(currentStep > prevStepRef.current ? "forward" : "backward");
      prevStepRef.current = currentStep;
    }
  }, [currentStep]);

  // Update modal config based on step and edit mode
  useEffect(() => {
    let config;
    if (currentStep === 1) {
      config = isEditMode
        ? {
            showTitle: true,
            showDoneButton: false,
            allowClose: false,
            showBackButton: false,
            title: "Remove Sheets",
            leftButton: {
              label: "Cancel",
              onClick: () => {
                setIsEditMode(false);
                setSelectedSheets([]);
                setTempData({ actions: [] });
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
          }
        : {
            showTitle: true,
            showDoneButton: true,
            allowClose: true,
            showBackButton: false,
            title: folderName,
            rightButton: null,
            leftButton: { label: "Edit", onClick: () => setIsEditMode(true) },
          };
    } else if (currentStep === 2) {
      config = {
        showTitle: true,
        showDoneButton: false,
        allowClose: false,
        showBackButton: true,
        backButtonTitle: folderName,
        backButton: {
          label: folderName,
          onClick: () => {
            setSelectedSheets([]);
            setTempData({ actions: tempData?.actions || [] });
            setNavigationDirection("backward");
            goBack();
          },
        },
        title: "Add Sheets",
        leftButton: null,
        rightButton: {
          label: "Add",
          onClick: handleAddSheets,
          isActive: selectedSheets.length > 0,
        },
      };
    }
    setModalConfig(config);
  }, [
    currentStep,
    isEditMode,
    selectedSheets,
    folderSheets,
    folderName,
    handleRemoveSheets,
    handleAddSheets,
    setModalConfig,
    goBack,
    setTempData,
    tempData,
  ]);

  return (
    <div className={`${styles.folderModal} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.viewContainer}>
        {[1, 2].map((step) => (
          <div
            key={step}
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ""} ${
              step !== currentStep ? styles.hidden : ""
            } ${
              step === currentStep && navigationDirection === "forward" ? styles.animateForward : ""
            } ${
              step === currentStep && navigationDirection === "backward" ? styles.animateBackward : ""
            }`}
            style={{ display: step !== currentStep ? "none" : "block" }}
          >
            {step === 1 && (
              <div className={styles.sheetList}>
                {displayedSheets.length === 0 ? (
                  <div className={`${styles.noSheets} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    No sheets in this folder
                  </div>
                ) : (
                  displayedSheets.map((sheetName, index) => (
                    <div
                      key={`${sheetName}-${index}`}
                      className={`${styles.sheetItem} ${isDarkTheme ? styles.darkTheme : ""} ${
                        index === 0 ? styles.firstSheet : ""
                      } ${index === displayedSheets.length - 1 ? styles.lastSheet : ""}`}
                      onClick={() => handleSheetClick(sheetName)}
                    >
                      <div className={styles.sheetRow}>
                        {isEditMode && (
                          selectedSheets.includes(sheetName) ? (
                            <FaRegCheckCircle
                              className={`${styles.customCheckbox} ${styles.checked} ${
                                isDarkTheme ? styles.darkTheme : ""
                              }`}
                              size={18}
                            />
                          ) : (
                            <FaRegCircle
                              className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ""}`}
                              size={18}
                            />
                          )
                        )}
                        <span className={`${styles.sheetName} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          {sheetName}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                {!isEditMode && (
                  <div className={styles.buttonContainer}>
                    {availableSheets.length > 0 && (
                      <button
                        onClick={() => {
                          setNavigationDirection("forward");
                          goToStep(2);
                        }}
                        className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        Add Sheets
                      </button>
                    )}
                  </div>
                )}
                {isEditMode && (
                  <button
                    onClick={handleDeleteFolder}
                    className={`${styles.deleteLink} ${isDarkTheme ? styles.darkTheme : ""}`}
                  >
                    Delete Folder
                  </button>
                )}
              </div>
            )}
            {step === 2 && (
              <div className={styles.sheetList}>
                {availableSheets.length === 0 ? (
                  <div className={`${styles.noSheets} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    No sheets available to add
                  </div>
                ) : (
                  availableSheets.map((sheetName, index) => (
                    <div
                      key={`${sheetName}-${index}`}
                      className={`${styles.sheetItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => handleSheetClick(sheetName)}
                    >
                      <div className={styles.sheetRow}>
                        <span className={styles.selectionCircle}>
                          {selectedSheets.includes(sheetName) ? (
                            <FaRegCheckCircle
                              className={`${styles.customCheckbox} ${styles.checked} ${
                                isDarkTheme ? styles.darkTheme : ""
                              }`}
                              size={18}
                            />
                          ) : (
                            <FaRegCircle
                              className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ""}`}
                              size={18}
                            />
                          )}
                        </span>
                        <span className={`${styles.sheetName} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          {sheetName}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

FolderModal.propTypes = {
  folderName: PropTypes.string.isRequired,
  onSheetSelect: PropTypes.func.isRequired,
  tempData: PropTypes.object,
  setTempData: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
};

FolderModal.defaultProps = {
  tempData: {},
};

export default FolderModal;
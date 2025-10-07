import { useState, useContext, useEffect, useRef, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import styles from "./FolderModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { FaFileAlt, FaPlus, FaTrash } from "react-icons/fa";

const FolderModal = ({ folderName, onSheetSelect, tempData, setTempData, handleClose }) => {
  const { sheets, isDarkTheme, setActiveSheetName: setActiveSheetNameWithRef } = useContext(MainContext);
  const { registerModalSteps, setModalConfig, goToStep, goBack, currentStep } = useContext(ModalNavigatorContext);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState(tempData?.selectedSheets || []);
  const [displayedSheets, setDisplayedSheets] = useState([]);
  const [navigationDirection, setNavigationDirection] = useState(null);
  const prevStepRef = useRef(currentStep);
  const hasInitialized = useRef(false);

  const folder = sheets.structure.find((item) => item.folderName === folderName);
  const folderSheets = useMemo(() => folder ? folder.sheets : [], [sheets, folderName]);

  // Compute set of all nested sheets across all folders, including pending actions
  const nestedSheetsSet = useMemo(() => {
    const baseNestedSheets = new Set(
      sheets.structure
        .filter((item) => item.folderName)
        .flatMap((folder) => folder.sheets || [])
    );

    // Add sheets from pending 'addSheets' actions for this folder
    const addedSheets = (tempData?.actions || [])
      .filter((action) => action.action === "addSheets" && action.folderName === folderName)
      .flatMap((action) => action.selectedSheets || []);

    // Remove sheets from pending 'removeSheets' actions for this folder
    const removedSheets = (tempData?.actions || [])
      .filter((action) => action.action === "removeSheets" && action.folderName === folderName)
      .flatMap((action) => action.selectedSheets || []);

    addedSheets.forEach((sheet) => baseNestedSheets.add(sheet));
    removedSheets.forEach((sheet) => baseNestedSheets.delete(sheet));

    return baseNestedSheets;
  }, [sheets.structure, tempData?.actions, folderName]);

  // Calculate available sheets (standalone sheets not in any folder, adjusted for pending actions)
  const availableSheets = useMemo(() => {
    const sheetsList = sheets.allSheets
      .filter(
        (sheet) =>
          !nestedSheetsSet.has(sheet.sheetName) && // Exclude sheets in any folder (including pending actions)
          sheet.sheetName !== "All Records"           // Exclude special "All Records" sheet
      )
      .map((sheet) => sheet.sheetName);

    return sheetsList;
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
    setDisplayedSheets((prev) => {
      const updatedSheets = prev.filter((sheet) => !selectedSheets.includes(sheet));
      return updatedSheets;
    });
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
    setDisplayedSheets((prev) => {
      const updatedSheets = [...new Set([...prev, ...selectedSheets])];
      return updatedSheets;
    });
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
        // Match Sheets.jsx tab click behavior
        const urlSheetName = sheetName.replace(/ /g, "-");
        const newUrl = `/sheets/${urlSheetName}`;
        if (window.location.pathname !== newUrl) {
          window.history.pushState({}, '', newUrl);
        }
        setActiveSheetNameWithRef(sheetName);
        onSheetSelect(sheetName);
        handleClose({ fromSave: false });
      }
    },
    [isEditMode, currentStep, onSheetSelect, toggleSheetSelection, handleClose, setActiveSheetNameWithRef]
  );

  // Initialize displayedSheets
  useEffect(() => {
    // Initialize with folderSheets and apply pending actions
    let initialSheets = [...folderSheets];
    (tempData?.actions || []).forEach((action) => {
      if (action.action === "addSheets" && action.folderName === folderName) {
        initialSheets = [...new Set([...initialSheets, ...(action.selectedSheets || [])])];
      } else if (action.action === "removeSheets" && action.folderName === folderName) {
        initialSheets = initialSheets.filter((sheet) => !(action.selectedSheets || []).includes(sheet));
      }
    });
    setDisplayedSheets(initialSheets);
  }, [folderSheets, tempData?.actions, folderName]);

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
        title: "Add Sheets",
        leftButton: null,
        rightButton: null,
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
              <div className={styles.section}>
                <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  <FaFileAlt />
                  Sheets in Folder
                </h3>
                <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  {displayedSheets.length === 0
                    ? "This folder is empty. Add sheets to organize your data."
                    : `${displayedSheets.length} sheet${displayedSheets.length !== 1 ? 's' : ''} in this folder.`
                  }
                </p>

                {displayedSheets.length === 0 ? (
                  <div className={`${styles.noSheets} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <div className={styles.emptyStateIcon}>
                      <FaFileAlt />
                    </div>
                    <p className={styles.emptyStateText}>No sheets in this folder</p>
                  </div>
                ) : (
                  <div className={styles.sheetList}>
                    {displayedSheets.map((sheetName, index) => (
                      <div
                        key={`${sheetName}-${index}`}
                        className={`${styles.sheetItem} ${isDarkTheme ? styles.darkTheme : ""} ${
                          index === displayedSheets.length - 1 ? styles.lastSheet : ""
                        }`}
                        onClick={() => handleSheetClick(sheetName)}
                      >
                        <div className={styles.sheetRow}>
                          {isEditMode && (
                            <div className={`${styles.selectionCircle} ${isDarkTheme ? styles.darkTheme : ""} ${
                              selectedSheets.includes(sheetName) ? styles.selected : ""
                            }`}>
                              {selectedSheets.includes(sheetName) && (
                                <span className={styles.checkmark}>✓</span>
                              )}
                            </div>
                          )}
                          <div className={`${styles.sheetIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            <FaFileAlt />
                          </div>
                          <div className={styles.sheetInfo}>
                            <div className={`${styles.sheetName} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              {sheetName}
                            </div>
                            <div className={`${styles.sheetMeta} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              Sheet • {folderName}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isEditMode && availableSheets.length > 0 && (
                  <div className={styles.buttonContainer}>
                    <button
                      onClick={() => {
                        setNavigationDirection("forward");
                        goToStep(2);
                      }}
                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    >
                      <FaPlus />
                      Add Sheets
                    </button>
                  </div>
                )}

                {isEditMode && (
                  <button
                    onClick={handleDeleteFolder}
                    className={`${styles.deleteLink} ${isDarkTheme ? styles.darkTheme : ""}`}
                  >
                    <FaTrash />
                    Delete Folder
                  </button>
                )}
              </div>
            )}

            {step === 2 && (
              <div className={styles.section}>
                <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  <FaPlus />
                  Available Sheets
                </h3>
                <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  Select sheets to add to the "{folderName}" folder.
                </p>

                {availableSheets.length === 0 ? (
                  <div className={`${styles.noSheets} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <div className={styles.emptyStateIcon}>
                      <FaFileAlt />
                    </div>
                    <p className={styles.emptyStateText}>No sheets available to add</p>
                  </div>
                ) : (
                  <div className={styles.sheetList}>
                    {availableSheets.map((sheetName, index) => (
                      <div
                        key={`${sheetName}-${index}`}
                        className={`${styles.sheetItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                        onClick={() => handleSheetClick(sheetName)}
                      >
                        <div className={styles.sheetRow}>
                          <div className={`${styles.selectionCircle} ${isDarkTheme ? styles.darkTheme : ""} ${
                            selectedSheets.includes(sheetName) ? styles.selected : ""
                          }`}>
                            {selectedSheets.includes(sheetName) && (
                              <span className={styles.checkmark}>✓</span>
                            )}
                          </div>
                          <div className={`${styles.sheetIcon} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            <FaFileAlt />
                          </div>
                          <div className={styles.sheetInfo}>
                            <div className={`${styles.sheetName} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              {sheetName}
                            </div>
                            <div className={`${styles.sheetMeta} ${isDarkTheme ? styles.darkTheme : ""}`}>
                              Available to add
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedSheets.length > 0 && (
                  <div className={styles.buttonContainer}>
                    <button
                      onClick={handleAddSheets}
                      className={`${styles.actionButton} ${styles.primary} ${isDarkTheme ? styles.darkTheme : ""}`}
                    >
                      <FaPlus />
                      Add {selectedSheets.length} Sheet{selectedSheets.length !== 1 ? 's' : ''}
                    </button>
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
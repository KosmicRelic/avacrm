import React, { useState, useContext, useEffect, useRef, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import styles from "./FolderModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { FaRegCircle, FaRegCheckCircle } from "react-icons/fa";

const FolderModal = ({ folderName, onSheetSelect, handleClose, tempData, setTempData }) => {
  const { sheets, isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, setModalConfig } = useContext(ModalNavigatorContext);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState(tempData?.selectedSheets || []);
  const [displayedSheets, setDisplayedSheets] = useState([]);
  const hasInitialized = useRef(false);

  const folder = sheets.structure.find((item) => item.folderName === folderName);
  const folderSheets = folder ? folder.sheets : [];

  // Dynamically calculate available sheets
  const availableSheets = useMemo(() => {
    const folderSheetsSet = new Set(displayedSheets);
    return sheets.allSheets
      .filter(
        (sheet) =>
          !folderSheetsSet.has(sheet.sheetName) && sheet.sheetName !== "All Cards"
      )
      .map((sheet) => sheet.sheetName);
  }, [sheets.allSheets, displayedSheets]);

  const handleRemoveSheets = useCallback(() => {
    if (selectedSheets.length === 0) {
      setIsEditMode(false);
      setSelectedSheets([]);
      setTempData({});
      return;
    }

    const confirmMessage = `Are you sure you want to remove the following sheet${
      selectedSheets.length > 1 ? "s" : ""
    }: ${selectedSheets.join(", ")}?`;
    if (window.confirm(confirmMessage)) {
      const newTempData = {
        selectedSheets,
        action: "removeSheets",
        folderName,
      };
      setTempData(newTempData);
      setDisplayedSheets((prev) => prev.filter((sheet) => !selectedSheets.includes(sheet)));
      setSelectedSheets([]);
      setIsEditMode(false);
    }
  }, [selectedSheets, folderName, setTempData]);

  const handleAddSheets = useCallback(() => {
    if (selectedSheets.length === 0) {
      setIsAddMode(false);
      setSelectedSheets([]);
      setTempData({});
      return;
    }

    const confirmMessage = `Are you sure you want to add the following sheet${
      selectedSheets.length > 1 ? "s" : ""
    } to "${folderName}"?`;

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    const newTempData = {
      selectedSheets,
      action: "addSheets",
      folderName,
    };

    setTempData(newTempData);
    setDisplayedSheets((prev) => [...new Set([...prev, ...selectedSheets])]); // Avoid duplicates
    setSelectedSheets([]);
    setIsAddMode(false);
  }, [selectedSheets, folderName, setTempData]);

  const toggleSheetSelection = useCallback(
    (sheetName) => {
      setSelectedSheets((prev) => {
        const newSelected = prev.includes(sheetName)
          ? prev.filter((name) => name !== sheetName)
          : [...prev, sheetName];
        setTempData({ ...tempData, selectedSheets: newSelected });
        return newSelected;
      });
    },
    [setTempData, tempData]
  );

  const handleSheetClick = useCallback(
    (sheetName) => {
      if (isEditMode || isAddMode) {
        toggleSheetSelection(sheetName);
      } else {
        onSheetSelect(sheetName);
        handleClose();
      }
    },
    [isEditMode, isAddMode, onSheetSelect, handleClose, toggleSheetSelection]
  );

  // Initialize displayedSheets
  useEffect(() => {
    setDisplayedSheets(folderSheets);
  }, [folderSheets]);

  // Initialize modal configuration
  useEffect(() => {
    if (!hasInitialized.current) {
      const editButton = {
        label: "Edit",
        onClick: () => setIsEditMode(true),
      };

      registerModalSteps({
        steps: [{ title: folderName, rightButton: null, leftButton: editButton }],
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

  // Update modal config based on mode
  useEffect(() => {
    if (isEditMode) {
      setModalConfig({
        showDoneButton: false,
        allowClose: false,
        title: "Remove Sheets",
        leftButton: {
          label: "Cancel",
          onClick: () => {
            setIsEditMode(false);
            setSelectedSheets([]);
            setTempData({});
            setDisplayedSheets(folderSheets); // Reset to original
          },
        },
        rightButton: {
          label: "Remove",
          onClick: handleRemoveSheets,
          isActive: selectedSheets.length > 0,
          isRemove: true,
          color: "red",
        },
      });
    } else if (isAddMode) {
      setModalConfig({
        showDoneButton: false,
        allowClose: false,
        title: "Add Sheets",
        leftButton: {
          label: "Cancel",
          onClick: () => {
            setIsAddMode(false);
            setSelectedSheets([]);
            setTempData({});
          },
        },
        rightButton: {
          label: "Add",
          onClick: handleAddSheets,
          isActive: selectedSheets.length > 0,
        },
      });
    } else {
      setModalConfig({
        showDoneButton: true,
        allowClose: true,
        title: folderName,
        rightButton: null,
        leftButton: {
          label: "Edit",
          onClick: () => setIsEditMode(true),
        },
      });
    }
  }, [
    isEditMode,
    isAddMode,
    selectedSheets,
    folderSheets,
    folderName,
    handleRemoveSheets,
    handleAddSheets,
    setModalConfig,
  ]);

  useEffect(() => {
    console.log(tempData);
  }, [tempData]);

  return (
    <div className={`${styles.folderModal} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.sheetList}>
        {isAddMode ? (
          availableSheets.length === 0 ? (
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
          )
        ) : displayedSheets.length === 0 ? (
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
                  <>
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
                  </>
                )}
                <span className={`${styles.sheetName} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  {sheetName}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className={styles.buttonContainer}>
        {!isEditMode && !isAddMode && availableSheets.length > 0 && (
          <button
            onClick={() => setIsAddMode(true)}
            className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
          >
            Add Sheets
          </button>
        )}
      </div>
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
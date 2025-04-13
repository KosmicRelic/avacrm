import { useContext, useState, useEffect } from "react";
import PropTypes from "prop-types";
import styles from "./TransportModal.module.css"; // Extended with new styles below
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";

const TransportModal = ({ tempData, onClose }) => {
  const { sheets, setSheets, isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, setModalConfig } = useContext(ModalNavigatorContext);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize modal configuration
  useEffect(() => {
    if (!hasInitialized) {
      registerModalSteps({
        steps: [
          {
            title: tempData.action === "move" ? "Move to Sheet" : "Copy to Sheet",
            rightButtons: [],
          },
        ],
      });
      setModalConfig({
        showTitle: true,
        showDoneButton: false,
        showBackButton: false,
        title: tempData.action === "move" ? "Move to Sheet" : "Copy to Sheet",
        backButtonTitle: "",
        rightButtons: [],
      });
      setHasInitialized(true);
    }
  }, [hasInitialized, registerModalSteps, setModalConfig, tempData.action]);

  // Handle sheet selection and card transfer
  const handleSheetSelect = (sheetName) => {
    setSheets((prevSheets) => {
      const newSheets = {
        ...prevSheets,
        allSheets: [...prevSheets.allSheets],
      };
      const sourceSheetIndex = newSheets.allSheets.findIndex((s) => s.isActive);
      const targetSheetIndex = newSheets.allSheets.findIndex((s) => s.sheetName === sheetName);

      if (sourceSheetIndex === -1 || targetSheetIndex === -1) {
        console.warn("Invalid sheet indices:", { sourceSheetIndex, targetSheetIndex });
        return prevSheets;
      }

      const sourceSheet = newSheets.allSheets[sourceSheetIndex];
      const targetSheet = newSheets.allSheets[targetSheetIndex];
      const { action, selectedRowIds } = tempData;

      // Add selected card IDs to target sheet, avoiding duplicates
      const newTargetRows = [
        ...targetSheet.rows,
        ...selectedRowIds.filter((id) => !targetSheet.rows.includes(id)),
      ];
      newSheets.allSheets[targetSheetIndex] = { ...targetSheet, rows: newTargetRows };

      // If moving, remove card IDs from source sheet
      if (action === "move") {
        newSheets.allSheets[sourceSheetIndex] = {
          ...sourceSheet,
          rows: sourceSheet.rows.filter((id) => !selectedRowIds.includes(id)),
        };
      }

      return newSheets;
    });

    // Call onComplete callback if provided
    if (tempData.onComplete) {
      tempData.onComplete();
    }

    // Close the modal
    onClose();
  };

  // Filter out the active sheet from the list
  const availableSheets = sheets.allSheets.filter((sheet) => !sheet.isActive);

  return (
    <div
      className={`${styles.modalOverlay} ${isDarkTheme ? styles.darkTheme : ""}`}
    >
      <div
        className={`${styles.modalContent} ${isDarkTheme ? styles.darkTheme : ""}`}
      >
        <div className={styles.modalHeader}>
          <h2
            className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ""}`}
          >
            {tempData.action === "move" ? "Move to Sheet" : "Copy to Sheet"}
          </h2>
        </div>
        <div className={`${styles.sheetList} ${isDarkTheme ? styles.darkTheme : ""}`}>
          {availableSheets.length > 0 ? (
            availableSheets.map((sheet, index) => (
              <div
                key={sheet.id}
                className={`${styles.sheetItem} ${
                  isDarkTheme ? styles.darkTheme : ""
                } ${index === availableSheets.length - 1 ? styles.lastChild : ""}`}
                onClick={() => handleSheetSelect(sheet.sheetName)}
              >
                <div className={styles.sheetRow}>
                  <span
                    className={`${styles.sheetName} ${
                      isDarkTheme ? styles.darkTheme : ""
                    }`}
                  >
                    {sheet.sheetName}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div
              className={`${styles.sheetItem} ${
                isDarkTheme ? styles.darkTheme : ""
              } ${styles.lastChild}`}
            >
              <div className={styles.sheetRow}>
                <span
                  className={`${styles.sheetName} ${
                    isDarkTheme ? styles.darkTheme : ""
                  }`}
                >
                  No other sheets available
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

TransportModal.propTypes = {
  tempData: PropTypes.shape({
    action: PropTypes.oneOf(["move", "copy"]).isRequired,
    selectedRowIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    onComplete: PropTypes.func,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default TransportModal;
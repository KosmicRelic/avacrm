import { useContext, useCallback } from "react";
import PropTypes from "prop-types";
import styles from "./CardsTransportationModal.module.css";
import { MainContext } from "../../Contexts/MainContext";

const CardsTransportationModal = ({ tempData, setTempData, onSave }) => {
  const { sheets, setSheets, isDarkTheme } = useContext(MainContext);
  const { action, selectedRowIds, onComplete } = tempData; // onComplete is optional

  const handleSheetSelect = useCallback(
    (targetSheetName) => {
      setSheets((prevSheets) => {
        const newSheets = { ...prevSheets, allSheets: [...prevSheets.allSheets] };
        const sourceSheetIndex = newSheets.allSheets.findIndex((s) => s.isActive);
        const targetSheetIndex = newSheets.allSheets.findIndex((s) => s.sheetName === targetSheetName);

        if (sourceSheetIndex === -1 || targetSheetIndex === -1) return prevSheets;

        const sourceSheet = newSheets.allSheets[sourceSheetIndex];
        const targetSheet = newSheets.allSheets[targetSheetIndex];

        // Add IDs to target sheet, avoiding duplicates
        const newTargetRows = [
          ...targetSheet.rows,
          ...selectedRowIds.filter((id) => !targetSheet.rows.includes(id)),
        ];
        newSheets.allSheets[targetSheetIndex] = { ...targetSheet, rows: newTargetRows };

        // Remove IDs from source sheet if moving
        if (action === "move") {
          newSheets.allSheets[sourceSheetIndex] = {
            ...sourceSheet,
            rows: sourceSheet.rows.filter((id) => !selectedRowIds.includes(id)),
          };
        }

        return newSheets;
      });
      if (onComplete) onComplete(); // Call only if defined
      onSave(); // Close the modal
    },
    [action, selectedRowIds, setSheets, onSave, onComplete]
  );

  return (
    <div className={`${styles.transportModal} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <h3>{action === "move" ? "Move to Sheet" : "Copy to Sheet"}</h3>
      <div className={styles.sheetList}>
        {sheets.allSheets.map((sheet) => (
          <button
            key={sheet.sheetName}
            className={`${styles.sheetButton} ${isDarkTheme ? styles.darkTheme : ""}`}
            onClick={() => handleSheetSelect(sheet.sheetName)}
            disabled={sheet.isActive}
          >
            {sheet.sheetName}
          </button>
        ))}
      </div>
    </div>
  );
};

CardsTransportationModal.propTypes = {
  tempData: PropTypes.shape({
    action: PropTypes.oneOf(["move", "copy"]).isRequired,
    selectedRowIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    onComplete: PropTypes.func,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default CardsTransportationModal;
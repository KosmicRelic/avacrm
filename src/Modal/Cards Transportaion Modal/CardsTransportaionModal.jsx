import { useContext, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./CardsTransportationModal.module.css";
import { MainContext } from "../../Contexts/MainContext";

const CardsTransportationModal = ({ tempData, setTempData, onSave }) => {
  const { sheets, setSheets, isDarkTheme, registerModalSteps, goToStep } = useContext(MainContext);
  const { action, selectedRowIds, onComplete } = tempData;
  const hasInitialized = useRef(false);

  const handleSheetSelect = useCallback(
    (targetSheetName) => {
      setSheets((prevSheets) => {
        const newSheets = { ...prevSheets, allSheets: [...prevSheets.allSheets] };
        const sourceSheetIndex = newSheets.allSheets.findIndex((s) => s.isActive);
        const targetSheetIndex = newSheets.allSheets.findIndex((s) => s.sheetName === targetSheetName);

        if (sourceSheetIndex === -1 || targetSheetIndex === -1) return prevSheets;

        const sourceSheet = newSheets.allSheets[sourceSheetIndex];
        const targetSheet = newSheets.allSheets[targetSheetIndex];

        const newTargetRows = [
          ...targetSheet.rows,
          ...selectedRowIds.filter((id) => !targetSheet.rows.includes(id)),
        ];
        newSheets.allSheets[targetSheetIndex] = { ...targetSheet, rows: newTargetRows };

        if (action === "move") {
          newSheets.allSheets[sourceSheetIndex] = {
            ...sourceSheet,
            rows: sourceSheet.rows.filter((id) => !selectedRowIds.includes(id)),
          };
        }

        return newSheets;
      });
      if (onComplete) onComplete();
      onSave();
    },
    [action, selectedRowIds, setSheets, onSave, onComplete]
  );

  // Register modal steps
  useEffect(() => {
    if (!hasInitialized.current) {
      registerModalSteps({
        steps: [
          {
            title: () => action === "move" ? "Move to Sheet" : "Copy to Sheet",
            rightButtons: () => [{ label: "Done", onClick: onSave }],
          },
        ],
        data: { action, selectedRowIds },
      });
      goToStep(1);
      hasInitialized.current = true;
    }
  }, [registerModalSteps, goToStep, action, onSave]);

  return (
    <div className={`${styles.transportModal} ${isDarkTheme ? styles.darkTheme : ""}`}>
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
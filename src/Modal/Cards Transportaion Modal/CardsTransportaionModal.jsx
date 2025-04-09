import { useContext, useCallback } from "react";
import styles from "./CardsTransportationModal.module.css";
import { MainContext } from "../../Contexts/MainContext";

const CardsTransportationModal = ({ tempData, setTempData, onSave }) => {
  const { sheets, setSheets, cards, isDarkTheme } = useContext(MainContext);
  const { action, selectedRowIds } = tempData;

  const handleSheetSelect = useCallback(
    (sheetName) => {
      setSheets((prevSheets) => {
        const updatedSheets = { ...prevSheets };
        const sourceSheet = updatedSheets.allSheets.find((s) => s.isActive);
        const targetSheet = updatedSheets.allSheets.find((s) => s.sheetName === sheetName);

        if (!sourceSheet || !targetSheet) return prevSheets;

        const selectedCards = cards.filter((card) =>
          selectedRowIds.includes(card[sourceSheet.headers[0].key])
        );

        // Add selected cards to target sheet (using full card data for flexibility)
        targetSheet.rows = [
          ...targetSheet.rows,
          ...selectedCards.map((card) => card[sourceSheet.headers[0].key]),
        ];

        if (action === "move") {
          // Remove selected rows from source sheet
          sourceSheet.rows = sourceSheet.rows.filter((id) => !selectedRowIds.includes(id));
        }

        return updatedSheets;
      });
      onSave(); // Close the modal after saving
    },
    [action, selectedRowIds, cards, setSheets, onSave]
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

export default CardsTransportationModal;
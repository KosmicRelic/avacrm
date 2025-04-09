import { useContext, useState, useCallback, useMemo } from "react";
import styles from "./CardsEditor.module.css";
import { MainContext } from "../../Contexts/MainContext";

const CardsEditor = ({
  onClose,
  onSave,
  initialRowData,
  startInEditMode,
  preSelectedSheet,
}) => {
  const { sheets, cardTemplates, headers, isDarkTheme } = useContext(MainContext); // Added headers
  const [view, setView] = useState(startInEditMode ? "editor" : "selection");
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState(initialRowData?.sheetName || preSelectedSheet || "");

  // Initialize selectedCardType based on initialRowData.typeOfCards
  const initialTemplate = initialRowData?.typeOfCards
    ? cardTemplates.find((t) => t.typeOfCards === initialRowData.typeOfCards)
    : null;
  const [selectedCardType, setSelectedCardType] = useState(initialTemplate?.name || "");
  const [formData, setFormData] = useState(initialRowData || {});
  const [isEditing, setIsEditing] = useState(!!initialRowData);

  const sheetOptions = useMemo(() => {
    return sheets.allSheets.map((sheet) => sheet.sheetName);
  }, [sheets]);

  const cardTypeOptions = useMemo(() => {
    return cardTemplates.map((template) => template.name);
  }, [cardTemplates]);

  const selectedFields = useMemo(() => {
    // Use initialRowData.typeOfCards directly if editing, fallback to selectedCardType
    let template;
    if (isEditing && initialRowData?.typeOfCards) {
      template = cardTemplates.find((t) => t.typeOfCards === initialRowData.typeOfCards);
    } else {
      template = cardTemplates.find((t) => t.name === selectedCardType);
    }
    if (!template || !template.keys) return [];
    return template.keys
      .filter((key) => key !== "id" && key !== "typeOfCards")
      .map((key) => {
        const header = headers.find((h) => h.key === key); // Now headers is defined
        return {
          key,
          name: header?.name || key.charAt(0).toUpperCase() + key.slice(1),
          type: header?.type || "text",
        };
      });
  }, [selectedCardType, cardTemplates, headers, isEditing, initialRowData]);

  const handleSelectionNext = useCallback(() => {
    if (!selectedSheet) {
      alert("Please select a sheet.");
      return;
    }
    if (!selectedCardType) {
      alert("Please select a card type.");
      return;
    }
    const template = cardTemplates.find((t) => t.name === selectedCardType);
    setFormData((prev) => ({
      ...prev,
      typeOfCards: template.typeOfCards,
    }));
    setIsAnimating(true);
    setTimeout(() => {
      setView("editor");
      if (!isEditing) setFormData({ typeOfCards: template.typeOfCards });
      setIsAnimating(false);
    }, 300);
  }, [selectedSheet, selectedCardType, isEditing, cardTemplates]);

  const handleCloseEditor = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      if (isEditing) {
        onClose();
      } else {
        setView("selection");
        setSelectedSheet(preSelectedSheet || "");
        setSelectedCardType("");
        setIsAnimating(false);
      }
    }, 300);
  }, [isEditing, onClose, preSelectedSheet]);

  const handleInputChange = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedSheet) {
      alert("No sheet selected.");
      return;
    }
    const template = cardTemplates.find((t) => t.name === selectedCardType || t.typeOfCards === initialRowData?.typeOfCards);
    if (!template) {
      alert("Invalid card type selected.");
      return;
    }
    const newRow = {
      ...formData,
      sheetName: selectedSheet,
      typeOfCards: template.typeOfCards,
    };
    onSave(newRow);
  }, [formData, selectedSheet, selectedCardType, onSave, cardTemplates, initialRowData]);

  return (
    <div className={`${styles.editorWrapper} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.viewContainer}>
        {view === "selection" && (
          <div className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ""}`}>
            <h2 className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
              Choose Sheet
            </h2>
            <select
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
              className={`${styles.sheetSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
            >
              <option value="">Select a sheet</option>
              {sheetOptions.map((sheetName) => (
                <option key={sheetName} value={sheetName}>
                  {sheetName}
                </option>
              ))}
            </select>
            <h2 className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
              Choose Card Type
            </h2>
            <select
              value={selectedCardType}
              onChange={(e) => setSelectedCardType(e.target.value)}
              className={`${styles.sheetSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
            >
              <option value="">Select a card type</option>
              {cardTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <div className={styles.modalButtons}>
              <button
                className={`${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className={`${styles.saveButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={handleSelectionNext}
              >
                Next
              </button>
            </div>
          </div>
        )}
        {view === "editor" && (
          <div
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ""} ${
              isAnimating ? styles.slideOutRight : styles.slideInRight
            }`}
          >
            <div className={styles.cardHeader}>
              <h2 className={`${styles.modalTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                {isEditing ? `Edit Card for ${selectedSheet}` : `New ${selectedCardType} Card for ${selectedSheet}`}
              </h2>
              <div className={styles.headerButtons}>
                <button
                  className={`${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={handleCloseEditor}
                >
                  {isEditing ? "Close" : "Back"}
                </button>
                <button
                  className={`${styles.saveButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={handleSave}
                >
                  Save
                </button>
              </div>
            </div>
            <div className={styles.fieldList}>
              {selectedFields.length > 0 ? (
                selectedFields.map((field) => (
                  <div key={field.key} className={styles.fieldItem}>
                    <span className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {field.name}
                    </span>
                    <input
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      value={formData[field.key] || ""}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      className={`${styles.fieldInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                      placeholder={`Enter ${field.name}`}
                    />
                  </div>
                ))
              ) : (
                <p>No fields defined for this card type.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardsEditor;
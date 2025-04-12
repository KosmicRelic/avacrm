import { useContext, useState, useCallback, useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import styles from "./CardsEditor.module.css";
import { MainContext } from "../../Contexts/MainContext";

const CardsEditor = ({
  onClose,
  onSave,
  initialRowData,
  startInEditMode,
  preSelectedSheet,
}) => {
  const { sheets, cardTemplates, headers, isDarkTheme } = useContext(MainContext);
  const [view, setView] = useState(startInEditMode ? "editor" : "selection");
  const [isVisible, setIsVisible] = useState(true);
  const [selectedSheet, setSelectedSheet] = useState(initialRowData?.sheetName || preSelectedSheet || "");
  const initialTemplate = initialRowData?.typeOfCards
    ? cardTemplates.find((t) => t.name === initialRowData.typeOfCards)
    : null;
  const [selectedCardType, setSelectedCardType] = useState(initialTemplate?.name || "");
  const [formData, setFormData] = useState(initialRowData ? { ...initialRowData } : {});
  const [isEditing, setIsEditing] = useState(!!initialRowData && !!initialRowData.id);

  const sheetOptions = useMemo(() => {
    return sheets.allSheets.map((sheet) => sheet.sheetName);
  }, [sheets]);

  const cardTypeOptions = useMemo(() => {
    return cardTemplates.map((template) => template.name);
  }, [cardTemplates]);

  const selectedSections = useMemo(() => {
    const template = cardTemplates.find((t) => t.name === (isEditing ? initialRowData?.typeOfCards : selectedCardType));
    if (!template || !template.sections) return [];
    return template.sections.map((section) => ({
      title: section.title,
      fields: section.keys
        .filter((key) => key !== "id" && key !== "typeOfCards")
        .map((key) => {
          const header = headers.find((h) => h.key === key);
          return {
            key,
            name: header?.name || key.charAt(0).toUpperCase() + key.slice(1),
            type: header?.type || "text",
            options: header?.options || [],
          };
        }),
    }));
  }, [selectedCardType, cardTemplates, headers, isEditing, initialRowData]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

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
    setFormData({ sheetName: selectedSheet, typeOfCards: template.name });
    setView("editor");
  }, [selectedSheet, selectedCardType, cardTemplates]);

  const handleCloseEditor = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      if (isEditing) {
        onClose();
      } else {
        setView("selection");
        setSelectedSheet(preSelectedSheet || "");
        setSelectedCardType("");
        setFormData({});
      }
    }, 300);
  }, [isEditing, onClose, preSelectedSheet]);

  const handleCloseSelection = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  const handleInputChange = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedSheet) {
      alert("No sheet selected.");
      return;
    }
    const template = cardTemplates.find((t) => t.name === (isEditing ? initialRowData?.typeOfCards : selectedCardType));
    if (!template) {
      alert("Invalid card type selected.");
      return;
    }
    const newRow = {
      ...formData,
      id: isEditing && initialRowData?.id ? initialRowData.id : Date.now().toString(),
      sheetName: selectedSheet,
      typeOfCards: template.name,
    };
    setIsVisible(false);
    setTimeout(() => {
      onSave(newRow, isEditing);
      onClose();
    }, 300);
  }, [formData, selectedSheet, selectedCardType, onSave, cardTemplates, initialRowData, isEditing, onClose]);

  return (
    <div className={`${styles.editorWrapper} ${isDarkTheme ? styles.darkTheme : ""} ${isVisible ? styles.active : ""}`}>
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
                onClick={handleCloseSelection}
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
          <div className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ""}`}>
            <div className={`${styles.cardHeader} ${isDarkTheme ? styles.darkTheme : ""}`}>
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
              {selectedSections.length > 0 ? (
                selectedSections.map((section, sectionIndex) => (
                  <div key={section.title} className={`${styles.sectionGroup} ${isDarkTheme ? styles.darkTheme : ""}`}>
                    <h3 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                      {section.title}
                    </h3>
                    {section.fields.length > 0 ? (
                      section.fields.map((field) => (
                        <div key={field.key} className={`${styles.fieldItem} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <span className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            {field.name}
                          </span>
                          {field.type === "dropdown" ? (
                            <select
                              value={formData[field.key] || ""}
                              onChange={(e) => handleInputChange(field.key, e.target.value)}
                              className={`${styles.fieldSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
                            >
                              <option value="">Select {field.name}</option>
                              {field.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                              value={formData[field.key] || ""}
                              onChange={(e) => handleInputChange(field.key, e.target.value)}
                              className={`${styles.fieldInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                              placeholder={`Enter ${field.name}`}
                            />
                          )}
                        </div>
                      ))
                    ) : (
                      <p className={`${styles.emptySection} ${isDarkTheme ? styles.darkTheme : ""}`}>
                        No fields defined for this section.
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p>No sections defined for this card type.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

CardsEditor.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialRowData: PropTypes.object,
  startInEditMode: PropTypes.bool,
  preSelectedSheet: PropTypes.string,
};

CardsEditor.defaultProps = {
  startInEditMode: false,
};

export default CardsEditor;
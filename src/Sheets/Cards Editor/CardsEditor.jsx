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
  const { sheets, setSheets, cardTemplates, headers, isDarkTheme, deleteCard, cards, setCards } = useContext(MainContext);
  const [view, setView] = useState(startInEditMode ? "editor" : "selection");
  const [selectedSheet, setSelectedSheet] = useState(initialRowData?.sheetName || preSelectedSheet || "");
  const initialTemplate = initialRowData?.typeOfCards
    ? cardTemplates?.find((t) => t.name === initialRowData.typeOfCards)
    : null;
  const [selectedCardType, setSelectedCardType] = useState(initialTemplate?.name || "");
  const [formData, setFormData] = useState(initialRowData ? { ...initialRowData } : {});
  const [isEditing, setIsEditing] = useState(!!initialRowData && !!initialRowData.id);
  const [openSections, setOpenSections] = useState([]);

  const sheetOptions = useMemo(() => sheets?.allSheets?.map((sheet) => sheet.sheetName) || [], [sheets]);
  const cardTypeOptions = useMemo(() => cardTemplates?.map((template) => template.name) || [], [cardTemplates]);

  const selectedSections = useMemo(() => {
    const template = cardTemplates?.find((t) => t.name === (isEditing ? initialRowData?.typeOfCards : selectedCardType));
    if (!template || !template.sections) return [];
    return template.sections.map((section) => ({
      name: section.name,
      fields: section.keys
        .filter((key) => key !== "id" && key !== "typeOfCards")
        .map((key) => {
          const header = headers?.find((h) => h.key === key);
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
    if (view === "editor" && selectedSections.length > 0 && openSections.length === 0) {
      setOpenSections([selectedSections[0].name]);
    }
  }, [view, selectedSections]);

  const handleSelectionNext = useCallback(() => {
    if (!selectedSheet) {
      alert("Please select a sheet.");
      return;
    }
    if (!selectedCardType) {
      alert("Please select a card type.");
      return;
    }
    const template = cardTemplates?.find((t) => t.name === selectedCardType);
    if (!template) {
      alert("Invalid card type selected.");
      return;
    }
    setFormData({ sheetName: selectedSheet, typeOfCards: template.name });
    setView("editor");
  }, [selectedSheet, selectedCardType, cardTemplates]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleInputChange = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedSheet) {
      alert("No sheet selected.");
      return;
    }
    const template = cardTemplates?.find((t) => t.name === (isEditing ? initialRowData?.typeOfCards : selectedCardType));
    if (!template) {
      alert("Invalid card type selected.");
      return;
    }
    const hasData = Object.keys(formData).some(
      (key) => key !== "sheetName" && key !== "typeOfCards" && formData[key] && formData[key].toString().trim() !== ""
    );
    if (!isEditing && !hasData) {
      alert("Please fill in at least one field to create a card.");
      return;
    }
    const newRow = {
      ...formData,
      id: isEditing && initialRowData?.id ? initialRowData.id : Date.now().toString(),
      sheetName: selectedSheet,
      typeOfCards: template.name,
    };
    onSave(newRow, isEditing);
    onClose();
  }, [formData, selectedSheet, selectedCardType, onSave, cardTemplates, initialRowData, isEditing, onClose]);

  const handleDelete = useCallback(() => {
    if (!isEditing || !initialRowData?.id) {
      alert("No card to delete.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this card? This action will remove it from all sheets.")) {
      setCards((prev) => prev.filter((card) => card.id !== initialRowData.id));
      setSheets((prev) => ({
        ...prev,
        allSheets: prev.allSheets.map((sheet) => ({
          ...sheet,
          rows: sheet.rows.filter((id) => id !== initialRowData.id),
        })),
      }));
      onClose();
    }
  }, [isEditing, initialRowData, setCards, setSheets, onClose]);

  const handleRemove = useCallback(() => {
    if (!isEditing || !initialRowData?.id || !selectedSheet) {
      alert("No card or sheet selected to remove.");
      return;
    }
    const currentSheet = sheets.allSheets.find((s) => s.sheetName === selectedSheet);
    if (currentSheet?.id === "primarySheet") {
      alert("Cannot remove a card from the primary sheet. Use Delete to remove it entirely.");
      return;
    }
    if (window.confirm(`Are you sure you want to remove this card from "${selectedSheet}"? It will remain in other sheets.`)) {
      setSheets((prev) => ({
        ...prev,
        allSheets: prev.allSheets.map((sheet) =>
          sheet.sheetName === selectedSheet
            ? { ...sheet, rows: sheet.rows.filter((id) => id !== initialRowData.id) }
            : sheet
        ),
      }));
      onClose();
    }
  }, [isEditing, initialRowData, selectedSheet, sheets, setSheets, onClose]);

  const toggleSection = useCallback((sectionName) => {
    setOpenSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((name) => name !== sectionName)
        : [...prev, sectionName]
    );
  }, []);

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
              aria-label="Select a sheet"
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
              aria-label="Select a card type"
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
                onClick={handleClose}
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
            <div className={`${styles.navBar} ${isDarkTheme ? styles.darkTheme : ""}`}>
              <button
                className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={handleClose}
                aria-label="Back"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 12L6 8L10 4"
                    stroke={isDarkTheme ? "#0a84ff" : "#007aff"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <h1 className={`${styles.navTitle} ${isDarkTheme ? styles.darkTheme : ""}`}>
                {isEditing ? "Edit Card" : "New Card"}
              </h1>
              <button
                className={`${styles.saveButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={handleSave}
              >
                Save
              </button>
            </div>
            <div className={styles.contentWrapper}>
              {selectedSections.length > 0 ? (
                selectedSections.map((section, index) => (
                  <div key={`${section.name}-${index}`} className={styles.sectionWrapper}>
                    <button
                      className={`${styles.sectionButton} ${isDarkTheme ? styles.darkTheme : ""} ${
                        openSections.includes(section.name) ? styles.active : ""
                      }`}
                      onClick={() => toggleSection(section.name)}
                      aria-expanded={openSections.includes(section.name)}
                      aria-controls={`section-content-${index}`}
                    >
                      <span className={styles.sectionTitle}>{section.name}</span>
                      <svg
                        className={styles.chevron}
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d={openSections.includes(section.name) ? "M2 8L6 4L10 8" : "M2 4L6 8L10 4"}
                          stroke={isDarkTheme ? "#a1a1a6" : "#6e6e73"}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <div
                      id={`section-content-${index}`}
                      className={`${styles.sectionContent} ${isDarkTheme ? styles.darkTheme : ""} ${
                        openSections.includes(section.name) ? styles.expanded : ""
                      }`}
                    >
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
                                aria-label={`Select ${field.name}`}
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
                                aria-label={`Enter ${field.name}`}
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
                  </div>
                ))
              ) : (
                <p className={`${styles.emptySection} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  No sections defined for this card type.
                </p>
              )}
              {isEditing && (
                <div className={styles.deleteButtonWrapper}>
                  <button
                    className={`${styles.removeButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    onClick={handleRemove}
                    aria-label="Remove card from sheet"
                  >
                    Remove from Sheet
                  </button>
                  <button
                    className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    onClick={handleDelete}
                    aria-label="Delete card"
                  >
                    Delete Card
                  </button>
                </div>
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
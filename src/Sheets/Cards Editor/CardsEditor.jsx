import React, { useContext, useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './CardsEditor.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { v4 as uuidv4 } from 'uuid'; // Import UUID

// Utility function to format field names
const formatFieldName = (key) => {
  if (key === key.toUpperCase()) {
    return key
      .split(/[_-]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const CardsEditor = ({
  onClose,
  onSave,
  initialRowData,
  startInEditMode,
  preSelectedSheet,
}) => {
  const { sheets, setSheets, cardTemplates, headers, isDarkTheme, cards, setCards } = useContext(MainContext);
  const [view, setView] = useState(startInEditMode ? 'editor' : 'selection');
  const [selectedSheet, setSelectedSheet] = useState(initialRowData?.sheetName || preSelectedSheet || '');
  const initialTemplate = initialRowData?.typeOfCards
    ? cardTemplates?.find((t) => t.name === initialRowData.typeOfCards)
    : null;
  const [selectedCardType, setSelectedCardType] = useState(initialTemplate?.name || '');
  const [formData, setFormData] = useState(initialRowData ? { ...initialRowData } : {});
  const [isEditing, setIsEditing] = useState(!!initialRowData && !!initialRowData.id);
  const [openSections, setOpenSections] = useState([]);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const sheetOptions = useMemo(() => sheets?.allSheets?.map((sheet) => sheet.sheetName) || [], [sheets]);
  const cardTypeOptions = useMemo(() => cardTemplates?.map((template) => template.name) || [], [cardTemplates]);

  const selectedSections = useMemo(() => {
    const template = cardTemplates?.find((t) => t.name === (isEditing ? initialRowData?.typeOfCards : selectedCardType));
    if (!template || !template.sections) return [];
    return template.sections.map((section) => ({
      name: section.name,
      fields: section.keys
        .filter((key) => key !== 'id')
        .map((key) => {
          const header = template.headers?.find((h) => h.key === key);
          return {
            key,
            name: header?.name || formatFieldName(key),
            type: header?.type || 'text',
            options: header?.options || [],
          };
        }),
    }));
  }, [selectedCardType, cardTemplates, isEditing, initialRowData]);

  const historicalFormData = useMemo(() => {
    if (!isViewingHistory || !selectedHistoryDate || !formData.history) {
      return formData;
    }

    const historicalData = { ...formData };
    const historyUpToDate = formData.history.filter(
      (entry) => entry.timestamp._seconds <= selectedHistoryDate._seconds
    );

    const fieldValues = {};
    historyUpToDate.reverse().forEach((entry) => {
      if (!fieldValues[entry.field]) {
        fieldValues[entry.field] = entry.value;
      }
    });

    Object.keys(fieldValues).forEach((field) => {
      historicalData[field] = fieldValues[field];
    });

    selectedSections.flatMap((section) => section.fields).forEach((field) => {
      if (!fieldValues[field.key] && formData[field.key]) {
        historicalData[field.key] = '';
      }
    });

    return historicalData;
  }, [isViewingHistory, selectedHistoryDate, formData, selectedSections]);

  const historyDates = useMemo(() => {
    if (!formData.history) return [];
    const timestamps = [...new Set(formData.history.map((entry) => entry.timestamp._seconds))];
    return timestamps
      .map((seconds) => ({
        _seconds: seconds,
        _nanoseconds: 0,
        date: new Date(seconds * 1000).toLocaleDateString(),
      }))
      .sort((a, b) => b._seconds - a._seconds);
  }, [formData.history]);

  useEffect(() => {
    if (view === 'editor' && selectedSections.length > 0 && openSections.length === 0) {
      setOpenSections([selectedSections[0].name]);
    }
  }, [view, selectedSections]);

  const handleSelectionNext = useCallback(() => {
    if (!selectedSheet) {
      alert('Please select a sheet.');
      return;
    }
    if (!selectedCardType) {
      alert('Please select a card type.');
      return;
    }
    const template = cardTemplates?.find((t) => t.name === selectedCardType);
    if (!template) {
      alert('Invalid card type selected.');
      return;
    }
    setFormData({ sheetName: selectedSheet, typeOfCards: template.name });
    setView('editor');
  }, [selectedSheet, selectedCardType, cardTemplates]);

  const handleClose = useCallback(() => {
    setIsViewingHistory(false);
    setSelectedHistoryDate(null);
    setIsHistoryModalOpen(false);
    onClose();
  }, [onClose]);

  const handleInputChange = useCallback(
    (key, value) => {
      if (!isViewingHistory) {
        setFormData((prev) => ({ ...prev, [key]: value }));
      }
    },
    [isViewingHistory]
  );

  const handleSave = useCallback(() => {
    if (!selectedSheet) {
      alert('No sheet selected.');
      return;
    }
    const template = cardTemplates?.find((t) => t.name === (isEditing ? initialRowData?.typeOfCards : selectedCardType));
    if (!template) {
      alert('Invalid card type selected.');
      return;
    }
    const hasData = Object.keys(formData).some(
      (key) => key !== 'sheetName' && key !== 'typeOfCards' && formData[key] && formData[key].toString().trim() !== ''
    );
    if (!isEditing && !hasData && !isViewingHistory) {
      alert('Please fill in at least one field to create a card.');
      return;
    }

    const newRow = {
      ...formData,
      id: isEditing && initialRowData?.id ? initialRowData.id : uuidv4(), // Use UUID for new cards
      docId: isEditing && initialRowData?.id ? initialRowData.id : uuidv4(),
      sheetName: selectedSheet,
      typeOfCards: template.name,
      history: formData.history || [],
    };

    // Log the saved card
    console.log('CardsEditor saving card:', newRow);

    const newHistory = [];
    const timestamp = { _seconds: Math.floor(Date.now() / 1000), _nanoseconds: 0 };

    if (isViewingHistory && selectedHistoryDate) {
      const existingCard = cards.find((card) => card.id === initialRowData.id);
      Object.keys(historicalFormData).forEach((key) => {
        if (
          key !== 'id' &&
          key !== 'sheetName' &&
          key !== 'typeOfCards' &&
          key !== 'history' &&
          historicalFormData[key] !== existingCard[key]
        ) {
          newHistory.push({
            field: key,
            value: historicalFormData[key] || '',
            timestamp,
          });
        }
      });
      newRow.history = [...newRow.history, ...newHistory];
      Object.keys(historicalFormData).forEach((key) => {
        newRow[key] = historicalFormData[key];
      });
    } else if (isEditing) {
      const existingCard = cards.find((card) => card.id === initialRowData.id);
      if (existingCard) {
        Object.keys(formData).forEach((key) => {
          if (
            key !== 'id' &&
            key !== 'sheetName' &&
            key !== 'typeOfCards' &&
            key !== 'history' &&
            formData[key] !== existingCard[key]
          ) {
            newHistory.push({
              field: key,
              value: formData[key] || '',
              timestamp,
            });
          }
        });
      }
      newRow.history = [...newRow.history, ...newHistory];
    } else {
      Object.keys(formData).forEach((key) => {
        if (
          key !== 'id' &&
          key !== 'sheetName' &&
          key !== 'typeOfCards' &&
          key !== 'history' &&
          formData[key] &&
          formData[key].toString().trim() !== ''
        ) {
          newHistory.push({
            field: key,
            value: formData[key],
            timestamp,
          });
        }
      });
      newRow.history = [...newRow.history, ...newHistory];
    }

    onSave(newRow, isEditing);
    setIsViewingHistory(false);
    setSelectedHistoryDate(null);
    setIsHistoryModalOpen(false);
    onClose();
  }, [
    formData,
    historicalFormData,
    selectedSheet,
    selectedCardType,
    onSave,
    cardTemplates,
    initialRowData,
    isEditing,
    isViewingHistory,
    selectedHistoryDate,
    onClose,
    cards,
  ]);

  const handleDelete = useCallback(() => {
    if (!isEditing || !initialRowData?.id) {
      alert('No card to delete.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this card? This action will remove it from all sheets.')) {
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
      alert('No card or sheet selected to remove.');
      return;
    }
    const currentSheet = sheets.allSheets.find((s) => s.sheetName === selectedSheet);
    if (currentSheet?.id === 'primarySheet') {
      alert('Cannot remove a card from the primary sheet. Use Delete to remove it entirely.');
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

  const handleViewHistory = useCallback(() => {
    if (!formData.history || formData.history.length === 0) {
      alert('No history available for this card.');
      return;
    }
    setIsHistoryModalOpen(true);
  }, [formData.history]);

  const handleHistoryDateSelect = useCallback((historyDate) => {
    setSelectedHistoryDate(historyDate);
    setIsViewingHistory(true);
    setIsHistoryModalOpen(false);
  }, []);

  const handleCancelHistory = useCallback(() => {
    setIsViewingHistory(false);
    setSelectedHistoryDate(null);
    setIsHistoryModalOpen(false);
    setFormData(initialRowData || {});
  }, [initialRowData]);

  const HistoryModal = () => (
    <div className={`${styles.historyModal} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={styles.historyModalContent}>
        <h2>Select History Date</h2>
        {historyDates.length > 0 ? (
          <ul className={styles.historyList}>
            {historyDates.map((historyDate) => (
              <li
                key={historyDate._seconds}
                className={styles.historyItem}
                onClick={() => handleHistoryDateSelect(historyDate)}
              >
                {historyDate.date}
              </li>
            ))}
          </ul>
        ) : (
          <p>No history entries available.</p>
        )}
        <div className={styles.historyModalButtons}>
          <button
            className={`${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={handleCancelHistory}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${styles.editorWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={styles.viewContainer}>
        <div className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <div className={`${styles.navBar} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <button
              className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ''}`}
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
                  stroke={isDarkTheme ? '#0a84ff' : '#007aff'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <h1 className={`${styles.navTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
              {isEditing ? (isViewingHistory ? 'View Card History' : 'Edit Card') : view === 'selection' ? 'Create a New Card' : 'New Card'}
            </h1>
            <button
              className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={view === 'selection' ? handleSelectionNext : handleSave}
            >
              {view === 'selection' ? 'Next' : isViewingHistory ? 'Revert Data' : 'Save'}
            </button>
          </div>
          <div className={styles.contentWrapper}>
            {view === 'selection' && (
              <div className={styles.sectionWrapper}>
                <div className={`${styles.sectionContent} ${isDarkTheme ? styles.darkTheme : ''} ${styles.expanded}`}>
                  <div className={`${styles.fieldItem} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    <span className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      Sheet
                    </span>
                    <select
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className={`${styles.fieldSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                      aria-label="Select a sheet"
                    >
                      <option value="">Select a sheet</option>
                      {sheetOptions.map((sheetName) => (
                        <option key={sheetName} value={sheetName}>
                          {sheetName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={`${styles.fieldItem} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    <span className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      Card Type
                    </span>
                    <select
                      value={selectedCardType}
                      onChange={(e) => setSelectedCardType(e.target.value)}
                      className={`${styles.fieldSelect} ${styles.cardTypeSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                      aria-label="Select a card type"
                    >
                      <option value="">Select a card type</option>
                      {cardTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
            {view === 'editor' && (
              <>
                {selectedSections.length > 0 ? (
                  selectedSections.map((section, index) => (
                    <div key={`${section.name}-${index}`} className={styles.sectionWrapper}>
                      <button
                        className={`${styles.sectionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                          openSections.includes(section.name) ? styles.active : ''
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
                            d={openSections.includes(section.name) ? 'M2 8L6 4L10 8' : 'M2 4L6 8L10 4'}
                            stroke={isDarkTheme ? '#a1a1a6' : '#6e6e73'}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <div
                        id={`section-content-${index}`}
                        className={`${styles.sectionContent} ${isDarkTheme ? styles.darkTheme : ''} ${
                          openSections.includes(section.name) ? styles.expanded : ''
                        }`}
                      >
                        {section.fields.length > 0 ? (
                          section.fields.map((field) => (
                            <div key={field.key} className={`${styles.fieldItem} ${isDarkTheme ? styles.darkTheme : ''}`}>
                              <span className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                {field.name}
                              </span>
                              {field.type === 'dropdown' ? (
                                <select
                                  value={historicalFormData[field.key] || ''}
                                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                                  className={`${styles.fieldSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                                  aria-label={`Select ${field.name}`}
                                  disabled={isViewingHistory}
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
                                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                  value={historicalFormData[field.key] || ''}
                                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                                  className={`${styles.fieldInput} ${isDarkTheme ? styles.darkTheme : ''} ${
                                    isViewingHistory ? styles.readOnly : ''
                                  }`}
                                  placeholder={`Enter ${field.name}`}
                                  aria-label={`Enter ${field.name}`}
                                  readOnly={isViewingHistory}
                                />
                              )}
                            </div>
                          ))
                        ) : (
                          <p className={`${styles.emptySection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            No fields defined for this section.
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={`${styles.emptySection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    No sections defined for this card type.
                  </p>
                )}
                {isEditing && (
                  <div className={styles.deleteButtonWrapper}>
                    <button
                      className={`${styles.historyButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={handleViewHistory}
                      aria-label="View history"
                    >
                      View History
                    </button>
                    <button
                      className={`${styles.removeButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={handleRemove}
                      aria-label="Remove card from sheet"
                    >
                      Remove from Sheet
                    </button>
                    <button
                      className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={handleDelete}
                      aria-label="Delete card"
                    >
                      Delete Card
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {isHistoryModalOpen && <HistoryModal />}
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
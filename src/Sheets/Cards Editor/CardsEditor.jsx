import React, { useContext, useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './CardsEditor.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase/firestore'; // Import Firestore Timestamp
import { formatFirestoreTimestamp } from '../../Utils/firestoreUtils';

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

// Utility function to format Firestore timestamp for <input type="date">
const formatDateForInput = (value) => {
  if (value && typeof value === 'object' && ('seconds' in value || 'toDate' in value)) {
    const date = value.toDate ? value.toDate() : new Date(value.seconds * 1000);
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  }
  return value || '';
};

const CardsEditor = ({
  onClose,
  onSave,
  initialRowData,
  startInEditMode,
  preSelectedSheet,
}) => {
  const { sheets, cardTemplates, headers, isDarkTheme, cards, setCards, teamMembers, user } = useContext(MainContext);
  const [view, setView] = useState(startInEditMode ? 'editor' : 'selection');
  const [selectedSheet, setSelectedSheet] = useState(initialRowData?.sheetName || preSelectedSheet || '');
  const initialTemplate = initialRowData?.typeOfCards
    ? cardTemplates?.find((t) => t.name === initialRowData.typeOfCards)
    : null;
  const [selectedCardType, setSelectedCardType] = useState(initialTemplate?.name || '');
  const [formData, setFormData] = useState(initialRowData ? { ...initialRowData } : {});
  const [isEditing, setIsEditing] = useState(!!initialRowData && !!initialRowData.docId);
  const [openSections, setOpenSections] = useState([]);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const isBusinessUser = (() => {
    if (!formData || !formData.sheetName || !sheets || !sheets.allSheets) return false;
    const sheet = sheets.allSheets.find((s) => s.sheetName === formData.sheetName);
    return sheet && sheet.businessId && (sheet.businessId === (window?.user?.uid || (window?.firebase?.auth?.currentUser?.uid) || (window?.auth?.currentUser?.uid) || (user && user.uid)));
  })();

  const sheetOptions = useMemo(() => sheets?.allSheets?.map((sheet) => sheet.sheetName) || [], [sheets]);
  const cardTypeOptions = useMemo(() => {
    if (!selectedSheet) return [];
    const sheet = sheets.allSheets.find((s) => s.sheetName === selectedSheet);
    return sheet?.typeOfCardsToDisplay || [];
  }, [selectedSheet, sheets]);

  // Helper to get display name from uid
  const getTeamMemberName = (uid) => {
    if (!uid) return '';
    if (uid === user?.uid) return user?.name && user?.surname ? `${user.name} ${user.surname}` : user?.email || 'Me';
    const member = teamMembers?.find((tm) => tm.uid === uid);
    return member ? `${member.name || ''} ${member.surname || ''}`.trim() : uid;
  };

  const selectedSections = useMemo(() => {
    const template = cardTemplates?.find((t) => t.name === (isEditing ? initialRowData?.typeOfCards : selectedCardType));
    if (!template || !template.sections) return [];
    return template.sections.map((section) => ({
      name: section.name,
      fields: section.keys
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
        date: formatFirestoreTimestamp({ _seconds: seconds, _nanoseconds: 0 }), // Use formatFirestoreTimestamp
      }))
      .sort((a, b) => b._seconds - a._seconds);
  }, [formData.history]);

  useEffect(() => {
    if (view === 'editor' && selectedSections.length > 0 && openSections.length === 0) {
      setOpenSections([selectedSections[0].name]);
    }
  }, [view, selectedSections]);

  useEffect(() => {
    if (selectedSheet && !isEditing) {
      const sheet = sheets.allSheets.find((s) => s.sheetName === selectedSheet);
      if (sheet?.typeOfCardsToDisplay?.length === 1) {
        setSelectedCardType(sheet.typeOfCardsToDisplay[0]);
      } else {
        setSelectedCardType('');
      }
    }
  }, [selectedSheet, sheets, isEditing]);

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
    setFormData((prev) => ({
      ...prev,
      sheetName: selectedSheet,
      typeOfCards: template.name,
      docId: prev.docId || uuidv4(),
    }));
    setView('editor');
  }, [selectedSheet, selectedCardType, cardTemplates]);

  const handleClose = useCallback(() => {
    setIsViewingHistory(false);
    setSelectedHistoryDate(null);
    setIsHistoryModalOpen(false);
    onClose();
  }, [onClose]);

  const handleInputChange = useCallback(
    (key, value, fieldType) => {
      if (key === 'docId' || key === 'typeOfCards') {
        return;
      }
      if (!isViewingHistory) {
        let formattedValue = value;
        if (fieldType === 'date' && value) {
          // Convert date string (YYYY-MM-DD) to Firestore Timestamp
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            formattedValue = Timestamp.fromDate(date);
          } else {
            formattedValue = ''; // Handle invalid date
          }
        }
        setFormData((prev) => ({ ...prev, [key]: formattedValue }));
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
      (key) => key !== 'sheetName' && key !== 'typeOfCards' && key !== 'docId' && formData[key] && formData[key].toString().trim() !== ''
    );
    if (!isEditing && !hasData && !isViewingHistory) {
      alert('Please fill in at least one field to create a card.');
      return;
    }

    const newRow = {
      ...formData,
      docId: isEditing && initialRowData?.docId ? initialRowData.docId : formData.docId || uuidv4(),
      sheetName: selectedSheet,
      typeOfCards: isEditing ? initialRowData?.typeOfCards : template.name,
      history: formData.history || [],
      isModified: true,
      action: isEditing ? 'update' : 'add',
    };

    const newHistory = [];
    const timestamp = Timestamp.now(); // Use Firestore Timestamp for history

    if (isViewingHistory && selectedHistoryDate) {
      const existingCard = cards.find((card) => card.docId === initialRowData.docId);
      Object.keys(historicalFormData).forEach((key) => {
        if (
          key !== 'docId' &&
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
      const existingCard = cards.find((card) => card.docId === initialRowData.docId);
      if (existingCard) {
        Object.keys(formData).forEach((key) => {
          if (
            key !== 'docId' &&
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
          key !== 'docId' &&
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
    if (!isEditing || !initialRowData?.docId) {
      alert('No card to delete.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this card? This action will remove it from all sheets.')) {
      setCards((prev) =>
        prev.map((card) =>
          card.docId === initialRowData.docId
            ? { ...card, isModified: true, action: 'remove' }
            : card
        )
      );
      onClose();
    }
  }, [isEditing, initialRowData, setCards, onClose]);

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
                              <span className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ''}`}>{field.name}</span>
                              {field.key === 'assignedTo' ? (
                                <select
                                  value={formData.assignedTo || ''}
                                  onChange={e => handleInputChange('assignedTo', e.target.value, 'dropdown')}
                                  className={`${styles.fieldSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                                  aria-label="Select team member"
                                  disabled={isViewingHistory}
                                >
                                  <option value="">Unassigned</option>
                                  {isBusinessUser
                                    ? teamMembers.map(tm => (
                                        <option key={tm.uid} value={tm.uid}>
                                          {tm.name && tm.surname ? `${tm.name} ${tm.surname}` : tm.email || tm.uid}
                                        </option>
                                      ))
                                    : user && (
                                        <option key={user.uid} value={user.uid}>
                                          {user.name && user.surname ? `${user.name} ${user.surname}` : user.email || user.uid}
                                        </option>
                                      )
                                  }
                                </select>
                              ) : field.type === 'dropdown' ? (
                                <select
                                  value={historicalFormData[field.key] || ''}
                                  onChange={e => handleInputChange(field.key, e.target.value, field.type)}
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
                                  type={field.key === 'id' ? 'text' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                  value={field.key === 'assignedTo' ? getTeamMemberName(formData.assignedTo) : (field.type === 'date' ? formatDateForInput(historicalFormData[field.key]) : historicalFormData[field.key] || '')}
                                  onChange={e => handleInputChange(field.key, e.target.value, field.type)}
                                  className={`${styles.fieldInput} ${isDarkTheme ? styles.darkTheme : ''} ${isViewingHistory ? styles.readOnly : ''}`}
                                  placeholder={`Enter ${field.name}`}
                                  aria-label={`Enter ${field.name}`}
                                  readOnly={isViewingHistory || field.key === 'assignedTo'}
                                  disabled={field.key === 'typeOfCards' || field.key === 'docId' || field.key === 'id'}
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
                    {isBusinessUser && (
                      <button
                        className={`${styles.historyButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                        onClick={handleViewHistory}
                        aria-label="View history"
                      >
                        View History
                      </button>
                    )}
                    {isBusinessUser && (
                      <button
                        className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                        onClick={handleDelete}
                        aria-label="Delete card"
                      >
                        Delete Card
                      </button>
                    )}
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
  initialRowData: PropTypes.shape({
    docId: PropTypes.string,
    sheetName: PropTypes.string,
    typeOfCards: PropTypes.string,
    history: PropTypes.arrayOf(
      PropTypes.shape({
        field: PropTypes.string,
        value: PropTypes.any,
        timestamp: PropTypes.oneOfType([
          PropTypes.shape({
            _seconds: PropTypes.number,
            _nanoseconds: PropTypes.number,
          }),
          PropTypes.instanceOf(Timestamp),
        ]),
      })
    ),
  }),
  startInEditMode: PropTypes.bool,
  preSelectedSheet: PropTypes.string,
};

CardsEditor.defaultProps = {
  startInEditMode: false,
};

export default CardsEditor;
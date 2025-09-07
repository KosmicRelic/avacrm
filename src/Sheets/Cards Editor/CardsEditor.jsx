import React, { useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './CardsEditor.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { Timestamp } from 'firebase/firestore';
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

// Helper to format time for <input type="time"> (always 24-hour format, never AM/PM)
const formatTimeForInput = (value) => {
  if (value && typeof value === 'object' && ('seconds' in value || 'toDate' in value)) {
    const date = value.toDate ? value.toDate() : new Date(value.seconds * 1000);
    // Always return 24-hour format HH:mm (never AM/PM)
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  return '';
};

// Helper to parse yyyy-mm-dd as local date (not UTC)
function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

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

  // --- FIX: Manage showInputs state for each date field at the top level ---
  const [showInputsMap, setShowInputsMap] = useState({});

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

  // Top-level effect to keep showInputsMap in sync with date fields (must be after selectedSections/historicalFormData)
  useEffect(() => {
    if (!selectedSections) return;
    const newShowInputsMap = { ...showInputsMap };
    selectedSections.forEach(section => {
      section.fields.forEach(field => {
        if (field.type === 'date') {
          const dateValue = formatDateForInput(historicalFormData[field.key]);
          const timeValue = formatTimeForInput(historicalFormData[field.key]);
          const isEmpty = !dateValue && !timeValue;
          if (isEmpty && showInputsMap[field.key]) {
            newShowInputsMap[field.key] = false;
          } else if (!Object.prototype.hasOwnProperty.call(showInputsMap, field.key)) {
            newShowInputsMap[field.key] = !isEmpty;
          }
        }
      });
    });
    if (JSON.stringify(newShowInputsMap) !== JSON.stringify(showInputsMap)) {
      setShowInputsMap(newShowInputsMap);
    }
    // eslint-disable-next-line
  }, [selectedSections, historicalFormData]);

  // Utility: check if user is business user
  const isBusinessUser = user && user.businessId === user.uid;

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

  const historyDates = useMemo(() => {
    if (!formData.history) return [];
    const timestamps = [...new Set(formData.history.map((entry) => entry.timestamp._seconds))];
    return timestamps
      .map((seconds) => ({
        _seconds: seconds,
        _nanoseconds: 0,
        date: formatFirestoreTimestamp({ _seconds: seconds, _nanoseconds: 0 }),
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
    (key, value, fieldType, extra) => {
      if (key === 'docId' || key === 'typeOfCards') {
        return;
      }
      if (!isViewingHistory) {
        let formattedValue = value;
        if (fieldType === 'date') {
          let prevDate = formData[key];
          let dateObj;
          if (extra && extra.type === 'time') {
            // value is the new time string, keep the previous date part (from Firestore Timestamp only)
            let baseDate;
            if (prevDate && typeof prevDate === 'object' && (typeof prevDate.toDate === 'function' || 'seconds' in prevDate)) {
              baseDate = prevDate.toDate ? prevDate.toDate() : new Date(prevDate.seconds * 1000);
            } else {
              // If no previous value, use today's date (local)
              baseDate = new Date();
            }
            let [hours, minutes] = value.split(':');
            hours = parseInt(hours, 10);
            minutes = parseInt(minutes, 10);
            if (!isNaN(hours) && !isNaN(minutes)) {
              // Set hours/minutes directly on a local date
              dateObj = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, 0, 0);
              formattedValue = Timestamp.fromDate(dateObj);
            } else if (baseDate) {
              dateObj = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), baseDate.getHours(), baseDate.getMinutes(), 0, 0);
              formattedValue = Timestamp.fromDate(dateObj);
            } else {
              formattedValue = '';
            }
            setFormData((prev) => ({ ...prev, [key]: formattedValue }));
            return;
          } else if (extra && extra.type === 'date') {
            // value is the new date string, keep the previous time part
            let hours = 0, minutes = 0;
            if (prevDate && typeof prevDate === 'object' && ('seconds' in prevDate || 'toDate' in prevDate)) {
              const d = prevDate.toDate ? prevDate.toDate() : new Date(prevDate.seconds * 1000);
              hours = d.getHours();
              minutes = d.getMinutes();
            }
            // value is yyyy-mm-dd
            const baseDate = parseLocalDate(value);
            dateObj = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, 0, 0);
          } else if (value) {
            // fallback, just date
            const baseDate = parseLocalDate(value);
            dateObj = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
          }
          if (dateObj && !isNaN(dateObj.getTime())) {
            formattedValue = Timestamp.fromDate(dateObj);
          } else {
            formattedValue = '';
          }
        }
        setFormData((prev) => ({ ...prev, [key]: formattedValue }));
      }
    },
    [isViewingHistory, formData]
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

    let newRow = {
      ...formData,
      docId: isEditing && initialRowData?.docId ? initialRowData.docId : formData.docId,
      typeOfCards: isEditing ? initialRowData?.typeOfCards : template.name,
      history: formData.history || [],
      isModified: true,
      action: isEditing ? 'update' : 'add',
    };

    const requiredFields = ['docId', 'typeOfCards', 'history', 'isModified', 'action'];
    Object.keys(newRow).forEach((key) => {
      if (!requiredFields.includes(key) && (newRow[key] === null || newRow[key] === undefined || newRow[key] === '')) {
        delete newRow[key];
      }
    });

    const newHistory = [];
    const timestamp = Timestamp.now();

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

  const MultiSelectDropdown = ({ options, value, onChange, label, disabled, isDarkTheme }) => {
    const [open, setOpen] = useState(false);
    const [tempValue, setTempValue] = useState(Array.isArray(value) ? value : []);
    const ref = useRef(null);
    const dropdownRef = useRef(null);

    // Always sync tempValue with value when opening
    useEffect(() => {
      if (open) {
        setTempValue(Array.isArray(value) ? value : []);
      }
    }, [open, value]);

    useEffect(() => {
      if (!open) return;
      const handleClickOutside = (event) => {
        if (
          ref.current && !ref.current.contains(event.target) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target)
        ) {
          // Save the current tempValue as the new value
          const ordered = options.filter(option => tempValue.includes(option));
          onChange(ordered);
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open, tempValue, options, onChange]);

    const handleOptionToggle = (option) => {
      let newValue = Array.isArray(tempValue) ? [...tempValue] : [];
      if (newValue.includes(option)) {
        newValue = newValue.filter((v) => v !== option);
      } else {
        newValue.push(option);
      }
      setTempValue(newValue);
    };

    const handleSave = (e) => {
      e.stopPropagation();
      // Sort tempValue according to the order in options
      const ordered = options.filter(option => tempValue.includes(option));
      onChange(ordered);
      setOpen(false);
    };

    const handleCancel = (e) => {
      e.stopPropagation();
      setTempValue(Array.isArray(value) ? value : []);
      setOpen(false);
    };

    const display = (Array.isArray((open ? tempValue : value)) && (open ? tempValue : value).length > 0)
      ? (open ? tempValue : value).join(', ')
      : `Select ${label}`;

    // Position dropdown below the field
    const [dropdownStyle, setDropdownStyle] = useState({});
    useEffect(() => {
      if (open && ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setDropdownStyle({
          top: rect.height + 4,
        });
      }
    }, [open]);

    return (
      <div
        ref={ref}
        className={[
          styles.fieldSelect,
          styles.multiSelectDropdownWrapper,
          isDarkTheme ? styles.darkTheme : '',
          disabled ? styles.disabled : '',
        ].join(' ')}
        tabIndex={0}
        onClick={() => {
          if (!disabled && !open) setOpen(true);
        }}
      >
        <span
          className={[
            styles.multiSelectDropdownDisplay,
            (!value || value.length === 0) ? styles.multiSelectDropdownPlaceholder : '',
          ].join(' ')}
        >
          {display}
        </span>
        <svg className={styles.multiSelectDropdownChevron} width="16" height="16" viewBox="0 0 16 16"></svg>
        {open && !disabled && (
          <div
            ref={dropdownRef}
            className={styles.multiSelectDropdown}
            style={dropdownStyle}
          >
            <div className={styles.multiSelectDropdownList}>
              {options.map((option) => (
                <label
                  key={option}
                  className={styles.multiSelectDropdownLabel}
                >
                  <input
                    type="checkbox"
                    checked={Array.isArray(tempValue) && tempValue.includes(option)}
                    onChange={() => handleOptionToggle(option)}
                    disabled={disabled}
                    className={styles.multiSelectDropdownCheckbox}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            <div className={styles.multiSelectDropdownButtons}>
              <button
                type="button"
                onClick={handleCancel}
                className={styles.multiSelectDropdownButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className={[styles.multiSelectDropdownButton, styles.save].join(' ')}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

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
                              ) : field.type === 'multi-select' ? (
                                <MultiSelectDropdown
                                  options={field.options}
                                  value={Array.isArray(historicalFormData[field.key]) ? historicalFormData[field.key] : []}
                                  onChange={selected => handleInputChange(field.key, selected, field.type)}
                                  label={field.name}
                                  disabled={isViewingHistory}
                                  isDarkTheme={isDarkTheme}
                                />
                              ) : field.type === 'date' ? (
                                (() => {
                                  const dateValue = formatDateForInput(historicalFormData[field.key]);
                                  const timeValue = formatTimeForInput(historicalFormData[field.key]);
                                  const isEmpty = !dateValue && !timeValue;
                                  const showInputs = showInputsMap[field.key] ?? !isEmpty;
                                  const handleSetNow = () => {
                                    const now = new Date();
                                    setFormData(prev => ({ ...prev, [field.key]: Timestamp.fromDate(now) }));
                                    setShowInputsMap(prev => ({ ...prev, [field.key]: true }));
                                  };
                                  if (!showInputs && isEmpty && !isViewingHistory) {
                                    return (
                                      <span
                                        className={`${styles.fieldInput} ${isDarkTheme ? styles.darkTheme : ''} ${styles.dateTimePlaceholder}`}
                                        style={{ cursor: 'pointer', color: '#888', minHeight: 36, display: 'flex', alignItems: 'center' }}
                                        onClick={handleSetNow}
                                      >
                                        Enter A Date and Time
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className={`${styles.fieldInput} ${isDarkTheme ? styles.darkTheme : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <input
                                          type="date"
                                          value={dateValue}
                                          onChange={e => handleInputChange(
                                            field.key,
                                            e.target.value,
                                            field.type,
                                            { type: 'date', timeValue: timeValue }
                                          )}
                                          className={`${styles.fieldInput} ${isDarkTheme ? styles.darkTheme : ''} ${isViewingHistory ? styles.readOnly : ''}`}
                                          style={{ backgroundColor: 'transparent', padding: 0 }}
                                          placeholder={`Enter ${field.name}`}
                                          aria-label={`Enter ${field.name} date`}
                                          readOnly={isViewingHistory}
                                          disabled={field.key === 'typeOfCards' || field.key === 'docId' || field.key === 'id'}
                                        />
                                        <input
                                          type="time"
                                          value={timeValue || ''}
                                          onChange={e => handleInputChange(
                                            field.key,
                                            e.target.value,
                                            field.type,
                                            { type: 'time', dateValue: dateValue }
                                          )}
                                          className={`${styles.fieldInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          aria-label={`Enter ${field.name} time`}
                                          style={{ backgroundColor: 'transparent', padding: 0 }}
                                          readOnly={isViewingHistory}
                                          disabled={isViewingHistory || field.key === 'typeOfCards' || field.key === 'docId' || field.key === 'id'}
                                        />
                                      </div>
                                      {!isViewingHistory && (dateValue || timeValue) && (
                                        <button
                                          type="button"
                                          aria-label="Clear date and time"
                                          style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 18 }}
                                          onClick={() => {
                                            setFormData(prev => ({ ...prev, [field.key]: '' }));
                                            setShowInputsMap(prev => ({ ...prev, [field.key]: false }));
                                          }}
                                        >
                                          ×
                                        </button>
                                      )}
                                    </span>
                                  );
                                })()
                              ) : (
                                <input
                                  type={field.key === 'id' ? 'text' : field.type === 'number' ? 'number' : 'text'}
                                  value={historicalFormData[field.key] || ''}
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

// .customTimePicker .react-time-picker__wrapper { border: none !important; box-shadow: none !important; background: transparent !important; }
// .customTimePicker .react-time-picker__inputGroup { border: none !important; background: transparent !important; }
import React, { useContext, useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import styles from './RecordsEditor.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { Timestamp } from 'firebase/firestore';
import { formatFirestoreTimestamp } from '../../Utils/firestoreUtils';
import { getFormattedHistory, formatHistoryEntry, getRecordCreator, getLastModifier, formatFieldName, formatDateForInput, formatTimeForInput, parseLocalDate } from '../../Utils/assignedToUtils';const RecordsEditor = memo(({
  onClose,
  onSave,
  onOpenNewRecord, // New prop for opening a new record after pipeline execution
  initialRowData,
  startInEditMode,
  preSelectedSheet,
}) => {
  const { sheets, recordTemplates, templateObjects, headers, isDarkTheme, records, setRecords, teamMembers, user } = useContext(MainContext);
  const [view, setView] = useState(startInEditMode ? 'editor' : 'selection');
  const [selectedSheet, setSelectedSheet] = useState(initialRowData?.sheetName || preSelectedSheet || '');
  const initialTemplate = initialRowData?.typeOfRecord
    ? recordTemplates?.find((t) => t.name === initialRowData.typeOfRecord)
    : null;
  const [selectedRecordType, setSelectedRecordType] = useState(initialTemplate?.name || '');
  const [formData, setFormData] = useState(initialRowData ? { ...initialRowData } : {});
  const [isEditing, setIsEditing] = useState(!!initialRowData && !!initialRowData.docId);
  const [openSections, setOpenSections] = useState([]);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // --- FIX: Manage showInputs state for each date field at the top level ---
  const [showInputsMap, setShowInputsMap] = useState({});

  const selectedSections = useMemo(() => {
    // Use formData.typeOfRecord first (for pipeline conversions), then fall back to other sources
    const templateName = formData.typeOfRecord || (isEditing ? initialRowData?.typeOfRecord : selectedRecordType);
    const template = recordTemplates?.find((t) => t.name === templateName);
    
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
  }, [selectedRecordType, recordTemplates, isEditing, initialRowData, formData.typeOfRecord]);

  // Ensure formData has all required fields properly initialized
  useEffect(() => {
    if (!isEditing && selectedRecordType && !formData.linkId) {
      const template = recordTemplates?.find((t) => t.name === selectedRecordType);
      setFormData(prev => ({
        ...prev,
        linkId: `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        assignedTo: prev.assignedTo || user?.email || '',
        typeOfRecord: selectedRecordType,
        typeOfObject: (() => {
          // Find the object for this template to set typeOfObject
          if (template?.objectId && templateObjects) {
            const object = templateObjects.find(e => e.id === template.objectId);
            return object ? object.name : '';
          }
          return '';
        })(),
      }));
    }
  }, [selectedRecordType, isEditing, formData.linkId, user?.email, recordTemplates, templateObjects]);

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
  const recordTypeOptions = useMemo(() => {
    if (!selectedSheet) return [];
    const sheet = sheets.allSheets.find((s) => s.sheetName === selectedSheet);
    return sheet?.typeOfRecordsToDisplay || [];
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
      if (sheet?.typeOfRecordsToDisplay?.length === 1) {
        setSelectedRecordType(sheet.typeOfRecordsToDisplay[0]);
      } else {
        setSelectedRecordType('');
      }
    }
  }, [selectedSheet, sheets, isEditing]);

  // Update component state when initialRowData changes (for pipeline conversions)
  useEffect(() => {
    if (initialRowData) {
      const newTemplate = initialRowData.typeOfRecord
        ? recordTemplates?.find((t) => t.name === initialRowData.typeOfRecord)
        : null;
      
      setSelectedSheet(initialRowData.sheetName || preSelectedSheet || '');
      setSelectedRecordType(newTemplate?.name || '');
      setFormData({ ...initialRowData });
      setIsEditing(!!initialRowData.docId);
      setView('editor');
      
      // Reset other states for the new record
      setIsViewingHistory(false);
      setSelectedHistoryDate(null);
      setIsHistoryModalOpen(false);
      setShowInputsMap({});
    }
  }, [initialRowData, recordTemplates, preSelectedSheet]);

  // Ensure typeOfObject is set for existing records that might be missing it
  useEffect(() => {
    if (isEditing && formData.typeOfRecord && !formData.typeOfObject) {
      const template = recordTemplates?.find((t) => t.name === formData.typeOfRecord);
      if (template?.objectId && templateObjects) {
        const object = templateObjects.find(e => e.id === template.objectId);
        if (object) {
          setFormData(prev => ({
            ...prev,
            typeOfObject: object.name
          }));
        }
      }
    }
  }, [isEditing, formData.typeOfRecord, formData.typeOfObject, recordTemplates, templateObjects]);

  const handleSelectionNext = useCallback(() => {
    if (!selectedSheet) {
      alert('Please select a sheet.');
      return;
    }
    if (!selectedRecordType) {
      alert('Please select a record type.');
      return;
    }
    const template = recordTemplates?.find((t) => t.name === selectedRecordType);
    if (!template) {
      alert('Invalid record type selected.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      sheetName: selectedSheet,
      typeOfRecord: template.name,
      typeOfObject: (() => {
        // Find the object for this template to set typeOfObject
        if (template.objectId && templateObjects) {
          const object = templateObjects.find(e => e.id === template.objectId);
          return object ? object.name : '';
        }
        return '';
      })(),
    }));
    setView('editor');
  }, [selectedSheet, selectedRecordType, recordTemplates]);

  const handleClose = useCallback(() => {
    setIsViewingHistory(false);
    setSelectedHistoryDate(null);
    setIsHistoryModalOpen(false);
    onClose();
  }, [onClose]);

  const handleInputChange = useCallback(
    (key, value, fieldType, extra) => {
      if (key === 'docId' || key === 'typeOfRecord' || key === 'typeOfObject') {
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
            if (value && typeof value === 'string') {
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
              }
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

  // Get available pipelines for current record type (filter out already used ones)
  const getAvailablePipelines = useCallback(() => {
    // Use formData.typeOfRecord first (for pipeline conversions), then fall back to other sources
    const templateName = formData.typeOfRecord || (isEditing ? initialRowData?.typeOfRecord : selectedRecordType);
    const currentTemplate = recordTemplates?.find((t) => t.name === templateName);
    
    if (!currentTemplate || !templateObjects) {
      return [];
    }
    
    // Find the object that contains this template
    const object = templateObjects.find(e => e.id === currentTemplate.objectId);
    const allPipelines = object?.pipelines || [];
    
    // Filter pipelines that have this template as source
    const sourcePipelines = allPipelines.filter(pipeline => 
      pipeline.sourceTemplateId === currentTemplate.docId
    );
    
    // Filter out pipelines that have already been used for this record
    const usedPipelineIds = formData.usedPipelines || [];
    return sourcePipelines.filter(pipeline => !usedPipelineIds.includes(pipeline.id));
  }, [recordTemplates, templateObjects, isEditing, initialRowData, selectedRecordType, formData.usedPipelines, formData.typeOfRecord]);

  // Execute pipeline to convert record to another type
  const executePipeline = useCallback((pipeline) => {
    if (!pipeline || !formData.linkId) {
      alert('Unable to execute pipeline: missing required data.');
      return;
    }

    const targetTemplate = recordTemplates?.find((t) => t.docId === pipeline.targetTemplateId);
    if (!targetTemplate) {
      alert('Target template not found.');
      return;
    }

    // Create new record data with mapped fields
    const newRecordData = {
      linkId: formData.linkId, // Keep the same linkId to maintain connection
      typeOfRecord: targetTemplate.name, // Use template name for consistency
      typeOfObject: (() => {
        // Find the object for target template to set typeOfObject
        if (targetTemplate.objectId && templateObjects) {
          const object = templateObjects.find(e => e.id === targetTemplate.objectId);
          return object ? object.name : '';
        }
        return '';
      })(),
      assignedTo: formData.assignedTo || user?.email || '', // Always carry over assignedTo with fallback
      history: [], // Start fresh history for new record type
      isModified: true,
      action: 'add',
    };

    // Apply field mappings from the pipeline
    if (pipeline.fieldMappings && Array.isArray(pipeline.fieldMappings)) {
      pipeline.fieldMappings.forEach(mapping => {
        if (mapping.source && mapping.target && formData[mapping.source] !== undefined) {
          newRecordData[mapping.target] = formData[mapping.source];
        }
      });
    }

    // Confirm the conversion
    if (window.confirm(`Convert this ${formData.typeOfRecord} to ${targetTemplate.name}? This will save the current record and open the new record for immediate editing.`)) {
      // Mark this pipeline as used in the current record
      const updatedUsedPipelines = [...(formData.usedPipelines || []), pipeline.id];
      const updatedFormData = {
        ...formData,
        usedPipelines: updatedUsedPipelines,
        isModified: true,
        action: 'update'
      };
      
      // Save the updated source record first (to mark pipeline as used)
      onSave(updatedFormData, true);
      
      // Then create and open the new target record for immediate editing
      if (onOpenNewRecord) {
        onOpenNewRecord(newRecordData);
      } else {
        // Fallback: create the record and close editor
        onSave(newRecordData, false);
        alert(`Successfully created ${targetTemplate.name} record with Link ID: ${formData.linkId}`);
        onClose();
      }
    }
  }, [formData, recordTemplates, onSave, onClose, onOpenNewRecord, user]);

  const handleSave = useCallback(() => {
    if (!selectedSheet) {
      alert('No sheet selected.');
      return;
    }
    const template = recordTemplates?.find((t) => t.name === (isEditing ? initialRowData?.typeOfRecord : selectedRecordType));
    if (!template) {
      alert('Invalid record type selected.');
      return;
    }
    const hasData = Object.keys(formData).some(
      (key) => key !== 'sheetName' && key !== 'typeOfRecord' && key !== 'typeOfObject' && key !== 'docId' && formData[key] && formData[key].toString().trim() !== ''
    );
    if (!isEditing && !hasData && !isViewingHistory) {
      alert('Please fill in at least one field to create a record.');
      return;
    }

    let newRow = {
      ...formData,
      docId: isEditing && initialRowData?.docId ? initialRowData.docId : formData.docId,
      linkId: isEditing && initialRowData?.linkId ? initialRowData.linkId : (formData.linkId || `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
      typeOfRecord: isEditing ? initialRowData?.typeOfRecord : template.name,
      typeOfObject: (() => {
        // Find the object for this template to set typeOfObject
        if (template.objectId && templateObjects) {
          const object = templateObjects.find(e => e.id === template.objectId);
          return object ? object.name : '';
        }
        return formData.typeOfObject || '';
      })(),
      assignedTo: formData.assignedTo || user?.email || '',
      history: formData.history || [],
      isModified: true,
      action: isEditing ? 'update' : 'add',
    };

    const requiredFields = ['docId', 'linkId', 'typeOfRecord', 'typeOfObject', 'history', 'isModified', 'action'];
    Object.keys(newRow).forEach((key) => {
      if (!requiredFields.includes(key) && (newRow[key] === null || newRow[key] === undefined || newRow[key] === '')) {
        delete newRow[key];
      }
    });

    const newHistory = [];
    const timestamp = Timestamp.now();

    if (isViewingHistory && selectedHistoryDate) {
      const existingRecord = records.find((record) => record.docId === initialRowData.docId);
      Object.keys(historicalFormData).forEach((key) => {
        if (
          key !== 'docId' &&
          key !== 'sheetName' &&
          key !== 'typeOfRecord' &&
          key !== 'history' &&
          historicalFormData[key] !== existingRecord[key]
        ) {
          newHistory.push({
            field: key,
            value: historicalFormData[key] || '',
            timestamp,
            modifiedBy: user?.uid,
          });
        }
      });
      newRow.history = [...newRow.history, ...newHistory];
      Object.keys(historicalFormData).forEach((key) => {
        newRow[key] = historicalFormData[key];
      });
    } else if (isEditing) {
      const existingRecord = records.find((record) => record.docId === initialRowData.docId);
      if (existingRecord) {
        Object.keys(formData).forEach((key) => {
          if (
            key !== 'docId' &&
            key !== 'sheetName' &&
            key !== 'typeOfRecord' &&
            key !== 'history' &&
            formData[key] !== existingRecord[key]
          ) {
            newHistory.push({
              field: key,
              value: formData[key] || '',
              timestamp,
              modifiedBy: user?.uid,
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
          key !== 'typeOfRecord' &&
          key !== 'history' &&
          formData[key] &&
          formData[key].toString().trim() !== ''
        ) {
          newHistory.push({
            field: key,
            value: formData[key],
            timestamp,
            modifiedBy: user?.uid,
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
    selectedRecordType,
    onSave,
    recordTemplates,
    initialRowData,
    isEditing,
    isViewingHistory,
    selectedHistoryDate,
    onClose,
    records,
  ]);

  const handleDelete = useCallback(() => {
    if (!isEditing || !initialRowData?.docId) {
      alert('No record to delete.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this record? This action will remove it from all sheets.')) {
      setRecords((prev) =>
        prev.map((record) =>
          record.docId === initialRowData.docId
            ? { ...record, isModified: true, action: 'remove' }
            : record
        )
      );
      onClose();
    }
  }, [isEditing, initialRowData, setRecords, onClose]);

  const toggleSection = useCallback((sectionName) => {
    setOpenSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((name) => name !== sectionName)
        : [...prev, sectionName]
    );
  }, []);

  const handleViewHistory = useCallback(() => {
    if (!formData.history || formData.history.length === 0) {
      alert('No history available for this record.');
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

  const HistoryModal = () => {
    const formattedHistory = getFormattedHistory(formData, user, teamMembers);
    const recordCreator = getRecordCreator(formData, user, teamMembers);
    const lastModifier = getLastModifier(formData, user, teamMembers);
    
    return (
      <div className={`${styles.historyModal} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <div className={styles.historyModalContent}>
          <h2>Record History</h2>
          
          {/* Record Summary */}
          <div className={`${styles.historySummary} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <div className={styles.historyInfo}>
              <strong>Created by:</strong> {recordCreator.name}
              {recordCreator.timestamp && (
                <span className={styles.historyTimestamp}>
                  {' '}on {formatFirestoreTimestamp(recordCreator.timestamp)}
                </span>
              )}
            </div>
            {lastModifier.timestamp && (
              <div className={styles.historyInfo}>
                <strong>Last modified by:</strong> {lastModifier.name}
                <span className={styles.historyTimestamp}>
                  {' '}on {formatFirestoreTimestamp(lastModifier.timestamp)}
                </span>
              </div>
            )}
          </div>

          {/* History Timeline */}
          {formattedHistory.length > 0 ? (
            <div className={styles.historyTimeline}>
              <h3>Change History</h3>
              <ul className={styles.historyList}>
                {formattedHistory.map((entry, index) => (
                  <li
                    key={`${entry.timestamp?._seconds || index}-${entry.field}`}
                    className={`${styles.historyItem} ${styles.detailedHistoryItem}`}
                  >
                    <div className={styles.historyEntry}>
                      <div className={styles.historyEntryMain}>
                        <span className={styles.historyField}>
                          {formatFieldName(entry.field)}
                        </span>
                        <span className={styles.historyValue}>
                          "{entry.value || '(empty)'}"
                        </span>
                      </div>
                      <div className={styles.historyEntryMeta}>
                        <span className={styles.historyUser}>
                          {getTeamMemberName(entry.modifiedBy)}
                        </span>
                        <span className={styles.historyTimestamp}>
                          {formatFirestoreTimestamp(entry.timestamp)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Allow viewing record state at this point in time */}
                    <button
                      className={`${styles.viewAtTimeButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => handleHistoryDateSelect({
                        _seconds: entry.timestamp._seconds,
                        _nanoseconds: entry.timestamp._nanoseconds,
                        date: formatFirestoreTimestamp(entry.timestamp)
                      })}
                      title="View record as it was at this time"
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>No history entries available.</p>
          )}

          <div className={styles.historyModalButtons}>
            <button
              className={`${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={handleCancelHistory}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

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
              {isEditing ? (isViewingHistory ? 'View Record History' : 'Edit Record') : view === 'selection' ? 'Create a New Record' : 'New Record'}
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
                      Record Type
                    </span>
                    <select
                      value={selectedRecordType}
                      onChange={(e) => setSelectedRecordType(e.target.value)}
                      className={`${styles.fieldSelect} ${styles.recordTypeSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                      aria-label="Select a record type"
                    >
                      <option value="">Select a record type</option>
                      {recordTypeOptions.map((type) => (
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
                        <span className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>{section.name}</span>
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
                        <div className={styles.fieldGrid}>
                          {section.fields.length > 0 ? (
                            section.fields.map((field) => (
                              <div key={field.key} className={`${styles.fieldItem} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                <div className={styles.fieldHeader}>
                                  <span className={`${styles.fieldLabel} ${isDarkTheme ? styles.darkTheme : ''}`}>{field.name}</span>
                                  {field.type === 'date' && (() => {
                                    const dateValue = formatDateForInput(historicalFormData[field.key]);
                                    const timeValue = formatTimeForInput(historicalFormData[field.key]);
                                    return (!isViewingHistory && (dateValue || timeValue)) ? (
                                      <button
                                        type="button"
                                        aria-label="Clear date and time"
                                        className={styles.clearButton}
                                        onClick={() => {
                                          setFormData(prev => ({ ...prev, [field.key]: '' }));
                                          setShowInputsMap(prev => ({ ...prev, [field.key]: false }));
                                        }}
                                      >
                                        Clear
                                      </button>
                                    ) : null;
                                  })()}
                                </div>
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
                                    <div className={styles.dateTimeWrapper}>
                                      <div className={`${styles.dateTimeContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                        <input
                                          type="date"
                                          value={dateValue}
                                          onChange={e => handleInputChange(
                                            field.key,
                                            e.target.value,
                                            field.type,
                                            { type: 'date', timeValue: timeValue }
                                          )}
                                          className={`${styles.fieldInput} ${styles.dateInput} ${isDarkTheme ? styles.darkTheme : ''} ${isViewingHistory ? styles.readOnly : ''}`}
                                          placeholder={`Enter ${field.name}`}
                                          aria-label={`Enter ${field.name} date`}
                                          readOnly={isViewingHistory}
                                          disabled={field.key === 'typeOfRecord' || field.key === 'typeOfObject' || field.key === 'docId' || field.key === 'linkId' || field.key === 'id'}
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
                                          className={`${styles.fieldInput} ${styles.timeInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                                          aria-label={`Enter ${field.name} time`}
                                          readOnly={isViewingHistory}
                                          disabled={isViewingHistory || field.key === 'typeOfRecord' || field.key === 'typeOfObject' || field.key === 'docId' || field.key === 'linkId' || field.key === 'id'}
                                        />
                                      </div>
                                    </div>
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
                                  readOnly={isViewingHistory || field.key === 'assignedTo' || field.key === 'typeOfObject'}
                                  disabled={field.key === 'typeOfRecord' || field.key === 'typeOfObject' || field.key === 'docId' || field.key === 'linkId' || field.key === 'id'}
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
                    </div>
                  ))
                ) : (
                  <p className={`${styles.emptySection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    No sections defined for this record type.
                  </p>
                )}
                
                {/* Record Info Section for existing records */}
                {isEditing && formData.history && formData.history.length > 0 && (
                  <div className={`${styles.recordInfoSection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    <div className={styles.recordInfoHeader}>
                      <h3>Record Information</h3>
                    </div>
                    <div className={styles.recordInfoContent}>
                      {(() => {
                        const creator = getRecordCreator(formData, user, teamMembers);
                        const lastModifier = getLastModifier(formData, user, teamMembers);
                        return (
                          <>
                            <div className={styles.recordInfoItem}>
                              <span className={styles.recordInfoLabel}>Created by:</span>
                              <span className={styles.recordInfoValue}>
                                {creator.name}
                                {creator.timestamp && (
                                  <span className={styles.recordInfoTimestamp}>
                                    {' '}on {formatFirestoreTimestamp(creator.timestamp)}
                                  </span>
                                )}
                              </span>
                            </div>
                            {lastModifier.timestamp && creator.timestamp !== lastModifier.timestamp && (
                              <div className={styles.recordInfoItem}>
                                <span className={styles.recordInfoLabel}>Last modified by:</span>
                                <span className={styles.recordInfoValue}>
                                  {lastModifier.name}
                                  <span className={styles.recordInfoTimestamp}>
                                    {' '}on {formatFirestoreTimestamp(lastModifier.timestamp)}
                                  </span>
                                </span>
                              </div>
                            )}
                            <div className={styles.recordInfoItem}>
                              <span className={styles.recordInfoLabel}>Total changes:</span>
                              <span className={styles.recordInfoValue}>
                                {formData.history.length} modification{formData.history.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                
                {/* Pipeline Section - Only show for saved records with docId */}
                {view === 'editor' && formData.docId && isEditing && formData.linkId && (() => {
                  const availablePipelines = getAvailablePipelines();
                  return availablePipelines.length > 0 && (
                    <div className={`${styles.pipelineSection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      <div className={styles.sectionWrapper}>
                        <div className={styles.sectionHeader}>
                          <h3>Available Conversions</h3>
                          <p>Convert this record to another type using predefined pipelines</p>
                        </div>
                        <div className={styles.pipelineList}>
                          {availablePipelines.map((pipeline) => (
                            <div key={pipeline.id} className={`${styles.pipelineRecord} ${isDarkTheme ? styles.darkTheme : ''}`}>
                              <div className={`${styles.pipelineInfo} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                <h4>{pipeline.name}</h4>
                                <p>Convert to {pipeline.targetTemplate}</p>
                                <div className={styles.mappingPreview}>
                                  {pipeline.fieldMappings.slice(0, 2).map((mapping, index) => (
                                    <span key={index} className={`${styles.mappingItem} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                      {mapping.source} → {mapping.target}
                                    </span>
                                  ))}
                                  {pipeline.fieldMappings.length > 2 && (
                                    <span className={`${styles.mappingMore} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                      +{pipeline.fieldMappings.length - 2} more
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => executePipeline(pipeline)}
                                className={`${styles.pipelineButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                              >
                                Convert
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
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
                        aria-label="Delete record"
                      >
                        Delete Record
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
});

RecordsEditor.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onOpenNewRecord: PropTypes.func, // Optional callback for opening new records
  initialRowData: PropTypes.shape({
    docId: PropTypes.string,
    sheetName: PropTypes.string,
    typeOfRecord: PropTypes.string,
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

RecordsEditor.defaultProps = {
  startInEditMode: false,
  onOpenNewRecord: null,
};

export default RecordsEditor;

// .customTimePicker .react-time-picker__wrapper { border: none !important; box-shadow: none !important; background: transparent !important; }
// .customTimePicker .react-time-picker__inputGroup { border: none !important; background: transparent !important; }
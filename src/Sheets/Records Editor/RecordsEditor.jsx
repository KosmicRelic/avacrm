import { useContext, useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import styles from './RecordsEditor.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { Timestamp, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatFirestoreTimestamp } from '../../Utils/firestoreUtils';
import { getFormattedHistory, getRecordCreator, getLastModifier, formatFieldName, formatDateForInput, formatTimeForInput, parseLocalDate } from '../../Utils/assignedToUtils';
import { validateField, getAllCountryCodes } from '../../Utils/fieldValidation';
import { IoMdArrowDropdown } from 'react-icons/io';
import { MdHistory, MdDelete, MdLink } from 'react-icons/md';
import { FaLayerGroup } from 'react-icons/fa';

// Debug logging utility - Global function
const addDebugLog = (message) => {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  if (typeof window !== 'undefined') {
    if (!window.debugLogs) {
      window.debugLogs = [];
    }
    window.debugLogs.push(logEntry);
  }
  console.log(logEntry);
};

const RecordsEditor = memo(({
  onClose,
  onSave,
  onOpenNewRecord, // New prop for opening a new record after pipeline execution
  onNavigateToRelatedRecord, // New prop for navigating to related records with parent context
  initialRowData,
  startInEditMode,
  preSelectedSheet,
  parentObjectData, // Parent object data for breadcrumbs when viewing records
  isObjectMode: propIsObjectMode,
  isCreatingObject, // Loading state for object creation from parent
}) => {
  // Clear old debug logs when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.debugLogs = [];
    }
  }, []);

  // Log what data we receive
  useEffect(() => {
    console.log('🎨 [RecordsEditor] Mounted/Updated with initialRowData:', {
      docId: initialRowData?.docId,
      typeOfRecord: initialRowData?.typeOfRecord,
      typeOfObject: initialRowData?.typeOfObject,
      isObject: initialRowData?.isObject,
      fullData: initialRowData
    });
  }, [initialRowData]);

  const { sheets, recordTemplates, templateObjects, isDarkTheme, records, setRecords, objects, setObjects, teamMembers, user, businessId, setTemplateObjects: _contextSetTemplateObjects } = useContext(MainContext);
  const [view, setView] = useState(startInEditMode ? 'editor' : 'objectTypeSelection'); // 'objectTypeSelection' -> 'editor'
  
  // Determine if we're in object mode based on the initialRowData
  // An item is an object if it has isObject flag OR if it has a typeOfObject but no typeOfRecord (child record)
  const initialIsObjectMode = initialRowData?.isObject === true || 
                              (initialRowData?.typeOfObject && !initialRowData?.typeOfRecord);
  const [isObjectMode, setIsObjectMode] = useState(initialIsObjectMode);
  
  const [selectedSheet, setSelectedSheet] = useState(initialRowData?.sheetName || preSelectedSheet || '');
  const initialTemplate = initialRowData?.typeOfRecord
    ? recordTemplates?.find((t) => t.name === initialRowData.typeOfRecord)
    : null;
  const [selectedRecordType, setSelectedRecordType] = useState(initialTemplate?.name || '');
  const [formData, setFormData] = useState(initialRowData ? { ...initialRowData } : {});
  const [isEditing, setIsEditing] = useState(!!initialRowData && !!initialRowData.docId);
  const [openSections, setOpenSections] = useState([]);
  const [hasUserToggledSections, setHasUserToggledSections] = useState(false);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [fieldHistoryPopup, setFieldHistoryPopup] = useState({ isOpen: false, field: null, position: null });
  const [relatedRecords, setRelatedRecords] = useState([]);
  const [expandedSections, setExpandedSections] = useState({ relatedRecords: true });
  const [viewingRelatedRecord, setViewingRelatedRecord] = useState(null);
  const [originalObjectData, setOriginalObjectData] = useState(null);
  const [originalRecordType, setOriginalRecordType] = useState(null);
  const [originalIsObjectMode, setOriginalIsObjectMode] = useState(null);
  const [baseDataForComparison, setBaseDataForComparison] = useState(initialRowData ? { ...initialRowData } : {});

  // Track whether there are unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Validation state
  const [fieldErrors, setFieldErrors] = useState({});

  // --- FIX: Manage showInputs state for each date field at the top level ---
  const [showInputsMap, setShowInputsMap] = useState({});

  // Ref to prevent double-saves
  const isSavingRef = useRef(false);

  // Update isObjectMode when initialRowData changes (e.g., navigating between records/objects)
  useEffect(() => {
    if (initialRowData) {
      const shouldBeObjectMode = initialRowData.isObject === true || 
                                 (initialRowData.typeOfObject && !initialRowData.typeOfRecord);
      console.log('🔄 [RecordsEditor] Updating isObjectMode:', {
        currentMode: isObjectMode,
        shouldBe: shouldBeObjectMode,
        hasIsObject: initialRowData.isObject,
        hasTypeOfObject: !!initialRowData.typeOfObject,
        hasTypeOfRecord: !!initialRowData.typeOfRecord
      });
      setIsObjectMode(shouldBeObjectMode);
    }
  }, [initialRowData?.docId]); // Only run when the docId changes (different record/object)

  // Add useEffect to fetch related records when viewing an object
  useEffect(() => {
    if (view === 'editor' && isObjectMode && formData.linkId && businessId) {
      const unsubscribe = onSnapshot(
        query(
          collection(db, 'businesses', businessId, 'records'),
          where('linkId', '==', formData.linkId)
        ),
        (snapshot) => {
          const records = snapshot.docs.map(doc => ({ 
            docId: doc.id, 
            ...doc.data() 
          }));
          setRelatedRecords(records);
        },
        (error) => {
          console.error('Error fetching related records:', error);
          setRelatedRecords([]);
        }
      );
      return () => unsubscribe();
    } else {
      setRelatedRecords([]);
    }
  }, [view, isObjectMode, formData.linkId, businessId]);

  // Handler to navigate to a related record
  const handleViewRelatedRecord = useCallback((record) => {
    console.log('🔍 handleViewRelatedRecord called:', {
      record: record,
      formData: formData,
      hasCallback: !!onNavigateToRelatedRecord,
      hasFormDataDocId: !!formData?.docId,
      hasRecordDocId: !!record?.docId
    });
    
    // Store the original object data before switching
    if (!viewingRelatedRecord) {
      setOriginalObjectData(formData);
      setOriginalRecordType(selectedRecordType);
      setOriginalIsObjectMode(isObjectMode);
    }
    
    // If we have a navigation callback and both object and record have docIds, use URL navigation
    if (onNavigateToRelatedRecord && formData?.docId && record?.docId) {
      console.log('✅ Calling navigation callback');
      onNavigateToRelatedRecord(record, formData);
    } else {
      console.log('⚠️ Using fallback navigation');
      // Fallback to in-component navigation (old behavior)
      // Switch to viewing the related record
      setViewingRelatedRecord(record);
      setFormData(record);
      setBaseDataForComparison({ ...record }); // Set base data for change detection
      setSelectedRecordType(record.typeOfRecord);
      setIsObjectMode(false);
      setIsEditing(true);
      
      // Collapse the related records section
      setExpandedSections({ relatedRecords: false });
    }
  }, [viewingRelatedRecord, formData, selectedRecordType, isObjectMode, onNavigateToRelatedRecord]);

  // Handler to go back to the original object
  const handleBackToObject = useCallback(() => {
    const targetObject = originalObjectData || parentObjectData;
    
    if (targetObject && targetObject.docId) {
      // Use the navigation callback to navigate to the object URL
      // Pass the object as both parameters to trigger object-only navigation
      if (onNavigateToRelatedRecord) {
        console.log('🔄 Navigating back to object via URL:', targetObject);
        onNavigateToRelatedRecord(targetObject, targetObject); // Both params same = navigate to object URL
      } else {
        // Fallback: restore object data in current editor
        console.log('⚠️ No navigation callback, restoring object data locally');
        setFormData(targetObject);
        setBaseDataForComparison({ ...targetObject });
        setSelectedRecordType(originalRecordType || null);
        setIsObjectMode(true);
        setIsEditing(!!targetObject.docId);
        setViewingRelatedRecord(null);
        setExpandedSections({ relatedRecords: true });
      }
    } else {
      console.log('❌ No object data found for navigation!');
    }
  }, [originalObjectData, parentObjectData, originalRecordType, onNavigateToRelatedRecord]);

  // Render breadcrumbs for navigation
  const renderBreadcrumbs = () => {
    const breadcrumbs = [];

    // When viewing a record (either via navigation or direct URL), show Object > Record Type
    if (!isObjectMode && isEditing && formData.typeOfRecord) {
      // Try to get parent object info from parentObjectData prop, originalObjectData, or from context
      const parentObject = parentObjectData || originalObjectData;
      if (parentObject && parentObject.typeOfObject) {
        breadcrumbs.push({
          label: parentObject.typeOfObject,
          type: 'Object',
          onClick: handleBackToObject
        });
      }
      breadcrumbs.push({
        label: formData.typeOfRecord,
        type: 'Record',
        onClick: null // Current page, no click
      });
    }
    // When viewing an object, just show the object name (no navigation needed)
    else if (isObjectMode && isEditing && formData.typeOfObject) {
      breadcrumbs.push({
        label: formData.typeOfObject,
        type: 'Object',
        onClick: null // Current page, no click
      });
    }

    if (breadcrumbs.length === 0) return null;

    return (
      <div className={`${styles.breadcrumbs} ${isDarkTheme ? styles.darkTheme : ''}`}>
        {breadcrumbs.map((crumb, index) => (
          <div key={index} className={styles.breadcrumbItem}>
            {index > 0 && (
              <svg
                className={styles.breadcrumbChevron}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.5 9L7.5 6L4.5 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <button
              onClick={crumb.onClick}
              className={`${styles.breadcrumbButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              disabled={!crumb.onClick} // Disable if no onClick (current page)
            >
              <div className={styles.breadcrumbLabel}>
                {crumb.label}
              </div>
              {crumb.type && (
                <div className={`${styles.breadcrumbType} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {crumb.type}
                </div>
              )}
            </button>
          </div>
        ))}
      </div>
    );
  };

  const selectedSections = useMemo(() => {
    if (isObjectMode) {
      // Object mode: use basicFields from the selected object
      const objectName = formData.typeOfObject || (isEditing ? initialRowData?.typeOfObject : selectedRecordType);
      const object = templateObjects?.find((o) => o.name === objectName);
      
      if (!object || !object.basicFields) {
        return [];
      }

      const basicFieldsSection = {
        name: 'Basic Information',
        fields: object.basicFields.map(field => ({
          key: field.key,
          name: field.name,
          type: field.type,
          options: field.options || [],
        })),
      };
      return [basicFieldsSection];
    } else {
      // Record mode: existing logic
      const templateName = formData.typeOfRecord || (isEditing ? initialRowData?.typeOfRecord : selectedRecordType);
      const template = recordTemplates?.find((t) => t.name === templateName);
      
      if (!template || !template.sections) {
        return [];
      }

      const templateSections = template.sections.map((section) => ({
        name: section.name,
        fields: section.keys
          .map((key) => {
            const header = template.headers?.find((h) => h.key === key);
            return {
              key,
              name: header?.name || formatFieldName(key),
              type: header?.type === 'picklist' ? 'dropdown' : (header?.type || 'text'),
              options: header?.options || [],
            };
          }),
      }));

      return templateSections;
    }
  }, [isObjectMode, selectedRecordType, recordTemplates, templateObjects, isEditing, initialRowData, formData.typeOfRecord, formData.typeOfObject]);

  // Ensure formData has all required fields properly initialized
  useEffect(() => {
    if (!isEditing && selectedRecordType && !formData.linkId) {
      if (isObjectMode) {
        // Object mode: selectedRecordType is the object name
        setFormData(prev => ({
          ...prev,
          linkId: `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          assignedTo: prev.assignedTo || user?.email || '',
          typeOfObject: selectedRecordType,
        }));
      } else {
        // Record mode: existing logic
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
    }
  }, [isObjectMode, selectedRecordType, isEditing, formData.linkId, user?.email, recordTemplates, templateObjects]);

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
    // Return all available record template names, not just sheet-configured ones
    return recordTemplates?.map(template => template.name) || [];
  }, [recordTemplates]);

  // Filter templateObjects based on current sheet compatibility
  const filteredTemplateObjects = useMemo(() => {
    if (!templateObjects || !preSelectedSheet || !sheets?.allSheets) return templateObjects || [];
    
    const currentSheet = sheets.allSheets.find(sheet => sheet.sheetName === preSelectedSheet);
    if (!currentSheet?.headers) return templateObjects || [];
    
    // Get sheet header keys
    const sheetHeaderKeys = currentSheet.headers.map(header => header.key);
    
    // Filter objects whose basicFields are compatible with the sheet
    return templateObjects.filter(obj => {
      if (!obj.basicFields) return false;
      
      // Check if all object fields can be mapped to sheet headers
      return obj.basicFields.every(field => 
        sheetHeaderKeys.includes(field.key) || 
        // Also allow if the field key matches common fields that might not be in headers
        ['docId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'linkId', 'sheetName', 'typeOfObject', 'typeOfRecord'].includes(field.key)
      );
    });
  }, [templateObjects, preSelectedSheet, sheets?.allSheets]);

  // Helper to get display name from uid
  const getTeamMemberName = (uid) => {
    if (!uid) return '';
    if (uid === user?.uid) return user?.name && user?.surname ? `${user.name} ${user.surname}` : user?.email || 'Me';
    const member = teamMembers?.find((tm) => tm.uid === uid);
    return member ? `${member.name || ''} ${member.surname || ''}`.trim() : uid;
  };

  useEffect(() => {
    if (view === 'editor' && selectedSections.length > 0 && openSections.length === 0 && !hasUserToggledSections) {
      setOpenSections([selectedSections[0].name]);
    }
  }, [view, selectedSections, openSections.length, hasUserToggledSections]);

  // Reset user toggled flag when switching views or record types
  useEffect(() => {
    setHasUserToggledSections(false);
  }, [view, selectedRecordType]);

  useEffect(() => {
    if (selectedSheet && !isEditing) {
      // No longer auto-select record type since we work with objects
      setSelectedRecordType('');
    }
  }, [selectedSheet, sheets, isEditing]);

  // Update component state when initialRowData changes (for pipeline conversions)
  useEffect(() => {
    if (initialRowData) {
      console.log('📝 Setting up for editing existing record/object:', initialRowData);
      const newTemplate = initialRowData.typeOfRecord
        ? recordTemplates?.find((t) => t.name === initialRowData.typeOfRecord)
        : null;
      
      setSelectedSheet(initialRowData.sheetName || preSelectedSheet || '');
      setSelectedRecordType(newTemplate?.name || '');
      setFormData({ ...initialRowData });
      setBaseDataForComparison({ ...initialRowData });
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

  // Detect unsaved changes
  useEffect(() => {
    // Skip if not in editor view
    if (view !== 'editor') {
      setHasUnsavedChanges(false);
      return;
    }

    // For new records/objects (not editing), check if any meaningful data has been entered
    if (!isEditing) {
      const hasData = Object.keys(formData).some(
        (key) => 
          key !== 'sheetName' && 
          key !== 'typeOfRecord' && 
          key !== 'typeOfObject' && 
          key !== 'docId' && 
          key !== 'linkId' &&
          key !== 'assignedTo' &&
          key !== 'history' &&
          key !== 'isModified' &&
          key !== 'action' &&
          key !== 'isObject' &&
          key !== 'records' &&
          formData[key] && 
          formData[key].toString().trim() !== ''
      );
      setHasUnsavedChanges(hasData);
      return;
    }

    // For existing records/objects, compare with baseDataForComparison
    if (!baseDataForComparison || Object.keys(baseDataForComparison).length === 0) {
      // If no base data, check if any meaningful data exists
      const hasData = Object.keys(formData).some(
        (key) => 
          key !== 'sheetName' && 
          key !== 'typeOfRecord' && 
          key !== 'typeOfObject' && 
          key !== 'docId' && 
          key !== 'linkId' &&
          key !== 'assignedTo' &&
          key !== 'history' &&
          key !== 'isModified' &&
          key !== 'action' &&
          key !== 'isObject' &&
          key !== 'records' &&
          formData[key] && 
          formData[key].toString().trim() !== ''
      );
      setHasUnsavedChanges(hasData);
      return;
    }

    // Compare current formData with baseDataForComparison to detect changes
    const normalizeValue = (value) => {
      if (value === null || value === undefined) return '';
      return String(value).trim();
    };

    const hasChanges = Object.keys(formData).some((key) => {
      if (
        key !== 'docId' &&
        key !== 'sheetName' &&
        key !== 'typeOfRecord' &&
        key !== 'typeOfObject' &&
        key !== 'history' &&
        key !== 'isModified' &&
        key !== 'action' &&
        key !== 'isObject' &&
        key !== 'records' &&
        key !== 'linkId'
      ) {
        const formValue = normalizeValue(formData[key]);
        const baseValue = normalizeValue(baseDataForComparison[key]);
        const isDifferent = formValue !== baseValue;
        return isDifferent;
      }
      return false;
    }) || Object.keys(baseDataForComparison).some((key) => {
      if (
        key !== 'docId' &&
        key !== 'sheetName' &&
        key !== 'typeOfRecord' &&
        key !== 'typeOfObject' &&
        key !== 'history' &&
        key !== 'isModified' &&
        key !== 'action' &&
        key !== 'isObject' &&
        key !== 'records' &&
        key !== 'linkId' &&
        !(key in formData)
      ) {
        const baseValue = normalizeValue(baseDataForComparison[key]);
        const isDifferent = baseValue !== '';
        return isDifferent;
      }
      return false;
    });

    setHasUnsavedChanges(hasChanges);
  }, [formData, baseDataForComparison, isEditing, view, isObjectMode]);

  const handleSelectionNext = useCallback(() => {
    // From object type selection to editor
    if (!selectedRecordType) {
      alert('Please select an object type.');
      return;
    }
    
    const object = templateObjects?.find((o) => o.name === selectedRecordType);
    if (!object) {
      alert('Invalid object type selected.');
      return;
    }
    
    if (!object.basicFields || object.basicFields.length === 0) {
      alert('This object type has no basic fields defined. Please define basic fields for this object in the Data Models section.');
      return;
    }
    
    const newObjectId = `object_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setFormData((prev) => ({
      ...prev,
      docId: newObjectId,
      linkId: newObjectId, // For objects, linkId is the same as docId
      typeOfObject: object.name,
      isObject: true,
      action: 'add',
      isModified: true,
    }));
    setIsObjectMode(true); // Switch to object mode when creating a new object
    setView('editor');
  }, [selectedRecordType, templateObjects]);

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

        // Validate the field
        const validation = validateField(fieldType, value);
        setFieldErrors(prev => ({
          ...prev,
          [key]: validation.isValid ? null : validation.error
        }));

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
        setFormData((prev) => {
          const newFormData = { ...prev, [key]: formattedValue };
          return newFormData;
        });
      }
    },
    [isViewingHistory]
  );

  // Helper functions for phone number handling
  const detectCountryFromPhoneNumber = (phoneNumber) => {
    if (!phoneNumber || typeof phoneNumber !== 'string') return '+1';

    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, '');

    // Greek phone number patterns
    if (digits.length === 10) {
      // Greek mobile numbers start with 69
      if (digits.startsWith('69')) {
        return '+30';
      }
      // Greek landline numbers start with area codes (2x)
      if (digits.startsWith('2')) {
        return '+30';
      }
    }

    // Add more country detection logic here as needed
    // For now, default to US
    return '+1';
  };

  const getCountryCode = (phoneValue) => {
    if (!phoneValue || typeof phoneValue !== 'string') return '+1';
    if (phoneValue.startsWith('+')) {
      // Extract country code
      const match = phoneValue.match(/^(\+\d+)/);
      return match ? match[1] : '+1';
    }
    // Try to detect country from phone number pattern
    return detectCountryFromPhoneNumber(phoneValue);
  };

  const getPhoneNumber = (phoneValue) => {
    if (!phoneValue || typeof phoneValue !== 'string') return '';
    if (phoneValue.startsWith('+')) {
      // Remove country code
      const parts = phoneValue.split(' ');
      return parts.slice(1).join(' ') || '';
    }
    return phoneValue;
  };

  const handleCountryCodeChange = useCallback((key, countryCode, currentPhone) => {
    const phoneNumber = getPhoneNumber(currentPhone);
    const newValue = phoneNumber ? `${countryCode} ${phoneNumber}` : countryCode;
    handleInputChange(key, newValue, 'phone');
  }, [handleInputChange]);

  const handlePhoneNumberChange = useCallback((key, countryCode, phoneNumber) => {
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    const newValue = cleanedNumber ? `${countryCode} ${cleanedNumber}` : '';
    handleInputChange(key, newValue, 'phone');
  }, [handleInputChange]);

  // Get available pipelines for current record type (filter out already used ones)
  const getAvailablePipelines = useCallback(() => {
    // Use formData.typeOfRecord first (for pipeline conversions), then fall back to other sources
    const templateName = formData.typeOfRecord || (isEditing ? initialRowData?.typeOfRecord : selectedRecordType);
    const currentTemplate = recordTemplates?.find((t) => t.docId === templateName);
    
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

  // Get available templates in the same category/object for creating new linked records
  const getAvailableTemplatesInCategory = useCallback(() => {
    if (!formData.linkId || !formData.typeOfObject) return [];
    
    // Find the current object
    const currentObject = templateObjects?.find(obj => obj.name === formData.typeOfObject);
    if (!currentObject) return [];
    
    // Get all templates from this object, excluding the current one
    const currentTemplateName = formData.typeOfRecord || (isEditing ? initialRowData?.typeOfRecord : selectedRecordType);
    return (currentObject.templates || []).filter(template => 
      template.name !== currentTemplateName
    );
  }, [templateObjects, formData.linkId, formData.typeOfObject, formData.typeOfRecord, isEditing, initialRowData, selectedRecordType]);

  // Create a new record with the same linkId but different template
  const createLinkedRecord = useCallback((targetTemplate) => {
    if (!targetTemplate || !formData.linkId) {
      alert('Unable to create linked record: missing required data.');
      return;
    }

    const newRecordData = {
      docId: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      linkId: formData.linkId,
      typeOfRecord: targetTemplate.name,
      typeOfObject: formData.typeOfObject,
      assignedTo: formData.assignedTo || user?.email || '',
      sheetName: selectedSheet || preSelectedSheet,
      action: 'add',
      isModified: true,
      history: [],
    };

    // Close current editor and open new one
    if (onOpenNewRecord) {
      onClose(); // Close current editor first
      onOpenNewRecord(newRecordData);
    } else {
      // Fallback: reset current editor to create new record
      setView('editor');
      setSelectedRecordType(targetTemplate.name);
      setIsEditing(false);
      setFormData(newRecordData);
    }
  }, [formData, user?.email, onOpenNewRecord, onClose, selectedSheet, preSelectedSheet]);



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
  }, [formData, recordTemplates, templateObjects, onSave, onClose, onOpenNewRecord, user]);

  const handleSave = useCallback(async () => {
    // Prevent double-saves
    if (isSavingRef.current) {
      return;
    }
    
    isSavingRef.current = true;
    
    if (!selectedSheet && !isObjectMode) {
      alert('No sheet selected.');
      isSavingRef.current = false;
      return;
    }
    
    const templateName = isEditing ? (formData.typeOfRecord || initialRowData?.typeOfRecord) : selectedRecordType;
    const template = isObjectMode ? null : recordTemplates?.find((t) => t.name === templateName);
    
    if (!isObjectMode && !template) {
      alert('Invalid record type selected.');
      isSavingRef.current = false;
      return;
    }
    const hasData = Object.keys(formData).some(
      (key) => key !== 'sheetName' && key !== 'typeOfRecord' && key !== 'typeOfObject' && key !== 'docId' && formData[key] && formData[key].toString().trim() !== ''
    );
    if (!isEditing && !hasData && !isViewingHistory) {
      alert(isObjectMode ? 'Please fill in at least one field to create an object.' : 'Please fill in at least one field to create a record.');
      isSavingRef.current = false;
      return;
    }

    let newRow = {
      ...formData,
      docId: formData.docId || (isEditing && initialRowData?.docId ? initialRowData.docId : `object_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
      linkId: formData.linkId || (isEditing && initialRowData?.linkId ? initialRowData.linkId : `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
      isObject: isObjectMode, // Explicit flag to indicate if this is an object
      ...(isObjectMode ? {
        typeOfObject: formData.typeOfObject || (isEditing ? initialRowData?.typeOfObject : selectedRecordType),
        records: initialRowData?.records || [], // Initialize records array for objects
      } : {
        typeOfRecord: formData.typeOfRecord || (isEditing ? initialRowData?.typeOfRecord : template.name),
        typeOfObject: formData.typeOfObject || (() => {
          // Find the object for this template to set typeOfObject
          if (template.objectId && templateObjects) {
            const object = templateObjects.find(e => e.id === template.objectId);
            return object ? object.name : '';
          }
          return '';
        })(),
      }),
      assignedTo: formData.assignedTo || user?.email || '',
      lastModifiedBy: user?.uid || user?.email || 'unknown',
      history: formData.history || [],
    };

    // Clean up empty/null/undefined fields
    const requiredFields = isObjectMode 
      ? ['docId', 'linkId', 'typeOfObject', 'isObject', 'history', 'records']
      : ['docId', 'linkId', 'typeOfRecord', 'typeOfObject', 'isObject', 'history'];
    Object.keys(newRow).forEach((key) => {
      if (!requiredFields.includes(key) && (newRow[key] === null || newRow[key] === undefined || newRow[key] === '')) {
        delete newRow[key];
      }
    });

    const newHistory = [];
    const timestamp = Timestamp.now();

    if (isViewingHistory && selectedHistoryDate) {
      const existingRecord = isObjectMode 
        ? objects.find((object) => object.docId === initialRowData.docId)
        : records.find((record) => record.docId === initialRowData.docId);
      Object.keys(historicalFormData).forEach((key) => {
        if (
          key !== 'docId' &&
          key !== 'sheetName' &&
          (!isObjectMode ? key !== 'typeOfRecord' : true) &&
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
      // Compare current formData with baseDataForComparison to detect changes
      Object.keys(formData).forEach((key) => {
        if (
          key !== 'docId' &&
          key !== 'sheetName' &&
          (!isObjectMode ? key !== 'typeOfRecord' : true) &&
          key !== 'history' &&
          formData[key] !== baseDataForComparison[key]
        ) {
          newHistory.push({
            field: key,
            value: formData[key] || '',
            timestamp,
            modifiedBy: user?.uid,
          });
        }
      });
      newRow.history = [...newRow.history, ...newHistory];
    } else {
      Object.keys(formData).forEach((key) => {
        if (
          key !== 'docId' &&
          key !== 'sheetName' &&
          (!isObjectMode ? key !== 'typeOfRecord' : true) &&
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

    // Determine if we should save based on whether there are actual changes
    let shouldSave = false;
    
    if (isViewingHistory && selectedHistoryDate) {
      // When viewing history, save if changes were made to historical data
      shouldSave = newHistory.length > 0;
    } else if (isEditing) {
      // For existing records, only save if there are changes
      shouldSave = newHistory.length > 0;
    } else {
      // For new records, always save (validation already checked hasData)
      shouldSave = true;
    }

    if (!shouldSave) {
      // No changes detected, just close without saving
      setIsViewingHistory(false);
      setSelectedHistoryDate(null);
      setIsHistoryModalOpen(false);
      isSavingRef.current = false;
      onClose();
      return;
    }

    try {
      await onSave(newRow, isEditing);
      setIsViewingHistory(false);
      setSelectedHistoryDate(null);
      setIsHistoryModalOpen(false);
      setHasUnsavedChanges(false); // Reset unsaved changes after successful save
      setBaseDataForComparison({ ...newRow }); // Update base data for future change detection
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save. Please try again.');
    } finally {
      isSavingRef.current = false;
    }
    
    // If this is a record (not an object), update the parent object's records array in local context only
    // (The Firestore update is now handled atomically in the batch save operation)
    if (!isObjectMode && newRow.linkId) {
      console.log('🔄 [RecordsEditor] Updating parent object records in local context:', {
        isObjectMode,
        linkId: newRow.linkId,
        recordDocId: newRow.docId,
        typeOfRecord: newRow.typeOfRecord
      });
      
      const parentObject = objects.find(obj => obj.linkId === newRow.linkId);
      console.log('🔍 [RecordsEditor] Found parent object:', parentObject);
      
      if (parentObject) {
        const recordInfo = {
          docId: newRow.docId,
          typeOfRecord: newRow.typeOfRecord
        };
        
        // Initialize records array if it doesn't exist
        if (!parentObject.records) {
          parentObject.records = [];
        }
        
        console.log('📋 [RecordsEditor] Parent object current records:', parentObject.records);
        
        // Check if record already exists in the array
        const existingIndex = parentObject.records.findIndex(r => r.docId === newRow.docId);
        if (existingIndex >= 0) {
          // Update existing record info
          parentObject.records[existingIndex] = recordInfo;
        } else {
          // Add new record info
          parentObject.records.push(recordInfo);
        }
        
        console.log('📋 [RecordsEditor] Parent object updated records:', parentObject.records);
        
        // Update the object in context only (no Firestore save needed)
        setObjects(prev => prev.map(obj => 
          obj.linkId === newRow.linkId ? { ...parentObject } : obj
        ));
        
        // Also update the current formData if we're editing the parent object
        if (isObjectMode && formData.linkId === newRow.linkId) {
          setFormData(prev => ({
            ...prev,
            records: parentObject.records
          }));
        }
        
        console.log('✅ [RecordsEditor] Local context updated');
      } else {
        console.error('❌ [RecordsEditor] Parent object not found in local context');
      }
    }
    
    // Keep the editor open after save and switch to editing mode if it was a new object
    if (!isEditing) {
      setIsEditing(true);
      setFormData({ ...newRow });
    } else {
      setFormData({ ...newRow });
    }
    // Editor stays open - user must manually close it
  }, [
    formData,
    historicalFormData,
    selectedSheet,
    selectedRecordType,
    onSave,
    recordTemplates,
    templateObjects,
    initialRowData,
    isEditing,
    isViewingHistory,
    selectedHistoryDate,
    onClose,
    records,
    user,
    isObjectMode,
    objects,
    baseDataForComparison,
  ]);

  const handleDelete = useCallback(() => {
    if (!isEditing || !initialRowData?.docId) {
      alert(isObjectMode ? 'No object to delete.' : 'No record to delete.');
      return;
    }
    if (window.confirm(isObjectMode ? 'Are you sure you want to delete this object?' : 'Are you sure you want to delete this record? This action will remove it from all sheets.')) {
      if (isObjectMode) {
        setObjects((prev) =>
          prev.map((object) => {
            if (object.docId === initialRowData.docId) {
              const updatedObject = { ...object, isModified: true, action: 'remove' };
              return updatedObject;
            }
            return object;
          })
        );
      } else {
        // Mark record for deletion
        setRecords((prev) =>
          prev.map((record) =>
            record.docId === initialRowData.docId
              ? { ...record, isModified: true, action: 'remove' }
              : record
          )
        );
        
        // Also remove this record from the parent object's records array
        if (initialRowData.linkId) {
          setObjects((prev) =>
            prev.map((object) => {
              if (object.linkId === initialRowData.linkId && object.records) {
                const updatedRecords = object.records.filter(r => r.docId !== initialRowData.docId);
                return { ...object, records: updatedRecords, isModified: true, action: 'update' };
              }
              return object;
            })
          );
        }
      }
      onClose();
    }
  }, [isObjectMode, isEditing, initialRowData, setObjects, setRecords, onClose]);

  const toggleSection = useCallback((sectionName) => {
    setHasUserToggledSections(true);
    setOpenSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((name) => name !== sectionName)
        : [...prev, sectionName]
    );
  }, []);

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

  // Check if a field has history
  const hasFieldHistory = useCallback((fieldKey) => {
    return formData.history && formData.history.some(entry => entry.field === fieldKey);
  }, [formData.history]);

  // Get history for a specific field
  const getFieldHistory = useCallback((fieldKey) => {
    if (!formData.history) return [];
    return formData.history
      .filter(entry => entry.field === fieldKey)
      .sort((a, b) => b.timestamp._seconds - a.timestamp._seconds);
  }, [formData.history]);

  // Handle field history icon click
  const handleFieldHistoryClick = useCallback((fieldKey, event) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setFieldHistoryPopup({
      isOpen: true,
      field: fieldKey,
      position: {
        top: rect.bottom + 8,
        left: rect.left,
        right: rect.right
      }
    });
  }, []);

  // Close field history popup
  const closeFieldHistoryPopup = useCallback(() => {
    setFieldHistoryPopup({ isOpen: false, field: null, position: null });
  }, []);

  // Handle click outside to close field history popup
  useEffect(() => {
    if (!fieldHistoryPopup.isOpen) return;

    const handleClickOutside = (event) => {
      const popup = document.querySelector(`.${styles.fieldHistoryPopup}`);
      if (popup && !popup.contains(event.target)) {
        closeFieldHistoryPopup();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fieldHistoryPopup.isOpen, closeFieldHistoryPopup]);

  const _HistoryModal = () => {
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

  const _FieldHistoryPopup = () => {
    const fieldHistory = getFieldHistory(fieldHistoryPopup.field);
    const fieldName = selectedSections
      .flatMap(section => section.fields)
      .find(field => field.key === fieldHistoryPopup.field)?.name || formatFieldName(fieldHistoryPopup.field);

    return (
      <div 
        className={`${styles.fieldHistoryPopup} ${isDarkTheme ? styles.darkTheme : ''}`}
        style={{
          top: fieldHistoryPopup.position?.top || 0,
          left: Math.min(fieldHistoryPopup.position?.left || 0, window.innerWidth - 320),
        }}
      >
        <div className={styles.fieldHistoryContent}>
          <div className={styles.fieldHistoryHeader}>
            <h4>Field History</h4>
            <span className={styles.fieldHistoryFieldName}>{fieldName}</span>
          </div>
          <div className={styles.fieldHistoryList}>
            {fieldHistory.length > 0 ? (
              fieldHistory.map((entry, index) => (
                <div key={`${entry.timestamp._seconds}-${index}`} className={styles.fieldHistoryItem}>
                  <div className={styles.fieldHistoryValue}>
                    "{entry.value || '(empty)'}"
                  </div>
                  <div className={styles.fieldHistoryMeta}>
                    <span className={styles.fieldHistoryUser}>
                      {getTeamMemberName(entry.modifiedBy)}
                    </span>
                    <span className={styles.fieldHistoryDate}>
                      {formatFirestoreTimestamp(entry.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.fieldHistoryEmpty}>
                No history available for this field.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const FieldHistoryPopup = _FieldHistoryPopup;

  const SingleSelectDropdown = ({ options, value, onChange, placeholder, disabled, isDarkTheme }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
      if (!open) return;
      const handleClickOutside = (event) => {
        if (
          ref.current && !ref.current.contains(event.target) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target)
        ) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const handleOptionSelect = (option) => {
      onChange(option);
      setOpen(false);
    };

    const display = value || placeholder;

    // Position dropdown below the field
    const [dropdownStyle, setDropdownStyle] = useState({});
    useEffect(() => {
      if (open && ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setDropdownStyle({
          top: rect.height + 4,
          left: 0,
          width: rect.width,
        });
      }
    }, [open]);

    return (
      <div className={styles.singleSelectDropdownWrapper}>
        <div
          ref={ref}
          className={[
            styles.fieldSelect,
            styles.singleSelectDropdownTrigger,
            isDarkTheme ? styles.darkTheme : '',
            disabled ? styles.disabled : '',
            open ? styles.open : '',
          ].filter(Boolean).join(' ')}
          onClick={() => !disabled && setOpen(!open)}
        >
          <span className={styles.singleSelectDisplay}>{display}</span>
          <span className={styles.singleSelectArrow}>▼</span>
        </div>
        {open && (
          <div
            ref={dropdownRef}
            className={`${styles.singleSelectDropdown} ${isDarkTheme ? styles.darkTheme : ''}`}
            style={dropdownStyle}
          >
            <div className={styles.singleSelectOptions}>
              {options.map((option) => (
                <div
                  key={option}
                  className={`${styles.singleSelectOption} ${value === option ? styles.selected : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                  onClick={() => handleOptionSelect(option)}
                >
                  {option}
                </div>
              ))}
            </div>
          </div>
        )}
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
            {/* Only show back button when viewing objects (not creating or viewing records) */}
            {isObjectMode && !viewingRelatedRecord && isEditing && (
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
            )}
            <div className={styles.navContent}>
              {renderBreadcrumbs() || (
                <h1 className={`${styles.navTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {isEditing ? (isViewingHistory ? 'View Record History' : 'Edit Object') :
                  view === 'objectTypeSelection' ? 'Create New Object' : 
                  view === 'relatedTemplates' ? 'Create Record' : 
                  'New Object'}
                </h1>
              )}
            </div>
            {view === 'objectTypeSelection' && (
              <button
                type="button"
                className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                onClick={handleSelectionNext}
                disabled={!selectedRecordType}
              >
                Next
              </button>
            )}
            {view === 'editor' && hasUnsavedChanges && (
              <button
                type="button"
                className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                onClick={handleSave}
              >
                {isViewingHistory ? 'Revert Data' : (!isEditing ? (isObjectMode ? 'Create Object' : 'Create Record') : 'Save')}
              </button>
            )}
          </div>
          <div className={styles.contentWrapper}>
            {isCreatingObject && (
              // Loading state for object creation - Apple HIG inspired design
              <div className={`${styles.loadingContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={styles.loadingContent}>
                  <div className={styles.loadingSpinner}>
                    <div className={styles.spinnerRing}></div>
                    <div className={styles.spinnerRing}></div>
                    <div className={styles.spinnerRing}></div>
                  </div>
                  <h2 className={styles.loadingTitle}>Creating {isObjectMode ? 'Object' : 'Record'}</h2>
                  <p className={styles.loadingSubtitle}>Please wait while we set up your new {isObjectMode ? 'object' : 'record'}...</p>
                </div>
              </div>
            )}
            {!isCreatingObject && view === 'objectTypeSelection' && (() => {
              // Get the preselected sheet's supported objects if available
              const currentSheet = preSelectedSheet ? sheets?.allSheets?.find(s => s.sheetName === preSelectedSheet) : null;
              const sheetSupportedObjectNames = currentSheet?.headers
                ?.filter(h => h.key === 'typeOfObject')
                .flatMap(h => h.options || [])
                .filter(Boolean) || [];
              
              // Separate objects into sheet-supported and others (only include objects with basicFields)
              const supportedObjects = templateObjects?.filter(obj => 
                obj.basicFields && obj.basicFields.length > 0 && sheetSupportedObjectNames.includes(obj.name)
              ) || [];
              
              const otherObjects = templateObjects?.filter(obj => 
                obj.basicFields && obj.basicFields.length > 0 && !sheetSupportedObjectNames.includes(obj.name)
              ) || [];

              // Combine for dropdown: supported first, then separator, then others
              const allObjects = [...supportedObjects, ...otherObjects];

              return (
                <div className={`${styles.objectCreationView} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  <div className={styles.objectCreationContent}>
                    <div className={styles.objectSelectionContainer}>
                      <div className={styles.objectSelectionHeader}>
                        <div className={`${styles.objectSelectionIcon} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          <FaLayerGroup size={32} />
                        </div>
                        <h2 className={`${styles.objectSelectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          Select Object Type
                        </h2>
                        <p className={`${styles.objectSelectionSubtitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          {preSelectedSheet ? `Choose an object type${supportedObjects.length > 0 ? ` for ${preSelectedSheet}` : ''}` : 'Choose an object type to create'}
                        </p>
                      </div>
                      
                      <div className={styles.objectSelectionDropdown}>
                        <select
                          value={selectedRecordType}
                          onChange={(e) => setSelectedRecordType(e.target.value)}
                          className={`${styles.objectSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          <option value="">Select an object type...</option>
                          {supportedObjects.length > 0 && (
                            <optgroup label={`${preSelectedSheet} Objects`}>
                              {supportedObjects.map((object) => (
                                <option key={object.id} value={object.name}>
                                  {object.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {otherObjects.length > 0 && (
                            <optgroup label="Other Objects">
                              {otherObjects.map((object) => (
                                <option key={object.id} value={object.name}>
                                  {object.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                      {supportedObjects.length === 0 && otherObjects.length === 0 && (
                        <div className={styles.noObjectsMessage}>
                          <div className={styles.noObjectsIcon}>📭</div>
                          <h3>No Objects Available</h3>
                          <p>Objects need to have basic fields defined before they can be used to create instances. Please define basic fields for your objects in the Data Models section.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            {!isCreatingObject && view === 'editor' && (
              <>
                
                {selectedSections.length > 0 ? (
                  selectedSections.map((section, index) => (
                    <div key={`${section.name}-${index}`} className={`${styles.sectionContainer} ${isDarkTheme ? styles.darkTheme : ''} ${
                      openSections.includes(section.name) ? styles.active : ''
                    }`}>
                      <button
                        className={`${styles.sectionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                        onClick={() => toggleSection(section.name)}
                        aria-expanded={openSections.includes(section.name)}
                        aria-controls={`section-content-${index}`}
                      >
                        <div className={styles.sectionHeader}>
                          <div className={styles.sectionText}>
                            <span className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>{section.name}</span>
                          </div>
                        </div>
                        <div className={`${styles.chevron} ${openSections.includes(section.name) ? styles.expanded : ''} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          <IoMdArrowDropdown />
                        </div>
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
                                  {hasFieldHistory(field.key) && (
                                    <button
                                      type="button"
                                      className={`${styles.fieldHistoryIcon} ${isDarkTheme ? styles.darkTheme : ''}`}
                                      onClick={(e) => handleFieldHistoryClick(field.key, e)}
                                      aria-label={`View history for ${field.name}`}
                                      title={`View history for ${field.name}`}
                                    >
                                      <MdHistory size={14} />
                                    </button>
                                  )}
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
                              ) : field.type === 'email' ? (
                                <input
                                  type="email"
                                  value={historicalFormData[field.key] || ''}
                                  onChange={e => handleInputChange(field.key, e.target.value, field.type)}
                                  className={`${styles.fieldInput} ${isDarkTheme ? styles.darkTheme : ''} ${isViewingHistory ? styles.readOnly : ''}`}
                                  placeholder={`Enter ${field.name}`}
                                  aria-label={`Enter ${field.name}`}
                                  readOnly={isViewingHistory}
                                  disabled={field.key === 'typeOfRecord' || field.key === 'typeOfObject' || field.key === 'docId' || field.key === 'linkId' || field.key === 'id'}
                                />
                              ) : field.type === 'phone' ? (
                                <div className={styles.phoneWrapper}>
                                      <select
                                        value={getCountryCode(historicalFormData[field.key] || '')}
                                        onChange={e => handleCountryCodeChange(field.key, e.target.value, historicalFormData[field.key] || '')}
                                        className={`${styles.countryCodeSelect} ${isDarkTheme ? styles.darkTheme : ''} ${isViewingHistory ? styles.readOnly : ''}`}
                                        disabled={isViewingHistory || field.key === 'typeOfRecord' || field.key === 'typeOfObject' || field.key === 'docId' || field.key === 'linkId' || field.key === 'id'}
                                        aria-label={`Country code for ${field.name}`}
                                      >
                                        {getAllCountryCodes().map((country, index) => (
                                          <option key={`${country.code}-${index}`} value={country.code}>
                                            {country.code} ({country.country})
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        type="tel"
                                        value={getPhoneNumber(historicalFormData[field.key] || '')}
                                        onChange={e => handlePhoneNumberChange(field.key, getCountryCode(historicalFormData[field.key] || ''), e.target.value)}
                                        className={`${styles.fieldInput} ${styles.phoneInput} ${isDarkTheme ? styles.darkTheme : ''} ${isViewingHistory ? styles.readOnly : ''}`}
                                        placeholder={`Enter ${field.name}`}
                                        aria-label={`Enter ${field.name}`}
                                        readOnly={isViewingHistory}
                                        disabled={field.key === 'typeOfRecord' || field.key === 'typeOfObject' || field.key === 'docId' || field.key === 'linkId' || field.key === 'id'}
                                      />
                                    </div>
                              ) : field.type === 'currency' ? (
                                <div className={styles.currencyWrapper}>
                                  <span className={`${styles.currencySymbol} ${isDarkTheme ? styles.darkTheme : ''}`}>$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={historicalFormData[field.key] || ''}
                                    onChange={e => handleInputChange(field.key, e.target.value, field.type)}
                                    className={`${styles.fieldInput} ${styles.currencyInput} ${isDarkTheme ? styles.darkTheme : ''} ${isViewingHistory ? styles.readOnly : ''}`}
                                    placeholder={`Enter ${field.name}`}
                                    aria-label={`Enter ${field.name}`}
                                    readOnly={isViewingHistory}
                                    disabled={field.key === 'typeOfRecord' || field.key === 'typeOfObject' || field.key === 'docId' || field.key === 'linkId' || field.key === 'id'}
                                  />
                                </div>
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
                            {fieldErrors[field.key] && (
                              <div className={`${styles.fieldError} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                {fieldErrors[field.key]}
                              </div>
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
                
                {/* Create Record Section - Show only for objects with linkId */}
                {view === 'editor' && isEditing && isObjectMode && formData.linkId && !viewingRelatedRecord && getAvailableTemplatesInCategory().length > 0 && (
                  <div className={`${styles.createRecordSection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    <div className={styles.createRecordCard} onClick={() => setView('relatedTemplates')}>
                      <div className={styles.createRecordIcon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className={styles.createRecordContent}>
                        <h3 className={styles.createRecordTitle}>Create Record</h3>
                        <p className={styles.createRecordDescription}>
                          Create a new record linked to this {formData.typeOfObject}
                        </p>
                      </div>
                      <div className={styles.createRecordArrow}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
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

                {/* Related Records Section - Show for objects with linkId */}
                {view === 'editor' && isObjectMode && !viewingRelatedRecord && relatedRecords.length > 0 && (
                  <div className={`${styles.sectionContainer} ${isDarkTheme ? styles.darkTheme : ''} ${styles.active}`}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTextRecords}>
                        <div className={styles.sectionTitleWithIcon}>
                          <MdLink size={18} className={`${styles.sectionIcon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                          <span className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            {formData.typeOfObject} Records
                          </span>
                        </div>
                        <span className={`${styles.sectionSubtitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          All records associated with this {formData.typeOfObject}
                        </span>
                      </div>
                    </div>
                    <div className={`${styles.sectionContent} ${isDarkTheme ? styles.darkTheme : ''} ${styles.expanded}`}>
                      <div className={styles.relatedRecordsList}>
                        {relatedRecords.map((record) => (
                          <div 
                            key={record.docId} 
                            className={`${styles.relatedRecordItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                            onClick={() => handleViewRelatedRecord(record)}
                          >
                            <div className={styles.relatedRecordInfo}>
                              <span className={`${styles.relatedRecordType} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                {record.typeOfRecord}
                              </span>
                              {record.assignedTo && (
                                <span className={`${styles.relatedRecordDetail} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                  Assigned to: {getTeamMemberName(record.assignedTo)}
                                </span>
                              )}
                              {record.status && (
                                <span className={`${styles.relatedRecordDetail} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                  Status: {record.status}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className={`${styles.relatedRecordViewButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('🔘 View button clicked for record:', {
                                  recordType: record.typeOfRecord,
                                  recordId: record.docId,
                                  parentObject: formData.typeOfObject,
                                  parentObjectId: formData.docId,
                                  hasNavigationCallback: !!onNavigateToRelatedRecord,
                                  willNavigateToURL: !!onNavigateToRelatedRecord && !!formData.docId && !!record.docId
                                });
                                handleViewRelatedRecord(record);
                              }}
                            >
                              View
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {isEditing && (
                  <div className={styles.deleteButtonWrapper}>
                    {isBusinessUser && (
                      <button
                        className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                        onClick={handleDelete}
                        aria-label="Delete record"
                      >
                        <MdDelete size={18} />
                        Delete {isObjectMode ? 'Object' : 'Record'}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
            {!isCreatingObject && view === 'relatedTemplates' && (
              <div className={`${styles.sectionWrapper} ${styles.relatedTemplatesView} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={styles.selectionHeader}>
                  <h2 className={styles.selectionTitle}>Create Record</h2>
                  <p className={styles.selectionSubtitle}>
                    Choose a template to create a new record linked to this {formData.typeOfObject}
                  </p>
                </div>
                <div className={`${styles.sectionContent} ${isDarkTheme ? styles.darkTheme : ''} ${styles.expanded}`}>
                  <div className={styles.templatesGrid}>
                    {getAvailableTemplatesInCategory().map((template) => (
                      <div
                        key={template.docId}
                        className={`${styles.templateCard} ${isDarkTheme ? styles.darkTheme : ''}`}
                        onClick={() => createLinkedRecord(template)}
                      >
                        <div className={styles.templateCardHeader}>
                          <div className={styles.templateIcon}>
                            📄
                          </div>
                          <h3 className={styles.templateCardTitle}>{template.name}</h3>
                        </div>
                        <p className={styles.templateCardDescription}>
                          Create a new {template.name} record that will be automatically linked to this {formData.typeOfObject}.
                        </p>
                        <div className={styles.templateCardFooter}>
                          <span className={styles.linkIdBadge}>
                            Link ID: {formData.linkId}
                          </span>
                          <button className={`${styles.templateCreateButton} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            Create →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {getAvailableTemplatesInCategory().length === 0 && (
                    <div className={styles.noTemplatesMessage}>
                      <div className={styles.noTemplatesIcon}>📭</div>
                      <h3>No Related Templates Available</h3>
                      <p>All available templates for this object type have already been used.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {isHistoryModalOpen && <HistoryModal />}
      {fieldHistoryPopup.isOpen && <FieldHistoryPopup />}
    </div>
  );
});

RecordsEditor.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onOpenNewRecord: PropTypes.func, // Optional callback for opening new records
  onNavigateToRelatedRecord: PropTypes.func, // Optional callback for navigating to related records with parent context
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
  parentObjectData: PropTypes.object, // Parent object data for breadcrumbs
  isObjectMode: PropTypes.bool,
  isCreatingObject: PropTypes.bool, // Loading state for object creation
};

RecordsEditor.defaultProps = {
  startInEditMode: false,
  onOpenNewRecord: null,
  onNavigateToRelatedRecord: null,
  parentObjectData: null,
  isObjectMode: false,
  isCreatingObject: false,
};

export default RecordsEditor;

// .customTimePicker .react-time-picker__wrapper { border: none !important; box-shadow: none !important; background: transparent !important; }
// .customTimePicker .react-time-picker__inputGroup { border: none !important; background: transparent !important; }
import { useContext, useState, useCallback, useMemo, useEffect, useRef, memo, forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import styles from './RecordsEditor.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { Timestamp, collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatFirestoreTimestamp } from '../../Utils/firestoreUtils';
import { getFormattedHistory, getRecordCreator, getLastModifier, formatFieldName, formatDateForInput, formatTimeForInput, parseLocalDate } from '../../Utils/assignedToUtils';
import { validateField, getAllCountryCodes } from '../../Utils/fieldValidation';
import { IoMdArrowDropdown } from 'react-icons/io';
import { MdHistory, MdDelete, MdLink } from 'react-icons/md';
import { FaLayerGroup, FaFileAlt } from 'react-icons/fa';
import BackButton from '../../Components/Reusable Buttons/BackButton';
import MenuButton from '../../Components/Reusable Buttons/MenuButton';

const RecordsEditor = memo(forwardRef(({
  onClose,
  onSave,
  onOpenNewRecord, // New prop for opening a new record after pipeline execution
  onNavigateToRelatedRecord, // New prop for navigating to related records with parent context
  onNavigateToObject, // New prop for navigating to object URLs
  onCreateObject, // New prop for creating objects (sets selectedRow)
  initialRowData,
  startInEditMode,
  preSelectedSheet,
  parentObjectData, // Parent object data for breadcrumbs when viewing records
  isObjectMode: propIsObjectMode,
  isCreatingObject, // Loading state for object creation from parent
}, ref) => {
  // Clear old debug logs when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.debugLogs = [];
    }
  }, []);

  // Hide app header when RecordsEditor is open (mobile)
  useEffect(() => {
    document.body.classList.add('records-editor-open');
    return () => {
      document.body.classList.remove('records-editor-open');
    };
  }, []);

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
  
  const [selectedRecordType, setSelectedRecordType] = useState('');
  const [isItemDeleted, setIsItemDeleted] = useState(false);
  
  // Update selectedRecordType when data becomes available
  useEffect(() => {
    if (initialTemplate?.name) {
      setSelectedRecordType(initialTemplate.name);
      return;
    }
    
    // If we're in object creation mode and have a preselected sheet, find the selected object
    if (preSelectedSheet && sheets?.allSheets && templateObjects) {
      const currentSheet = sheets.allSheets.find(s => s.sheetName === preSelectedSheet);
      
      // Check if the sheet has selectedObjects and find the one marked as selected
      if (currentSheet?.selectedObjects) {
        const selectedObjectEntry = Object.values(currentSheet.selectedObjects).find(obj => obj.selected);
        if (selectedObjectEntry && selectedObjectEntry.name) {
          // Verify this object exists in templateObjects
          const objectExists = templateObjects.some(obj => obj.name === selectedObjectEntry.name && obj.basicFields && obj.basicFields.length > 0);
          if (objectExists) {
            setSelectedRecordType(selectedObjectEntry.name);
            return;
          }
        }
      }
      
      // Fallback: find supported objects from headers
      const sheetSupportedObjectNames = currentSheet?.headers
        ?.filter(h => h.key === 'typeOfObject')
        .flatMap(h => h.options || [])
        .filter(Boolean) || [];
      
      const supportedObjects = templateObjects.filter(obj => 
        obj.basicFields && obj.basicFields.length > 0 && sheetSupportedObjectNames.includes(obj.name)
      );
      
      if (supportedObjects.length > 0) {
        setSelectedRecordType(supportedObjects[0].name);
        return;
      }
    }
    
    // If no selection found, set empty
    setSelectedRecordType('');
  }, [preSelectedSheet, sheets?.allSheets, templateObjects, initialTemplate?.name]);
  const [formData, setFormData] = useState(initialRowData ? { ...initialRowData } : {});
  const [isEditing, setIsEditing] = useState(!!initialRowData && !!initialRowData.docId && !initialRowData.isNewRecord);
  // Track whether this item was originally loaded from database (not created in this session)
  const [wasOriginallyLoaded, setWasOriginallyLoaded] = useState(!!initialRowData && !!initialRowData.docId && !initialRowData.isNewRecord);
  const [openSections, setOpenSections] = useState([]);
  const [hasUserToggledSections, setHasUserToggledSections] = useState(false);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [fieldHistoryPopup, setFieldHistoryPopup] = useState({ isOpen: false, field: null, position: null });
  const [relatedRecords, setRelatedRecords] = useState([]);
  const [fetchedRecordsCache, setFetchedRecordsCache] = useState({});
  const [recordListenersRef, setRecordListenersRef] = useState({ current: {} });
  const [loadingRecordId, setLoadingRecordId] = useState(null);
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
      setIsObjectMode(shouldBeObjectMode);
    }
  }, [initialRowData?.docId]); // Only run when the docId changes (different record/object)

  // Handler to fetch and view a related record by docId (with caching and real-time updates)
  const handleViewRelatedRecord = useCallback(async (recordRef) => {
    const recordDocId = recordRef.docId;
    const recordType = recordRef.typeOfRecord;

    // Step 1: Check if record is in fetched cache
    if (fetchedRecordsCache[recordDocId]) {
      const recordData = fetchedRecordsCache[recordDocId];

      // Store the original object data before switching
      if (!viewingRelatedRecord) {
        setOriginalObjectData(formData);
        setOriginalRecordType(selectedRecordType);
        setOriginalIsObjectMode(isObjectMode);
      }

      // Navigate to record immediately (no listener needed for cached data)
      // Prefer local state updates for cached records to avoid navigation delay
      setViewingRelatedRecord(recordData);
      setFormData(recordData);
      setBaseDataForComparison({ ...recordData });
      setSelectedRecordType(recordData.typeOfRecord);
      setIsObjectMode(false);
      setIsEditing(true);
      setExpandedSections({ relatedRecords: false });
      return;
    }

    // Step 2: Record not in cache - navigate immediately and fetch in background
    setLoadingRecordId(recordDocId);

    // Create placeholder record data for immediate navigation
    const placeholderRecordData = {
      docId: recordDocId,
      typeOfRecord: recordType,
      linkId: formData.linkId,
      typeOfObject: formData.typeOfObject,
      isLoading: true // Flag to indicate this is placeholder data
    };

    // Store the original object data before switching
    if (!viewingRelatedRecord) {
      setOriginalObjectData(formData);
      setOriginalRecordType(selectedRecordType);
      setOriginalIsObjectMode(isObjectMode);
    }

    // Navigate immediately with placeholder data
    if (onNavigateToRelatedRecord && formData?.docId && placeholderRecordData?.docId) {
      onNavigateToRelatedRecord(placeholderRecordData, formData);
    } else {
      setViewingRelatedRecord(placeholderRecordData);
      setFormData(placeholderRecordData);
      setBaseDataForComparison({ ...placeholderRecordData });
      setSelectedRecordType(recordType);
      setIsObjectMode(false);
      setIsEditing(true);
      setExpandedSections({ relatedRecords: false });
    }

    // Only set up listener for non-cached records
    try {
      // Set up real-time listener for this record
      const docRef = collection(db, 'businesses', businessId, 'records');
      const recordQuery = query(docRef, where('docId', '==', recordDocId));

      // Clean up any existing listener for this record
      if (recordListenersRef.current[recordDocId]) {
        recordListenersRef.current[recordDocId]();
      }

      // Set up new real-time listener
      const unsubscribe = onSnapshot(
        recordQuery,
        (snapshot) => {
          if (snapshot.empty) {
            setLoadingRecordId(null);
            return;
          }

          const recordData = { docId: snapshot.docs[0].id, ...snapshot.docs[0].data() };

          // Update cache
          setFetchedRecordsCache(prev => ({
            ...prev,
            [recordDocId]: recordData
          }));

          setLoadingRecordId(null);

          // Update the view with real data (don't navigate again, just update)
          if (viewingRelatedRecord?.docId === recordDocId || (formData.docId === recordDocId && !isObjectMode)) {
            if (onNavigateToRelatedRecord && formData?.docId && recordData?.docId) {
              // Update via navigation callback if available
              onNavigateToRelatedRecord(recordData, originalObjectData || formData);
            } else {
              // Update local state
              setFormData(recordData);
              setBaseDataForComparison({ ...recordData });
              setSelectedRecordType(recordData.typeOfRecord);
            }
          }
        },
        (error) => {
          console.error('Error setting up record listener:', error);
          setLoadingRecordId(null);
        }
      );

      // Store the unsubscribe function
      setRecordListenersRef(prev => ({
        current: {
          ...prev.current,
          [recordDocId]: unsubscribe
        }
      }));

    } catch (error) {
      console.error('Error fetching record:', error);
      setLoadingRecordId(null);
    }
  }, [viewingRelatedRecord, formData, selectedRecordType, isObjectMode, onNavigateToRelatedRecord, businessId, fetchedRecordsCache, loadingRecordId]);

  // Cleanup listeners when component unmounts
  useEffect(() => {
    return () => {
      Object.values(recordListenersRef.current).forEach(unsubscribe => unsubscribe());
    };
  }, []);

  // Handler to go back to the original object
  const handleBackToObject = useCallback(() => {
    // Check if we're in record creation mode
    const isCreatingRecord = (view === 'relatedTemplates' || (view === 'editor' && formData.linkId && !formData.docId)) && formData.typeOfObject;

    let targetObject;

    if (isCreatingRecord) {
      targetObject = parentObjectData || originalObjectData || objects.find(obj => obj.linkId === formData.linkId) || formData;
    } else {
      targetObject = originalObjectData || parentObjectData;
    }

    if (targetObject && targetObject.docId) {

      // Use the object navigation callback to navigate directly to the object URL
      if (onNavigateToObject) {
        onNavigateToObject(targetObject.docId);
      } else if (onNavigateToRelatedRecord) {
        // Fallback: use the related record navigation (though this creates wrong URLs)
        onNavigateToRelatedRecord(targetObject, targetObject); // Both params same = navigate to object URL
      } else {
        // Fallback: direct URL navigation for mobile compatibility
        try {
          // Use pushState for smooth navigation without reload
          window.history.pushState(null, '', `/object/${targetObject.docId}`);
          
          // If we have an onClose callback, call it to let the router handle the new URL
          if (onClose) {
            onClose();
          } else {
            setFormData(targetObject);
            setBaseDataForComparison({ ...targetObject });
            setSelectedRecordType(originalRecordType || null);
            setIsObjectMode(true);
            setIsEditing(!!targetObject.docId);
            setViewingRelatedRecord(null);
            setExpandedSections({ relatedRecords: true });
          }
        } catch (error) {
          setFormData(targetObject);
          setBaseDataForComparison({ ...targetObject });
          setSelectedRecordType(originalRecordType || null);
          setIsObjectMode(true);
          setIsEditing(!!targetObject.docId);
          setViewingRelatedRecord(null);
          setExpandedSections({ relatedRecords: true });
        }
      }
    }
  }, [view, formData.linkId, formData.docId, formData.typeOfObject, parentObjectData, originalObjectData, objects, onNavigateToObject, onNavigateToRelatedRecord, originalRecordType]);  // Render breadcrumbs for navigation
  const renderBreadcrumbs = () => {
    const breadcrumbs = [];

    // Check if we're in record creation mode (relatedTemplates or editor with linkId but no docId)
    const isCreatingRecord = (view === 'relatedTemplates' || (view === 'editor' && formData.linkId && !formData.docId)) && formData.typeOfObject;

    // When creating a new record (show parent object breadcrumb and editor step)
    if (isCreatingRecord) {
      // Find the parent object from the linkId or use the current object data
      const parentObject = parentObjectData || originalObjectData || objects.find(obj => obj.linkId === formData.linkId);
      if (parentObject && parentObject.typeOfObject) {
        breadcrumbs.push({
          label: parentObject.typeOfObject,
          type: 'Object',
          onClick: isObjectMode ? null : handleBackToObject // Disable if currently viewing object
        });
      }
      // If in relatedTemplates view (selecting record type), add that step
      if (view === 'relatedTemplates') {
        breadcrumbs.push({
          label: 'New Record',
          type: null,
          onClick: null // Current page, no click
        });
      } else if (view === 'editor') {
        // In editor view, add clickable "New Record" step and current record type
        breadcrumbs.push({
          label: 'New Record',
          type: null,
          onClick: () => setView('relatedTemplates')
        });
        breadcrumbs.push({
          label: formData.typeOfRecord || 'New Record',
          type: 'Record',
          onClick: null // Current page, no click
        });
      }
    }
    // When viewing a record (either via navigation or direct URL), show Object > Record Type
    else if (!isObjectMode && isEditing && formData.typeOfRecord) {
      // Try to get parent object info from parentObjectData prop, originalObjectData, or from context
      const parentObject = parentObjectData || originalObjectData;
      if (parentObject && parentObject.typeOfObject) {
        breadcrumbs.push({
          label: parentObject.typeOfObject,
          type: 'Object',
          onClick: isObjectMode ? null : handleBackToObject // Disable if currently viewing object
        });
      }
      breadcrumbs.push({
        label: formData.typeOfRecord,
        type: 'Record',
        onClick: null // Current page, no click
      });
    }
    // When viewing or creating an object, just show the object name (no navigation needed)
    else if (formData.typeOfObject) {
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
    if (selectedSheet && !isEditing && !isObjectMode && view !== 'objectTypeSelection') {
      // No longer auto-select record type since we work with objects
      setSelectedRecordType('');
    }
  }, [selectedSheet, sheets, isEditing, isObjectMode, view]);

  // Debug: Watch selectedRecordType changes
  useEffect(() => {
    // Removed debug log to reduce clutter
  }, [selectedRecordType]);

  // Update component state when initialRowData changes (for pipeline conversions)
  useEffect(() => {
    if (initialRowData) {
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
      isNewRecord: true, // Mark as new object for editor to know it's in create mode
      action: 'add',
      isModified: true,
    }));
    setIsObjectMode(true); // Switch to object mode when creating a new object
    setView('editor');
    
    // Set selectedRow in parent to prevent re-mounting during save
    if (onCreateObject) {
      const newObjectData = {
        docId: newObjectId,
        linkId: newObjectId,
        typeOfObject: object.name,
        isObject: true,
        isNewRecord: true,
      };
      onCreateObject(newObjectData);
    }
  }, [selectedRecordType, templateObjects]);

  const handleClose = useCallback(() => {
    setIsViewingHistory(false);
    setSelectedHistoryDate(null);
    setIsHistoryModalOpen(false);
    onClose();
  }, [onClose]);

  // Handler for back button - navigates based on breadcrumb trail
  const handleBackNavigation = useCallback(() => {

    // Check if we're in record creation mode
    const isCreatingRecord = (view === 'relatedTemplates' || (view === 'editor' && formData.linkId && !formData.docId)) && formData.typeOfObject;

    // CASE 1: In record creation mode and in editor view - go back to record type selection
    if (isCreatingRecord && view === 'editor') {
      setView('relatedTemplates');
      return;
    }

    // CASE 2: In record creation mode and in relatedTemplates view - go back to parent object
    if (isCreatingRecord && view === 'relatedTemplates') {
      handleBackToObject();
      return;
    }

    // CASE 3: Viewing an existing record - go back to parent object
    if (!isObjectMode && isEditing && (parentObjectData || originalObjectData)) {
      handleBackToObject();
      return;
    }

    // CASE 4: Viewing an existing object - close the editor
    if (isObjectMode && isEditing) {
      handleClose();
      return;
    }

    // Default: close the editor
    handleClose();
  }, [isObjectMode, isEditing, view, formData.linkId, formData.docId, formData.typeOfObject, parentObjectData, originalObjectData, handleBackToObject, handleClose]);

  // Expose handleBackNavigation to parent component via ref
  useImperativeHandle(ref, () => ({
    handleBackNavigation,
  }), [handleBackNavigation]);

  // Real-time deletion detection for objects
  useEffect(() => {
    if (!isObjectMode || !isEditing || !initialRowData?.docId || !businessId) return;

    // Check if object is already marked as deleted in local state
    const existingObject = objects.find(obj => obj.docId === initialRowData.docId);
    if (existingObject && existingObject.isDeleted) {
      console.warn('⚠️ Object being edited is marked as deleted:', initialRowData.docId);
      setIsItemDeleted(true);
      return;
    }

    const checkAndSetupListener = async () => {
      try {
        const objectRef = doc(db, `businesses/${businessId}/objects/${initialRowData.docId}`);
        const docSnapshot = await getDoc(objectRef);
        
        // Only set up deletion listener if the document actually exists
        if (docSnapshot.exists()) {
          const unsubscribe = onSnapshot(objectRef, (snapshot) => {
            if (!snapshot.exists()) {
              console.warn('⚠️ Object being edited was deleted by another user:', initialRowData.docId);
              setIsItemDeleted(true);
            }
          });
          return unsubscribe;
        } else {
          console.log('📝 Object does not exist in Firestore yet, skipping deletion detection:', initialRowData.docId);
        }
      } catch (error) {
        console.error('❌ Error checking if object exists:', error);
      }
    };

    const cleanup = checkAndSetupListener();
    return () => {
      cleanup?.then?.(unsubscribe => unsubscribe?.());
    };
  }, [isObjectMode, isEditing, initialRowData?.docId, businessId, objects]);

  // Real-time deletion detection for records
  useEffect(() => {
    if (isObjectMode || !isEditing || !initialRowData?.docId || !businessId) return;

    // Check if record is already marked as deleted in local state
    const existingRecord = records.find(rec => rec.docId === initialRowData.docId);
    if (existingRecord && existingRecord.isDeleted) {
      console.warn('⚠️ Record being edited is marked as deleted:', initialRowData.docId);
      setIsItemDeleted(true);
      return;
    }

    const checkAndSetupListener = async () => {
      try {
        const recordRef = doc(db, `businesses/${businessId}/records/${initialRowData.docId}`);
        const docSnapshot = await getDoc(recordRef);
        
        // Only set up deletion listener if the document actually exists
        if (docSnapshot.exists()) {
          const unsubscribe = onSnapshot(recordRef, (snapshot) => {
            if (!snapshot.exists()) {
              console.warn('⚠️ Record being edited was deleted by another user:', initialRowData.docId);
              setIsItemDeleted(true);
            }
          });
          return unsubscribe;
        } else {
          console.log('📝 Record does not exist in Firestore yet, skipping deletion detection:', initialRowData.docId);
        }
      } catch (error) {
        console.error('❌ Error checking if record exists:', error);
      }
    };

    const cleanup = checkAndSetupListener();
    return () => {
      cleanup?.then?.(unsubscribe => unsubscribe?.());
    };
  }, [isObjectMode, isEditing, initialRowData?.docId, businessId, records]);

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

    const templateData = {
      linkId: formData.linkId,
      typeOfRecord: targetTemplate.name,
      typeOfObject: formData.typeOfObject,
      assignedTo: formData.assignedTo || user?.email || '',
      sheetName: selectedSheet || preSelectedSheet,
    };

    // Open editor for creating new record (will be created on save)
    if (onOpenNewRecord) {
      onOpenNewRecord(templateData);
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
    // Prevent saving if item has been deleted
    if (isItemDeleted) {
      alert('This item has been deleted and cannot be saved.');
      return;
    }

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
      // Remove client-side only fields before saving
      const { isNewRecord, ...cleanNewRow } = newRow;
      await onSave(cleanNewRow, isEditing);
      setIsViewingHistory(false);
      setSelectedHistoryDate(null);
      setIsHistoryModalOpen(false);
      setHasUnsavedChanges(false); // Reset unsaved changes after successful save
      setBaseDataForComparison({ ...cleanNewRow }); // Update base data for future change detection
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save. Please try again.');
    } finally {
      isSavingRef.current = false;
    }
    
    // Ensure wasOriginallyLoaded is true after successful save
    if (!wasOriginallyLoaded) {
      setWasOriginallyLoaded(true);
    }
    
    // If this is a record (not an object), update the parent object's records array in local context only
    // For new records, update immediately for UI feedback. For existing records, Sheets.jsx will handle it.
    if (!isObjectMode && newRow.linkId && !isEditing) {
      
      const parentObject = objects.find(obj => obj.linkId === newRow.linkId);
      
      if (parentObject) {
        const recordInfo = {
          docId: newRow.docId,
          typeOfRecord: newRow.typeOfRecord
        };
        
        // Initialize records array if it doesn't exist
        if (!parentObject.records) {
          parentObject.records = [];
        }
        
        // Check if record already exists in the array
        const existingIndex = parentObject.records.findIndex(r => r.docId === newRow.docId);
        if (existingIndex >= 0) {
          // Update existing record info
          parentObject.records[existingIndex] = recordInfo;
        } else {
          // Add new record info
          parentObject.records.push(recordInfo);
        }
        
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
      }
    }
    
    // Keep the editor open after save and switch to editing mode if it was a new object
    if (!isEditing) {
      setIsEditing(true);
      // Remove isNewRecord flag after save
      const { isNewRecord, ...savedRow } = newRow;
      setFormData({ ...savedRow });
      // Mark as originally loaded since it now exists in the database
      setWasOriginallyLoaded(true);
    } else {
      // Remove isNewRecord flag if it exists
      const { isNewRecord, ...savedRow } = newRow;
      setFormData({ ...savedRow });
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

  // Determine if back button should be shown
  const shouldShowBackButton = useMemo(() => {

    // Check if we're in record creation mode
    const isCreatingRecord = (view === 'relatedTemplates' || (view === 'editor' && formData.linkId && !formData.docId)) && formData.typeOfObject;

    // Show back button when:
    // 1. Viewing/editing an existing object (can close)
    if (isObjectMode && isEditing) {
      return true;
    }

    // 2. Creating a record and in editor view (can go back to record type selection)
    if (!isObjectMode && !isEditing && view === 'editor') {
      return true;
    }

    // 3. In record creation mode (relatedTemplates or editor) - can go back to object
    if (isCreatingRecord) {
      return true;
    }

    // 4. Viewing a record with parent object (can go back to object)
    if (!isObjectMode && isEditing && (parentObjectData || originalObjectData)) {
      return true;
    }

    // 5. In object type selection (can go back to close the editor)
    if (view === 'objectTypeSelection') {
      return true;
    }

    return false;
  }, [isObjectMode, isEditing, view, parentObjectData, originalObjectData, formData.linkId, formData.docId, formData.typeOfObject]);

  return (
    <div className={`${styles.editorWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {isItemDeleted && (
        <div className={`${styles.deletedOverlay} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <div className={styles.deletedMessage}>
            <div className={styles.deletedIcon}>🗑️</div>
            <h3>This {isObjectMode ? 'object' : 'record'} has been deleted</h3>
            <p>It was deleted by another user. You can no longer edit or save this item.</p>
            <button 
              className={`${styles.closeButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={handleClose}
            >
              Close Editor
            </button>
          </div>
        </div>
      )}
      <div className={`${styles.viewContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <div className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <div className={`${styles.navBar} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <div className={styles.headerTop}>
              <div className={styles.headerTopLeft}>
                {/* Back button and save button moved to breadcrumb section */}
              </div>
              <div className={styles.headerTopRight}>
                {/* Save button moved to breadcrumb section */}
              </div>
            </div>
            <div className={styles.headerBreadcrumbs}>
              <div className={styles.breadcrumbWithActions}>
                <div className={styles.breadcrumbActions}>
                  {/* Show back button based on navigation context */}
                  {shouldShowBackButton && (
                    <BackButton
                      onClick={handleBackNavigation}
                      isDarkTheme={isDarkTheme}
                      showText={false}
                      ariaLabel="Back"
                      icon={
                        // Use X icon when closing the editor (editing existing object and not in navigation views, or initial selection), chevron when navigating within
                        (isObjectMode && isEditing && view !== 'relatedTemplates') || view === 'objectTypeSelection'
                          ? 'x'
                          : 'chevron'
                      }
                    />
                  )}
                  {view === 'editor' && hasUnsavedChanges && (
                    <button
                      type="button"
                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''} ${isItemDeleted ? styles.disabled : ''}`}
                      onClick={handleSave}
                      disabled={isItemDeleted}
                    >
                      {isViewingHistory ? 'Revert Data' : (isObjectMode ? 'Save' : (!isEditing ? 'New Record' : 'Save'))}
                    </button>
                  )}
                </div>
                <div className={styles.breadcrumbActionsRight}>
                  {/* New Record button - only show for saved objects */}
                  {(isObjectMode && formData.docId && !formData.isNewRecord) && (
                    <button
                      className={`${styles.actionTabButton} ${styles.selectButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => {
                        // Navigate to related templates to create a new record
                        setView('relatedTemplates');
                      }}
                    >
                      New Record
                    </button>
                  )}
                  {/* Only show menu button after object has been saved (not a new record) */}
                  {(isObjectMode && formData.docId && !formData.isNewRecord) && (
                    <MenuButton
                      isDarkTheme={isDarkTheme}
                      onDeleteObject={() => {
                        // Handle delete object - could show confirmation dialog
                        if (window.confirm('Are you sure you want to delete this object?')) {
                          handleDelete();
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.contentWrapper}>
            {formData.isLoading && !isObjectMode && (
              // Loading state for record fetching - Apple HIG inspired design
              <div className={`${styles.loadingContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={styles.loadingContent}>
                  <div className={styles.loadingSpinner}>
                    <div className={styles.spinnerRing}></div>
                    <div className={styles.spinnerRing}></div>
                    <div className={styles.spinnerRing}></div>
                  </div>
                  <h2 className={styles.loadingTitle}>Loading Record</h2>
                  <p className={styles.loadingSubtitle}>Fetching record data...</p>
                </div>
              </div>
            )}
            {isCreatingObject && isEditing && !isObjectMode && (
              // Loading state for object/record saving - Apple HIG inspired design
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
              
              // Get the selected object from the sheet's selectedObjects
              let selectedObjectName = null;
              if (currentSheet?.selectedObjects) {
                const selectedObjectEntry = Object.values(currentSheet.selectedObjects).find(obj => obj.selected);
                if (selectedObjectEntry?.name) {
                  selectedObjectName = selectedObjectEntry.name;
                }
              }
              
              // Separate objects into selected, sheet-supported, and others (only include objects with basicFields)
              const selectedObject = selectedObjectName ? templateObjects?.find(obj => 
                obj.name === selectedObjectName && obj.basicFields && obj.basicFields.length > 0
              ) : null;
              
              const supportedObjects = templateObjects?.filter(obj => 
                obj.basicFields && obj.basicFields.length > 0 && 
                sheetSupportedObjectNames.includes(obj.name) && 
                obj.name !== selectedObjectName
              ) || [];
              
              const otherObjects = templateObjects?.filter(obj => 
                obj.basicFields && obj.basicFields.length > 0 && 
                !sheetSupportedObjectNames.includes(obj.name) && 
                obj.name !== selectedObjectName
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
                          onChange={(e) => {
                            setSelectedRecordType(e.target.value);
                          }}
                          className={`${styles.objectSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          <option value="">Select an object type...</option>
                          {selectedObject && (
                            <optgroup label="Selected Object">
                              <option key={selectedObject.id} value={selectedObject.name}>
                                {selectedObject.name} ✓
                              </option>
                            </optgroup>
                          )}
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
                      
                      <button
                        type="button"
                        className={`${styles.continueButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                        onClick={handleSelectionNext}
                        disabled={!selectedRecordType}
                      >
                        Continue
                      </button>
                      
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
                    <div key={`${section.name}-${index}`} className={`${section.name === 'Basic Information' ? styles.basicInformationContainer : styles.sectionContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      <div className={styles.sectionHeader}>
                        <div className={styles.sectionText}>
                          <span className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>{section.name}</span>
                        </div>
                      </div>
                      <div className={`${section.name === 'Basic Information' ? styles.basicInformationContent : styles.sectionContent} ${isDarkTheme ? styles.darkTheme : ''}`}>
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
                                  disabled={isViewingHistory || isItemDeleted}
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
                                  disabled={isViewingHistory || isItemDeleted}
                                >
                                  <option value="">Select {field.name}</option>
                                  {field.options.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              ) : field.type === 'multi-select' ? (
                                <select
                                  multiple
                                  value={Array.isArray(historicalFormData[field.key]) ? historicalFormData[field.key] : []}
                                  onChange={(e) => {
                                    const values = Array.from(e.target.selectedOptions, option => option.value);
                                    handleInputChange(field.key, values, field.type);
                                  }}
                                  disabled={isViewingHistory || isItemDeleted}
                                  className={`${styles.fieldSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  {field.options.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
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
                                          disabled={isViewingHistory || isItemDeleted || field.key === 'typeOfRecord' || field.key === 'typeOfObject' || field.key === 'docId' || field.key === 'linkId' || field.key === 'id'}
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
                                        disabled={isViewingHistory || isItemDeleted || field.key === 'typeOfRecord' || field.key === 'typeOfObject' || field.key === 'docId' || field.key === 'linkId' || field.key === 'id'}
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

                {/* Related Records Section - Show for objects with records array that were originally loaded from database */}
                {view === 'editor' && isObjectMode && !viewingRelatedRecord && wasOriginallyLoaded && formData.records && formData.records.length > 0 && (
                  <div className={`${styles.sectionContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    <div className={`${styles.relatedRecordsList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      {formData.records.map((recordRef) => {
                        const isLoading = loadingRecordId === recordRef.docId;
                        const isCached = !!fetchedRecordsCache[recordRef.docId];
                        const recordData = fetchedRecordsCache[recordRef.docId];

                        return (
                          <div key={recordRef.docId} className={styles.folderContainer}>
                            <button
                              className={`${styles.tabButton} ${isDarkTheme ? styles.darkTheme : ''} ${isLoading ? styles.loading : ''}`}
                              onClick={() => !isLoading && handleViewRelatedRecord(recordRef)}
                              style={{ cursor: isLoading ? 'not-allowed' : 'pointer' }}
                              disabled={isLoading}
                            >
                              <div className={styles.iconContainer}>
                                <FaFileAlt className={styles.recordIcon} />
                              </div>
                              <div className={styles.labelContainer}>
                                <div className={`${styles.relatedRecordType} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                  {recordRef.typeOfRecord}
                                </div>
                                {isCached && recordData?.assignedTo && (
                                  <div className={`${styles.relatedRecordDetail} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                    Assigned to: {getTeamMemberName(recordData.assignedTo)}
                                  </div>
                                )}
                                {isCached && recordData?.status && (
                                  <div className={`${styles.relatedRecordDetail} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                    Status: {recordData.status}
                                  </div>
                                )}
                                {isLoading && (
                                  <div className={`${styles.relatedRecordDetail} ${styles.loadingText} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                    Loading...
                                  </div>
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
            {!isCreatingObject && view === 'relatedTemplates' && (
              <div className={`${styles.sectionWrapper} ${styles.relatedTemplatesView} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={styles.selectionHeader}>
                  <h2 className={styles.selectionTitle}>New Record</h2>
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
                        <div className={styles.templateCardFooter}>
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
}));

RecordsEditor.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onOpenNewRecord: PropTypes.func, // Optional callback for opening new records
  onNavigateToRelatedRecord: PropTypes.func, // Optional callback for navigating to related records with parent context
  onNavigateToObject: PropTypes.func, // Optional callback for navigating to object URLs
  onCreateObject: PropTypes.func, // Optional callback for creating objects (sets selectedRow)
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
  onNavigateToObject: null,
  onCreateObject: null,
  parentObjectData: null,
  isObjectMode: false,
  isCreatingObject: false,
};

export default RecordsEditor;

// .customTimePicker .react-time-picker__wrapper { border: none !important; box-shadow: none !important; background: transparent !important; }
// .customTimePicker .react-time-picker__inputGroup { border: none !important; background: transparent !important; }
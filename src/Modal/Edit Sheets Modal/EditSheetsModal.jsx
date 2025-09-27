import React, { useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './EditSheetsModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';
import { FaEye, FaEyeSlash, FaThumbtack, FaRegCircle, FaRegCheckCircle, FaGripVertical } from 'react-icons/fa';
import { MdFilterAlt, MdFilterAltOff, MdDragIndicator } from 'react-icons/md';
import { IoMdList, IoMdOptions, IoMdFunnel, IoMdArrowDropdown } from 'react-icons/io';
import { IoChevronForward, IoChevronDown } from 'react-icons/io5';

// Utility function to convert various date formats to milliseconds
function toMillis(dateValue) {
  if (
    dateValue &&
    typeof dateValue === 'object' &&
    typeof dateValue.seconds === 'number' &&
    typeof dateValue.nanoseconds === 'number'
  ) {
    return dateValue.seconds * 1000 + Math.floor(dateValue.nanoseconds / 1e6);
  }
  if (dateValue && typeof dateValue.toDate === 'function') {
    return dateValue.toDate().getTime();
  }
  if (dateValue instanceof Date) {
    return dateValue.getTime();
  }
  if (typeof dateValue === 'string') {
    const parsed = Date.parse(dateValue);
    if (!isNaN(parsed)) return parsed;
  }
  return NaN;
}

const EditSheetsModal = ({
  isEditMode = false,
  tempData,
  setTempData,
  sheets = [],
  onPinToggle,
  onDeleteSheet,
  handleClose,
  setActiveSheetName,
  clearFetchedSheets,
}) => {
  const { isDarkTheme, templateObjects } = useContext(MainContext);
  
  // Get all templates directly from objects
  const allTemplates = useMemo(() => templateObjects.flatMap(object => 
    (object.templates || []).map(template => ({
      ...template,
      objectId: object.id,
      objectName: object.name
    }))
  ), [templateObjects]);
  const { registerModalSteps, goToStep, goBack, currentStep, setModalConfig } = useContext(ModalNavigatorContext);
  const [sheetName, setSheetName] = useState(tempData.sheetName || '');
  const [currentHeaders, setCurrentHeaders] = useState(() => {
    const uniqueHeaders = [];
    const seenKeys = new Set();
    (tempData.currentHeaders || []).forEach((header) => {
      // Create unique key considering both key and objectId for object fields
      const uniqueKey = header.objectId ? `${header.key}_${header.objectId}` : header.key;
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        uniqueHeaders.push({ ...header, options: header.options || [] });
      }
    });
    return uniqueHeaders;
  });
  const [pinnedStates, setPinnedStates] = useState({});
  const [selectedObjects, setSelectedObjects] = useState(() => {
    // Initialize from tempData if available, otherwise as empty for independence
    if (tempData.selectedObjects) {
      return tempData.selectedObjects;
    }
    const objectsMap = {};
    templateObjects.forEach(object => {
      objectsMap[object.id] = {
        name: object.name,
        selected: false
      };
    });
    return objectsMap;
  });
  const [selectedTemplates, setSelectedTemplates] = useState(() => {
    // Initialize from tempData.typeOfRecordsToDisplay
    const selectedTypes = tempData.typeOfRecordsToDisplay || [];
    const templatesMap = {};
    
    templateObjects.forEach(object => {
      templatesMap[object.id] = {
        selectedTemplates: []
      };
    });
    
    selectedTypes.forEach(typeOfRecord => {
      const template = allTemplates.find(t => t.typeOfRecord === typeOfRecord);
      if (template) {
        const objectId = template.objectId;
        if (!templatesMap[objectId]) {
          templatesMap[objectId] = { selectedTemplates: [] };
        }
        templatesMap[objectId].selectedTemplates.push(typeOfRecord);
      }
    });
    
    return templatesMap;
  });
  const [selectedRecordTypes, setSelectedRecordTypes] = useState(tempData.typeOfRecordsToDisplay || []);
  const [navigationDirection, setNavigationDirection] = useState(null);
  const [expandedObjects, setExpandedObjects] = useState(new Set());

  // Sync selectedRecordTypes from selectedTemplates
  useEffect(() => {
    const allSelectedTypes = Object.values(selectedTemplates).flatMap(obj => obj.selectedTemplates);
    setSelectedRecordTypes(allSelectedTypes);
  }, [selectedTemplates]);
  const [selectedTemplateForHeaders, setSelectedTemplateForHeaders] = useState(null);
  const [selectedRecordTypeForFilter, setSelectedRecordTypeForFilter] = useState(null);
  const [selectedObjectFieldForFilter, setSelectedObjectFieldForFilter] = useState(null);
  const [recordsPerSearch, setRecordsPerSearch] = useState(tempData.recordsPerSearch || '');
  const [filterType, setFilterType] = useState(null);
  const [filterOrder, setFilterOrder] = useState(tempData.filterOrder || ['user', 'text', 'number', 'date', 'dropdown']);
  const headerRefs = useRef(new Map());
  const filterRefs = useRef(new Map());
  const hasInitialized = useRef(false);
  const prevStepRef = useRef(currentStep);
  const prevModalConfig = useRef(null);
  const [draggedHeaderIndex, setDraggedHeaderIndex] = useState(null);
  const [dragOverHeaderIndex, setDragOverHeaderIndex] = useState(null);

  // Ensure recordTypeFilters, objectTypeFilters, recordsPerSearch, and filterOrder are initialized in tempData
  useEffect(() => {
    if (!tempData.recordTypeFilters || !tempData.objectTypeFilters || !('recordsPerSearch' in tempData) || !tempData.filterOrder) {
      setTempData({
        ...tempData,
        recordTypeFilters: tempData.recordTypeFilters || {},
        objectTypeFilters: tempData.objectTypeFilters || {},
        recordsPerSearch: tempData.recordsPerSearch || null,
        filterOrder: tempData.filterOrder || ['user', 'text', 'number', 'date', 'dropdown'],
      });
    }
  }, [tempData, setTempData]);

  const sheetId = sheets.allSheets?.find((s) => s.sheetName === sheetName)?.docId;

  // Ensure recordTypeFilters always has all headers for each selected record type
  useEffect(() => {
    if (!allTemplates || selectedRecordTypes.length === 0) return;

    let changed = false;
    const updatedRecordTypeFilters = { ...(tempData.recordTypeFilters || {}) };

    selectedRecordTypes.forEach((typeOfRecords) => {
      const template = allTemplates.find((t) => t.typeOfRecord === typeOfRecords);
      if (!template) return;
      if (!updatedRecordTypeFilters[typeOfRecords]) {
        updatedRecordTypeFilters[typeOfRecords] = {};
        changed = true;
      }
      template.headers
        .filter((h) => h.key)
        .forEach((header) => {
          if (!(header.key in updatedRecordTypeFilters[typeOfRecords])) {
            updatedRecordTypeFilters[typeOfRecords][header.key] = {};
            changed = true;
          }
        });
    });

    Object.keys(updatedRecordTypeFilters).forEach((typeOfRecords) => {
      if (!selectedRecordTypes.includes(typeOfRecords)) {
        delete updatedRecordTypeFilters[typeOfRecords];
        changed = true;
      }
    });

    if (changed) {
      setTempData({
        ...tempData,
        recordTypeFilters: updatedRecordTypeFilters,
      });
    }
  }, [selectedRecordTypes, allTemplates, tempData, setTempData]);

  // Ensure objectTypeFilters always has all basicFields for each selected object
  useEffect(() => {
    const selectedObjectIds = Object.keys(selectedObjects).filter(id => selectedObjects[id]?.selected);
    if (!templateObjects || selectedObjectIds.length === 0) return;

    let changed = false;
    const updatedObjectTypeFilters = { ...(tempData.objectTypeFilters || {}) };

    selectedObjectIds.forEach((objectId) => {
      const object = templateObjects.find((o) => o.id === objectId);
      if (!object || !object.basicFields) return;
      
      const objectName = object.name;
      if (!updatedObjectTypeFilters[objectName]) {
        updatedObjectTypeFilters[objectName] = {};
        changed = true;
      }
      
      object.basicFields
        .filter((field) => field.key)
        .forEach((field) => {
          if (!(field.key in updatedObjectTypeFilters[objectName])) {
            updatedObjectTypeFilters[objectName][field.key] = {};
            changed = true;
          }
        });
    });

    Object.keys(updatedObjectTypeFilters).forEach((objectName) => {
      const objectExists = selectedObjectIds.some(id => {
        const obj = templateObjects.find(o => o.id === id);
        return obj && obj.name === objectName;
      });
      if (!objectExists) {
        delete updatedObjectTypeFilters[objectName];
        changed = true;
      }
    });

    if (changed) {
      setTempData({
        ...tempData,
        objectTypeFilters: updatedObjectTypeFilters,
      });
    }
  }, [selectedObjects, templateObjects, tempData, setTempData]);

  // Compute filter summary for display
  const getFilterSummary = useCallback(
    (recordType) => {
      const filters = tempData.recordTypeFilters?.[recordType] || {};
      const summaries = [];

      Object.entries(filters).forEach(([headerKey, filter]) => {
        if (headerKey === 'userFilter') {
          if (filter.headerKey) {
            const header = allTemplates
              .find((t) => t.typeOfRecord === recordType)
              ?.headers.find((h) => h.key === filter.headerKey);
            summaries.push(`${header?.name || filter.headerKey} = Current User`);
          }
          return;
        }
        const header = allTemplates
          .find((t) => t.typeOfRecord === recordType)
          ?.headers.find((h) => h.key === headerKey);
        if (!header) return;

        const headerName = header.name || headerKey;
        if (header.type === 'number' && (filter.start || filter.end)) {
          const start = filter.start || '';
          const end = filter.end || '';
          const sortOrder = filter.sortOrder ? ` (${filter.sortOrder})` : '';
          summaries.push(`${headerName}: ${start}${start && end ? ' – ' : ''}${end}${sortOrder}`);
        } else if (header.type === 'date' && filter.sortOrder) {
          summaries.push(`${headerName}: Sorted ${filter.sortOrder}`);
        } else if (header.type === 'dropdown' && filter.values?.length) {
          const sortOrder = filter.sortOrder ? ` (${filter.sortOrder})` : '';
          summaries.push(`${headerName}: ${filter.values.join(', ')}${sortOrder}`);
        } else if (filter.value) {
          const condition = filter.condition || filter.order || 'equals';
          const prefix = header.type === 'number'
            ? { equals: '=', greater: '>', less: '<', greaterOrEqual: '≥', lessOrEqual: '≤' }[condition] || ''
            : condition;
          const sortOrder = filter.sortOrder ? ` (${filter.sortOrder})` : '';
          summaries.push(`${headerName}: ${prefix} ${filter.value}${sortOrder}`);
        } else if (filter.sortOrder) {
          summaries.push(`${headerName}: (${filter.sortOrder})`);
        }
      });

      return summaries.length > 0 ? summaries.join('; ') : 'None';
    },
    [tempData.recordTypeFilters, allTemplates]
  );

  // Compute filter summary for object fields
  const getObjectFieldFilterSummary = useCallback(
    (field) => {
      const fieldKey = `${field.key}_${field.objectId}`;
      const filters = tempData.objectTypeFilters?.[fieldKey] || {};
      const summaries = [];

      Object.entries(filters).forEach(([filterKey, filter]) => {
        if (filterKey === 'userFilter') {
          summaries.push(`${field.name || field.key} = Current User`);
          return;
        }

        const fieldName = field.name || field.key;
        if (field.type === 'number' && (filter.start || filter.end)) {
          const start = filter.start || '';
          const end = filter.end || '';
          const sortOrder = filter.sortOrder ? ` (${filter.sortOrder})` : '';
          summaries.push(`${fieldName}: ${start}${start && end ? ' – ' : ''}${end}${sortOrder}`);
        } else if (field.type === 'date' && filter.sortOrder) {
          summaries.push(`${fieldName}: Sorted ${filter.sortOrder}`);
        } else if (field.type === 'dropdown' && filter.values?.length) {
          const sortOrder = filter.sortOrder ? ` (${filter.sortOrder})` : '';
          summaries.push(`${fieldName}: ${filter.values.join(', ')}${sortOrder}`);
        } else if (filter.value) {
          const condition = filter.condition || filter.order || 'equals';
          const prefix = field.type === 'number'
            ? { equals: '=', greater: '>', less: '<', greaterOrEqual: '≥', lessOrEqual: '≤' }[condition] || ''
            : condition;
          const sortOrder = filter.sortOrder ? ` (${filter.sortOrder})` : '';
          summaries.push(`${fieldName}: ${prefix} ${filter.value}${sortOrder}`);
        } else if (filter.sortOrder) {
          summaries.push(`${fieldName}: (${filter.sortOrder})`);
        }
      });

      return summaries.length > 0 ? summaries.join('; ') : 'None';
    },
    [tempData.objectTypeFilters]
  );

  // Handle save action
  const onDoneClick = useCallback(() => {
    let updatedRecordTypeFilters = { ...(tempData.recordTypeFilters || {}) };
    selectedRecordTypes.forEach((typeOfRecords) => {
      const template = allTemplates.find((t) => t.typeOfRecord === typeOfRecords);
      if (!template) return;
      if (!updatedRecordTypeFilters[typeOfRecords]) updatedRecordTypeFilters[typeOfRecords] = {};
      template.headers
        .filter((h) => h.key)
        .forEach((header) => {
          if (!(header.key in updatedRecordTypeFilters[typeOfRecords])) {
            updatedRecordTypeFilters[typeOfRecords][header.key] = {};
          }
        });
    });
    Object.keys(updatedRecordTypeFilters).forEach((typeOfRecords) => {
      if (!selectedRecordTypes.includes(typeOfRecords)) {
        delete updatedRecordTypeFilters[typeOfRecords];
      }
    });

    const cleanedRecordTypeFilters = {};
    Object.entries(updatedRecordTypeFilters).forEach(([recordType, filters]) => {
      const cleanedFilters = {};
      Object.entries(filters).forEach(([key, filter]) => {
        const cleanedFilter = {};
        Object.entries(filter).forEach(([field, value]) => {
          if (value !== undefined && value !== null) {
            cleanedFilter[field] = value;
          }
        });
        if (Object.keys(cleanedFilter).length > 0) {
          cleanedFilters[key] = cleanedFilter;
        }
      });
      if (Object.keys(cleanedFilters).length > 0) {
        cleanedRecordTypeFilters[recordType] = cleanedFilters;
      }
    });

    // Clean objectTypeFilters
    let updatedObjectTypeFilters = { ...(tempData.objectTypeFilters || {}) };
    selectedRecordTypes.forEach((typeOfRecords) => {
      if (!updatedObjectTypeFilters[typeOfRecords]) updatedObjectTypeFilters[typeOfRecords] = {};
    });

    Object.keys(updatedObjectTypeFilters).forEach((objectName) => {
      const selectedObjectIds = Object.keys(selectedObjects).filter(id => selectedObjects[id]?.selected);
      const objectExists = selectedObjectIds.some(id => {
        const obj = templateObjects.find(o => o.id === id);
        return obj && obj.name === objectName;
      });
      if (!objectExists) {
        delete updatedObjectTypeFilters[objectName];
      }
    });

    const cleanedObjectTypeFilters = {};
    Object.entries(updatedObjectTypeFilters).forEach(([objectName, filters]) => {
      const cleanedFilters = {};
      Object.entries(filters).forEach(([key, filter]) => {
        const cleanedFilter = {};
        Object.entries(filter).forEach(([field, value]) => {
          if (value !== undefined && value !== null) {
            cleanedFilter[field] = value;
          }
        });
        if (Object.keys(cleanedFilter).length > 0) {
          cleanedFilters[key] = cleanedFilter;
        }
      });
      if (Object.keys(cleanedFilters).length > 0) {
        cleanedObjectTypeFilters[objectName] = cleanedFilters;
      }
    });

    setTempData({
      sheetName,
      currentHeaders,
      typeOfRecordsToDisplay: selectedRecordTypes,
      recordTypeFilters: cleanedRecordTypeFilters,
      objectTypeFilters: cleanedObjectTypeFilters,
      recordsPerSearch,
      filterOrder,
      selectedObjects,
    });
    
    // Clear cache when sheet name changes or when typeOfRecordsToDisplay changes
    const typeOfRecordsChanged = JSON.stringify(selectedRecordTypes) !== JSON.stringify(tempData.typeOfRecordsToDisplay);
    if (sheetName !== tempData.sheetName) {
      setActiveSheetName(sheetName);
      clearFetchedSheets();
    } else if (typeOfRecordsChanged) {
      // Clear cache for current sheet when record types change
      clearFetchedSheets(sheetId);
    }
    
    handleClose({ fromSave: true });
  }, [
    sheetName,
    currentHeaders,
    selectedRecordTypes,
    recordsPerSearch,
    filterOrder,
    selectedObjects,
    setTempData,
    tempData.sheetName,
    tempData.recordTypeFilters,
    setActiveSheetName,
    clearFetchedSheets,
    handleClose,
    allTemplates,
  ]);

  const handleBackClick = useCallback(() => {
    setNavigationDirection('backward');
    goBack();
  }, [goBack]);

  // Initialize modal steps and configuration
  useEffect(() => {
    if (!hasInitialized.current) {
      const steps = [
        { title: isEditMode ? 'Edit Sheet' : 'Create Sheet', rightButton: null },
        { title: 'Headers', rightButton: null },
        { title: 'Select Templates', rightButton: null },
        { title: 'Select Headers', rightButton: null },
        { title: 'Filters', rightButton: null },
        { title: 'Select Record Templates', rightButton: null },
        { title: 'Filters for Record Type', rightButton: null },
        { title: 'Add Filter', rightButton: null },
        { title: 'Select Object Fields', rightButton: null },
      ];
      registerModalSteps({ steps });
      const initialConfig = {
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: isEditMode ? 'Edit Sheet' : 'Create Sheet',
        backButtonTitle: '',
        rightButton: null,
        leftButton: null,
        onDoneClick,
      };
      setModalConfig(initialConfig);
      prevModalConfig.current = initialConfig;
      hasInitialized.current = true;
    }
  }, [isEditMode, registerModalSteps, setModalConfig, onDoneClick]);

  // Track navigation direction
  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      setNavigationDirection(currentStep > prevStepRef.current ? 'forward' : 'backward');
      prevStepRef.current = currentStep;
    }
  }, [currentStep]);

  // Configure modal for each step
  useEffect(() => {
    const step1Title = isEditMode ? 'Edit Sheet' : 'Create Sheet';
    let config;
    if (currentStep === 1) {
      config = {
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        allowClose: true,
        title: step1Title,
        backButtonTitle: '',
        leftButton: null,
        rightButton: null,
        onDoneClick,
      };
    } else if (currentStep === 2) {
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: 'Headers',
        backButtonTitle: step1Title,
        backButton: {
          label: `< ${step1Title}`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 3) {
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: 'Select Templates',
        backButtonTitle: 'Headers',
        backButton: {
          label: `< Headers`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 4) {
      const templateName = allTemplates.find((t) => t.typeOfRecord === selectedTemplateForHeaders)?.name || selectedTemplateForHeaders || 'Unknown';
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: `Headers for ${templateName}`,
        backButtonTitle: 'Select Templates',
        backButton: {
          label: `< Select Templates`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 5) {
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: 'Filters',
        backButtonTitle: step1Title,
        backButton: {
          label: `< ${step1Title}`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 6) {
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: 'Select Record Templates',
        backButtonTitle: step1Title,
        backButton: {
          label: `< ${step1Title}`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 7) {
      const recordTypeName = allTemplates.find((t) => t.typeOfRecord === selectedRecordTypeForFilter)?.name || selectedRecordTypeForFilter || 'Unknown';
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: `Filters for ${recordTypeName}`,
        backButtonTitle: 'Select Record Templates',
        backButton: {
          label: `< Select Record Templates`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 8) {
      const filterTypeTitle = {
        text: 'Add Text Filter',
        number: 'Add Number Filter',
        date: 'Add Date Filter',
        user: 'Restrict by User',
        dropdown: 'Add Dropdown Filter',
      }[filterType] || 'Add Filter';
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: filterTypeTitle,
        backButtonTitle: `Filters for ${allTemplates.find((t) => t.typeOfRecord === selectedRecordTypeForFilter)?.name || selectedRecordTypeForFilter || 'Unknown'}`,
        backButton: {
          label: `< Filters for ${allTemplates.find((t) => t.typeOfRecord === selectedRecordTypeForFilter)?.name || selectedRecordTypeForFilter || 'Unknown'}`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    } else if (currentStep === 9) {
      config = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        allowClose: false,
        title: 'Select Object Fields',
        backButtonTitle: 'Headers',
        backButton: {
          label: `< Headers`,
          onClick: handleBackClick,
        },
        leftButton: null,
        rightButton: null,
      };
    }

    if (JSON.stringify(config) !== JSON.stringify(prevModalConfig.current)) {
      setModalConfig(config);
      prevModalConfig.current = config;
    }
  }, [currentStep, isEditMode, handleBackClick, setModalConfig, onDoneClick, selectedTemplateForHeaders, selectedRecordTypeForFilter, allTemplates, filterType]);

  // Sync tempData with state changes
  useEffect(() => {
    const newTempData = {
      sheetName,
      currentHeaders,
      typeOfRecordsToDisplay: selectedRecordTypes,
      recordTypeFilters: tempData.recordTypeFilters || {},
      recordsPerSearch,
      filterOrder,
      selectedObjects,
    };
    if (
      newTempData.sheetName !== tempData.sheetName ||
      JSON.stringify(newTempData.currentHeaders) !== JSON.stringify(tempData.currentHeaders) ||
      JSON.stringify(newTempData.typeOfRecordsToDisplay) !== JSON.stringify(tempData.typeOfRecordsToDisplay) ||
      JSON.stringify(newTempData.recordTypeFilters) !== JSON.stringify(tempData.recordTypeFilters) ||
      newTempData.recordsPerSearch !== tempData.recordsPerSearch ||
      JSON.stringify(newTempData.filterOrder) !== JSON.stringify(tempData.filterOrder) ||
      JSON.stringify(newTempData.selectedObjects) !== JSON.stringify(tempData.selectedObjects)
    ) {
      setTempData(newTempData);
    }
  }, [sheetName, currentHeaders, selectedRecordTypes, recordsPerSearch, filterOrder, selectedObjects, tempData.recordTypeFilters, tempData.selectedObjects, setTempData]);

  // Sync state from tempData changes (for loading existing sheets)
  useEffect(() => {
    if (tempData.currentHeaders) {
      const uniqueHeaders = [];
      const seenKeys = new Set();
      tempData.currentHeaders.forEach((header) => {
        // Create unique key considering both key and objectId for object fields
        const uniqueKey = header.objectId ? `${header.key}_${header.objectId}` : header.key;
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          uniqueHeaders.push({ ...header, options: header.options || [] });
        }
      });
      setCurrentHeaders(uniqueHeaders);
    }
  }, [tempData.currentHeaders]);

  useEffect(() => {
    if (tempData.selectedObjects) {
      setSelectedObjects(tempData.selectedObjects);
    }
  }, [tempData.selectedObjects]);

  useEffect(() => {
    if (tempData.typeOfRecordsToDisplay) {
      const selectedTypes = tempData.typeOfRecordsToDisplay;
      const templatesMap = {};
      
      templateObjects.forEach(object => {
        templatesMap[object.id] = {
          selectedTemplates: []
        };
      });
      
      selectedTypes.forEach(typeOfRecord => {
        const template = allTemplates.find(t => t.typeOfRecord === typeOfRecord);
        if (template) {
          const objectId = template.objectId;
          if (!templatesMap[objectId]) {
            templatesMap[objectId] = { selectedTemplates: [] };
          }
          templatesMap[objectId].selectedTemplates.push(typeOfRecord);
        }
      });
      
      setSelectedTemplates(templatesMap);
    }
  }, [tempData.typeOfRecordsToDisplay, allTemplates, templateObjects]);

  useEffect(() => {
    if (tempData.sheetName !== undefined) {
      setSheetName(tempData.sheetName);
    }
  }, [tempData.sheetName]);

  useEffect(() => {
    if (tempData.recordsPerSearch !== undefined) {
      setRecordsPerSearch(tempData.recordsPerSearch || '');
    }
  }, [tempData.recordsPerSearch]);

  useEffect(() => {
    if (tempData.filterOrder) {
      setFilterOrder(tempData.filterOrder);
    }
  }, [tempData.filterOrder]);

  // New functions for object-based selection
  const toggleObjectSelection = useCallback((objectId) => {
    setSelectedObjects(prev => {
      const wasSelected = prev[objectId]?.selected;
      const newSelected = !wasSelected;
      if (!newSelected) {
        // De-selecting, remove headers
        setCurrentHeaders(current => current.filter(h => h.objectId !== objectId));
      }
      return {
        ...prev,
        [objectId]: {
          ...prev[objectId],
          selected: newSelected
        }
      };
    });
  }, []);

  const toggleTemplateInObject = useCallback((objectId, typeOfRecord) => {
    setSelectedTemplates(prev => {
      const newSelected = { ...prev };
      if (!newSelected[objectId]) return prev;
      
      const templateIndex = newSelected[objectId].selectedTemplates.indexOf(typeOfRecord);
      if (templateIndex > -1) {
        // Remove template
        newSelected[objectId].selectedTemplates.splice(templateIndex, 1);
        // Clean up filters
        const updatedFilters = { ...tempData.recordTypeFilters };
        delete updatedFilters[typeOfRecord];
        setTempData({ ...tempData, recordTypeFilters: updatedFilters });
        // Remove headers
        const template = allTemplates.find(t => t.typeOfRecord === typeOfRecord);
        if (template) {
          setCurrentHeaders(current => current.filter(h => !(h.objectId == null && template.headers.some(th => th.key === h.key))));
        }
      } else {
        // Add template
        newSelected[objectId].selectedTemplates.push(typeOfRecord);
      }
      return newSelected;
    });
  }, [tempData, setTempData, allTemplates]);

  const toggleHeaderSelection = useCallback((header, objectId = null) => {
    setCurrentHeaders((prev) => {
      // Handle both object field case (key, objectId) and template field case (header object)
      const headerKey = typeof header === 'string' ? header : header.key;
      const headerObjectId = objectId;

      const exists = prev.some((h) => h.key === headerKey && h.objectId === headerObjectId);
      if (exists) {
        return prev.filter((h) => !(h.key === headerKey && h.objectId === headerObjectId));
      } else {
        // If header is a string (object field), we need to find the field data
        if (typeof header === 'string') {
          // Find the field in templateObjects
          const fieldData = templateObjects
            .flatMap(obj => (obj.basicFields || []).map(field => ({ ...field, objectId: obj.id, objectName: obj.name })))
            .find(field => field.key === header && field.objectId === objectId);

          if (!fieldData) return prev;

          return [
            ...prev,
            {
              key: fieldData.key,
              name: fieldData.name,
              type: fieldData.type,
              options: fieldData.options || [],
              section: "Object Fields",
              objectId: fieldData.objectId,
              visible: true,
              hidden: false,
            },
          ];
        } else {
          // Template field case
          return [
            ...prev,
            {
              key: header.key,
              name: header.name,
              type: header.type,
              options: header.options || [],
              section: header.section,
              visible: true,
              hidden: false,
            },
          ];
        }
      }
    });
  }, [templateObjects]);

  const togglePin = useCallback(
    (headerKey) => {
      setPinnedStates((prev) => ({
        ...prev,
        [headerKey]: !prev[headerKey],
      }));
      onPinToggle(headerKey);
    },
    [onPinToggle]
  );

  const toggleVisible = useCallback((index) => {
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      newHeaders[index] = { ...newHeaders[index], visible: !newHeaders[index].visible };
      return newHeaders;
    });
  }, []);

  const toggleHidden = useCallback((index) => {
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      newHeaders[index] = { ...newHeaders[index], hidden: !newHeaders[index].hidden };
      return newHeaders;
    });
  }, []);

  const removeHeader = useCallback((headerKey) => {
    setCurrentHeaders((prev) => {
      const newHeaders = prev.filter((h) => h.key !== headerKey);
      setPinnedStates((prev) => {
        const newPinned = { ...prev };
        delete newPinned[headerKey];
        return newPinned;
      });
      return newHeaders;
    });
  }, []);

  const handleSheetNameChange = useCallback(
    (e) => {
      if (sheetId === 'primarySheet') {
        return;
      }
      setSheetName(e.target.value);
    },
    [sheetId]
  );

  const handleFilterClick = useCallback(
    (typeOfRecords) => {
      if (!typeOfRecords) return;
      if (!tempData.recordTypeFilters?.[typeOfRecords]) {
        setTempData({
          ...tempData,
          recordTypeFilters: {
            ...tempData.recordTypeFilters,
            [typeOfRecords]: {},
          },
        });
      }
      setSelectedRecordTypeForFilter(typeOfRecords);
      setNavigationDirection('forward');
      goToStep(7);
    },
    [goToStep, tempData, setTempData]
  );

  const handleObjectFieldFilterClick = useCallback(
    (field) => {
      if (!field) return;
      const fieldKey = `${field.key}_${field.objectId}`;
      if (!tempData.objectTypeFilters?.[fieldKey]) {
        setTempData({
          ...tempData,
          objectTypeFilters: {
            ...tempData.objectTypeFilters,
            [fieldKey]: {},
          },
        });
      }
      setSelectedObjectFieldForFilter(field);
      setFilterType(null);
      setNavigationDirection('forward');
      goToStep(7);
    },
    [goToStep, tempData, setTempData]
  );

  const handleAddFilterClick = useCallback(
    (typeOfRecords, filterType) => {
      setSelectedRecordTypeForFilter(typeOfRecords);
      setFilterType(filterType);
      setNavigationDirection('forward');
      goToStep(8);
    },
    [goToStep]
  );

  const handleTemplateClick = useCallback(
    (typeOfRecords) => {
      setSelectedTemplateForHeaders(typeOfRecords);
      setNavigationDirection('forward');
      goToStep(4);
    },
    [goToStep]
  );

  const handleAddRecordTemplateClick = useCallback((e) => {
    e.stopPropagation();
    setNavigationDirection('forward');
    goToStep(6);
  }, [goToStep]);

  const handleRecordsPerSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      const numValue = value === '' ? null : parseInt(value, 10);

      if (value === '' || (numValue >= 1 && !isNaN(numValue))) {
        setRecordsPerSearch(value);
        setTempData((prev) => ({
          ...prev,
          recordsPerSearch: numValue,
        }));
      }
    },
    [setTempData]
  );

  const isFilterEmpty = useCallback(
    (filter) =>
      Object.keys(filter).length === 0 ||
      (!filter.start && !filter.end && !filter.value && !filter.values?.length && !filter.headerKey),
    []
  );

  // --- DRAG STATE (restore old logic) ---
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchTargetIndex, setTouchTargetIndex] = useState(null);

  // --- DRAG HANDLERS (restore old logic) ---
  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    const element = headerRefs.current.get(index);
    if (element) element.classList.add(styles.dragging);
  }, [styles.dragging]);

  const handleTouchStart = useCallback((e, index) => {
    if (e.target.classList.contains(styles.dragIcon)) {
      e.preventDefault();
      setDraggedIndex(index);
      setTouchStartY(e.touches[0].clientY);
      setTouchTargetIndex(index);
      const element = headerRefs.current.get(index);
      if (element) element.classList.add(styles.dragging);
    }
  }, [styles.dragIcon]);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setCurrentHeaders((prev) => {
      const newHeaders = [...prev];
      const [draggedItem] = newHeaders.splice(draggedIndex, 1);
      newHeaders.splice(index, 0, draggedItem);
      setDraggedIndex(index);
      return newHeaders;
    });
  }, [draggedIndex, setCurrentHeaders]);

  const handleTouchMove = useCallback((e, index) => {
    if (draggedIndex === null || touchStartY === null) return;
    e.preventDefault();
    const touchY = e.touches[0].clientY;
    const itemHeight = 48;
    const delta = Math.round((touchY - touchStartY) / itemHeight);
    const newIndex = Math.max(0, Math.min(touchTargetIndex + delta, currentHeaders.length - 1));
    if (newIndex !== draggedIndex) {
      setCurrentHeaders((prev) => {
        const newHeaders = [...prev];
        const [draggedItem] = newHeaders.splice(draggedIndex, 1);
        newHeaders.splice(newIndex, 0, draggedItem);
        setDraggedIndex(newIndex);
        return newHeaders;
      });
    }
  }, [draggedIndex, touchStartY, touchTargetIndex, currentHeaders.length, setCurrentHeaders]);

  const handleDragEnd = useCallback(() => {
    const element = headerRefs.current.get(draggedIndex);
    if (element) element.classList.remove(styles.dragging);
    setDraggedIndex(null);
  }, [draggedIndex, styles.dragging]);

  const handleTouchEnd = useCallback(() => {
    const element = headerRefs.current.get(draggedIndex);
    if (element) element.classList.remove(styles.dragging);
    setDraggedIndex(null);
    setTouchStartY(null);
    setTouchTargetIndex(null);
  }, [draggedIndex, styles.dragging]);

  return (
    <div className={`${styles.sheetModal} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={styles.viewContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((step) => (
          <div
            key={step}
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ''} ${
              step !== currentStep ? styles.hidden : ''
            } ${
              step === currentStep && navigationDirection === 'forward' ? styles.animateForward : ''
            } ${
              step === currentStep && navigationDirection === 'backward' ? styles.animateBackward : ''
            }`}
            style={{ display: step !== currentStep ? 'none' : 'block' }}
          >
            {step === 1 && (
              <>
                <div className={styles.section}>
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Sheet Details</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Give your sheet a name and choose what to manage.</p>
                  <input
                    type="text"
                    value={sheetName}
                    onChange={handleSheetNameChange}
                    placeholder={isEditMode ? 'Rename sheet' : 'Sheet Name'}
                    className={`${styles.sheetNameInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                    disabled={sheetId === 'primarySheet'}
                  />
                </div>
                <div className={styles.section}>
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Choose What to Configure</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Set up the data types, columns, and filters for your sheet.</p>
                  <div className={`${styles.configGrid} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    <div
                      onClick={() => {
                        setNavigationDirection('forward');
                        goToStep(6);
                      }}
                      className={`${styles.configRecord} ${isDarkTheme ? styles.darkTheme : ''}`}
                      role="button"
                      aria-label="Select Record Templates"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setNavigationDirection('forward');
                          goToStep(6);
                        }
                      }}
                    >
                      <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <IoMdOptions size={28} />
                      </div>
                      <div className={styles.recordContent}>
                        <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Data Types</h3>
                        <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Choose which record templates to include</p>
                        <div className={`${styles.recordBadge} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          {selectedRecordTypes.length} selected
                        </div>
                      </div>
                    </div>
                    <div
                      onClick={() => {
                        setNavigationDirection('forward');
                        goToStep(2);
                      }}
                      className={`${styles.configRecord} ${isDarkTheme ? styles.darkTheme : ''}`}
                      role="button"
                      aria-label="Manage Headers"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setNavigationDirection('forward');
                          goToStep(2);
                        }
                      }}
                    >
                      <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <IoMdList size={28} />
                      </div>
                      <div className={styles.recordContent}>
                        <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Columns</h3>
                        <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Set up and organize your data columns</p>
                        <div className={`${styles.recordBadge} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          {currentHeaders.length} configured
                        </div>
                      </div>
                    </div>
                    <div
                      onClick={() => {
                        setNavigationDirection('forward');
                        goToStep(5);
                      }}
                      className={`${styles.configRecord} ${isDarkTheme ? styles.darkTheme : ''}`}
                      role="button"
                      aria-label="Manage Filters"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setNavigationDirection('forward');
                          goToStep(5);
                        }
                      }}
                    >
                      <div className={`${styles.recordIcon} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <IoMdFunnel size={28} />
                      </div>
                      <div className={styles.recordContent}>
                        <h3 className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Filters</h3>
                        <p className={`${styles.recordDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Filter and refine your data display</p>
                        <div className={`${styles.recordBadge} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          Configure
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {isEditMode && sheetId !== 'primarySheet' && (
                  <div className={styles.section}>
                    <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Danger Zone</h2>
                    <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Permanently delete this sheet and all its data.</p>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to delete the sheet "${sheetName}"? This action cannot be undone.`
                          )
                        ) {
                          onDeleteSheet(sheetName);
                          handleClose({ fromDelete: true });
                        }
                      }}
                      className={`${styles.deleteSheetButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      aria-label="Delete Sheet"
                    >
                      Delete Sheet
                    </button>
                  </div>
                )}
              </>
            )}
            {step === 2 && (
              <div className={styles.section}>
                <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Manage Your Columns</h2>
                <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Add object fields as columns to your sheet. Drag to reorder, pin important ones, and toggle visibility.</p>
                <button
                  className={`${styles.addHeaderButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  type="button"
                  style={{ width: '100%', marginBottom: 12, textAlign: 'left' }}
                  onClick={() => {
                    setNavigationDirection('forward');
                    goToStep(9);
                  }}
                >
                  Add object field
                </button>
                <div className={`${styles.prioritizedHeadersList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {currentHeaders.length === 0 && (
                    <div className={`${styles.noPrioritizedHeaders} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      No columns added yet. Tap "Add object field" to get started.
                    </div>
                  )}
                  {currentHeaders.map((header, index) => {
                    // All headers are now draggable
                    return (
                      <div
                        ref={(el) => headerRefs.current.set(index, el)}
                        key={header.key}
                        className={
                          `${styles.headerItem} ${draggedIndex === index ? styles.dragging : ''} ${isDarkTheme ? styles.darkTheme : ''}`
                        }
                        draggable={true}
                        onDragStart={(e) => {
                          // Always allow drag to start, but only show drag feedback if dragIcon is used
                          if (e.target.classList.contains(styles.dragIcon)) {
                            handleDragStart(e, index);
                          } else {
                            handleDragStart(e, index); // fallback: allow drag from row for mouse users
                          }
                        }}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onTouchStart={(e) => {
                          if (e.target.classList.contains(styles.dragIcon)) {
                            handleTouchStart(e, index);
                          } // else: do nothing for touch if not dragIcon
                        }}
                        onTouchMove={(e) => handleTouchMove(e, index)}
                        onTouchEnd={handleTouchEnd}
                        style={{ cursor: 'default' }}
                      >
                        <div className={styles.headerRow}>
                          <div className={styles.headerLeft}>
                            <button
                              onClick={() => togglePin(header.key)}
                              className={`${styles.actionButton} ${pinnedStates[header.key] ? styles.pinned : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                            >
                              <FaThumbtack />
                            </button>
                            {pinnedStates[header.key] && (
                              <button
                                onClick={() => removeHeader(header.key)}
                                className={`${styles.removeTextButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                              >
                                Remove
                              </button>
                            )}
                            <span className={`${styles.headerName} ${isDarkTheme ? styles.darkTheme : ''}`}>{header.name}</span>
                          </div>
                          <div className={styles.actions}>
                            <button
                              onClick={() => toggleHidden(index)}
                              className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                            >
                              {header.hidden ? <MdFilterAltOff /> : <MdFilterAlt />}
                            </button>
                            <button
                              onClick={() => toggleVisible(index)}
                              className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                            >
                              {header.visible ? <FaEye /> : <FaEyeSlash />}
                            </button>
                            <div className={styles.buttonSpacer}></div>
                            <MdDragIndicator
                              size={16}
                              className={`${styles.dragIcon} ${isDarkTheme ? styles.darkTheme : ''}`}
                              style={{ pointerEvents: 'auto', opacity: 1 }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {step === 3 && (
              <div className={styles.section}>
                <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Choose a Template</h2>
                <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Select a record template to add columns from. Templates define the structure of your data.</p>
                <div className={`${styles.recordTypeList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {allTemplates.length === 0 ? (
                    <div className={`${styles.noRecords} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      No templates available. Create templates first in the main app.
                    </div>
                  ) : allTemplates.filter((template) => selectedRecordTypes.includes(template.typeOfRecord)).length === 0 ? (
                    <div className={`${styles.noRecords} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      No record types selected. Go back to "Data Types" to select templates first.
                    </div>
                  ) : (
                    allTemplates
                      .filter((template) => selectedRecordTypes.includes(template.typeOfRecord))
                      .map((template) => (
                      <div
                        key={template.typeOfRecord}
                        className={`${styles.recordTypeItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                        onClick={() => handleTemplateClick(template.typeOfRecord)}
                      >
                        <div className={styles.templateRow}>
                          <span className={`${styles.recordTypeName} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            {template.name ? template.name.charAt(0).toUpperCase() + template.name.slice(1).toLowerCase() : template.typeOfRecord.charAt(0).toUpperCase() + template.typeOfRecord.slice(1).toLowerCase()}
                          </span>
                          <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            <IoChevronForward size={16} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            {step === 4 && (
              <div className={styles.section}>
                <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Manage Your Columns</h2>
                <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Select which object fields to include as columns in your sheet. You can reorder them later.</p>
                <div className={`${styles.recordTypeList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {(() => {
                    // Get all basic fields from selected objects
                    const allBasicFields = templateObjects
                      .filter(object => selectedObjects[object.id]?.selected)
                      .flatMap(object => 
                        (object.basicFields || []).map(field => ({
                          ...field,
                          objectId: object.id,
                          objectName: object.name,
                          key: `${field.key}_${object.id}`, // Make key unique per object
                        }))
                      );
                    
                    const groupedFields = allBasicFields.reduce((acc, field) => {
                      const objectName = field.objectName;
                      if (!acc[objectName]) acc[objectName] = [];
                      acc[objectName].push(field);
                      return acc;
                    }, {});
                    
                    return Object.keys(groupedFields).length === 0 ? (
                      <div className={`${styles.noRecords} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        No objects selected. Go back to Choose Data Types to select objects first.
                      </div>
                    ) : (
                      Object.entries(groupedFields).map(([objectName, fields]) => (
                        <div key={objectName} className={`${styles.sectionGroup} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          <h4 className={`${styles.sectionGroupTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>{objectName}</h4>
                          {fields.map((field) => (
                            <div
                              key={field.key}
                              className={`${styles.recordTypeItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                              onClick={() => toggleHeaderSelection({
                                key: field.key,
                                name: field.name,
                                type: field.type,
                                options: field.options || [],
                                objectId: field.objectId,
                              })}
                            >
                              <div className={styles.recordTypeRow}>
                                <span className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                  {currentHeaders.some((h) => h.key === field.key && h.objectId === field.objectId) ? (
                                    <FaRegCheckCircle size={18} className={`${styles.checked} ${isDarkTheme ? styles.darkTheme : ''}`} />
                                  ) : (
                                    <FaRegCircle size={18} />
                                  )}
                                </span>
                                <span className={`${styles.recordTypeName} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                  {field.name ? field.name.charAt(0).toUpperCase() + field.name.slice(1).toLowerCase() : field.key.charAt(0).toUpperCase() + field.key.slice(1).toLowerCase()}
                                </span>
                                <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                  <IoChevronForward size={16} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    );
                  })()}
                </div>
              </div>
            )}
            {step === 5 && (
              <div className={styles.section}>
                <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Configure Data Filters</h2>
                <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Configure filters for your selected object fields. You can filter by text, numbers, dates, and more.</p>
                <div className={`${styles.prioritizedHeadersList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {(() => {
                    const selectedObjectIds = Object.keys(selectedObjects).filter(id => selectedObjects[id]?.selected);
                    const allObjectFields = templateObjects
                      .filter(object => selectedObjectIds.includes(object.id))
                      .flatMap(object => 
                        (object.basicFields || []).map(field => ({
                          ...field,
                          objectId: object.id,
                          objectName: object.name,
                          key: `${field.key}_${object.id}`,
                        }))
                      );
                    
                    return allObjectFields.length === 0 ? (
                      <div className={`${styles.noPrioritizedHeaders} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        No objects selected. Go back to Choose Data Types to select objects first.
                      </div>
                    ) : (
                      allObjectFields.map((field) => (
                        <div
                          key={field.key}
                          onClick={() => handleObjectFieldFilterClick(field)}
                          className={`${styles.prioritizedHeaderItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                          role="button"
                          aria-label={`Filters for ${field.name || field.key}`}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              handleObjectFieldFilterClick(field);
                            }
                          }}
                        >
                          <span className={`${styles.headerName} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            {field.name
                              ? field.name.charAt(0).toUpperCase() + field.name.slice(1).toLowerCase()
                              : field.key.charAt(0).toUpperCase() + field.key.slice(1).toLowerCase()}
                            <span className={`${styles.objectName} ${isDarkTheme ? styles.darkTheme : ''}`}>
                              ({field.objectName})
                            </span>
                          </span>
                          <span className={`${styles.filterSummary} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            {getObjectFieldFilterSummary(field)}
                          </span>
                          <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            <IoChevronForward size={16} />
                          </div>
                        </div>
                      ))
                    );
                  })()}
                </div>
              </div>
            )}
            {step === 6 && (
              <div className={styles.section}>
                <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Choose Data Types</h2>
                <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Choose which objects to include in this sheet. All templates within selected objects will be available for display.</p>
                <div className={`${styles.recordTypeList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {templateObjects.length === 0 ? (
                    <div className={`${styles.noRecords} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      No objects available. Create objects and templates first in the main app.
                    </div>
                  ) : (
                    templateObjects.map((object) => {
                      const isObjectSelected = selectedObjects[object.id]?.selected || false;
                      
                      return (
                        <div key={object.id}>
                          <div
                            className={`${styles.objectItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                          >
                            <div className={styles.recordTypeRow}>
                              <span 
                                className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ''}`}
                                onClick={() => toggleObjectSelection(object.id)}
                              >
                                {isObjectSelected ? (
                                  <FaRegCheckCircle size={18} className={styles.checked} />
                                ) : (
                                  <FaRegCircle size={18} />
                                )}
                              </span>
                              <span className={`${styles.recordTypeName} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                {object.name}
                              </span>
                              <span className={`${styles.objectTemplatesCount} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                {(object.templates || []).length} templates
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {step === 7 && (
              (selectedRecordTypeForFilter || selectedObjectFieldForFilter) ? (
                <div className={styles.section}>
                  <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Set Up Filters</h2>
                  <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Set up filters to narrow down the data shown in this sheet. You can filter by text, numbers, dates, and more.</p>
                  
                  {/* Records per search - moved to top and made more prominent */}
                  <div className={`${styles.configRecord} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    <div className={styles.recordContent}>
                      <div className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Records per Search</div>
                      <div className={styles.recordDescription}>Limit the number of records displayed per search to improve performance</div>
                      <div className={styles.inputContainer}>
                        <input
                          type="number"
                          value={recordsPerSearch}
                          onChange={handleRecordsPerSearchChange}
                          placeholder="Enter limit (optional)"
                          className={`${styles.fetchLimitInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                          min="1"
                          step="1"
                          aria-label="Records Fetch Limit"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className={`${styles.filterListSection}`}>
                    {selectedObjectFieldForFilter ? (
                      <div className={`${styles.objectFieldFilter} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <p>Object field filtering for {selectedObjectFieldForFilter.name || selectedObjectFieldForFilter.key} will be implemented here.</p>
                      </div>
                    ) : (
                      <RecordTypeFilterLikeFilterModal
                        recordType={selectedRecordTypeForFilter}
                        headers={allTemplates.find((t) => t.typeOfRecord === selectedRecordTypeForFilter)?.headers || []}
                        tempData={tempData}
                        setTempData={setTempData}
                        isDarkTheme={isDarkTheme}
                        showOnlyUserFilter={false}
                        filterType={null}
                      />
                    )}
                  </div>
                  <div className={`${styles.footer} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    <button
                      onClick={() => {
                        setTempData({
                          ...tempData,
                          recordTypeFilters: {
                            ...tempData.recordTypeFilters,
                            [selectedRecordTypeForFilter]: {},
                          },
                          recordsPerSearch: null,
                        });
                        setRecordsPerSearch('');
                      }}
                      className={`${styles.resetButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      disabled={
                        !Object.entries(tempData.recordTypeFilters?.[selectedRecordTypeForFilter] || {}).some(
                          ([key, filter]) =>
                            Object.keys(filter).length > 0 &&
                            (key !== 'userFilter' || (key === 'userFilter' && filter.headerKey)) &&
                            !isFilterEmpty(filter)
                        ) && !tempData.recordsPerSearch
                      }
                    >
                      Reset All
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`${styles.noRecords} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  No record type selected for filtering
                </div>
              )
            )}
            {step === 8 && (
              <div className={styles.section}>
                <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Customize Filter</h2>
                <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Configure a specific filter for this record type. Choose the field and set your criteria.</p>
                <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {selectedRecordTypeForFilter && (
                    <RecordTypeFilterLikeFilterModal
                      recordType={selectedRecordTypeForFilter}
                      headers={allTemplates.find((t) => t.typeOfRecord === selectedRecordTypeForFilter)?.headers || []}
                      tempData={tempData}
                      setTempData={setTempData}
                      isDarkTheme={isDarkTheme}
                      showOnlyUserFilter={filterType === 'user'}
                      filterType={filterType}
                    />
                  )}
                </div>
              </div>
            )}
            {step === 9 && (
              <div className={styles.section}>
                <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Select Object Fields</h2>
                <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>Choose object-level fields to add as columns. These fields are shared across all templates within an object.</p>
                <div className={`${styles.recordTypeList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {templateObjects.filter(object => selectedObjects[object.id]?.selected).length === 0 ? (
                    <div className={`${styles.noRecords} ${isDarkTheme ? styles.darkTheme : ''}`}>
                      No objects available. Create objects and templates first in the main app.
                    </div>
                  ) : (
                    templateObjects.filter(object => selectedObjects[object.id]?.selected).map((object) => {
                      const objectBasicFields = object.basicFields || [];
                      const isExpanded = expandedObjects.has(object.id);
                      
                      return (
                        <div key={object.id}>
                          <div
                            className={`${styles.objectItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                            onClick={() => {
                              setExpandedObjects(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(object.id)) {
                                  newSet.delete(object.id);
                                } else {
                                  newSet.add(object.id);
                                }
                                return newSet;
                              });
                            }}
                          >
                            <div className={styles.recordTypeRow}>
                              <span className={`${styles.objectName} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                {object.name || object.id}
                              </span>
                              <div className={`${styles.recordArrow} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                {isExpanded ? <IoChevronDown size={16} /> : <IoChevronForward size={16} />}
                              </div>
                            </div>
                          </div>
                          {isExpanded && objectBasicFields.length > 0 && (
                            <div className={`${styles.templateList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                              {objectBasicFields.map((field) => {
                                const isSelected = currentHeaders.some((h) => h.key === field.key && h.objectId === object.id);
                                return (
                                  <div
                                    key={field.key}
                                    className={`${styles.templateItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                                    onClick={() => toggleHeaderSelection(field.key, object.id)}
                                  >
                                    <div className={styles.recordTypeRow}>
                                      <span 
                                        className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ''}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleHeaderSelection(field.key, object.id);
                                        }}
                                      >
                                        {isSelected ? (
                                          <FaRegCheckCircle size={18} />
                                        ) : (
                                          <FaRegCircle size={18} />
                                        )}
                                      </span>
                                      <span className={`${styles.recordTypeName} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                        {field.name || field.key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                                      </span>
                                      <span className={`${styles.fieldType} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                        {field.type || 'text'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {isExpanded && objectBasicFields.length === 0 && (
                            <div className={`${styles.noFields} ${isDarkTheme ? styles.darkTheme : ''}`}>
                              No object fields defined for this object.
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

EditSheetsModal.propTypes = {
  isEditMode: PropTypes.bool,
  tempData: PropTypes.shape({
    sheetName: PropTypes.string,
    currentHeaders: PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.string.isRequired,
        name: PropTypes.string,
        type: PropTypes.string,
        options: PropTypes.arrayOf(PropTypes.string),
        visible: PropTypes.bool,
        hidden: PropTypes.bool,
        objectId: PropTypes.string,
      })
    ),
    typeOfRecordsToDisplay: PropTypes.arrayOf(PropTypes.string),
    recordTypeFilters: PropTypes.object,
    recordsPerSearch: PropTypes.number,
    filterOrder: PropTypes.arrayOf(PropTypes.string),
    selectedObjects: PropTypes.object,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  sheets: PropTypes.shape({
    allSheets: PropTypes.arrayOf(
      PropTypes.shape({
        sheetName: PropTypes.string,
        headers: PropTypes.arrayOf(PropTypes.object),
      })
    ),
  }),
  onPinToggle: PropTypes.func.isRequired,
  onDeleteSheet: PropTypes.func.isRequired,
  handleClose: PropTypes.func,
  setActiveSheetName: PropTypes.func.isRequired,
  clearFetchedSheets: PropTypes.func.isRequired,
};

EditSheetsModal.defaultProps = {
  isEditMode: false,
  sheets: { allSheets: [] },
  handleClose: null,
};

function RecordTypeFilterLikeFilterModal({ recordType, headers, tempData, setTempData, isDarkTheme, showOnlyUserFilter, filterType }) {
  const { user } = useContext(MainContext);
  const [numberRangeMode, setNumberRangeMode] = useState(() => {
    const initial = {};
    Object.entries(tempData.recordTypeFilters?.[recordType] || {}).forEach(([key, filter]) => {
      if (filter.start || filter.end) initial[key] = true;
    });
    return initial;
  });
  const [activeFilterIndex, setActiveFilterIndex] = useState(null);
  const filterActionsRef = useRef(null);
  const filterValues = tempData.recordTypeFilters?.[recordType] || {};

  // Build visibleHeaders for the main filter list (exclude user fields)
  const visibleHeaders = useMemo(() => {
    let filteredHeaders = headers
      .filter((header) => {
        if (showOnlyUserFilter) {
          // Only show user fields in the user filter dropdown
          return header.key === 'assignedTo' || header.key === 'user' || header.key === 'createdBy';
        }
        // Exclude user fields and only allow text or dropdown types in the main filter list
        return !header.hidden && !['assignedTo', 'user', 'createdBy'].includes(header.key) && (header.type === 'text' || header.type === 'dropdown');
      })
      .map((header) => ({
        ...header,
        name: header.name || header.key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
        type: header.type || 'text',
        options: header.options || [],
      }));

    if (filterType && !showOnlyUserFilter) {
      filteredHeaders = filteredHeaders.filter((header) => header.type === filterType);
    }

    return filteredHeaders;
  }, [headers, showOnlyUserFilter, filterType]);

  // Build userHeaders for the Restrict by User dropdown (always include user fields)
  const userHeaders = useMemo(() =>
    headers.filter(
      (header) => ['assignedTo', 'user', 'createdBy'].includes(header.key)
    ).map((header) => ({
      ...header,
      name: header.name || header.key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
    })),
    [headers]
  );

  const applyFilters = useCallback(
    (filters) => {
      setTempData({
        ...tempData,
        recordTypeFilters: {
          ...tempData.recordTypeFilters,
          [recordType]: filters,
        },
      });
    },
    [setTempData, tempData, recordType]
  );

  const handleFilterChange = useCallback(
    (headerKey, value, type = 'default') => {
      const header = visibleHeaders.find((h) => h.key === headerKey);
      let newValue = value;
      if (header && header.type === 'text' && type === 'value') {
        newValue = String(value);
      }
      const newFilter = { ...filterValues[headerKey], [type]: newValue };
      if (type === 'start' || type === 'end' || type === 'value' || type === 'sortOrder') {
        if (value === '') delete newFilter[type];
      }
      const updatedFilters = { ...filterValues, [headerKey]: newFilter };
      applyFilters(updatedFilters);
    },
    [filterValues, applyFilters, visibleHeaders]
  );

  const handleUserFilterChange = useCallback(
    (headerKey) => {
      const newFilter = {
        headerKey: headerKey || undefined,
        condition: 'equals',
        value: headerKey ? user?.uid : undefined,
      };
      const updatedFilters = { ...filterValues, userFilter: headerKey ? newFilter : {} };
      applyFilters(updatedFilters);
    },
    [filterValues, applyFilters, user?.uid]
  );

  const handleDropdownChange = useCallback(
    (headerKey, e) => {
      const selectedValues = Array.from(e.target.selectedOptions, (option) => option.value);
      handleFilterChange(headerKey, selectedValues, 'values');
    },
    [handleFilterChange]
  );

  const toggleNumberRangeMode = useCallback(
    (headerKey) => {
      setNumberRangeMode((prev) => {
        const newMode = !prev[headerKey];
        const updatedFilters = {
          ...filterValues,
          [headerKey]: newMode
            ? { start: filterValues[headerKey]?.start || '', end: filterValues[headerKey]?.end || '' }
            : { value: filterValues[headerKey]?.value || '', order: 'equals' },
        };
        applyFilters(updatedFilters);
        return { ...prev, [headerKey]: newMode };
      });
    },
    [filterValues, applyFilters]
  );

  const clearFilter = useCallback(
    (headerKey) => {
      const updatedFilters = { ...filterValues, [headerKey]: {} };
      applyFilters(updatedFilters);
      setNumberRangeMode((prev) => ({ ...prev, [headerKey]: false }));
    },
    [filterValues, applyFilters]
  );

  const clearUserFilter = useCallback(() => {
    const updatedFilters = { ...filterValues, userFilter: {} };
    applyFilters(updatedFilters);
  }, [filterValues, applyFilters]);

  const handleReset = useCallback(() => {
    let clearedFilters = { ...filterValues };
    if (showOnlyUserFilter) {
      clearedFilters = { ...filterValues, userFilter: {} };
    } else if (filterType) {
      Object.keys(clearedFilters).forEach((key) => {
        if (key !== 'userFilter') {
          const header = visibleHeaders.find((h) => h.key === key);
          if (header && header.type === filterType) {
            clearedFilters[key] = {};
          }
        }
      });
    } else {
      clearedFilters = {};
    }
    applyFilters(clearedFilters);
    setNumberRangeMode({});
    setActiveFilterIndex(null);
  }, [filterValues, applyFilters, filterType, visibleHeaders, showOnlyUserFilter]);

  const isFilterEmpty = (filter) =>
    Object.keys(filter).length === 0 ||
    (!filter.start && !filter.end && !filter.value && !filter.values?.length && !filter.headerKey);

  const getFilterSummary = useCallback(
    (header) => {
      const filter = filterValues[header.key] || {};
      if (isFilterEmpty(filter)) return 'None';

      switch (header.type) {
        case 'number':
          if (numberRangeMode[header.key]) {
            const start = filter.start || '';
            const end = filter.end || '';
            return `${start}${start && end ? ' – ' : ''}${end}`.trim();
          } else {
            const order = filter.order || 'equals';
            const value = filter.value || '';
            const orderText = { equals: '=', greaterOrEqual: '≥', lessOrEqual: '≤', greater: '>', less: '<' }[order];
            return `${orderText}${value ? ` ${value}` : ''}`.trim();
          }
        case 'date':
          return 'Date Filter';
        case 'dropdown': {
          const values = filter.values || [];
          return values.length > 0 ? `${values.join(', ')}` : 'None';
        }
        case 'text': {
          const condition = filter.condition || 'equals';
          const value = filter.value !== undefined && filter.value !== null ? String(filter.value) : '';
          return value ? `${condition} "${value}"` : 'None';
        }
        default: {
          return filter.value !== undefined && filter.value !== null
            ? `"${String(filter.value)}"`
            : 'None';
        }
      }
    },
    [filterValues, numberRangeMode]
  );

  return (
    <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {/* Always show Restrict by User filter at the top - spans full width */}
      <div
        className={`${styles.configRecord} ${styles.userFilterRecord} ${isDarkTheme ? styles.darkTheme : ''}`}
        onClick={() => setActiveFilterIndex('user')}
      >
        <div className={styles.recordHeader} onClick={(e) => { e.stopPropagation(); setActiveFilterIndex(activeFilterIndex === 'user' ? null : 'user'); }}>
          <div className={styles.recordContent}>
            <div className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Restrict by User</div>
            <div className={styles.recordDescription}>
              {filterValues.userFilter?.headerKey
                ? `${
                    userHeaders.find((h) => h.key === filterValues.userFilter.headerKey)?.name ||
                    filterValues.userFilter.headerKey
                  } = Current User`
                : 'Filter records by user assignment'}
            </div>
            <div className={`${styles.recordBadge} ${isDarkTheme ? styles.darkTheme : ''}`}>
              {filterValues.userFilter?.headerKey ? 'Active' : 'None'}
            </div>
          </div>
          <div className={`${styles.recordArrow} ${activeFilterIndex === 'user' ? styles.expanded : ''} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <IoMdArrowDropdown />
          </div>
        </div>
        {activeFilterIndex === 'user' && (
          <>
            <div className={`${styles.recordDivider} ${isDarkTheme ? styles.darkTheme : ''}`}></div>
            <div
              className={`${styles.filterActions} ${styles.recordActions} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <select
                value={filterValues.userFilter?.headerKey || ''}
                onChange={(e) => handleUserFilterChange(e.target.value || '')}
                className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
              >
                <option value="">No User Filter</option>
                {userHeaders.map((header) => (
                  <option key={header.key} value={header.key}>
                    {header.name}
                  </option>
                ))}
              </select>
              {filterValues.userFilter?.headerKey && (
                <button
                  onClick={clearUserFilter}
                  className={`${styles.clearButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  disabled={!filterValues.userFilter?.headerKey}
                >
                  Clear
                </button>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Then show all other header filters in the grid */}
      {visibleHeaders.length === 0 ? (
        <div className={`${styles.noRecords} ${styles.gridSpan} ${isDarkTheme ? styles.darkTheme : ''}`}>
          No {filterType || 'headers'} available
        </div>
      ) : (
        visibleHeaders.map((header, index) => (
          <div
            key={header.key}
            className={`${styles.configRecord} ${activeFilterIndex === index ? styles.activeRecord : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
          >
            <div className={styles.recordHeader} onClick={(e) => { e.stopPropagation(); setActiveFilterIndex(activeFilterIndex === index ? null : index); }}>
              <div className={styles.recordContent}>
                <div className={`${styles.recordTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>{header.name}</div>
                <div className={styles.recordDescription}>
                  {header.type === 'text' && 'Filter by text content'}
                  {header.type === 'number' && 'Filter by numeric values'}
                  {header.type === 'date' && 'Filter by date ranges'}
                  {header.type === 'dropdown' && 'Filter by selected options'}
                </div>
                <div className={`${styles.recordBadge} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {getFilterSummary(header) !== 'None' ? 'Active' : 'None'}
                </div>
              </div>
              <div className={`${styles.recordArrow} ${activeFilterIndex === index ? styles.expanded : ''} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <IoMdArrowDropdown />
              </div>
            </div>
            {activeFilterIndex === index && (
              <>
                <div className={`${styles.recordDivider} ${isDarkTheme ? styles.darkTheme : ''}`}></div>
                <div
                  className={`${styles.filterActions} ${styles.recordActions} ${isDarkTheme ? styles.darkTheme : ''}`}
                  ref={filterActionsRef}
                  onClick={(e) => e.stopPropagation()}
                >
                  {header.type === 'number' ? (
                    numberRangeMode[header.key] ? (
                      <>
                        <input
                          type="number"
                          value={filterValues[header.key]?.start || ''}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, 'start')}
                          placeholder="From"
                          className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                        />
                        <span className={`${styles.separator} ${isDarkTheme ? styles.darkTheme : ''}`}>–</span>
                        <input
                          type="number"
                          value={filterValues[header.key]?.end || ''}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, 'end')}
                          placeholder="To"
                          className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                        />
                        <button
                          onClick={() => toggleNumberRangeMode(header.key)}
                          className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          Value
                        </button>
                      </>
                    ) : (
                      <>
                        <select
                          value={filterValues[header.key]?.order || 'equals'}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, 'order')}
                          className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          <option value="equals">=</option>
                          <option value="greater">{'>'}</option>
                          <option value="less">{'<'}</option>
                          <option value="greaterOrEqual">≥</option>
                          <option value="lessOrEqual">≤</option>
                        </select>
                        <input
                          type="number"
                          value={filterValues[header.key]?.value || ''}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, 'value')}
                          placeholder="Value"
                          className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                        />
                        <button
                          onClick={() => toggleNumberRangeMode(header.key)}
                          className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          Range
                        </button>
                      </>
                    )
                  ) : header.type === 'date' ? (
                    <>
                      <input
                        type="date"
                        value={filterValues[header.key]?.start || ''}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, 'start')}
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                      />
                      <span className={styles.separator}>–</span>
                      <input
                        type="date"
                        value={filterValues[header.key]?.end || ''}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, 'end')}
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                      />
                    </>
                  ) : header.type === 'dropdown' ? (
                    <select
                      multiple
                      value={filterValues[header.key]?.values || []}
                      onChange={(e) => handleDropdownChange(header.key, e)}
                      className={`${styles.filterMultiSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      {header.options.map((option, idx) => (
                        <option key={`${header.key}-option-${idx}`} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <select
                        value={filterValues[header.key]?.condition || 'equals'}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, 'condition')}
                        className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ''}`}
                      >
                        <option value="equals">Equals</option>
                        <option value="contains">Contains</option>
                        <option value="startsWith">Starts with</option>
                        <option value="endsWith">Ends with</option>
                      </select>
                      <input
                        type="text"
                        value={filterValues[header.key]?.value || ''}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, 'value')}
                        placeholder="Value"
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                      />
                    </>
                  )}
                  {!isFilterEmpty(filterValues[header.key] || {}) && (
                    <button
                      onClick={() => clearFilter(header.key)}
                      className={`${styles.clearButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      disabled={isFilterEmpty(filterValues[header.key] || {})}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}

RecordTypeFilterLikeFilterModal.propTypes = {
  recordType: PropTypes.string.isRequired,
  headers: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string,
      type: PropTypes.string,
      hidden: PropTypes.bool,
      options: PropTypes.arrayOf(PropTypes.string),
    })
  ).isRequired,
  tempData: PropTypes.shape({
    recordTypeFilters: PropTypes.object,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  isDarkTheme: PropTypes.bool.isRequired,
  showOnlyUserFilter: PropTypes.bool,
  filterType: PropTypes.string,
};

RecordTypeFilterLikeFilterModal.defaultProps = {
  showOnlyUserFilter: false,
  filterType: null,
};

export default EditSheetsModal;
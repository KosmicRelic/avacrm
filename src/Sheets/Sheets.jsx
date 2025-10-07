import { useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useParams, useNavigate } from 'react-router-dom';

// Third-party libraries
import { IoCloseCircle } from 'react-icons/io5';
import { FaFolder } from 'react-icons/fa';
import { MdFilterAlt } from 'react-icons/md';
import { FiEdit } from 'react-icons/fi';
import { CgArrowsExchangeAlt } from 'react-icons/cg';
import { BiSolidSpreadsheet } from 'react-icons/bi';
import { ImSpinner2 } from 'react-icons/im';
import { doc, setDoc, deleteDoc, query, where, onSnapshot, collection, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

// Debug logging utility
const addDebugLog = (message) => {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  if (window.debugLogs) {
    window.debugLogs.push(logEntry);
  }
  console.log(logEntry);
};

// Local components
import RowComponent from './Row Template/RowComponent';
import RecordsEditor from './Records Editor/RecordsEditor';

// Context and utilities
import { MainContext } from '../Contexts/MainContext';
import { filterRowsLocally } from '../Modal/FilterModal/filterUtils';
import { decodeSheetName, toMillis, isPrimarySheet, getSheetLoadingState } from './sheetsUtils';

// Styles
import styles from './Sheets.module.css';

const Sheets = ({
  headers,
  sheets,
  activeSheetName,
  onSheetChange,
  onEditSheet,
  onFilter,
  onRowClick,
  onRecordSave,
  onOpenSheetsModal,
  onOpenSheetFolderModal,
  onOpenFolderModal,
}) => {
  const { isDarkTheme, setRecords, records, objects, setObjects, setActiveSheetName: setActiveSheetNameWithRef, sheetRecordsFetched, user, businessId, teamMembers, templateObjects } = useContext(MainContext);
  const params = useParams();
  const navigate = useNavigate();

  const decodedActiveSheetName = decodeSheetName(activeSheetName);

  const activeSheet = sheets.allSheets.find((sheet) => sheet.sheetName === decodedActiveSheetName);

  const sheetId = activeSheet?.docId;
  const isLoading = useMemo(() => getSheetLoadingState(sheetId, sheetRecordsFetched), [sheetId, sheetRecordsFetched]);

  const [_spinnerVisible, _setSpinnerVisible] = useState(false);
  const [_spinnerFading, _setSpinnerFading] = useState(false);
  const [objectsLoading, setObjectsLoading] = useState(true);

  useEffect(() => {
    if (isLoading || objectsLoading) {
      _setSpinnerVisible(true);
      _setSpinnerFading(false);
    } else if (_spinnerVisible) {
      _setSpinnerFading(true);
      const timeout = setTimeout(() => {
        _setSpinnerVisible(false);
        _setSpinnerFading(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, objectsLoading, _spinnerVisible]);

  const sheetRecordTypes = useMemo(() => [], [activeSheet]); // No longer used since we work with objects
  const recordTypeFilters = useMemo(() => activeSheet?.recordTypeFilters || {}, [activeSheet]);
  const objectTypeFilters = useMemo(() => activeSheet?.objectTypeFilters || {}, [activeSheet]);
  const selectedObjects = useMemo(() => {
    let selected = activeSheet?.selectedObjects || {};
    
    // If no objects are selected, try to infer from sheet name
    if (Object.keys(selected).length === 0 && templateObjects.length > 0) {
      const sheetName = activeSheet?.sheetName?.toLowerCase();
      if (sheetName) {
        // Find template object that matches sheet name (singular/plural)
        const matchingObject = templateObjects.find(obj => {
          const objName = obj.name.toLowerCase();
          return objName === sheetName || 
                 objName === sheetName.replace(/s$/, '') || // Remove trailing 's'
                 objName + 's' === sheetName; // Add trailing 's'
        });
        
        if (matchingObject) {
          selected = { [matchingObject.id]: { selected: true, name: matchingObject.name } };
        }
      }
    }
    
    return selected;
  }, [activeSheet, templateObjects]);

  const selectedObjectNames = useMemo(() => 
    Object.values(selectedObjects).filter(obj => obj.selected).map(obj => obj.name),
    [selectedObjects]
  );

  // Set up objects listener based on selected objects
  useEffect(() => {
    if (selectedObjectNames.length === 0) {
      setObjects([]);
      setObjectsLoading(false);
      return;
    }

    setObjectsLoading(true);

    const unsubscribe = onSnapshot(
      query(collection(db, 'businesses', businessId, 'objects'), where('typeOfObject', 'in', selectedObjectNames)),
      (snapshot) => {
        const fetchedObjects = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
        setObjects(fetchedObjects);
        setObjectsLoading(false);
      },
      (error) => {
        console.error('Error in objects listener:', error);
      }
    );

    return unsubscribe;
  }, [selectedObjectNames, businessId]);

  // Process object deletions
  useEffect(() => {
    const objectsToDelete = objects.filter(obj => obj.action === 'remove' && obj.isModified);
    
    if (objectsToDelete.length > 0) {
      const deleteObjects = async () => {
        try {
          // Use batch operations for atomic deletes
          const batch = writeBatch(db);
          
          for (const obj of objectsToDelete) {
            // Delete all associated records first
            if (obj.records && obj.records.length > 0) {
              console.log(`🗑️ Deleting ${obj.records.length} records associated with object ${obj.docId}`);
              for (const recordInfo of obj.records) {
                const recordRef = doc(db, `businesses/${businessId}/records/${recordInfo.docId}`);
                batch.delete(recordRef);
              }
            }
            
            // Delete the object itself
            const objectRef = doc(db, `businesses/${businessId}/objects/${obj.docId}`);
            batch.delete(objectRef);
          }
          
          // Commit all deletes atomically
          await batch.commit();
          console.log(`✅ Successfully deleted ${objectsToDelete.length} objects and their associated records`);
          
          // Remove deleted objects from local state
          setObjects(prev => {
            const filtered = prev.filter(obj => !objectsToDelete.some(delObj => delObj.docId === obj.docId));
            return filtered;
          });
          
          // Also remove associated records from local state
          setRecords(prev => {
            const deletedRecordIds = new Set();
            objectsToDelete.forEach(obj => {
              if (obj.records) {
                obj.records.forEach(recordInfo => deletedRecordIds.add(recordInfo.docId));
              }
            });
            return prev.filter(record => !deletedRecordIds.has(record.docId));
          });
          
        } catch (error) {
          console.error('Failed to delete objects and records:', error);
        }
      };
      
      deleteObjects();
    }
  }, [objects, businessId]);

  const globalFilters = useMemo(() => activeSheet?.filters || {}, [activeSheet]);
  const _isPrimarySheetFlag = useMemo(() => isPrimarySheet(activeSheet), [activeSheet]);

  const sheetRecords = useMemo(() => {
    if (!activeSheet) return [];
    
    // Choose data source - always objects
    const dataSource = objects;
    const _typeField = 'typeOfObject';
    
    // First filter by selected object types
    const selectedObjectIds = Object.keys(selectedObjects).filter(id => selectedObjects[id]?.selected);
    let filteredObjects = dataSource;
    
    if (selectedObjectIds.length > 0) {
      // Get the names of selected template objects
      const selectedObjectNames = selectedObjectIds.map(id => {
        const templateObj = templateObjects.find(obj => obj.id === id);
        return templateObj?.name;
      }).filter(name => name);
      
      filteredObjects = dataSource.filter(object => 
        selectedObjectNames.includes(object.typeOfObject)
      );
    }
    
    // Then apply detailed objectTypeFilters to the selected objects
    filteredObjects = filteredObjects.filter((object) => {
      const filters = objectTypeFilters[object.typeOfObject] || {};
      return Object.entries(filters).every(([field, filter]) => {
        if (field === 'userFilter') {
          if (filter.headerKey && filter.condition === 'equals') {
            const objectValue = object[filter.headerKey];
            return objectValue === user.uid;
          }
          return true;
        }

        const header = headers.find((h) => h.key === field);
        const value = object[field];
        if (!filter || !header) {
          return true;
        }

        switch (header.type) {
          case 'number': {
            if (!filter.start && !filter.end && !filter.value && !filter.sortOrder) return true;
            const numValue = Number(value) || 0;
            if (filter.start || filter.end) {
              const startNum = filter.start ? Number(filter.start) : -Infinity;
              const endNum = filter.end ? Number(filter.end) : Infinity;
              return numValue >= startNum && numValue <= endNum;
            }
            if (!filter.value) return true;
            const filterNum = Number(filter.value);
            switch (filter.order) {
              case 'greater':
                return numValue > filterNum;
              case 'less':
                return numValue < filterNum;
              case 'greaterOrEqual':
                return numValue >= filterNum;
              case 'lessOrEqual':
                return numValue <= filterNum;
              default:
                return numValue === filterNum;
            }
          }
          case 'date':
            if (!filter.sortOrder) return true;
            return true;
          case 'dropdown':
            if (!filter.values || filter.values.length === 0) return true;
            return filter.values.includes(value);
          case 'currency': {
            if (!filter.start && !filter.end && !filter.value && !filter.sortOrder) return true;
            const numValue = Number(value) || 0;
            if (filter.start || filter.end) {
              const startNum = filter.start ? Number(filter.start) : -Infinity;
              const endNum = filter.end ? Number(filter.end) : Infinity;
              return numValue >= startNum && numValue <= endNum;
            }
            if (!filter.value) return true;
            const filterNum = Number(filter.value);
            switch (filter.order) {
              case 'greater':
                return numValue > filterNum;
              case 'less':
                return numValue < filterNum;
              case 'greaterOrEqual':
                return numValue >= filterNum;
              case 'lessOrEqual':
                return numValue <= filterNum;
              default:
                return numValue === filterNum;
            }
          }
          case 'email':
          case 'phone':
          case 'text': {
            if (!filter.value || !filter.condition) return true;
            const strValue = String(value || '').toLowerCase();
            const filterStr = filter.value.toLowerCase();
            switch (filter.condition) {
              case 'contains':
                return strValue.includes(filterStr);
              case 'startsWith':
                return strValue.startsWith(filterStr);
              case 'endsWith':
                return strValue.endsWith(filterStr);
              default:
                return strValue === filterStr;
            }
          }
          default:
            return true;
        }
      });
    });
    
    return filteredObjects;
  }, [objects, sheetRecordTypes, objectTypeFilters, selectedObjects, headers, user.uid, activeSheet]);

  const filteredWithGlobalFilters = useMemo(() => {
    return sheetRecords.filter((row) =>
      Object.entries(globalFilters).every(([headerKey, filter]) => {
        const header = headers.find((h) => h.key === headerKey);
        const rowValue = row[headerKey];
        if (!filter || !header) {
          return true;
        }

        switch (header.type) {
          case 'number': {
            if (!filter.start && !filter.end && !filter.value && !filter.sortOrder) return true;
            const numValue = Number(rowValue) || 0;
            if (filter.start || filter.end) {
              const startNum = filter.start ? Number(filter.start) : -Infinity;
              const endNum = filter.end ? Number(filter.end) : Infinity;
              return numValue >= startNum && numValue <= endNum;
            }
            if (!filter.value) return true;
            const filterNum = Number(filter.value);
            switch (filter.order) {
              case 'greater':
                return numValue > filterNum;
              case 'less':
                return numValue < filterNum;
              case 'greaterOrEqual':
                return numValue >= filterNum;
              case 'lessOrEqual':
                return numValue <= filterNum;
              default:
                return numValue === filterNum;
            }
          }
          case 'date':
            if (!filter.sortOrder) return true;
            return true;
          case 'dropdown':
            if (!filter.values || filter.values.length === 0) return true;
            return filter.values.includes(rowValue);
          case 'currency': {
            if (!filter.start && !filter.end && !filter.value && !filter.sortOrder) return true;
            const numValue = Number(rowValue) || 0;
            if (filter.start || filter.end) {
              const startNum = filter.start ? Number(filter.start) : -Infinity;
              const endNum = filter.end ? Number(filter.end) : Infinity;
              return numValue >= startNum && numValue <= endNum;
            }
            if (!filter.value) return true;
            const filterNum = Number(filter.value);
            switch (filter.order) {
              case 'greater':
                return numValue > filterNum;
              case 'less':
                return numValue < filterNum;
              case 'greaterOrEqual':
                return numValue >= filterNum;
              case 'lessOrEqual':
                return numValue <= filterNum;
              default:
                return numValue === filterNum;
            }
          }
          case 'email':
          case 'phone':
          case 'text': {
            if (!filter.value) return true;
            const strValue = String(rowValue || '').toLowerCase();
            const filterStr = filter.value.toLowerCase();
            switch (filter.condition) {
              case 'contains':
                return strValue.includes(filterStr);
              case 'startsWith':
                return strValue.startsWith(filterStr);
              case 'endsWith':
                return strValue.endsWith(filterStr);
              default:
                return strValue === filterStr;
            }
          }
          default:
            return true;
        }
      })
    );
  }, [sheetRecords, globalFilters, headers]); // Removed activeSheetName since it doesn't directly affect the filtering logic

  const scrollContainerRef = useRef(null);
  const sheetTabsRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [selectedRowForEdit, setSelectedRowForEdit] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [shouldAnimateIn, setShouldAnimateIn] = useState(false);
  const [editButtonPosition, setEditButtonPosition] = useState({ top: 0, left: 0 });
  const [_scrollOffset, _setScrollOffset] = useState(0);
  const [parentObject, setParentObject] = useState(null); // Track parent object for records
  const [isCreatingObject, setIsCreatingObject] = useState(false); // Loading state for object creation
  const loadedFromUrlRef = useRef(null); // Track what we've loaded from URL to prevent re-loading

  const isMobile = windowWidth <= 1024;

  // Log select mode changes
  useEffect(() => {
    addDebugLog('🔄 Select mode changed to: ' + isSelectMode);
  }, [isSelectMode]);

  // Animation trigger for opening and closing (both mobile and desktop)
  useEffect(() => {
    if (isEditorOpen && !isClosing) {
      // Opening animation - use setTimeout to ensure DOM is ready
      const timer = setTimeout(() => setShouldAnimateIn(true), 0);
      return () => clearTimeout(timer);
    } else if (isClosing) {
      // Closing animation - keep animate-in class during closing
      setShouldAnimateIn(true);
    } else if (!isEditorOpen) {
      // Reset animation state when fully closed
      setShouldAnimateIn(false);
    }
  }, [isEditorOpen, isClosing]);

  const visibleHeaders = useMemo(() => headers.filter((header) => header.visible), [headers]);

  const folderSheets = useMemo(() => {
    const folderItems = sheets.structure.filter((item) => item.folderName);
    return folderItems.flatMap((folder) => folder.sheets);
  }, [sheets.structure]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Click outside detection to deselect rows
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectedRowForEdit && !isSelectMode) {
        // Check if the click is outside of any row
        const rows = document.querySelectorAll('[class*="bodyRow"]');
        const isClickOnRow = Array.from(rows).some(row => row.contains(event.target));
        
        // Also check if click is on the floating button
        const floatingButton = document.querySelector('[class*="floatingEditButton"]');
        const isClickOnButton = floatingButton && floatingButton.contains(event.target);
        
        if (!isClickOnRow && !isClickOnButton) {
          setSelectedRowForEdit(null);
        }
      }
    };

    if (selectedRowForEdit && !isSelectMode) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [selectedRowForEdit, isSelectMode]);

  // Position the edit button near the selected row (optimized for performance)
  useEffect(() => {
    if (selectedRowForEdit && !isSelectMode) {
      let animationFrameId = null;
      let isUpdating = false;

      const updatePosition = () => {
        if (isUpdating) return; // Prevent overlapping updates
        isUpdating = true;

        // Use requestAnimationFrame for smooth updates
        animationFrameId = requestAnimationFrame(() => {
          const selectedRowElement = document.querySelector(`[data-row-id="${selectedRowForEdit.docId}"]`);
          if (selectedRowElement) {
            const rect = selectedRowElement.getBoundingClientRect();

            // Position the button below the selected row
            let buttonTop = rect.bottom + 8; // 8px below the row
            let buttonLeft = rect.left + (rect.width / 2) - 50; // Center horizontally on the row (button is ~100px wide)
            
            // Ensure button doesn't go off-screen horizontally
            const buttonWidth = 100;
            if (buttonLeft < 10) {
              buttonLeft = 10;
            } else if (buttonLeft + buttonWidth > window.innerWidth - 10) {
              buttonLeft = window.innerWidth - 10 - buttonWidth;
            }
            
            // Ensure button stays within vertical viewport bounds
            const buttonHeight = 36;
            if (buttonTop + buttonHeight > window.innerHeight - 20) {
              // If it would go off bottom, position it above the row instead
              buttonTop = rect.top - buttonHeight - 8;
            }

            setEditButtonPosition({ top: buttonTop, left: buttonLeft });
          }
          isUpdating = false;
        });
      };

      // Throttled scroll handler
      let scrollTimeoutId = null;
      const throttledUpdatePosition = () => {
        if (scrollTimeoutId) return; // Already scheduled

        scrollTimeoutId = setTimeout(() => {
          updatePosition();
          scrollTimeoutId = null;
        }, 16); // ~60fps
      };

      // Initial position
      updatePosition();

      // Update position on scroll (throttled) and resize
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        scrollContainer.addEventListener('scroll', throttledUpdatePosition, { passive: true });
        window.addEventListener('resize', updatePosition);

        return () => {
          scrollContainer.removeEventListener('scroll', throttledUpdatePosition);
          window.removeEventListener('resize', updatePosition);
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          if (scrollTimeoutId) {
            clearTimeout(scrollTimeoutId);
          }
        };
      }
    }
  }, [selectedRowForEdit, isSelectMode]);

  useEffect(() => {
    if (sheetTabsRef.current) {
      sheetTabsRef.current.scrollWidth;
      sheetTabsRef.current.style.width = 'auto';
    }
  }, [sheets.structure, activeSheetName]);

  // Replace filteredRows with filterRowsLocally to apply all filters
  const filteredRows = useMemo(() => {
    // Apply globalFilters (from FilterModal) using filterRowsLocally
    const globallyFiltered = filterRowsLocally(filteredWithGlobalFilters, globalFilters, visibleHeaders);
    // Then apply search
    const query = searchQuery.toLowerCase();
    return globallyFiltered.filter((row) =>
      visibleHeaders.some((header) => String(row[header.key] || '').toLowerCase().includes(query))
    );
  }, [filteredWithGlobalFilters, globalFilters, searchQuery, visibleHeaders]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    // Only use globalFilters (FilterModal) for client-side sorting
    const sortCriteria = Object.entries(globalFilters)
      .filter((entry) => entry[1].sortOrder)
      .map((entry) => ({
        key: entry[0],
        sortOrder: entry[1].sortOrder,
        type: headers.find((h) => h.key === entry[0])?.type || 'text',
      }));

    if (sortCriteria.length > 0) {
      sorted.sort((a, b) => {
        for (const { key, sortOrder, type } of sortCriteria) {
          let aValue = a[key];
          let bValue = b[key];
          if (type === 'number') {
            aValue = Number(aValue) || 0;
            bValue = Number(bValue) || 0;
          } else if (type === 'date') {
            aValue = toMillis(aValue);
            bValue = toMillis(bValue);
            if (isNaN(aValue)) {
              aValue = sortOrder === 'ascending' ? Infinity : -Infinity;
            }
            if (isNaN(bValue)) {
              bValue = sortOrder === 'ascending' ? Infinity : -Infinity;
            }
          } else {
            aValue = String(aValue || '').toLowerCase();
            bValue = String(bValue || '').toLowerCase();
          }
          if (aValue < bValue) return sortOrder === 'ascending' ? -1 : 1;
          if (aValue > bValue) return sortOrder === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sorted;
  }, [filteredRows, globalFilters, headers]);

  const finalRows = useMemo(() => sortedRows, [sortedRows]);

  // Get filtered records (excluding the "Add New" row)
  const filteredRecords = useMemo(() => 
    finalRows.filter(rowData => rowData.docId), 
    [finalRows]
  );

  const isBusinessUser = user && user.uid === businessId;

  useEffect(() => {
    if (activeSheet && Array.isArray(sheets.allSheets) && sheets.allSheets.length > 0) {
      // console.log('[Sheets][DEBUG] Attempting to load records for activeSheet:', activeSheet?.sheetName, 'with docId:', activeSheet?.docId);
    }
  }, [activeSheet, sheets.allSheets]);

  const handleSheetClick = useCallback(
    (sheetName) => {
      const urlSheetName = sheetName.replace(/ /g, "-");
      const newUrl = `/sheets/${urlSheetName}`;
      navigate(newUrl);
    },
    [navigate]
  );

  const prevActiveSheetNameRef = useRef();
  useEffect(() => {
    _setSpinnerVisible(false);
    _setSpinnerFading(false);
    setIsEditorOpen(false);
    setSelectedRow(null);
    setIsSelectMode(false);
    setSelectedRowIds([]);
    setSearchQuery('');
    prevActiveSheetNameRef.current = activeSheetName;
  }, [activeSheetName]);

  useEffect(() => {
    if (params.sheetName) {
      const sheetName = decodeSheetName(params.sheetName);
      if (sheetName !== activeSheetName) {
        setActiveSheetNameWithRef(sheetName);
        onSheetChange(sheetName);
      }
    }
  }, [params.sheetName, activeSheetName, setActiveSheetNameWithRef, onSheetChange]);

  const handleFolderClick = useCallback(
    (folderName) => {
      onOpenFolderModal(folderName, (sheetName) => {
        const urlSheetName = sheetName.replace(/ /g, "-");
        const newUrl = `/sheets/${urlSheetName}`;
        navigate(newUrl);
      });
    },
    [onOpenFolderModal, navigate]
  );

  const clearSearch = useCallback(() => setSearchQuery(''), []);

  const recordIdFromUrl = params.recordId;
  const objectIdFromUrl = params.objectId;

  // Clear the loaded URL ref when the URL params change
  useEffect(() => {
    const urlKey = `${objectIdFromUrl || ''}_${recordIdFromUrl || ''}`;
    if (loadedFromUrlRef.current && loadedFromUrlRef.current !== urlKey) {
      console.log('🔄 URL changed, clearing loaded ref:', loadedFromUrlRef.current, '->', urlKey);
      loadedFromUrlRef.current = null;
    }
  }, [objectIdFromUrl, recordIdFromUrl]);

  // Handle opening record from URL (with optional parent object)
  useEffect(() => {
    // Skip if we have an objectId - will be handled in the object effect
    if (recordIdFromUrl && !objectIdFromUrl && records.length > 0) {
      const record = records.find((c) => c.docId === recordIdFromUrl);
      if (record) {
        console.log('🔍 Opening editor for record from URL:', record);
        setSelectedRow(record);
        setIsEditorOpen(true);
      }
    }
  }, [recordIdFromUrl, objectIdFromUrl, records]);

  // Handle opening object and/or record from URL
  useEffect(() => {
    if (!businessId || isCreatingObject) return;
    
    const loadFromUrl = async () => {
      console.log('🔄 [URL Effect] Running with:', { 
        objectIdFromUrl, 
        recordIdFromUrl, 
        objectsLoading,
        objectsCount: objects.length 
      });
      
      // Check if we've already loaded this exact URL combination
      const urlKey = `${objectIdFromUrl || ''}_${recordIdFromUrl || ''}`;
      if (loadedFromUrlRef.current === urlKey && isEditorOpen && selectedRow?.docId) {
        console.log('⏭️ Already loaded this URL, skipping to prevent remount');
        return;
      }
      
      // Case 1: We have an objectId in the URL
      if (objectIdFromUrl) {
        // Wait for objects to load if they haven't yet
        if (objectsLoading) {
          console.log('⏳ Waiting for objects to load...');
          return;
        }
        
        let object = objects.find((obj) => obj.docId === objectIdFromUrl);
        
        // If object not found in memory, try fetching from Firestore
        if (!object && objects.length > 0) {
          console.log('🔍 Object not in sheet, fetching from Firestore:', objectIdFromUrl);
          try {
            const objectRef = doc(db, 'businesses', businessId, 'objects', objectIdFromUrl);
            const objectSnap = await getDoc(objectRef);
            
            if (objectSnap.exists()) {
              object = { docId: objectSnap.id, ...objectSnap.data() };
              console.log('✅ Object fetched from Firestore:', object);
              
              // Add to objects array
              setObjects((prev) => {
                const exists = prev.some(o => o.docId === object.docId);
                return exists ? prev : [...prev, object];
              });
            } else {
              console.warn('⚠️ Object not found in Firestore:', objectIdFromUrl);
              return;
            }
          } catch (error) {
            console.error('❌ Error fetching object:', error);
            return;
          }
        }
        
        if (object) {
          // Case 1a: We also have a recordId - fetch and open the record
          if (recordIdFromUrl) {
            console.log('🔍 Fetching record from URL with parent object:', recordIdFromUrl);
            
            try {
              const recordRef = doc(db, 'businesses', businessId, 'records', recordIdFromUrl);
              const recordSnap = await getDoc(recordRef);
              
              if (recordSnap.exists()) {
                const record = { docId: recordSnap.id, ...recordSnap.data() };
                console.log('✅ Record fetched from Firestore:', record);
                console.log('📌 Setting selectedRow to RECORD:', record.docId);
                
                // Add the record to the records array if not already there
                setRecords((prev) => {
                  const exists = prev.some(r => r.docId === record.docId);
                  return exists ? prev : [...prev, record];
                });
                
                setParentObject(object); // Set the parent object for the record
                setSelectedRow(record);
                setIsEditorOpen(true);
                
                // Mark this URL as loaded
                loadedFromUrlRef.current = `${objectIdFromUrl}_${recordIdFromUrl}`;
              } else {
                console.warn('⚠️ Record not found:', recordIdFromUrl);
              }
            } catch (error) {
              console.error('❌ Error fetching record:', error);
            }
          } else {
            // Case 1b: Only objectId - open the object
            console.log('🔍 Opening editor for object from URL:', object);
            console.log('📌 Setting selectedRow to OBJECT:', object.docId);
            setParentObject(null); // Clear parent object when viewing an object
            setSelectedRow(object);
            setIsEditorOpen(true);
            
            // Mark this URL as loaded
            loadedFromUrlRef.current = `${objectIdFromUrl}_`;
          }
        } else {
          console.warn('⚠️ Object not found:', objectIdFromUrl);
        }
      }
    };
    
    loadFromUrl();
  }, [objectIdFromUrl, recordIdFromUrl, objects, objectsLoading, businessId, setRecords, setObjects]);

  const handleRowClick = useCallback(
    (rowData) => {
      if (rowData.isAddNew) {
        setSelectedRow(null);
        setSelectedRowForEdit(null);
        setIsEditorOpen(true);
      } else {
        // Check if this row is already selected
        if (selectedRowForEdit?.docId === rowData.docId) {
          // If already selected, deselect it
          setSelectedRowForEdit(null);
        } else {
          // If not selected, select it (show floating button)
          setSelectedRowForEdit(rowData);
        }
      }
    },
    [selectedRowForEdit?.docId]
  );

  const handleRowEdit = useCallback(
    (rowData) => {
      // Check if this is an object or a record
      const isObject = rowData.isObject === true || objects.some(obj => obj.docId === rowData.docId);
      const fullData = isObject 
        ? (objects.find((obj) => obj.docId === rowData.docId) || rowData)
        : (records.find((record) => record.docId === rowData.docId) || rowData);
      
      // If this is a record, find its parent object by linkId
      if (!isObject && fullData.linkId) {
        const parent = objects.find(obj => obj.linkId === fullData.linkId);
        setParentObject(parent || null);
      } else {
        setParentObject(null);
      }
      
      setSelectedRow(fullData);
      setIsEditorOpen(true);
      setIsClosing(false);
      onRowClick(fullData);
      
      if (fullData?.docId) {
        const urlSheetName = activeSheetName.replace(/ /g, "-");
        // Use different URL pattern for objects vs records
        let url;
        if (isObject) {
          url = `/sheets/${urlSheetName}/object/${fullData.docId}`;
        } else {
          // For records, check if they're linked to an object
          if (fullData.typeOfObject) {
            const relatedObject = objects.find(obj => obj.typeOfObject === fullData.typeOfObject || obj.name === fullData.typeOfObject);
            if (relatedObject) {
              url = `/sheets/${urlSheetName}/object/${relatedObject.docId}/record/${fullData.docId}`;
            } else {
              url = `/sheets/${urlSheetName}/${fullData.docId}`;
            }
          } else {
            url = `/sheets/${urlSheetName}/${fullData.docId}`;
          }
        }
        navigate(url, { replace: false });
      }
      setSelectedRowForEdit(null); // Clear any existing selection
    },
    [records, objects, onRowClick, activeSheetName, navigate]
  );

  const handleFloatingEditClick = useCallback(
    () => {
      if (selectedRowForEdit) {
        // Check if this is an object or a record
        const isObject = selectedRowForEdit.isObject === true || objects.some(obj => obj.docId === selectedRowForEdit.docId);
        const fullData = isObject
          ? (objects.find((obj) => obj.docId === selectedRowForEdit.docId) || selectedRowForEdit)
          : (records.find((record) => record.docId === selectedRowForEdit.docId) || selectedRowForEdit);
        
        // If this is a record, find its parent object by linkId
        if (!isObject && fullData.linkId) {
          const parent = objects.find(obj => obj.linkId === fullData.linkId);
          setParentObject(parent || null);
        } else {
          setParentObject(null);
        }
        
        setSelectedRow(fullData);
        setIsEditorOpen(true);
        setIsClosing(false);
        onRowClick(fullData);
        
        if (fullData?.docId) {
          const urlSheetName = activeSheetName.replace(/ /g, "-");
          // Use different URL pattern for objects vs records
          const url = isObject 
            ? `/sheets/${urlSheetName}/object/${fullData.docId}`
            : `/sheets/${urlSheetName}/${fullData.docId}`;
          navigate(url, { replace: false });
        }
        setSelectedRowForEdit(null); // Clear selection after opening editor
      }
    },
    [selectedRowForEdit, records, objects, onRowClick, activeSheetName, navigate]
  );

  const handleEditorClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsEditorOpen(false);
      setSelectedRow(null);
      setSelectedRowForEdit(null);
      setParentObject(null); // Clear parent object reference
      loadedFromUrlRef.current = null; // Clear loaded URL ref
      setIsClosing(false);
      
      // Determine where to navigate back to
      const currentPath = window.location.pathname;
      const urlSheetName = activeSheetName.replace(/ /g, "-");
      
      // Check if we're viewing a record under an object
      const objectRecordMatch = currentPath.match(/\/sheets\/[^/]+\/object\/([^/]+)\/record\//);
      if (objectRecordMatch) {
        // Navigate back to the parent object
        const parentObjectId = objectRecordMatch[1];
        const backToObjectPath = `/sheets/${urlSheetName}/object/${parentObjectId}`;
        navigate(backToObjectPath, { replace: true });
      } else {
        // Check if we're viewing an object or record directly
        const expectedPath = `/sheets/${urlSheetName}`;
        if (currentPath !== expectedPath) {
          navigate(expectedPath, { replace: true });
        }
      }
    }, 300);
  }, [activeSheetName, navigate]);

  const handleEditorSave = useCallback(
    async (updatedRow, isEditing) => {
      console.log('🔍 handleEditorSave called:', { updatedRow, isEditing, businessId });
      
      // Set loading state for object/record creation
      if (!isEditing && (updatedRow.isObject === true || updatedRow.typeOfRecord)) {
        setIsCreatingObject(true);
      }
      if (!businessId) {
        console.error('❌ Cannot save: businessId is null/undefined');
        alert('Cannot save: Business ID not available. Please refresh the page and try again.');
        return;
      }

      const rowId = updatedRow.docId;
      
      // Check if this is an object using the explicit flag
      const isObject = updatedRow.isObject === true;

      if (isObject) {
        // Save object to Firebase first
        try {
          // Remove client-side tracking fields before saving to Firestore
          const { action, isModified, ...cleanObject } = updatedRow;
          console.log('� Saving object to Firebase:', cleanObject);
          await setDoc(doc(db, `businesses/${businessId}/objects/${updatedRow.docId}`), cleanObject);
          
          // Update local state AFTER successful save
          // The real-time listener will also pick this up, but we update here for immediate UI feedback
          if (!isEditing) {
            console.log('📝 Adding new object to state:', updatedRow);
            setObjects((prev) => {
              // Check if object already exists to prevent duplicates
              const exists = prev.some(obj => obj.docId === updatedRow.docId);
              if (exists) {
                console.log('⚠️ Object already exists in state, skipping add');
                return prev;
              }
              return [...prev, updatedRow];
            });

            // For new objects, update URL to match the actual object ID and keep editor open in edit mode
            const urlSheetName = activeSheetName.replace(/ /g, "-");
            const objectUrl = `/sheets/${urlSheetName}/object/${updatedRow.docId}`;
            console.log('🔗 Updating URL for new object:', objectUrl);
            navigate(objectUrl, { replace: true });

            // Update selectedRow to the saved object (this will switch RecordsEditor to edit mode)
            setSelectedRow(updatedRow);

            // Don't close the editor - keep it open in edit mode
            // setIsEditorOpen(false); // Commented out to keep editor open
          } else {
            console.log('� Updating existing object in state:', updatedRow);
            setObjects((prev) =>
              prev.map((object) => (object.docId === rowId ? updatedRow : object))
            );
            // Keep editor open for existing object updates (like records)
            // setIsEditorOpen(false); // Commented out to keep editor open
          }
        } catch (error) {
          console.error('Failed to save object to Firebase:', error);
          setIsEditorOpen(false); // Close on error
          setIsCreatingObject(false); // Reset loading state on error
        } finally {
          // Reset loading state
          setIsCreatingObject(false);
        }
      } else {
        // Save record to Firebase first
        try {
          // Remove client-side tracking fields before saving to Firestore
          const { action, isModified, ...cleanRecord } = updatedRow;
          console.log('� Saving record to Firebase:', cleanRecord);
          await setDoc(doc(db, `businesses/${businessId}/records/${updatedRow.docId}`), cleanRecord);
          
          // Update local state AFTER successful save
          if (!isEditing) {
            console.log('📝 Adding new record to state:', updatedRow);
            setRecords((prev) => {
              // Check if record already exists to prevent duplicates
              const exists = prev.some(rec => rec.docId === updatedRow.docId);
              if (exists) {
                console.log('⚠️ Record already exists in state, skipping add');
                return prev;
              }
              return [...prev, updatedRow];
            });

            // For new records, update URL to match the actual record ID and keep editor open in edit mode
            // Skip navigation if we're already on the correct URL (from pre-creation)
            const currentPath = window.location.pathname;
            const urlSheetName = activeSheetName.replace(/ /g, "-");
            let recordUrl;
            
            // If this record is linked to an object, use the object route
            if (updatedRow.typeOfObject) {
              const relatedObject = objects.find(obj => obj.typeOfObject === updatedRow.typeOfObject || obj.name === updatedRow.typeOfObject);
              if (relatedObject) {
                recordUrl = `/sheets/${urlSheetName}/object/${relatedObject.docId}/record/${updatedRow.docId}`;
              } else {
                recordUrl = `/sheets/${urlSheetName}/${updatedRow.docId}`;
              }
            } else {
              recordUrl = `/sheets/${urlSheetName}/${updatedRow.docId}`;
            }
            
            // Only navigate if we're not already on the correct URL
            if (currentPath !== recordUrl) {
              console.log('🔗 Updating URL for new record:', recordUrl);
              navigate(recordUrl, { replace: true });
            } else {
              console.log('🔗 Already on correct URL for new record:', recordUrl);
            }

            // Update selectedRow to the saved record (this will switch RecordsEditor to edit mode)
            setSelectedRow(updatedRow);

            // Don't close the editor - keep it open in edit mode
            // setIsEditorOpen(false); // Commented out to keep editor open
          } else {
            console.log('� Updating existing record in state:', updatedRow);
            setRecords((prev) =>
              prev.map((record) => (record.docId === rowId ? updatedRow : record))
            );
          }
        } catch (error) {
          console.error('Failed to save record to Firebase:', error);
          setIsCreatingObject(false); // Reset loading state on error
        } finally {
          // Reset loading state for records
          setIsCreatingObject(false);
        }

        // Update the related object to include this record (for new records) or ensure it's included (for existing records)
        if (updatedRow.linkId) {
          console.log('🔄 [Sheets] Updating related object in Firestore:', {
            recordDocId: updatedRow.docId,
            recordLinkId: updatedRow.linkId,
            recordTypeOfRecord: updatedRow.typeOfRecord,
            isEditing,
            isNewRecord: !isEditing
          });
          
          try {
            // Find the object this record belongs to by linkId
            const relatedObject = objects.find(obj => obj.linkId === updatedRow.linkId);
            console.log('🔍 [Sheets] Found related object for Firestore update:', relatedObject ? {
              objDocId: relatedObject.docId,
              objLinkId: relatedObject.linkId,
              objTypeOfObject: relatedObject.typeOfObject,
              objCurrentRecords: relatedObject.records
            } : 'NOT FOUND');
            
            if (relatedObject) {
              // Ensure the records array exists
              const currentRecords = relatedObject.records || [];
              
              // Check if this record is already in the array
              const existingIndex = currentRecords.findIndex(r => r.docId === updatedRow.docId);
              const recordInfo = { docId: updatedRow.docId, typeOfRecord: updatedRow.typeOfRecord };
              
              let updatedRecords;
              if (existingIndex >= 0) {
                // Update existing record info
                updatedRecords = [...currentRecords];
                updatedRecords[existingIndex] = recordInfo;
                console.log('📝 [Sheets] Updated existing record in Firestore array at index', existingIndex);
              } else {
                // Add new record info
                updatedRecords = [...currentRecords, recordInfo];
                console.log('➕ [Sheets] Added new record to Firestore array');
              }
              
              // Update the object to include this record
              const updatedObject = {
                ...relatedObject,
                records: updatedRecords,
                lastModified: new Date().toISOString()
              };
              
              console.log('📝 [Sheets] Updated object data for Firestore:', {
                objDocId: updatedObject.docId,
                newRecordsCount: updatedObject.records.length,
                newRecords: updatedObject.records
              });
              
              // Update local state
              setObjects(prev => prev.map(obj => 
                obj.docId === relatedObject.docId ? updatedObject : obj
              ));
              console.log('✅ [Sheets] Local state updated with record reference');
              
              // Save to Firebase (remove client-side tracking fields)
              const { action, isModified, ...cleanObject } = updatedObject;
              await setDoc(doc(db, `businesses/${businessId}/objects/${relatedObject.docId}`), cleanObject);
              console.log('✅ [Sheets] Firestore updated with record reference');
            } else {
              console.error('❌ [Sheets] Related object not found for linkId:', updatedRow.linkId);
              console.log('📊 [Sheets] Available objects:', objects.map(obj => ({
                docId: obj.docId,
                linkId: obj.linkId,
                typeOfObject: obj.typeOfObject
              })));
            }
          } catch (error) {
            console.error('❌ [Sheets] Failed to update related object:', error);
          }
        } else {
          console.log('⏭️ [Sheets] Skipping related object update:', {
            hasLinkId: !!updatedRow.linkId,
            isEditing,
            recordDocId: updatedRow.docId
          });
        }
      }
      setSelectedRow(updatedRow);
      
      // Keep editor open for all items (both objects and records, new and existing)
      // They switch to edit mode and stay open for continued editing
      // setIsEditorOpen(false); // Never close editor after save
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, objects, onRecordSave, setObjects, businessId, setRecords]
  );

  const handleInlineSave = useCallback(
    (updatedRowData) => {
      const rowId = updatedRowData.docId;
      
      // Determine if this is an object record or regular record
      const isObjectRecord = updatedRowData.isObject;
      const recordArray = isObjectRecord ? objects : records;
      const setRecordArray = isObjectRecord ? setObjects : setRecords;
      
      // Find the original record to compare
      const originalRecord = recordArray.find(record => record.docId === rowId);
      if (!originalRecord) {
        return;
      }
      
      // Check if any data actually changed (excluding system fields)
      const systemFields = ['updatedAt', 'createdAt', 'createdBy', 'lastModifiedBy'];
      let hasDataChanges = false;
      let changedField = null;
      
      for (const key of Object.keys(updatedRowData)) {
        if (systemFields.includes(key)) continue;
        
        const newValue = updatedRowData[key];
        const oldValue = originalRecord[key];
        
        // More robust comparison
        let valuesEqual = false;
        if (newValue === oldValue) {
          valuesEqual = true;
        } else if (newValue == null && oldValue == null) {
          valuesEqual = true;
        } else if (typeof newValue === 'string' && typeof oldValue === 'string') {
          valuesEqual = newValue.trim() === oldValue.trim();
        } else if (Array.isArray(newValue) && Array.isArray(oldValue)) {
          valuesEqual = JSON.stringify(newValue.sort()) === JSON.stringify(oldValue.sort());
        } else {
          // Try string comparison as fallback
          valuesEqual = String(newValue) === String(oldValue);
        }
        
        if (!valuesEqual) {
          hasDataChanges = true;
          changedField = key;
          break; // Found a change, no need to check further
        }
      }
      
      if (hasDataChanges) {
        setRecordArray((prev) =>
          prev.map((record) => (record.docId === rowId ? updatedRowData : record))
        );
        onRecordSave(updatedRowData);
      }
    },
    [records, objects, onRecordSave, setRecords, setObjects]
  );

  const handleCreateNewRecord = useCallback(
    (templateData) => {
      console.log('🔍 handleCreateNewRecord called:', {
        templateData,
        templateLinkId: templateData.linkId,
        templateTypeOfRecord: templateData.typeOfRecord,
        templateTypeOfObject: templateData.typeOfObject
      });
      
      // Generate a docId immediately for the URL
      const generatedDocId = `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create initial data for the new record (with generated docId for URL purposes)
      const newRecordInitialData = {
        docId: generatedDocId, // Include docId so URL can be constructed
        linkId: templateData.linkId,
        typeOfRecord: templateData.typeOfRecord,
        typeOfObject: templateData.typeOfObject,
        assignedTo: templateData.assignedTo || user?.email || '',
        sheetName: templateData.sheetName,
        // Mark as new record for the editor to know it's in create mode
        isNewRecord: true,
      };
      
      console.log('📝 Created new record initial data:', {
        docId: newRecordInitialData.docId,
        linkId: newRecordInitialData.linkId,
        typeOfRecord: newRecordInitialData.typeOfRecord,
        typeOfObject: newRecordInitialData.typeOfObject,
        isNewRecord: newRecordInitialData.isNewRecord
      });
      
      // Open the editor with the initial data
      setSelectedRow(newRecordInitialData);
      setIsEditorOpen(true);
      
      // Set the parent object for breadcrumb display during creation
      if (templateData.linkId && templateData.typeOfObject) {
        const linkedObject = objects.find(obj => obj.linkId === templateData.linkId);
        if (linkedObject) {
          setParentObject(linkedObject);
          console.log('🎯 Set parent object for breadcrumb:', {
            parentDocId: linkedObject.docId,
            parentLinkId: linkedObject.linkId,
            parentTypeOfObject: linkedObject.typeOfObject
          });
        } else {
          console.warn('⚠️ Parent object not found for breadcrumb:', templateData.linkId);
        }
      }
      
      // Navigate to the record URL immediately
      const urlSheetName = activeSheetName.replace(/ /g, "-");
      let recordUrl;
      
      // For linked records, use the object/record URL
      if (templateData.linkId && templateData.typeOfObject) {
        const linkedObject = objects.find(obj => obj.linkId === templateData.linkId);
        if (linkedObject) {
          recordUrl = `/sheets/${urlSheetName}/object/${linkedObject.docId}/record/${generatedDocId}`;
        } else {
          recordUrl = `/sheets/${urlSheetName}/${generatedDocId}`;
        }
      } else {
        recordUrl = `/sheets/${urlSheetName}/${generatedDocId}`;
      }
      
      console.log('🔗 Navigating to new record URL:', recordUrl);
      navigate(recordUrl, { replace: true });
    },
    [user, activeSheetName, navigate, objects]
  );

  const handleCreateNewObject = useCallback(
    (objectData) => {
      console.log('🔍 handleCreateNewObject called:', objectData);
      setSelectedRow(objectData);
      setIsEditorOpen(true);
    },
    []
  );

  // Handle navigation to object URLs
  const handleNavigateToObject = useCallback(
    (objectId) => {
      const urlSheetName = activeSheetName.replace(/ /g, "-");
      const url = `/sheets/${urlSheetName}/object/${objectId}`;
      console.log('🔗 Navigating to object URL:', url);
      navigate(url, { replace: true });
    },
    [activeSheetName, navigate]
  );

  // Handle navigation to related record URLs with parent context
  const handleNavigateToRelatedRecord = useCallback(
    (targetRecord, currentFormData) => {
      const urlSheetName = activeSheetName.replace(/ /g, "-");
      let recordUrl;
      
      // If current form data is an object, navigate to record within object context
      if (currentFormData?.isObject === true && currentFormData?.docId) {
        recordUrl = `/sheets/${urlSheetName}/object/${currentFormData.docId}/record/${targetRecord.docId}`;
      } else {
        // Navigate to standalone record
        recordUrl = `/sheets/${urlSheetName}/${targetRecord.docId}`;
      }
      
      console.log('🔗 Navigating to related record URL:', recordUrl);
      navigate(recordUrl, { replace: true });
    },
    [activeSheetName, navigate]
  );

  const handleSelectToggle = useCallback(() => {
    setIsSelectMode((prev) => {
      if (prev) setSelectedRowIds([]); // Clear selections when exiting select mode
      return !prev;
    });
  }, []);

  const handleRowSelect = useCallback(
    (rowData) => {
      if (isSelectMode && !rowData.isAddNew) {
        const rowId = rowData.docId;
        setSelectedRowIds((prev) =>
          prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
        );
      } else {
        handleRowClick(rowData);
      }
    },
    [isSelectMode, handleRowClick]
  );

  const handleSelectAll = useCallback(() => {
    if (selectedRowIds.length === finalRows.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(finalRows.filter((row) => !row.isAddNew).map((row) => row.docId));
    }
  }, [finalRows, selectedRowIds]);

  const handleDeleteSelected = useCallback(() => {
    // Mark selected records for deletion
    setRecords((prev) =>
      prev.map((record) =>
        selectedRowIds.includes(record.docId)
          ? { ...record, isModified: true, action: 'remove' }
          : record
      )
    );
    
    // Note: Parent objects' records arrays will be updated automatically by the
    // atomic batch operation in MainContext when the records are deleted.
    // We don't need to update objects state here - the real-time listener will
    // pick up the changes after the batch commit.
    
    setSelectedRowIds([]);
    setIsSelectMode(false);
  }, [selectedRowIds, setRecords]);

  const handleDeleteSelectedObjects = useCallback(() => {
    setObjects((prev) =>
      prev.map((object) =>
        selectedRowIds.includes(object.docId)
          ? { ...object, isModified: true, action: 'remove' }
          : object
      )
    );
    setSelectedRowIds([]);
    setIsSelectMode(false);
  }, [selectedRowIds, setObjects]);

  // Ensure URL always matches the current active sheet
  useEffect(() => {
    if (activeSheetName) {
      const urlSheetName = activeSheetName.replace(/ /g, "-");
      const expectedUrl = `/sheets/${urlSheetName}`;
      if (!window.location.pathname.startsWith(expectedUrl)) {
        window.history.replaceState({}, '', expectedUrl);
      }
    }
  }, [activeSheetName]);

  // Helper to get display name from uid
  const getTeamMemberName = (uid) => {
    if (!uid) return '';
    if (uid === user?.uid) return user?.name && user?.surname ? `${user.name} ${user.surname}` : user?.email || 'Me';
    const member = teamMembers?.find((tm) => tm.uid === uid);
    return member ? `${member.name || ''} ${member.surname || ''}`.trim() : uid;
  };

  // Define loading UI
  const _LoadingUI = (
    <div
      className={`${styles.sheetWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}
      style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <ImSpinner2 className={styles.iconSpinner} size={32} style={{ marginRight: 12 }} />
      <span>Loading objects...</span>
    </div>
  );

  // Define TableContent (same as before)
  const TableContent = (
    <div className={styles.tableContent}>
      {activeSheet && (
        <div className={`${styles.controls} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <div className={styles.buttonGroup}>
            {!isSelectMode && (
              <button
                className={`${styles.filterButton} ${
                  isDarkTheme ? styles.darkTheme : ''
                } ${Object.keys(recordTypeFilters).length > 0 ? styles.active : ''}`}
                onClick={onFilter}
              >
                <MdFilterAlt size={20} />
              </button>
            )}
          </div>
          <div className={styles.searchContainer}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className={`${styles.searchBar} ${isDarkTheme ? styles.darkTheme : ''}`}
            />
            {searchQuery && (
              <button className={styles.clearButton} onClick={clearSearch}>
                <IoCloseCircle size={18} />
              </button>
            )}
          </div>
          {isBusinessUser && !isSelectMode && (
            <button className={styles.editHeaderButton} onClick={onEditSheet}>
              Edit
            </button>
          )}
        </div>
      )}
      <div
        className={`${styles.tableWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}
        ref={scrollContainerRef}
      >
        <div className={`${styles.header} ${isDarkTheme ? styles.darkTheme : ''}`}>
          {isSelectMode && (
            <div className={`${styles.headerCell} ${styles.emptyHeaderCell}`}></div>
          )}
          {visibleHeaders.map((header) => (
            <div key={header.key} className={styles.headerCell}>
              {header.name}
            </div>
          ))}
        </div>
        {_spinnerVisible ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
            fontSize: '18px',
            color: isDarkTheme ? '#ffffff' : '#666'
          }}>
            <ImSpinner2 className={styles.iconSpinner} size={32} style={{ marginRight: 12 }} />
            Loading records...
          </div>
        ) : !activeSheet ? (
          <div className={styles.selectSheetMessage + (isDarkTheme ? ' ' + styles.darkTheme : '')}>
            <div className={styles.selectSheetTitle}>Select a sheet</div>
            <div className={styles.selectSheetSubtitle}>Tap a sheet tab to get started</div>
          </div>
        ) : (
          <div className={`${styles.bodyContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
            {filteredRecords.length > 0 ? (
              filteredRecords.map((rowData, rowIndex) => (
                <RowComponent
                  key={rowData.docId || rowIndex}
                  rowData={rowData}
                  headers={visibleHeaders}
                  onClick={() => isSelectMode ? handleRowSelect(rowData) : handleRowClick(rowData)}
                  isSelected={isSelectMode ? selectedRowIds.includes(rowData.docId) : (selectedRowForEdit?.docId === rowData.docId)}
                  isSelectMode={isSelectMode}
                  onSelect={handleRowSelect}
                  getTeamMemberName={getTeamMemberName}
                  onInlineSave={handleInlineSave}
                  onEdit={handleRowEdit}
                  teamMembers={teamMembers}
                />
              ))
            ) : (
              <div className={styles.noResults}>No results found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Define ActionButtons component
  const ActionButtons = (
    <div className={styles.actionTabsContainer}>
      {isBusinessUser && !isSelectMode && activeSheet && (
        <>
          <button
            className={`${styles.actionTabButton} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={handleSelectToggle}
          >
            Select
          </button>
          <button
            className={`${styles.actionTabButton} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={() => handleRowClick({ isAddNew: true })}
          >
            + Add
          </button>
        </>
      )}
      {isSelectMode && isBusinessUser && (
        <>
          <button
            className={`${styles.actionTabButton} ${styles.cancelTab} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={handleSelectToggle}
          >
            Cancel
          </button>
          <button
            className={`${styles.actionTabButton} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={handleSelectAll}
          >
            {selectedRowIds.length === finalRows.filter((row) => !row.isAddNew).length
              ? 'Deselect All'
              : 'Select All'}
          </button>
          {selectedRowIds.length > 0 && (
            <>
              <button
                className={`${styles.actionTabButton} ${styles.deleteTab} ${isDarkTheme ? styles.darkTheme : ''}`}
                onClick={() => {
                  // Check if selected items are objects or records
                  const selectedObjects = objects.filter(obj => selectedRowIds.includes(obj.docId));
                  const isDeletingObjects = selectedObjects.length > 0;
                  
                  if (
                    window.confirm(
                      `Are you sure you want to delete the selected ${isDeletingObjects ? 'objects' : 'records'}? This action cannot be undone.`
                    )
                  ) {
                    if (isDeletingObjects) {
                      handleDeleteSelectedObjects();
                    } else {
                      handleDeleteSelected();
                    }
                  }
                }}
              >
                Delete
              </button>
            </>
          )}
        </>
      )}
    </div>
  );

  // Define SheetTabs component separately
  const SheetTabs = (
    <div className={`${styles.sheetTabs} ${isDarkTheme ? styles.darkTheme : ''}`} ref={sheetTabsRef}>
      {isBusinessUser && (
        <button
          className={`${styles.orderButton} ${isDarkTheme ? styles.darkTheme : ''}`}
          onClick={onOpenSheetsModal}
        >
          <CgArrowsExchangeAlt />
        </button>
      )}
      {isBusinessUser && (
        <button
          className={`${styles.addTabButton} ${isDarkTheme ? styles.darkTheme : ''}`}
          onClick={onOpenSheetFolderModal}
        >
          +
        </button>
      )}
      {sheets.structure.map((item, index) =>
        item.folderName ? (
          <div key={`folder-${item.folderName}-${index}`} className={styles.folderContainer}>
            <button
              className={`${styles.tabButton} ${
                item.sheets.includes(decodedActiveSheetName) ? styles.activeTab : ''
              } ${isDarkTheme ? styles.darkTheme : ''}`}
              data-folder-name={item.folderName}
              onClick={() => handleFolderClick(item.folderName)}
            >
              <FaFolder className={styles.folderIcon} />
              {item.sheets.includes(decodedActiveSheetName)
                ? `${item.folderName} > ${decodedActiveSheetName}`
                : item.folderName}
            </button>
          </div>
        ) : (
          !folderSheets.includes(item.sheetName) && (
            <div key={`sheet-${item.sheetName}-${index}`} className={styles.sheetContainer}>
              <button
                className={`${styles.tabButton} ${
                  item.sheetName === decodedActiveSheetName ? styles.activeTab : ''
                } ${isDarkTheme ? styles.darkTheme : ''}`}
                data-sheet-name={item.sheetName}
                onClick={() => handleSheetClick(item.sheetName)}
              >
                <BiSolidSpreadsheet className={styles.folderIcon} />
                {item.sheetName}
              </button>
            </div>
          )
        )
      )}
    </div>
  );

  return (
    <div className={`${styles.sheetWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={`${styles.tableContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
        {TableContent}
        {ActionButtons}
        {SheetTabs}
        {isMobile && isEditorOpen && (
          <div
            className={`${styles.recordDetailsMobile} ${
              shouldAnimateIn && !isClosing ? styles.recordOpen : isClosing ? styles.recordClosed : ''
            }`}
          >
            <RecordsEditor
              key={selectedRow?.docId || (isCreatingObject ? 'new-object' : 'no-selection')}
              onClose={handleEditorClose}
              onSave={handleEditorSave}
              onOpenNewRecord={handleCreateNewRecord}
              onNavigateToRelatedRecord={handleNavigateToRelatedRecord}
              onNavigateToObject={handleNavigateToObject}
              onCreateObject={handleCreateNewObject}
              initialRowData={selectedRow}
              startInEditMode={!!selectedRow}
              preSelectedSheet={activeSheetName}
              parentObjectData={parentObject}
              isCreatingObject={isCreatingObject}
            />
          </div>
        )}
      </div>
      {/* Floating edit button positioned near the selected row */}
      {selectedRowForEdit && !isSelectMode && (
        <button
          className={`${styles.floatingEditButton} ${isDarkTheme ? styles.darkTheme : ''}`}
          onClick={handleFloatingEditClick}
          title="Edit record"
          style={{
            position: 'fixed',
            top: `${editButtonPosition.top}px`,
            left: `${editButtonPosition.left}px`,
            transform: 'translateY(-50%)',
            zIndex: 900
          }}
        >
          <FiEdit size={16} />
          Edit
        </button>
      )}
      {isEditorOpen && !isMobile && (
        <>
          <div className={`${styles.backdrop} ${shouldAnimateIn && !isClosing ? styles.visible : isClosing ? styles.visible : ''}`} onClick={handleEditorClose}></div>
          <div className={`${styles.recordDetailsPopup} ${isDarkTheme ? styles.darkTheme : ''} ${shouldAnimateIn && !isClosing ? styles['animate-in'] : isClosing ? styles['animate-out'] : ''}`}>
            <RecordsEditor
              key={selectedRow?.docId || (isCreatingObject ? 'new-object' : 'no-selection')}
              onClose={handleEditorClose}
              onSave={handleEditorSave}
              onOpenNewRecord={handleCreateNewRecord}
              onNavigateToRelatedRecord={handleNavigateToRelatedRecord}
              onNavigateToObject={handleNavigateToObject}
              onCreateObject={handleCreateNewObject}
              initialRowData={selectedRow}
              startInEditMode={!!selectedRow}
              preSelectedSheet={activeSheetName}
              parentObjectData={parentObject}
              isCreatingObject={isCreatingObject}
            />
          </div>
        </>
      )}
    </div>
  );
};

Sheets.propTypes = {
  headers: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      type: PropTypes.string,
      visible: PropTypes.bool,
      hidden: PropTypes.bool,
    })
  ).isRequired,
  sheets: PropTypes.shape({
    allSheets: PropTypes.array.isRequired,
    structure: PropTypes.array.isRequired,
  }).isRequired,
  setSheets: PropTypes.func.isRequired,
  activeSheetName: PropTypes.string,
  onSheetChange: PropTypes.func.isRequired,
  onEditSheet: PropTypes.func.isRequired,
  onFilter: PropTypes.func.isRequired,
  onRowClick: PropTypes.func.isRequired,
  onRecordSave: PropTypes.func.isRequired,
  onRecordDelete: PropTypes.func.isRequired,
  onOpenSheetsModal: PropTypes.func.isRequired,
  onOpenTransportModal: PropTypes.func.isRequired,
  onOpenSheetFolderModal: PropTypes.func.isRequired,
  onOpenFolderModal: PropTypes.func.isRequired,
};

export default Sheets;
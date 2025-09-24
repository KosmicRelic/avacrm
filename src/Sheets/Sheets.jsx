import React, { useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

// Local components
import RowComponent from './Row Template/RowComponent';
import RecordsEditor from './Records Editor/RecordsEditor';

// Context and utilities
import { MainContext } from '../Contexts/MainContext';
import { filterRowsLocally } from '../Modal/FilterModal/FilterModal';
import { decodeSheetName, toMillis, isPrimarySheet, getSheetLoadingState } from './sheetsUtils';

// Styles
import styles from './Sheets.module.css';

const Sheets = ({
  headers,
  sheets,
  setSheets,
  activeSheetName,
  onSheetChange,
  onEditSheet,
  onFilter,
  onRowClick,
  onRecordSave,
  onRecordDelete,
  onOpenSheetsModal,
  onOpenTransportModal,
  onOpenSheetFolderModal,
  onOpenFolderModal,
}) => {
  const { isDarkTheme, setRecords, records, setActiveSheetName: setActiveSheetNameWithRef, sheetRecordsFetched, user, businessId, teamMembers } = useContext(MainContext);
  const params = useParams();
  const navigate = useNavigate();

  // --- LOGGING FOR DEBUGGING RECORD LOADING ---
  const decodedActiveSheetName = decodeSheetName(activeSheetName);

  const activeSheet = sheets.allSheets.find((sheet) => sheet.sheetName === decodedActiveSheetName);

  const sheetId = activeSheet?.docId;
  const isLoading = useMemo(() => getSheetLoadingState(sheetId, sheetRecordsFetched), [sheetId, sheetRecordsFetched]);

  const [spinnerVisible, setSpinnerVisible] = useState(false);
  const [spinnerFading, setSpinnerFading] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setSpinnerVisible(true);
      setSpinnerFading(false);
    } else if (spinnerVisible) {
      setSpinnerFading(true);
      const timeout = setTimeout(() => {
        setSpinnerVisible(false);
        setSpinnerFading(false);
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  const sheetRecordTypes = useMemo(() => activeSheet?.typeOfRecordsToDisplay || [], [activeSheet]);
  const recordTypeFilters = useMemo(() => activeSheet?.recordTypeFilters || {}, [activeSheet]);
  const globalFilters = useMemo(() => activeSheet?.filters || {}, [activeSheet]);
  const isPrimarySheetFlag = useMemo(() => isPrimarySheet(activeSheet), [activeSheet]);

  const sheetRecords = useMemo(() => {
    if (!activeSheet) return [];
    
    // Create a Set for O(1) lookup of record types
    const sheetRecordTypesSet = new Set(sheetRecordTypes);
    
    // Pre-filter by record types first (usually eliminates most records quickly)
    // Use Set.has() for O(1) lookup instead of Array.includes() O(n)
    const relevantRecords = records.filter((record) => sheetRecordTypesSet.has(record.typeOfRecord));
    
    // Then apply record type filters (only on relevant records)
    return relevantRecords.filter((record) => {
      const filters = recordTypeFilters[record.typeOfRecord] || {};
        return Object.entries(filters).every(([field, filter]) => {
          if (field === 'userFilter') {
            if (filter.headerKey && filter.condition === 'equals') {
              const recordValue = record[filter.headerKey];
              return recordValue === user.uid;
            }
            return true;
          }

          const header = headers.find((h) => h.key === field);
          const value = record[field];
          if (!filter || !header) {
            return true;
          }

          switch (header.type) {
            case 'number':
              if (!filter.start && !filter.end && !filter.value && !filter.sortOrder) return true;
              const numValue = Number(value) || 0;
              if (filter.start || filter.end) {
                const startNum = filter.start ? Number(filter.start) : -Infinity;
                const endNum = filter.end ? Number(filter.end) : Infinity;
                return numValue >= startNum && numValue <= endNum;
              }
              if (!filter.value || !filter.order) return true;
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
            case 'date':
              if (!filter.sortOrder) return true;
              return true;
            case 'dropdown':
              if (!filter.values || filter.values.length === 0) return true;
              return filter.values.includes(value);
            case 'text':
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
            default:
              return true;
          }
        });
      });
  }, [records, sheetRecordTypes, recordTypeFilters, headers, user.uid]);

  const filteredWithGlobalFilters = useMemo(() => {
    return sheetRecords.filter((row) =>
      Object.entries(globalFilters).every(([headerKey, filter]) => {
        const header = headers.find((h) => h.key === headerKey);
        const rowValue = row[headerKey];
        if (!filter || !header) {
          return true;
        }

        switch (header.type) {
          case 'number':
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
          case 'date':
            if (!filter.sortOrder) return true;
            return true;
          case 'dropdown':
            if (!filter.values || filter.values.length === 0) return true;
            return filter.values.includes(rowValue);
          case 'text':
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

  const isMobile = windowWidth <= 1024;

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
  }, [filteredWithGlobalFilters, globalFilters, searchQuery, visibleHeaders, activeSheetName]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    // Only use globalFilters (FilterModal) for client-side sorting
    const sortCriteria = Object.entries(globalFilters)
      .filter(([_, filter]) => filter.sortOrder)
      .map(([field, filter]) => ({
        key: field,
        sortOrder: filter.sortOrder,
        type: headers.find((h) => h.key === field)?.type || 'text',
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
  }, [filteredRows, globalFilters, headers, activeSheetName]);

  const finalRows = useMemo(() => sortedRows, [sortedRows]);

  // Get filtered records (excluding the "Add New" row)
  const filteredRecords = useMemo(() => 
    finalRows.filter(rowData => rowData.docId), 
    [finalRows]
  );

  const isBusinessUser = user && user.uid === businessId;

  useEffect(() => {
    if (activeSheet && Array.isArray(sheets.allSheets) && sheets.allSheets.length > 0) {
      // console.log('[Sheets][DEBUG] Attempting to load records for activeSheet:', activeSheet.sheetName, 'with docId:', activeSheet.docId);
    }
  }, [activeSheet, sheets.allSheets]);

  const handleSheetClick = useCallback(
    (sheetName) => {
      const urlSheetName = sheetName.replace(/ /g, "-");
      const newUrl = `/sheets/${urlSheetName}`;
      if (window.location.pathname !== newUrl) {
        window.history.pushState({}, '', newUrl);
      }
      if (sheetName !== activeSheetName) {
        setActiveSheetNameWithRef(sheetName);
        onSheetChange(sheetName);
      }
    },
    [activeSheetName, onSheetChange, setActiveSheetNameWithRef]
  );

  const prevActiveSheetNameRef = useRef();
  useEffect(() => {
    setSpinnerVisible(false);
    setSpinnerFading(false);
    setIsEditorOpen(false);
    setSelectedRow(null);
    setIsSelectMode(false);
    setSelectedRowIds([]);
    setSearchQuery('');
    prevActiveSheetNameRef.current = activeSheetName;
  }, [activeSheetName]);

  useEffect(() => {
    // console.log('[Sheets.jsx][CONTEXT] activeSheetName from context changed:', activeSheetName);
  }, [activeSheetName]);

  const handleFolderClick = useCallback(
    (folderName) => {
      onOpenFolderModal(folderName, (sheetName) => {
        setActiveSheetNameWithRef(sheetName);
        onSheetChange(sheetName);
        const urlSheetName = sheetName.replace(/ /g, "-");
        const newUrl = `/sheets/${urlSheetName}`;
        window.history.pushState({}, '', newUrl);
      });
    },
    [onOpenFolderModal, onSheetChange, setActiveSheetNameWithRef]
  );

  const clearSearch = useCallback(() => setSearchQuery(''), []);

  const recordIdFromUrl = params.recordId;

  useEffect(() => {
    if (recordIdFromUrl && records.length > 0) {
      const record = records.find((c) => c.docId === recordIdFromUrl);
      if (record) {
        setSelectedRow(record);
        setIsEditorOpen(true);
      }
    }
  }, [recordIdFromUrl, records]);

  const handleRowClick = useCallback(
    (rowData) => {
      if (rowData.isAddNew) {
        setIsEditorOpen(true);
        setSelectedRow(null);
        setSelectedRowForEdit(null);
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
    []
  );

  const handleFloatingEditClick = useCallback(
    () => {
      if (selectedRowForEdit) {
        const fullRecord = records.find((record) => record.docId === selectedRowForEdit.docId) || selectedRowForEdit;
        setSelectedRow(fullRecord);
        setIsEditorOpen(true);
        setIsClosing(false);
        onRowClick(fullRecord);
        if (fullRecord?.docId) {
          const urlSheetName = activeSheetName.replace(/ /g, "-");
          navigate(`/sheets/${urlSheetName}/${fullRecord.docId}`, { replace: false });
        }
        setSelectedRowForEdit(null); // Clear selection after opening editor
      }
    },
    [selectedRowForEdit, records, onRowClick, activeSheetName, navigate]
  );

  const handleEditorClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsEditorOpen(false);
      setSelectedRow(null);
      setSelectedRowForEdit(null);
      setIsClosing(false);
      const urlSheetName = activeSheetName.replace(/ /g, "-");
      navigate(`/sheets/${urlSheetName}`, { replace: true });
    }, 300);
  }, [activeSheetName, navigate]);

  const handleEditorSave = useCallback(
    (updatedRow, isEditing) => {
      const rowId = updatedRow.docId;
      const newRecordData = { ...updatedRow, isModified: true, action: isEditing ? 'update' : 'add' };

      if (!isEditing) {
        setRecords((prev) => [...prev, newRecordData]);
      } else {
        setRecords((prev) =>
          prev.map((record) => (record.docId === rowId ? newRecordData : record))
        );
      }
      onRecordSave(newRecordData);
      setSelectedRow(newRecordData);
      setIsEditorOpen(false);
    },
    [onRecordSave]
  );

  const handleInlineSave = useCallback(
    (updatedRowData) => {
      const rowId = updatedRowData.docId;
      const newRecordData = { ...updatedRowData, isModified: true, action: 'update' };

      setRecords((prev) =>
        prev.map((record) => (record.docId === rowId ? newRecordData : record))
      );
      onRecordSave(newRecordData);
    },
    [onRecordSave]
  );

  const handleOpenNewRecord = useCallback(
    (newRecordData) => {
      // Add the new record to the records array
      setRecords((prev) => [...prev, newRecordData]);
      
      // Save the record to Firestore
      onRecordSave(newRecordData);
      
      // Open the new record in the editor immediately
      setSelectedRow(newRecordData);
      setIsEditorOpen(true);
    },
    [onRecordSave, setRecords]
  );

  const handleSelectToggle = useCallback(() => {
    setIsSelectMode((prev) => !prev);
    if (isSelectMode) setSelectedRowIds([]);
  }, [isSelectMode]);

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
    setRecords((prev) =>
      prev.map((record) =>
        selectedRowIds.includes(record.docId)
          ? { ...record, isModified: true, action: 'remove' }
          : record
      )
    );
    setSelectedRowIds([]);
    setIsSelectMode(false);
  }, [selectedRowIds, setRecords]);

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
  const LoadingUI = (
    <div
      className={`${styles.sheetWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}
      style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <ImSpinner2 className={styles.iconSpinner} size={32} style={{ marginRight: 12 }} />
      <span>Loading sheet data...</span>
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
            {isSelectMode && isBusinessUser ? (
              <>
                <button
                  className={`${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  onClick={handleSelectToggle}
                >
                  Cancel
                </button>
                {selectedRowIds.length > 0 && (
                  <>
                    <button
                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={handleSelectAll}
                    >
                      {selectedRowIds.length === finalRows.filter((row) => !row.isAddNew).length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                    <button
                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Are you sure you want to delete the selected records? This action cannot be undone.'
                          )
                        ) {
                          handleDeleteSelected();
                        }
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </>
            ) : null}
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
        {spinnerVisible ? (
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
      {isBusinessUser && (
        <button
          className={`${styles.actionTabButton} ${isSelectMode ? styles.active : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
          onClick={handleSelectToggle}
        >
          Select
        </button>
      )}
      <button
        className={`${styles.actionTabButton} ${isDarkTheme ? styles.darkTheme : ''}`}
        onClick={() => handleRowClick({ isAddNew: true })}
      >
        + Add
      </button>
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
              key={selectedRow?.docId || Date.now()}
              onClose={handleEditorClose}
              onSave={handleEditorSave}
              onOpenNewRecord={handleOpenNewRecord}
              initialRowData={selectedRow}
              startInEditMode={!!selectedRow}
              preSelectedSheet={activeSheetName}
            />
          </div>
        )}
      </div>
      {/* Floating edit button positioned at bottom center of screen */}
      {selectedRowForEdit && !isSelectMode && (
        <button
          className={`${styles.floatingEditButton} ${isDarkTheme ? styles.darkTheme : ''}`}
          onClick={handleFloatingEditClick}
          title="Edit record"
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
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
              key={selectedRow?.docId || Date.now()}
              onClose={handleEditorClose}
              onSave={handleEditorSave}
              onOpenNewRecord={handleOpenNewRecord}
              initialRowData={selectedRow}
              startInEditMode={!!selectedRow}
              preSelectedSheet={activeSheetName}
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
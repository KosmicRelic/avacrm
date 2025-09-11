import React, { useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './Sheets.module.css';
import RowComponent from './Row Template/RowComponent';
import CardsEditor from './Cards Editor/CardsEditor';
import { IoCloseCircle } from 'react-icons/io5';
import { FaFolder } from 'react-icons/fa';
import { MdFilterAlt } from 'react-icons/md';
import { MainContext } from '../Contexts/MainContext';
import { CgArrowsExchangeAlt } from 'react-icons/cg';
import { BiSolidSpreadsheet } from 'react-icons/bi';
import { ImSpinner2 } from 'react-icons/im';
import { useParams, useNavigate } from 'react-router-dom';
import { filterRowsLocally } from '../Modal/FilterModal/FilterModal';

// Utility to decode dashes to spaces for sheet names from URL, and ignore cardId if present
function decodeSheetName(name) {
  if (!name) return '';
  return name.split('/')[0].replace(/-/g, ' ');
}

// Utility function to robustly convert any date value to milliseconds
function toMillis(dateValue) {
  // Firestore Timestamp object
  if (
    dateValue &&
    typeof dateValue === 'object' &&
    typeof dateValue.seconds === 'number' &&
    typeof dateValue.nanoseconds === 'number'
  ) {
    return dateValue.seconds * 1000 + Math.floor(dateValue.nanoseconds / 1e6);
  }
  // Firestore Timestamp with toDate()
  if (dateValue && typeof dateValue.toDate === 'function') {
    return dateValue.toDate().getTime();
  }
  // JS Date object
  if (dateValue instanceof Date) {
    return dateValue.getTime();
  }
  // ISO string or date string
  if (typeof dateValue === 'string') {
    const parsed = Date.parse(dateValue);
    if (!isNaN(parsed)) return parsed;
  }
  // null/undefined/invalid
  return NaN;
}

const Sheets = ({
  headers,
  sheets,
  setSheets,
  activeSheetName,
  onSheetChange,
  onEditSheet,
  onFilter,
  onRowClick,
  onCardSave,
  onCardDelete,
  onOpenSheetsModal,
  onOpenTransportModal,
  onOpenSheetFolderModal,
  onOpenFolderModal,
}) => {
  const { isDarkTheme, setCards, cards, setActiveSheetName: setActiveSheetNameWithRef, sheetCardsFetched, user, businessId, teamMembers } = useContext(MainContext);
  const params = useParams();
  const navigate = useNavigate();

  // --- LOGGING FOR DEBUGGING CARD LOADING ---
  const decodedActiveSheetName = decodeSheetName(activeSheetName);

  const activeSheet = sheets.allSheets.find((sheet) => sheet.sheetName === decodedActiveSheetName);

  const sheetId = activeSheet?.docId;
  const isLoading = sheetId && !sheetCardsFetched[sheetId];

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

  const sheetCardTypes = useMemo(() => activeSheet?.typeOfCardsToDisplay || [], [activeSheet]);
  const cardTypeFilters = useMemo(() => activeSheet?.cardTypeFilters || {}, [activeSheet]);
  const globalFilters = useMemo(() => activeSheet?.filters || {}, [activeSheet]);
  const isPrimarySheet = activeSheet?.id === 'primarySheet';

  const sheetCards = useMemo(() => {
    if (!activeSheet) return [];
    return cards
      .filter((card) => sheetCardTypes.includes(card.typeOfCards))
      .filter((card) => {
        const filters = cardTypeFilters[card.typeOfCards] || {};
        return Object.entries(filters).every(([field, filter]) => {
          if (field === 'userFilter') {
            if (filter.headerKey && filter.condition === 'equals') {
              const cardValue = card[filter.headerKey];
              return cardValue === user.uid;
            }
            return true;
          }

          const header = headers.find((h) => h.key === field);
          const value = card[field];
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
  }, [cards, sheetCardTypes, cardTypeFilters, headers, activeSheet, activeSheetName, user.uid]);

  const filteredWithGlobalFilters = useMemo(() => {
    return sheetCards.filter((row) =>
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
  }, [sheetCards, globalFilters, headers, activeSheetName]);

  const scrollContainerRef = useRef(null);
  const sheetTabsRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
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

  const isBusinessUser = user && user.uid === businessId;

  useEffect(() => {
    if (activeSheet && Array.isArray(sheets.allSheets) && sheets.allSheets.length > 0) {
      // console.log('[Sheets][DEBUG] Attempting to load cards for activeSheet:', activeSheet.sheetName, 'with docId:', activeSheet.docId);
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

  const cardIdFromUrl = params.cardId;

  useEffect(() => {
    if (cardIdFromUrl && cards.length > 0) {
      const card = cards.find((c) => c.docId === cardIdFromUrl);
      if (card) {
        setSelectedRow(card);
        setIsEditorOpen(true);
      }
    }
  }, [cardIdFromUrl, cards]);

  const handleRowClick = useCallback(
    (rowData) => {
      if (rowData.isAddNew) {
        setIsEditorOpen(true);
        setSelectedRow(null);
      } else {
        const fullCard = cards.find((card) => card.docId === rowData.docId) || rowData;
        setSelectedRow(fullCard);
        setIsEditorOpen(true);
        setIsClosing(false);
        onRowClick(fullCard);
        if (fullCard?.docId) {
          const urlSheetName = activeSheetName.replace(/ /g, "-");
          navigate(`/sheets/${urlSheetName}/${fullCard.docId}`, { replace: false });
        }
      }
    },
    [onRowClick, cards, activeSheetName, navigate]
  );

  const handleEditorClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsEditorOpen(false);
      setSelectedRow(null);
      setIsClosing(false);
      const urlSheetName = activeSheetName.replace(/ /g, "-");
      navigate(`/sheets/${urlSheetName}`, { replace: true });
    }, 300);
  }, [activeSheetName, navigate]);

  const handleEditorSave = useCallback(
    (updatedRow, isEditing) => {
      const rowId = updatedRow.docId;
      const newCardData = { ...updatedRow, isModified: true, action: isEditing ? 'update' : 'add' };

      if (!isEditing) {
        setCards((prev) => [...prev, newCardData]);
      } else {
        setCards((prev) =>
          prev.map((card) => (card.docId === rowId ? newCardData : card))
        );
      }
      onCardSave(newCardData);
      setSelectedRow(newCardData);
      setIsEditorOpen(false);
    },
    [onCardSave, setCards]
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
    setCards((prev) =>
      prev.map((card) =>
        selectedRowIds.includes(card.docId)
          ? { ...card, isModified: true, action: 'remove' }
          : card
      )
    );
    setSelectedRowIds([]);
    setIsSelectMode(false);
  }, [selectedRowIds, setCards]);

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
                } ${Object.keys(cardTypeFilters).length > 0 ? styles.active : ''}`}
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
                            'Are you sure you want to delete the selected cards? This action cannot be undone.'
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
          <div className={`${styles.spinnerContainer} ${spinnerFading ? styles.spinnerFadeOut : ''}`}>
            <ImSpinner2
              className={`${styles.iconSpinner} ${isDarkTheme ? styles.iconSpinnerDark : styles.iconSpinnerLight}`}
              size={24}
            />
          </div>
        ) : !activeSheet ? (
          <div className={styles.selectSheetMessage + (isDarkTheme ? ' ' + styles.darkTheme : '')}>
            <div className={styles.selectSheetTitle}>Select a sheet</div>
            <div className={styles.selectSheetSubtitle}>Tap a sheet tab to get started</div>
          </div>
        ) : (
          <div className={`${styles.bodyContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <RowComponent
              rowData={{ docId: 'Add New Card', isAddNew: true }}
              headers={visibleHeaders}
              onClick={() => handleRowClick({ isAddNew: true })}
              isSelected={false}
              isSelectMode={isSelectMode}
              onSelect={handleSelectToggle}
              onAddRow={() => handleRowClick({ isAddNew: true })}
              style={{ display: activeSheet ? undefined : 'none' }}
              getTeamMemberName={getTeamMemberName}
            />
            {finalRows.filter(rowData => rowData.docId).length > 0 ? (
              finalRows.filter(rowData => rowData.docId).map((rowData, rowIndex) => (
                <RowComponent
                  key={rowData.docId || rowIndex}
                  rowData={rowData}
                  headers={visibleHeaders}
                  onClick={() => handleRowSelect(rowData)}
                  isSelected={selectedRowIds.includes(rowData.docId)}
                  isSelectMode={isSelectMode}
                  onSelect={handleRowSelect}
                  getTeamMemberName={getTeamMemberName}
                />
              ))
            ) : (
              <div className={styles.noResults}>No results found</div>
            )}
          </div>
        )}
      </div>
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
    </div>
  );

  return (
    <div className={`${styles.sheetWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={`${styles.tableContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
        {TableContent}
        {isMobile && isEditorOpen && (
          <div
            className={`${styles.cardDetailsMobile} ${
              shouldAnimateIn && !isClosing ? styles.cardOpen : isClosing ? styles.cardClosed : ''
            }`}
          >
            <CardsEditor
              key={selectedRow?.docId || Date.now()}
              onClose={handleEditorClose}
              onSave={handleEditorSave}
              initialRowData={selectedRow}
              startInEditMode={!!selectedRow}
              preSelectedSheet={activeSheetName}
            />
          </div>
        )}
      </div>
      {isEditorOpen && !isMobile && (
        <>
          <div className={`${styles.backdrop} ${shouldAnimateIn && !isClosing ? styles.visible : isClosing ? styles.visible : ''}`} onClick={handleEditorClose}></div>
          <div className={`${styles.cardDetailsPopup} ${isDarkTheme ? styles.darkTheme : ''} ${shouldAnimateIn && !isClosing ? styles['animate-in'] : isClosing ? styles['animate-out'] : ''}`}>
            <CardsEditor
              key={selectedRow?.docId || Date.now()}
              onClose={handleEditorClose}
              onSave={handleEditorSave}
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
  onCardSave: PropTypes.func.isRequired,
  onCardDelete: PropTypes.func.isRequired,
  onOpenSheetsModal: PropTypes.func.isRequired,
  onOpenTransportModal: PropTypes.func.isRequired,
  onOpenSheetFolderModal: PropTypes.func.isRequired,
  onOpenFolderModal: PropTypes.func.isRequired,
};

export default Sheets;
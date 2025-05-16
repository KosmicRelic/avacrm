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
  const { isDarkTheme, setCards, cards, setActiveSheetName, sheetCardsFetched, user, businessId } = useContext(MainContext);

  const activeSheet = sheets.allSheets.find((sheet) => sheet.sheetName === activeSheetName);
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
  // console.log('Active sheet cardTypeFilters:', cardTypeFilters);
  const globalFilters = useMemo(() => activeSheet?.filters || {}, [activeSheet]);
  const isPrimarySheet = activeSheet?.id === 'primarySheet';

  const sheetCards = useMemo(() => {
    if (!activeSheet) return [];
    // Log followUpDate values to inspect format
    
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
            if (!header) {
              console.warn('Header not found for cardTypeFilter', { field, cardType: card.typeOfCards, activeSheetName });
            }
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
              return true; // Sorting is handled in sortedRows, not filtering
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
          if (!header) {
            console.warn('Header not found for global filter', { headerKey, activeSheetName });
          }
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
            return true; // Sorting is handled in sortedRows, not filtering
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
  const [isClosing, setIsClosing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  const visibleHeaders = useMemo(() => headers.filter((header) => header.visible), [headers]);
  const isMobile = windowWidth <= 1024;

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

  const filteredRows = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return filteredWithGlobalFilters.filter((row) =>
      visibleHeaders.some((header) => String(row[header.key] || '').toLowerCase().includes(query))
    );
  }, [filteredWithGlobalFilters, searchQuery, visibleHeaders, activeSheetName]);

  const sortedRows = useMemo(() => {
    // console.log('Global Filters:', globalFilters);
    // console.log('Card Type Filters:', cardTypeFilters);
    const sorted = [...filteredRows];
    const sortCriteria = [
      ...Object.entries(cardTypeFilters).flatMap(([type, filters]) =>
        Object.entries(filters)
          .filter(([_, filter]) => filter.sortOrder)
          .map(([field, filter]) => ({
            key: field,
            sortOrder: filter.sortOrder,
            type: headers.find((h) => h.key === field)?.type || 'text',
            appliesToCardType: type,
          }))
      ),
      ...Object.entries(globalFilters)
        .filter(([_, filter]) => filter.sortOrder)
        .map(([field, filter]) => ({
          key: field,
          sortOrder: filter.sortOrder,
          type: headers.find((h) => h.key === field)?.type || 'text',
          appliesToCardType: null,
        })),
    ];

    // console.log('Sort Criteria:', sortCriteria);

    if (sortCriteria.length > 0) {
      sorted.sort((a, b) => {
        for (const { key, sortOrder, type, appliesToCardType } of sortCriteria) {
          if (appliesToCardType && a.typeOfCards !== appliesToCardType) continue;
          let aValue = a[key];
          let bValue = b[key];
          if (type === 'number') {
            aValue = Number(aValue) || 0;
            bValue = Number(bValue) || 0;
          } else if (type === 'date') {
            // Use robust conversion for all date types
            aValue = toMillis(aValue);
            bValue = toMillis(bValue);
            // Handle invalid or NaN values
            if (isNaN(aValue)) {
              // Place invalid dates at the end for ascending, start for descending
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
  }, [filteredRows, cardTypeFilters, globalFilters, headers, activeSheetName]);

  const finalRows = useMemo(() => sortedRows, [sortedRows]);

  const isBusinessUser = user && user.uid === businessId;

  const handleSheetClick = useCallback(
    (sheetName) => {
      if (sheetName !== activeSheetName) {
        setActiveSheetName(sheetName);
        onSheetChange(sheetName);
      }
    },
    [activeSheetName, onSheetChange, setActiveSheetName]
  );

  const clearSearch = useCallback(() => setSearchQuery(''), []);

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
      }
    },
    [onRowClick, cards]
  );

  const handleEditorClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsEditorOpen(false);
      setSelectedRow(null);
      setIsClosing(false);
    }, 300);
  }, []);

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

  const handleFolderClick = useCallback(
    (folderName) => {
      onOpenFolderModal(folderName, (sheetName) => {
        setActiveSheetName(sheetName);
        onSheetChange(sheetName);
        window.history.pushState({}, '', `/sheets/${encodeURIComponent(sheetName)}`);
      });
    },
    [onOpenFolderModal, onSheetChange, setActiveSheetName]
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

  const TableContent = (
    <div className={styles.tableContent}>
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
        {isBusinessUser && (
          <button className={styles.editHeaderButton} onClick={onEditSheet}>
            Edit
          </button>
        )}
      </div>
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
            />
            {finalRows.length > 0 ? (
              finalRows.map((rowData, rowIndex) => (
                <RowComponent
                  key={rowData.docId || rowIndex}
                  rowData={rowData}
                  headers={visibleHeaders}
                  onClick={() => handleRowSelect(rowData)}
                  isSelected={selectedRowIds.includes(rowData.docId)}
                  isSelectMode={isSelectMode}
                  onSelect={handleRowSelect}
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
                  item.sheets.includes(activeSheetName) ? styles.activeTab : ''
                } ${isDarkTheme ? styles.darkTheme : ''}`}
                data-folder-name={item.folderName}
                onClick={() => handleFolderClick(item.folderName)}
              >
                <FaFolder className={styles.folderIcon} />
                {item.sheets.includes(activeSheetName)
                  ? `${item.folderName} > ${activeSheetName}`
                  : item.folderName}
              </button>
            </div>
          ) : (
            !folderSheets.includes(item.sheetName) && (
              <div key={`sheet-${item.sheetName}-${index}`} className={styles.sheetContainer}>
                <button
                  className={`${styles.tabButton} ${
                    item.sheetName === activeSheetName ? styles.activeTab : ''
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
              !isClosing ? styles.cardOpen : styles.cardClosed
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
      {!isMobile && (
        <div className={`${styles.cardDetailsContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
          {isEditorOpen ? (
            <CardsEditor
              key={selectedRow?.docId || Date.now()}
              onClose={handleEditorClose}
              onSave={handleEditorSave}
              initialRowData={selectedRow}
              startInEditMode={!!selectedRow}
              preSelectedSheet={activeSheetName}
            />
          ) : (
            <div className={styles.placeholder}>
              <p>Select a row to show its data</p>
            </div>
          )}
        </div>
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
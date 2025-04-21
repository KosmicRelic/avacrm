import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
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

const Sheets = ({
  headers,
  rows,
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
  const { isDarkTheme, setCards, cards } = useContext(MainContext);

  const activeSheet = sheets.allSheets.find((sheet) => sheet.sheetName === activeSheetName);
  const filters = activeSheet?.filters || {};
  const isPrimarySheet = activeSheet?.id === 'primarySheet';

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
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      Object.entries(filters).every(([headerKey, filter]) => {
        const header = headers.find((h) => h.key === headerKey);
        const rowValue = row[headerKey];
        if (!filter || !header) return true;

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
              case 'greater': return numValue > filterNum;
              case 'less': return numValue < filterNum;
              case 'greaterOrEqual': return numValue >= filterNum;
              case 'lessOrEqual': return numValue <= filterNum;
              default: return numValue === filterNum;
            }
          case 'date':
            if (!filter.start && !filter.end && !filter.value) return true;
            const dateValue = new Date(rowValue);
            if (filter.start || filter.end) {
              const startDate = filter.start ? new Date(filter.start) : new Date(-8640000000000000);
              const endDate = filter.end ? new Date(filter.end) : new Date(8640000000000000);
              return dateValue >= startDate && dateValue <= endDate;
            }
            if (!filter.value) return true;
            const filterDate = new Date(filter.value);
            switch (filter.order) {
              case 'before': return dateValue < filterDate;
              case 'after': return dateValue > filterDate;
              default: return dateValue.toDateString() === filterDate.toDateString();
            }
          case 'dropdown':
            if (!filter.values || filter.values.length === 0) return true;
            return filter.values.includes(rowValue);
          case 'text':
            if (!filter.value) return true;
            const strValue = String(rowValue || '').toLowerCase();
            const filterStr = filter.value.toLowerCase();
            switch (filter.condition) {
              case 'contains': return strValue.includes(filterStr);
              case 'startsWith': return strValue.startsWith(filterStr);
              case 'endsWith': return strValue.endsWith(filterStr);
              default: return strValue === filterStr;
            }
          default:
            return true;
        }
      })
    );
  }, [rows, filters, headers]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    const sortCriteria = Object.entries(filters)
      .filter(([_, filter]) => filter.sortOrder)
      .map(([headerKey, filter]) => ({
        key: headerKey,
        sortOrder: filter.sortOrder,
        type: headers.find((h) => h.key === headerKey)?.type || 'text',
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
            aValue = aValue ? new Date(aValue).getTime() : 0;
            bValue = bValue ? new Date(bValue).getTime() : 0;
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
  }, [filteredRows, filters, headers]);

  const finalRows = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return sortedRows.filter((row) =>
      visibleHeaders.some((header) => String(row[header.key] || '').toLowerCase().includes(query))
    );
  }, [sortedRows, searchQuery, visibleHeaders]);

  const handleSheetClick = useCallback((sheetName) => {
    onSheetChange(sheetName);
  }, [onSheetChange]);

  const clearSearch = useCallback(() => setSearchQuery(''), []);

  const handleRowClick = useCallback(
    (rowData) => {
      if (rowData.isAddNew) {
        setIsEditorOpen(true);
        setSelectedRow(null);
      } else {
        const fullCard = cards.find((card) => card.id === rowData.id) || rowData;
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
      const rowId = updatedRow.id;
      const newCardData = { ...updatedRow, id: rowId };

      const activeSheet = sheets.allSheets.find((s) => s.sheetName === updatedRow.sheetName);
      const sheetRows = activeSheet ? activeSheet.rows : [];

      if (!isEditing) {
        setSheets((prev) => ({
          ...prev,
          allSheets: prev.allSheets.map((sheet) =>
            sheet.sheetName === updatedRow.sheetName
              ? { ...sheet, rows: [...sheet.rows, rowId] }
              : sheet
          ),
        }));
        setCards((prev) => [...prev, newCardData]);
      } else {
        setCards((prev) =>
          prev.map((card) => (card.id === rowId ? newCardData : card))
        );
        onCardSave(newCardData);
      }
      setSelectedRow(newCardData);
      setIsEditorOpen(false);
    },
    [rows, setSheets, setCards, onCardSave, sheets.allSheets]
  );

  const handleCardDelete = useCallback(
    (rowData) => {
      onCardDelete(rowData);
      setSelectedRow(null);
      setIsEditorOpen(false);
    },
    [onCardDelete]
  );

  const handleFolderClick = useCallback(
    (folderName) => {
      onOpenFolderModal(folderName);
    },
    [onOpenFolderModal]
  );

  const handleSelectToggle = useCallback(() => {
    setIsSelectMode((prev) => !prev);
    if (isSelectMode) setSelectedRowIds([]);
  }, [isSelectMode]);

  const handleRowSelect = useCallback(
    (rowData) => {
      if (isSelectMode && !rowData.isAddNew) {
        const rowId = rowData.id;
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
      setSelectedRowIds(finalRows.filter((row) => !row.isAddNew).map((row) => row.id));
    }
  }, [finalRows, selectedRowIds]);

  const handleMoveOrCopy = useCallback(
    (action) => {
      if (action === 'move' && isPrimarySheet) {
        alert("Cards cannot be moved from the primary sheet 'All Cards'.");
        return;
      }
      onOpenTransportModal(action, selectedRowIds, () => {
        setIsSelectMode(false);
        setSelectedRowIds([]);
      });
    },
    [selectedRowIds, onOpenTransportModal, isPrimarySheet]
  );

  const handleDeleteSelected = useCallback(() => {
    setCards((prev) => prev.filter((card) => !selectedRowIds.includes(card.id)));
    setSheets((prev) => ({
      ...prev,
      allSheets: prev.allSheets.map((sheet) => ({
        ...sheet,
        rows: sheet.rows.filter((id) => !selectedRowIds.includes(id)),
      })),
    }));
    setSelectedRowIds([]);
    setIsSelectMode(false);
  }, [selectedRowIds, setCards, setSheets]);

  const handleRemoveSelected = useCallback(() => {
    if (isPrimarySheet) {
      alert("Cards cannot be removed from the primary sheet 'All Cards'.");
      return;
    }
    setSheets((prev) => ({
      ...prev,
      allSheets: prev.allSheets.map((sheet) =>
        sheet.sheetName === activeSheetName
          ? { ...sheet, rows: sheet.rows.filter((id) => !selectedRowIds.includes(id)) }
          : sheet
      ),
    }));
    setSelectedRowIds([]);
    setIsSelectMode(false);
  }, [selectedRowIds, activeSheetName, setSheets, isPrimarySheet]);

  const TableContent = (
    <div className={styles.tableContent}>
      <div className={`${styles.controls} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <div className={styles.buttonGroup}>
          {!isSelectMode ? (
            <button
              className={`${styles.filterButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={onFilter}
            >
              <MdFilterAlt size={20} />
            </button>
          ) : (
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
                  {!isPrimarySheet && (
                    <button
                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => handleMoveOrCopy('move')}
                    >
                      Move
                    </button>
                  )}
                  <button
                    className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => handleMoveOrCopy('copy')}
                  >
                    Copy
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
                  {!isPrimarySheet && (
                    <button
                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Are you sure you want to remove the selected cards from this sheet?'
                          )
                        ) {
                          handleRemoveSelected();
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </>
              )}
            </>
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
        <button className={styles.editHeaderButton} onClick={onEditSheet}>
          Edit
        </button>
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
        <div className={`${styles.bodyContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <RowComponent
            rowData={{ id: 'Add New Card', isAddNew: true }}
            headerNames={visibleHeaders.map((h) => h.key)}
            onClick={() => handleRowClick({ isAddNew: true })}
            isSelected={false}
            isSelectMode={isSelectMode}
            onSelect={handleSelectToggle}
            onAddRow={() => handleRowClick({ isAddNew: true })}
          />
          {finalRows.length > 0 ? (
            finalRows.map((rowData, rowIndex) => (
              <RowComponent
                key={rowIndex}
                rowData={rowData}
                headerNames={visibleHeaders.map((h) => h.key)}
                onClick={() => handleRowSelect(rowData)}
                isSelected={selectedRowIds.includes(rowData.id)}
                isSelectMode={isSelectMode}
                onSelect={handleRowSelect}
              />
            ))
          ) : (
            <div className={styles.noResults}>No results found</div>
          )}
        </div>
      </div>
      <div className={`${styles.sheetTabs} ${isDarkTheme ? styles.darkTheme : ''}`} ref={sheetTabsRef}>
        <button
          className={`${styles.orderButton} ${isDarkTheme ? styles.darkTheme : ''}`}
          onClick={onOpenSheetsModal}
        >
          <CgArrowsExchangeAlt />
        </button>
        <button
          className={`${styles.addTabButton} ${isDarkTheme ? styles.darkTheme : ''}`}
          onClick={onOpenSheetFolderModal}
        >
          +
        </button>
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
              key={selectedRow?.id || Date.now()}
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
              key={selectedRow?.id || Date.now()}
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
  rows: PropTypes.array.isRequired,
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
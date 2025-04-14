import { useContext, useState, useCallback, useRef, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import styles from "./Sheets.module.css";
import RowComponent from "./Row Template/RowComponent";
import CardsEditor from "./Cards Editor/CardsEditor";
import { IoCloseCircle } from "react-icons/io5";
import { FaFolder } from "react-icons/fa";
import { MdFilterAlt } from "react-icons/md";
import { CgArrowsExchangeAlt } from "react-icons/cg";
import { MainContext } from "../Contexts/MainContext";

const SheetTemplate = ({
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
}) => {
  const { isDarkTheme, setCards, cards } = useContext(MainContext);

  // Retrieve filters and sheet ID from active sheet
  const activeSheet = sheets.allSheets.find((sheet) => sheet.sheetName === activeSheetName);
  const filters = activeSheet?.filters || {};
  const isPrimarySheet = activeSheet?.id === "primarySheet";

  const scrollContainerRef = useRef(null);
  const sheetTabsRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [openFolder, setOpenFolder] = useState(null);
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
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutsideFolder = (event) => {
      if (openFolder && !event.target.closest(`.${styles.tabButton}`)) {
        setOpenFolder(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutsideFolder);
    document.addEventListener("touchstart", handleClickOutsideFolder);
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideFolder);
      document.removeEventListener("touchstart", handleClickOutsideFolder);
    };
  }, [openFolder]);

  useEffect(() => {
    if (sheetTabsRef.current) {
      sheetTabsRef.current.scrollWidth;
      sheetTabsRef.current.style.width = "auto";
    }
  }, [openFolder]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      Object.entries(filters).every(([headerKey, filter]) => {
        const header = headers.find((h) => h.key === headerKey);
        const rowValue = row[headerKey];
        if (!filter || !header) return true;

        switch (header.type) {
          case "number":
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
              case "greater": return numValue > filterNum;
              case "less": return numValue < filterNum;
              case "greaterOrEqual": return numValue >= filterNum;
              case "lessOrEqual": return numValue <= filterNum;
              default: return numValue === filterNum;
            }
          case "date":
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
              case "before": return dateValue < filterDate;
              case "after": return dateValue > filterDate;
              default: return dateValue.toDateString() === filterDate.toDateString();
            }
          case "dropdown":
            if (!filter.values || filter.values.length === 0) return true;
            return filter.values.includes(rowValue);
          case "text":
            if (!filter.value) return true;
            const strValue = String(rowValue || "").toLowerCase();
            const filterStr = filter.value.toLowerCase();
            switch (filter.condition) {
              case "contains": return strValue.includes(filterStr);
              case "startsWith": return strValue.startsWith(filterStr);
              case "endsWith": return strValue.endsWith(filterStr);
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
        type: headers.find((h) => h.key === headerKey)?.type || "text",
      }));

    if (sortCriteria.length > 0) {
      sorted.sort((a, b) => {
        for (const { key, sortOrder, type } of sortCriteria) {
          let aValue = a[key];
          let bValue = b[key];
          if (type === "number") {
            aValue = Number(aValue) || 0;
            bValue = Number(bValue) || 0;
          } else if (type === "date") {
            aValue = aValue ? new Date(aValue).getTime() : 0;
            bValue = bValue ? new Date(bValue).getTime() : 0;
          } else {
            aValue = String(aValue || "").toLowerCase();
            bValue = String(bValue || "").toLowerCase();
          }
          if (aValue < bValue) return sortOrder === "ascending" ? -1 : 1;
          if (aValue > bValue) return sortOrder === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sorted;
  }, [filteredRows, filters, headers]);

  const finalRows = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return sortedRows.filter((row) =>
      visibleHeaders.some((header) => String(row[header.key] || "").toLowerCase().includes(query))
    );
  }, [sortedRows, searchQuery, visibleHeaders]);

  const handleSheetClick = useCallback((sheetName) => {
    onSheetChange(sheetName);
    setOpenFolder(null);
  }, [onSheetChange]);

  const clearSearch = useCallback(() => setSearchQuery(""), []);

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

      // Double-check the active sheet's rows directly from sheets
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

  const toggleFolder = useCallback((folderName) => {
    setOpenFolder((prev) => (prev === folderName ? null : folderName));
  }, []);

  const handleSelectToggle = useCallback(() => {
    setIsSelectMode((prev) => !prev);
    if (isSelectMode) setSelectedRowIds([]);
  }, [isSelectMode]);

  const handleRowSelect = useCallback(
    (rowData) => {
      if (isSelectMode) {
        const rowId = rowData.id || rowData;
        setSelectedRowIds((prev) =>
          prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
        );
      } else {
        handleRowClick(rowData);
      }
    },
    [isSelectMode, handleRowClick]
  );

  const handleMoveOrCopy = useCallback(
    (action) => {
      if (action === "move" && isPrimarySheet) {
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
      <div className={`${styles.controls} ${isDarkTheme ? styles.darkTheme : ""}`}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className={`${styles.searchBar} ${isDarkTheme ? styles.darkTheme : ""}`}
          />
          {searchQuery && (
            <button className={styles.clearButton} onClick={clearSearch}>
              <IoCloseCircle size={18} />
            </button>
          )}
        </div>
        <div className={styles.buttonGroup}>
          {!isSelectMode ? (
            <>
              <button
                className={`${styles.filterButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={onFilter}
              >
                <MdFilterAlt size={20} />
              </button>
              <button
                className={`${styles.selectButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={handleSelectToggle}
              >
                Select
              </button>
            </>
          ) : (
            <>
              <button
                className={`${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={handleSelectToggle}
              >
                Cancel
              </button>
              {selectedRowIds.length > 0 && (
                <>
                  {!isPrimarySheet && (
                    <button
                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => handleMoveOrCopy("move")}
                    >
                      Move
                    </button>
                  )}
                  <button
                    className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    onClick={() => handleMoveOrCopy("copy")}
                  >
                    Copy
                  </button>
                  <button
                    className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete the selected cards? This action cannot be undone.")) {
                        handleDeleteSelected();
                      }
                    }}
                  >
                    Delete
                  </button>
                  {!isPrimarySheet && (
                    <button
                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => {
                        if (window.confirm("Are you sure you want to remove the selected cards from this sheet?")) {
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
      </div>
      <div className={`${styles.tableWrapper} ${isDarkTheme ? styles.darkTheme : ""}`} ref={scrollContainerRef}>
        <div className={`${styles.header} ${isDarkTheme ? styles.darkTheme : ""}`}>
          {visibleHeaders.map((header) => (
            <div key={header.key} className={styles.headerCell}>
              {header.name}
            </div>
          ))}
        </div>
        <div className={`${styles.bodyContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
          <RowComponent
            rowData={{ id: "Add New Card", isAddNew: true }}
            headerNames={visibleHeaders.map((h) => h.key)}
            onClick={() => handleRowClick({ isAddNew: true })}
            isSelected={false}
          />
          {finalRows.length > 0 ? (
            finalRows.map((rowData, rowIndex) => (
              <RowComponent
                key={rowIndex}
                rowData={rowData}
                headerNames={visibleHeaders.map((h) => h.key)}
                onClick={() => handleRowSelect(rowData)}
                isSelected={selectedRowIds.includes(rowData.id || rowData)}
              />
            ))
          ) : (
            <div className={styles.noResults}>No results found</div>
          )}
        </div>
      </div>
      <div className={`${styles.sheetTabs} ${isDarkTheme ? styles.darkTheme : ""}`} ref={sheetTabsRef}>
        <button className={styles.editHeaderButton} onClick={onEditSheet}>
          Edit
        </button>
        <button
          className={`${styles.orderButton} ${isDarkTheme ? styles.darkTheme : ""}`}
          onClick={onOpenSheetsModal}
        >
          <CgArrowsExchangeAlt />
        </button>
        {sheets.structure.map((item, index) =>
          item.folderName ? (
            <div key={`folder-${item.folderName}-${index}`} className={styles.folderContainer}>
              <button
                className={`${styles.tabButton} ${
                  openFolder === item.folderName ? styles.activeFolder : ""
                } ${isDarkTheme ? styles.darkTheme : ""}`}
                data-folder-name={item.folderName}
                onClick={() => toggleFolder(item.folderName)}
              >
                <FaFolder className={styles.folderIcon} />
                {item.folderName}
                {openFolder === item.folderName && (
                  <span className={styles.folderSheets}>
                    {" > "}
                    {item.sheets.map((sheetName, idx) => (
                      <span key={`inline-sheet-${sheetName}-${idx}`}>
                        <span
                          className={`${styles.inlineSheet} ${
                            sheetName === activeSheetName ? styles.activeInlineSheet : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSheetClick(sheetName);
                          }}
                        >
                          {sheetName}
                        </span>
                        {idx < item.sheets.length - 1 && " | "}
                      </span>
                    ))}
                  </span>
                )}
                {openFolder !== item.folderName && item.sheets.includes(activeSheetName) && (
                  <span className={styles.folderPath}> {` > ${activeSheetName}`}</span>
                )}
              </button>
            </div>
          ) : (
            !folderSheets.includes(item.sheetName) && (
              <div key={`sheet-${item.sheetName}-${index}`} className={styles.sheetContainer}>
                <button
                  className={`${styles.tabButton} ${
                    item.sheetName === activeSheetName ? styles.activeTab : ""
                  } ${isDarkTheme ? styles.darkTheme : ""}`}
                  data-sheet-name={item.sheetName}
                  onClick={() => handleSheetClick(item.sheetName)}
                >
                  {item.sheetName}
                </button>
              </div>
            )
          )
        )}
        <button
          className={`${styles.addTabButton} ${isDarkTheme ? styles.darkTheme : ""}`}
          onClick={onOpenSheetFolderModal}
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className={`${styles.sheetWrapper} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={`${styles.tableContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
        {TableContent}
        {isMobile && isEditorOpen && (
          <div
            className={`${styles.cardDetailsMobile} ${!isClosing ? styles.cardOpen : styles.cardClosed}`}
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
        <div className={`${styles.cardDetailsContainer} ${isDarkTheme ? styles.darkTheme : ""}`}>
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

SheetTemplate.propTypes = {
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
};

export default SheetTemplate;
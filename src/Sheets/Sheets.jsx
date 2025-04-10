import { useContext, useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  filters = {},
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
}) => {
  const { isDarkTheme, setCards, cards } = useContext(MainContext);
  const scrollContainerRef = useRef(null);
  const modalRef = useRef(null);
  const sheetTabsRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [openFolder, setOpenFolder] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [addType, setAddType] = useState(null);
  const [newSheetName, setNewSheetName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [selectedHeaders, setSelectedHeaders] = useState([]);
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
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target) && isAddModalOpen) {
        setIsAddModalOpen(false);
        setAddType(null);
        setNewSheetName("");
        setNewFolderName("");
        setSelectedSheets([]);
        setSelectedHeaders([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAddModalOpen]);

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
    for (const [headerKey, filter] of Object.entries(filters)) {
      const header = headers.find((h) => h.key === headerKey);
      if (header && filter.sortOrder && header.type === "number") {
        sorted.sort((a, b) => {
          const aValue = Number(a[headerKey] || 0);
          const bValue = Number(b[headerKey] || 0);
          return filter.sortOrder === "ascending" ? aValue - bValue : bValue - aValue;
        });
      }
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
      console.log("handleEditorSave - updatedRow:", updatedRow, "isEditing:", isEditing, "rows:", rows);
  
      // Double-check the active sheet's rows directly from sheets
      const activeSheet = sheets.allSheets.find((s) => s.sheetName === updatedRow.sheetName);
      const sheetRows = activeSheet ? activeSheet.rows : [];
      console.log("Active sheet rows:", sheetRows);
  
      if (!isEditing) {
        console.log("Creating new card with ID:", rowId);
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
        console.log("Updating card with ID:", rowId);
        setCards((prev) =>
          prev.map((card) => (card.id === rowId ? newCardData : card))
        );
        onCardSave(newCardData); // Notify parent of update
      }
      setSelectedRow(newCardData);
      setIsEditorOpen(false);
    },
    [rows, setSheets, setCards, onCardSave, sheets.allSheets] // Added sheets.allSheets to dependencies
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

  const handleAddModalOpen = useCallback(() => {
    setIsAddModalOpen(true);
    setAddType(null);
    setNewSheetName("");
    setNewFolderName("");
    setSelectedSheets([]);
    setSelectedHeaders([]);
  }, []);

  const handleAddTypeChange = useCallback((type) => {
    setAddType(type);
    setNewSheetName("");
    setNewFolderName("");
    setSelectedSheets([]);
    setSelectedHeaders([]);
  }, []);

  const handleSheetSave = useCallback(() => {
    if (!newSheetName) {
      alert("Please provide a sheet name.");
      return;
    }
    setSheets((prevSheets) => {
      const newSheet = {
        sheetName: newSheetName,
        headers: selectedHeaders.map((key) => ({ key, visible: true, hidden: false })),
        pinnedHeaders: [],
        rows: [],
        isActive: true,
      };
      return {
        ...prevSheets,
        allSheets: prevSheets.allSheets
          .map((sheet) => ({
            ...sheet,
            isActive: false,
          }))
          .concat(newSheet),
        structure: [...prevSheets.structure, { sheetName: newSheetName }],
      };
    });
    setIsAddModalOpen(false);
    onSheetChange(newSheetName);
  }, [newSheetName, selectedHeaders, setSheets, onSheetChange]);

  const handleFolderSave = useCallback(() => {
    if (!newFolderName) {
      alert("Please provide a folder name.");
      return;
    }
    setSheets((prevSheets) => ({
      ...prevSheets,
      structure: [
        ...prevSheets.structure,
        {
          folderName: newFolderName,
          sheets: selectedSheets,
        },
      ],
    }));
    setNewFolderName("");
    setSelectedSheets([]);
    setIsAddModalOpen(false);
  }, [newFolderName, selectedSheets, setSheets]);

  const toggleSheetSelection = useCallback((sheetName) => {
    setSelectedSheets((prev) =>
      prev.includes(sheetName) ? prev.filter((s) => s !== sheetName) : [...prev, sheetName]
    );
  }, []);

  const toggleHeaderSelection = useCallback((headerKey) => {
    setSelectedHeaders((prev) =>
      prev.includes(headerKey) ? prev.filter((h) => h !== headerKey) : [...prev, headerKey]
    );
  }, []);

  const availableHeaders = useMemo(() => {
    return headers.map((h, index) => ({
      key: h.key || `header-${index}`,
      name: h.name || Object.values(h)[0],
    }));
  }, [headers]);

  const handleSelectToggle = useCallback(() => {
    setIsSelectMode((prev) => !prev);
    if (isSelectMode) setSelectedRowIds([]);
  }, [isSelectMode]);

  const handleRowSelect = useCallback(
    (rowData) => {
      if (isSelectMode) {
        const rowId = rowData.id || rowData; // Handle both ID and full object
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
      onOpenTransportModal(action, selectedRowIds, () => {
        setIsSelectMode(false);
        setSelectedRowIds([]);
      });
    },
    [selectedRowIds, onOpenTransportModal]
  );

  const TableContent = (
    <div className={styles.tableContent}>
      <div className={`${styles.controls} ${isDarkTheme ? styles.darkTheme : ""}`}>
        {!isSelectMode ? (
          <>
            <button
              className={`${styles.selectButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              onClick={handleSelectToggle}
            >
              Select
            </button>
            <button
              className={`${styles.filterButton} ${isDarkTheme ? styles.darkTheme : ""}`}
              onClick={onFilter}
            >
              <MdFilterAlt size={20} />
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
                <button
                  className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={() => handleMoveOrCopy("move")}
                >
                  Move
                </button>
                <button
                  className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                  onClick={() => handleMoveOrCopy("copy")}
                >
                  Copy
                </button>
              </>
            )}
          </>
        )}
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
        <button className={styles.editHeaderButton} onClick={onEditSheet}>
          Edit
        </button>
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
        <button
          className={`${styles.orderButton} ${isDarkTheme ? styles.darkTheme : ""}`}
          onClick={onOpenSheetsModal}
        >
          <CgArrowsExchangeAlt />
        </button>
        {sheets.structure.map((item, index) =>
          item.folderName ? (
            <div key={item.folderName} className={styles.folderContainer}>
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
                      <span key={sheetName}>
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
              <div key={item.sheetName} className={styles.sheetContainer}>
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
          onClick={handleAddModalOpen}
        >
          +
        </button>
      </div>
      {isAddModalOpen && (
        <div className={`${styles.addModal} ${isDarkTheme ? styles.darkTheme : ""}`} ref={modalRef}>
          <div className={`${styles.addTypeToggle} ${isDarkTheme ? styles.darkTheme : ""}`}>
            <button
              className={`${styles.typeButton} ${addType === "sheet" ? styles.activeType : ""}`}
              onClick={() => handleAddTypeChange("sheet")}
            >
              Sheet
            </button>
            <button
              className={`${styles.typeButton} ${addType === "folder" ? styles.activeType : ""}`}
              onClick={() => handleAddTypeChange("folder")}
            >
              Folder
            </button>
          </div>
          {addType === "sheet" && (
            <div className={styles.addForm}>
              <input
                type="text"
                value={newSheetName}
                onChange={(e) => setNewSheetName(e.target.value)}
                placeholder="Sheet Name"
                className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
              />
              <div className={styles.selectionList}>
                {availableHeaders.map((header) => (
                  <label key={header.key} className={styles.selectionItem}>
                    <input
                      type="checkbox"
                      checked={selectedHeaders.includes(header.key)}
                      onChange={() => toggleHeaderSelection(header.key)}
                    />
                    {header.name}
                  </label>
                ))}
              </div>
              <div className={styles.modalButtons}>
                <button onClick={handleSheetSave}>Save</button>
                <button onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              </div>
            </div>
          )}
          {addType === "folder" && (
            <div className={styles.addForm}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder Name"
                className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ""}`}
              />
              <div className={styles.selectionList}>
                {sheets.allSheets.map((sheet) => (
                  <label key={sheet.sheetName} className={styles.selectionItem}>
                    <input
                      type="checkbox"
                      checked={selectedSheets.includes(sheet.sheetName)}
                      onChange={() => toggleSheetSelection(sheet.sheetName)}
                    />
                    {sheet.sheetName}
                  </label>
                ))}
              </div>
              <div className={styles.modalButtons}>
                <button onClick={handleFolderSave}>Save</button>
                <button onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
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

export default SheetTemplate;
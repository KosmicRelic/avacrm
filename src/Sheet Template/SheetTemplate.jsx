import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import styles from "./SheetTemplate.module.css";
import RowComponent from "./Row Template/RowComponent";
import CardDetails from "./CardDetails/CardDetails";
import { CiFilter } from "react-icons/ci";
import { IoCloseCircle } from "react-icons/io5";

const SheetTemplate = ({
  headers,
  rows,
  filters = {},
  sheets,
  activeSheetName,
  onSheetChange,
  onEditSheet,
  onFilter,
  onRowClick,
  onCardSave,
  onCardDelete,
}) => {
  const scrollContainerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const visibleHeaders = useMemo(() => headers.filter((header) => header.visible), [headers]);
  const isMobile = windowWidth <= 1024;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    if (sheetName === "add-new-sheet") {
      onSheetChange("add-new-sheet");
    } else {
      onSheetChange(sheetName);
    }
  }, [onSheetChange]);

  const clearSearch = useCallback(() => setSearchQuery(""), []);

  const handleRowClick = useCallback((rowData) => {
    setSelectedRow(rowData);
    setIsClosing(false);
    onRowClick(rowData);
  }, [onRowClick]);

  const handleCardClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedRow(null);
      setIsClosing(false);
    }, 300);
  }, []);

  const handleCardSave = useCallback((updatedRow) => {
    onCardSave(updatedRow);
    setSelectedRow(updatedRow);
  }, [onCardSave]);

  const handleCardDelete = useCallback((rowData) => {
    onCardDelete(rowData);
    setSelectedRow(null);
  }, [onCardDelete]);

  const handleAddNewCard = useCallback(() => {
    const newId = `${Date.now()}`;
    let newCard;
    switch (activeSheetName) {
      case "Leads":
        newCard = { leadId: newId, name: "", phone: "", email: "", leadScore: "", nextActions: "", followUpDate: "" };
        break;
      case "Business Partners":
        newCard = { businessId: newId, fullName: "", address: "", status: "" };
        break;
      case "Tasks":
        newCard = { taskId: newId, description: "", dueDate: "", priority: "" };
        break;
      default:
        newCard = { [visibleHeaders[0].key]: newId };
    }
    onCardSave(newCard);
    setSelectedRow(newCard);
  }, [activeSheetName, visibleHeaders, onCardSave]);

  const TableContent = (
    <div className={styles.tableContent}>
      <div className={styles.controls}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className={styles.searchBar}
          />
          {searchQuery && (
            <button className={styles.clearButton} onClick={clearSearch}>
              <IoCloseCircle size={18} />
            </button>
          )}
        </div>
        <button className={styles.filterButton} onClick={onFilter}>
          <CiFilter size={20} />
        </button>
        <button className={styles.editHeaderButton} onClick={onEditSheet}>
          Edit
        </button>
      </div>
      <div className={styles.tableWrapper} ref={scrollContainerRef}>
        <div className={styles.header}>
          {visibleHeaders.map((header) => (
            <div key={header.key} className={styles.headerCell}>
              {header.name}
            </div>
          ))}
        </div>
        <div className={styles.bodyContainer}>
          <RowComponent
            rowData={{ [visibleHeaders[0].key]: "Add New Card", isAddNew: true }}
            headerNames={visibleHeaders.map((h) => h.key)}
            onClick={handleAddNewCard}
          />
          {finalRows.length > 0 ? (
            finalRows.map((rowData, rowIndex) => (
              <RowComponent
                key={rowIndex}
                rowData={rowData}
                headerNames={visibleHeaders.map((h) => h.key)}
                onClick={() => handleRowClick(rowData)}
              />
            ))
          ) : (
            <div className={styles.noResults}>No results found</div>
          )}
        </div>
      </div>
      <div className={styles.sheetTabs}>
        {sheets.map((sheet) => (
          <button
            key={sheet.sheetName}
            className={`${styles.tabButton} ${
              sheet.sheetName === activeSheetName ? styles.activeTab : ""
            }`}
            onClick={() => handleSheetClick(sheet.sheetName)}
          >
            {sheet.sheetName}
          </button>
        ))}
        <button className={styles.addTabButton} onClick={() => handleSheetClick("add-new-sheet")}>
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.sheetWrapper}>
      <div className={styles.tableContainer}>
        {TableContent}
        {isMobile && selectedRow && (
          <div className={`${styles.cardDetailsMobile} ${!isClosing ? styles.cardOpen : styles.cardClosed}`}>
            <CardDetails
              key={selectedRow.leadId || selectedRow.businessId || selectedRow.taskId || Date.now()}
              rowData={selectedRow}
              headers={visibleHeaders}
              onClose={handleCardClose}
              onSave={handleCardSave}
              onDelete={handleCardDelete}
            />
          </div>
        )}
      </div>
      {!isMobile && (
        <div className={styles.cardDetailsContainer}>
          {selectedRow ? (
            <CardDetails
              key={selectedRow.leadId || selectedRow.businessId || selectedRow.taskId || Date.now()}
              rowData={selectedRow}
              headers={visibleHeaders}
              onClose={handleCardClose}
              onSave={handleCardSave}
              onDelete={handleCardDelete}
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
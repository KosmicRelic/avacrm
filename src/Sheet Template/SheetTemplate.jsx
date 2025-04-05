import { useRef, useState, useEffect } from "react";
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
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const visibleHeaders = headers.filter((header) => header.visible);

  const filteredRows = rows.filter((row) => {
    const matchesSearch = searchQuery
      ? headers.some((header) =>
          String(row[header.key] || "").toLowerCase().includes(searchQuery.toLowerCase())
        )
      : true;

    const matchesFilters = Object.entries(filters).every(([headerKey, filter]) => {
      if (!filter || Object.keys(filter).length === 0) return true;
      const rowValue = row[headerKey];
      const header = headers.find((h) => h.key === headerKey);
      const type = header ? header.type : "text";

      switch (type) {
        case "number":
          if (!filter.value) return true;
          const numValue = Number(rowValue);
          const filterNum = Number(filter.value);
          switch (filter.order) {
            case "greater":
              return numValue > filterNum;
            case "less":
              return numValue < filterNum;
            case "greaterOrEqual":
              return numValue >= filterNum;
            case "lessOrEqual":
              return numValue <= filterNum;
            default:
              return numValue === filterNum;
          }
        case "date":
          if (!filter.start && !filter.end && !filter.value) return true;
          const rowDate = new Date(rowValue);
          if (filter.start || filter.end) {
            const startDate = filter.start ? new Date(filter.start) : null;
            const endDate = filter.end ? new Date(filter.end) : null;
            if (startDate && endDate) {
              return rowDate >= startDate && rowDate <= endDate;
            }
            if (startDate) return rowDate >= startDate;
            if (endDate) return rowDate <= endDate;
            return true;
          }
          const filterDate = new Date(filter.value);
          switch (filter.order) {
            case "before":
              return rowDate < filterDate;
            case "after":
              return rowDate > filterDate;
            default:
              return rowDate.toDateString() === filterDate.toDateString();
          }
        case "dropdown":
          if (!filter.values || filter.values.length === 0) return true;
          return filter.values.includes(String(rowValue));
        default:
          if (!filter.value) return true;
          return String(rowValue || "").toLowerCase().includes(filter.value.toLowerCase());
      }
    });

    return matchesSearch && matchesFilters;
  });

  const handleSheetClick = (sheetName) => {
    if (sheetName === "add-new-sheet") {
      onSheetChange("add-new-sheet");
    } else {
      onSheetChange(sheetName);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const handleRowClick = (rowData) => {
    setSelectedRow(rowData);
    setIsCardOpen(true);
    onRowClick(rowData);
  };

  const handleCardClose = () => {
    setIsCardOpen(false);
    setTimeout(() => setSelectedRow(null), 300);
  };

  const handleCardSave = (updatedRow) => {
    onCardSave(updatedRow);
    setSelectedRow(updatedRow);
  };

  const handleCardDelete = (rowData) => {
    onCardDelete(rowData);
    handleCardClose();
  };

  const handleAddNewCard = () => {
    const newId = `${Date.now()}`;
    let newCard;
    switch (activeSheetName) {
      case "Leads":
        newCard = {
          leadId: newId,
          name: "",
          phone: "",
          email: "",
          leadScore: "",
          nextActions: "",
          followUpDate: "",
        };
        break;
      case "Business Partners":
        newCard = {
          businessId: newId,
          fullName: "",
          address: "",
          status: "",
        };
        break;
      case "Tasks":
        newCard = {
          taskId: newId,
          description: "",
          dueDate: "",
          priority: "",
        };
        break;
      default:
        newCard = { [visibleHeaders[0].key]: newId };
    }
    onCardSave(newCard);
    setSelectedRow(newCard);
    setIsCardOpen(true);
  };

  useEffect(() => {
    setTimeout(() => setIsInitialLoad(false), 0);
  }, []);

  const addNewCardRow = {
    [visibleHeaders[0].key]: "Add New Card",
    isAddNew: true,
  };

  const TableContent = (
    <div className={`${styles.tableContent} ${isInitialLoad ? styles.tableInitial : ""}`}>
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
            rowData={addNewCardRow}
            headerNames={visibleHeaders.map((h) => h.key)}
            onClick={handleAddNewCard}
          />
          {filteredRows.length > 0 ? (
            filteredRows.map((rowData, rowIndex) => (
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
        <button
          className={styles.addTabButton}
          onClick={() => handleSheetClick("add-new-sheet")}
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.sheetWrapper}>
      <div className={styles.tableContainer}>
        {window.innerWidth <= 1024 && selectedRow ? (
          <div className={`${styles.cardDetailsMobile} ${isCardOpen ? styles.cardOpen : styles.cardClosed}`}>
            <CardDetails
              rowData={selectedRow}
              headers={visibleHeaders}
              onClose={handleCardClose}
              onSave={handleCardSave}
              onDelete={handleCardDelete}
            />
          </div>
        ) : (
          TableContent
        )}
      </div>
      <div className={styles.cardDetailsContainer}>
        {selectedRow ? (
          <CardDetails
            rowData={selectedRow}
            headers={visibleHeaders}
            onClose={() => setSelectedRow(null)}
            onSave={handleCardSave}
            onDelete={handleCardDelete}
          />
        ) : (
          <div className={styles.placeholder}>
            <p>Select a row to show its data</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SheetTemplate;
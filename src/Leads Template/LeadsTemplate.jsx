import { useRef, useState } from "react";
import styles from "./LeadsTemplate.module.css";
import RowComponent from "./Row Template/RowComponent";

const LeadsTemplate = ({ headers, rows, filters = {}, onEditSheet }) => {
  const scrollContainerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");

  const visibleHeaders = headers.filter((header) => header.visible);

  const filteredRows = rows.filter((row) => {
    const matchesSearch = searchQuery
      ? headers.some((header) =>
          String(row[header.name] || "").toLowerCase().includes(searchQuery.toLowerCase())
        )
      : true;

    const matchesFilters = Object.entries(filters).every(([headerName, value]) => {
      if (!value) return true;
      const rowValue = String(row[headerName] || "").toLowerCase();
      const filterValue = String(value).toLowerCase();
      const header = headers.find((h) => h.name === headerName);
      const type = header ? header.type : "text";

      switch (type) {
        case "number":
          return Number(rowValue) === Number(filterValue);
        case "date":
          return rowValue === filterValue;
        case "dropdown":
          return rowValue === filterValue;
        default:
          return rowValue.includes(filterValue);
      }
    });

    return matchesSearch && matchesFilters;
  });

  return (
    <div className={styles.tableContainer}>
      <div className={styles.controls}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Find a row..."
          className={styles.searchBar}
        />
        <button className={styles.addHeader} onClick={onEditSheet}>
          Edit
        </button>
      </div>
      <div className={styles.tableWrapper} ref={scrollContainerRef}>
        <div className={styles.header}>
          {visibleHeaders.map((header) => (
            <div key={header.name} className={styles.headerCell}>
              {header.name}
            </div>
          ))}
        </div>
        <div className={styles.bodyContainer}>
          {filteredRows.map((rowData, rowIndex) => (
            <RowComponent key={rowIndex} rowData={rowData} headerNames={visibleHeaders.map((h) => h.name)} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeadsTemplate;
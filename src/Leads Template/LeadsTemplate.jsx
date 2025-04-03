import { useRef, useState } from "react";
import styles from "./LeadsTemplate.module.css";
import RowComponent from "./Row Template/RowComponent";

const LeadsTemplate = ({ headerNames, rows, onEditSheet }) => {
  const scrollContainerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter rows based on search query
  const filteredRows = rows.filter((row) =>
    headerNames.some((header) =>
      String(row[header] || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    )
  );

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
          {headerNames.map((col) => (
            <div key={col} className={styles.headerCell}>
              {col}
            </div>
          ))}
        </div>
        <div className={styles.bodyContainer}>
          {filteredRows.map((rowData, rowIndex) => (
            <RowComponent key={rowIndex} rowData={rowData} headerNames={headerNames} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeadsTemplate;
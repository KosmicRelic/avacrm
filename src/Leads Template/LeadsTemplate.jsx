import { useRef, useState } from "react";
import styles from "./LeadsTemplate.module.css";
import RowComponent from "../Row Template/RowComponent";

const LeadsTemplate = () => {
  const scrollContainerRef = useRef(null);
  const headerRef = useRef(null);

  const [headerNames, setHeaderNames] = useState(["Name", "Email", "Phone", "Status", "Actions"]);
  const [rows, setRows] = useState(
    [...Array(40)].map(() => ["John Doe", "john@example.com", "123-456-7890", "Active", "Edit"])
  );

  const handleScroll = () => {
    if (headerRef.current && scrollContainerRef.current) {
      headerRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
    }
  };

  return (
    <div className={styles.tableContainer}>
      {/* Sticky Header */}
      <div ref={headerRef} className={styles.header}>
        <div className={styles.headerRow}>
          {headerNames.map((col) => (
            <div key={col} className={styles.headerCell}>{col}</div>
          ))}
        </div>
      </div>
      {/* Scrollable Content */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className={styles.bodyContainer}>
        <div className={styles.bodyContent}>
          {rows.map((rowData, rowIndex) => (
            <RowComponent key={rowIndex} rowData={rowData} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeadsTemplate;

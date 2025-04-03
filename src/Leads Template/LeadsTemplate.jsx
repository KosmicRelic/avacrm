import { useRef } from "react";
import styles from "./LeadsTemplate.module.css";
import RowComponent from "./Row Template/RowComponent";

const LeadsTemplate = ({ headerNames, rows }) => {
  const scrollContainerRef = useRef(null);

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableWrapper} ref={scrollContainerRef}>
        <div className={styles.header}>
          {headerNames.map((col) => (
            <div key={col} className={styles.headerCell}>
              {col}
            </div>
          ))}
        </div>
        <div className={styles.bodyContainer}>
          {rows.map((rowData, rowIndex) => (
            <RowComponent key={rowIndex} rowData={rowData} headerNames={headerNames} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeadsTemplate;
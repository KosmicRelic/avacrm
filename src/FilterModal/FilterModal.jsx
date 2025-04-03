import { useState } from "react";
import styles from "./FilterModal.module.css";

const FilterModal = ({ headers, rows, onApply, onClose }) => {
  const [filterValues, setFilterValues] = useState({});

  const visibleHeaders = headers.filter((header) => !header.hidden);

  const uniqueDropdownOptions = (headerName) => {
    return [...new Set(rows.map((row) => row[headerName] || ""))].filter(Boolean);
  };

  const handleFilterChange = (headerName, value) => {
    setFilterValues((prev) => ({ ...prev, [headerName]: value }));
  };

  const handleApply = () => {
    onApply(filterValues, headers);
    onClose();
  };

  const handleReset = () => {
    setFilterValues({});
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.filterTitle}>Filter Rows</h2>
        <div className={styles.filterList}>
          {visibleHeaders.map((header) => (
            <div key={header.name} className={styles.filterItem}>
              <label>{header.name}</label>
              {header.type === "number" ? (
                <input
                  type="number"
                  value={filterValues[header.name] || ""}
                  onChange={(e) => handleFilterChange(header.name, e.target.value)}
                  placeholder={`Filter ${header.name}`}
                />
              ) : header.type === "date" ? (
                <input
                  type="date"
                  value={filterValues[header.name] || ""}
                  onChange={(e) => handleFilterChange(header.name, e.target.value)}
                />
              ) : header.type === "dropdown" ? (
                <select
                  value={filterValues[header.name] || ""}
                  onChange={(e) => handleFilterChange(header.name, e.target.value)}
                >
                  <option value="">All</option>
                  {uniqueDropdownOptions(header.name).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={filterValues[header.name] || ""}
                  onChange={(e) => handleFilterChange(header.name, e.target.value)}
                  placeholder={`Filter ${header.name}`}
                />
              )}
            </div>
          ))}
        </div>
        <div className={styles.modalActions}>
          <button onClick={handleApply}>Apply</button>
          <button onClick={handleReset} className={styles.resetButton}>Reset</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;
import { useState } from "react";
import styles from "./FilterModal.module.css";

const FilterModal = ({ headers, rows, onApply, onClose }) => {
    const [filterValues, setFilterValues] = useState({});

    const visibleHeaders = headers.filter((header) => !header.hidden);

    const uniqueDropdownOptions = (headerKey) => {
        return [...new Set(rows.map((row) => row[headerKey] || ""))].filter(Boolean);
    };

    const handleFilterChange = (headerKey, value) => {
        setFilterValues((prev) => ({ ...prev, [headerKey]: value }));
    };

    const handleApply = () => {
        onApply(filterValues);
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
                        <div key={header.key} className={styles.filterItem}>
                            <label>{header.name}</label>
                            {header.type === "number" ? (
                                <input
                                    type="number"
                                    value={filterValues[header.key] || ""}
                                    onChange={(e) => handleFilterChange(header.key, e.target.value)}
                                    placeholder={`Filter ${header.name}`}
                                />
                            ) : header.type === "date" ? (
                                <input
                                    type="date"
                                    value={filterValues[header.key] || ""}
                                    onChange={(e) => handleFilterChange(header.key, e.target.value)}
                                />
                            ) : header.type === "dropdown" ? (
                                <select
                                    value={filterValues[header.key] || ""}
                                    onChange={(e) => handleFilterChange(header.key, e.target.value)}
                                >
                                    <option value="">All</option>
                                    {uniqueDropdownOptions(header.key).map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={filterValues[header.key] || ""}
                                    onChange={(e) => handleFilterChange(header.key, e.target.value)}
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
import { useState, useContext, useRef } from "react";
import styles from "./FilterModal.module.css";
import { MainContext } from "../Contexts/MainContext";

const FilterModal = ({ headers, rows, onApply, onClose }) => {
    const { headers: allHeaders } = useContext(MainContext);
    const [filterValues, setFilterValues] = useState({});
    const [dateRangeMode, setDateRangeMode] = useState({});
    const dropdownRefs = useRef({}); // Refs for each dropdown

    const visibleHeaders = headers.filter((header) => !header.hidden);

    const getDropdownOptions = (headerKey) => {
        const header = allHeaders.find((h) => Object.keys(h)[0] === headerKey);
        return header && header.type === "dropdown" ? header.options || [] : [];
    };

    const handleFilterChange = (headerKey, value, type = "default") => {
        setFilterValues((prev) => ({
            ...prev,
            [headerKey]: {
                ...prev[headerKey],
                [type]: value,
            },
        }));
    };

    const handleDropdownChange = (headerKey, e) => {
        const selectedValues = Array.from(e.target.selectedOptions, (option) => option.value);
        handleFilterChange(headerKey, selectedValues, "values");
        // Refocus the dropdown after selection
        setTimeout(() => {
            const dropdown = dropdownRefs.current[headerKey];
            if (dropdown) {
                dropdown.focus();
            }
        }, 50); // Small delay to ensure selection event completes
    };

    const toggleDateRangeMode = (headerKey) => {
        setDateRangeMode((prev) => ({
            ...prev,
            [headerKey]: !prev[headerKey],
        }));
        if (dateRangeMode[headerKey]) {
            setFilterValues((prev) => ({
                ...prev,
                [headerKey]: { value: prev[headerKey]?.value || "" },
            }));
        }
    };

    const handleApply = () => {
        onApply(filterValues);
        onClose();
    };

    const handleReset = () => {
        setFilterValues({});
        setDateRangeMode({});
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <button className={styles.closeButton} onClick={onClose}>
                    ✕
                </button>
                <h2 className={styles.filterTitle}>Filter</h2>
                <div className={styles.filterList}>
                    {visibleHeaders.map((header) => (
                        <div key={header.key} className={styles.filterItem}>
                            <div className={styles.filterHeader}>
                                <label className={styles.filterLabel}>{header.name}</label>
                                {header.type === "date" && (
                                    <button
                                        className={styles.toggleButton}
                                        onClick={() => toggleDateRangeMode(header.key)}
                                    >
                                        {dateRangeMode[header.key] ? "Single Date" : "Date Range"}
                                    </button>
                                )}
                            </div>
                            {header.type === "number" ? (
                                <div className={styles.numberFilter}>
                                    <input
                                        type="number"
                                        value={filterValues[header.key]?.value || ""}
                                        onChange={(e) => handleFilterChange(header.key, e.target.value, "value")}
                                        placeholder={`Enter ${header.name}`}
                                        className={styles.filterInput}
                                    />
                                    <select
                                        value={filterValues[header.key]?.order || "equals"}
                                        onChange={(e) => handleFilterChange(header.key, e.target.value, "order")}
                                        className={styles.filterSelect}
                                    >
                                        <option value="equals">Equals</option>
                                        <option value="greater">Greater Than</option>
                                        <option value="less">Less Than</option>
                                    </select>
                                </div>
                            ) : header.type === "date" ? (
                                dateRangeMode[header.key] ? (
                                    <div className={styles.dateFilter}>
                                        <input
                                            type="date"
                                            value={filterValues[header.key]?.start || ""}
                                            onChange={(e) => handleFilterChange(header.key, e.target.value, "start")}
                                            className={styles.filterInput}
                                            placeholder="Start Date"
                                        />
                                        <span className={styles.dateSeparator}>to</span>
                                        <input
                                            type="date"
                                            value={filterValues[header.key]?.end || ""}
                                            onChange={(e) => handleFilterChange(header.key, e.target.value, "end")}
                                            className={styles.filterInput}
                                            placeholder="End Date"
                                        />
                                    </div>
                                ) : (
                                    <input
                                        type="date"
                                        value={filterValues[header.key]?.value || ""}
                                        onChange={(e) => handleFilterChange(header.key, e.target.value, "value")}
                                        className={styles.filterInput}
                                        placeholder="Select Date"
                                    />
                                )
                            ) : header.type === "dropdown" ? (
                                <select
                                    multiple
                                    ref={(el) => (dropdownRefs.current[header.key] = el)} // Assign ref
                                    value={filterValues[header.key]?.values || []}
                                    onChange={(e) => handleDropdownChange(header.key, e)}
                                    className={styles.filterMultiSelect}
                                >
                                    {getDropdownOptions(header.key).map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={filterValues[header.key]?.value || ""}
                                    onChange={(e) => handleFilterChange(header.key, e.target.value, "value")}
                                    placeholder={`Filter by ${header.name}`}
                                    className={styles.filterInput}
                                />
                            )}
                        </div>
                    ))}
                </div>
                <div className={styles.modalActions}>
                    <button onClick={handleReset} className={styles.resetButton}>
                        Reset
                    </button>
                    <button onClick={handleApply} className={styles.applyButton}>
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FilterModal;
import { useEffect, useState, useContext, useRef } from "react";
import styles from "./FilterModal.module.css";
import { MainContext } from "../Contexts/MainContext";

const FilterModal = ({ headers, rows, onApply, onClose }) => {
    const { headers: allHeaders } = useContext(MainContext);
    const [filterValues, setFilterValues] = useState({});
    const [dateRangeMode, setDateRangeMode] = useState({});
    const [activeFilter, setActiveFilter] = useState(null);
    const dropdownRefs = useRef({});
    const modalRef = useRef(null);

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
        setTimeout(() => {
            const dropdown = dropdownRefs.current[headerKey];
            if (dropdown) dropdown.focus();
        }, 50);
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

    const toggleFilter = (headerKey) => {
        setActiveFilter(activeFilter === headerKey ? null : headerKey);
    };

    const handleApply = () => {
        onApply(filterValues);
        onClose();
    };

    const handleReset = () => {
        setFilterValues({});
        setDateRangeMode({});
        setActiveFilter(null);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} ref={modalRef}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>Filter</h2>
                    <button className={styles.closeButton} onClick={onClose}>Done</button>
                </div>
                <div className={styles.filterList}>
                    {visibleHeaders.map((header) => {
                        const isActive = activeFilter === header.key;
                        return (
                            <div
                                key={header.key}
                                className={`${styles.filterItem} ${isActive ? styles.activeItem : ''}`}
                            >
                                <div className={styles.filterRow}>
                                    {!isActive ? (
                                        <>
                                            <span>{header.name}</span>
                                            <span className={styles.headerType}>({header.type})</span>
                                            <button
                                                onClick={() => toggleFilter(header.key)}
                                                className={styles.editButton}
                                                disabled={activeFilter !== null && activeFilter !== header.key}
                                            >
                                                Filter
                                            </button>
                                        </>
                                    ) : (
                                        <div className={styles.filterFields}>
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
                                                        <button
                                                            onClick={() => toggleDateRangeMode(header.key)}
                                                            className={styles.toggleButton}
                                                        >
                                                            Single Date
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className={styles.dateFilter}>
                                                        <input
                                                            type="date"
                                                            value={filterValues[header.key]?.value || ""}
                                                            onChange={(e) => handleFilterChange(header.key, e.target.value, "value")}
                                                            className={styles.filterInput}
                                                            placeholder="Select Date"
                                                        />
                                                        <button
                                                            onClick={() => toggleDateRangeMode(header.key)}
                                                            className={styles.toggleButton}
                                                        >
                                                            Date Range
                                                        </button>
                                                    </div>
                                                )
                                            ) : header.type === "dropdown" ? (
                                                <select
                                                    multiple
                                                    ref={(el) => (dropdownRefs.current[header.key] = el)}
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
                                            <div className={styles.filterActions}>
                                                <button onClick={() => toggleFilter(header.key)} className={styles.cancelButton}>
                                                    Done
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
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
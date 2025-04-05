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
                [headerKey]: { value: prev[headerKey]?.value || "", order: "on" },
            }));
        } else {
            setFilterValues((prev) => ({
                ...prev,
                [headerKey]: { start: "", end: "" },
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

    const getFilterSummary = (header) => {
        const filter = filterValues[header.key];
        if (!filter) return "No filter";

        switch (header.type) {
            case "number":
                const order = filter.order || "equals";
                const value = filter.value || "";
                if (!value) return "No filter";
                const orderText =
                    order === "greaterOrEqual" ? "≥" : order === "lessOrEqual" ? "≤" : order.replace(/([A-Z])/g, " $1").toLowerCase();
                return `${orderText} ${value}`;
            case "date":
                if (dateRangeMode[header.key]) {
                    const start = filter.start || "";
                    const end = filter.end || "";
                    if (!start && !end) return "No filter";
                    return `${start ? `${start}` : ""}${start && end ? " - " : ""}${end ? `${end}` : ""}`.trim();
                } else {
                    const order = filter.order || "on";
                    const value = filter.value || "";
                    if (!value) return "No filter";
                    return `${order} ${value}`;
                }
            case "dropdown":
                const values = filter.values || [];
                return values.length > 0 ? values.join(", ") : "No filter";
            default:
                return filter.value ? `"${filter.value}"` : "No filter";
        }
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
                    <h2 className={styles.modalTitle}>Filters</h2>
                    <button className={styles.closeButton} onClick={onClose}>Done</button>
                </div>
                <div className={styles.filterList}>
                    {visibleHeaders.map((header) => {
                        const isActive = activeFilter === header.key;
                        return (
                            <div
                                key={header.key}
                                className={`${styles.filterItem} ${isActive ? styles.activeItem : ""}`}
                            >
                                <div className={styles.filterRow}>
                                    {!isActive ? (
                                        <>
                                            <div className={styles.filterSummary}>
                                                <span className={styles.headerName}>{header.name}</span>
                                                <span className={styles.filterValue}>
                                                    {getFilterSummary(header)}
                                                </span>
                                            </div>
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
                                                    <select
                                                        value={filterValues[header.key]?.order || "equals"}
                                                        onChange={(e) => handleFilterChange(header.key, e.target.value, "order")}
                                                        className={styles.filterSelect}
                                                    >
                                                        <option value="equals">=</option>
                                                        <option value="greater">{'>'}</option>
                                                        <option value="less">{'<'}</option>
                                                        <option value="greaterOrEqual">{'≥'}</option>
                                                        <option value="lessOrEqual">{'≤'}</option>
                                                    </select>
                                                    <input
                                                        type="number"
                                                        value={filterValues[header.key]?.value || ""}
                                                        onChange={(e) => handleFilterChange(header.key, e.target.value, "value")}
                                                        placeholder="Value"
                                                        className={styles.filterInput}
                                                    />
                                                </div>
                                            ) : header.type === "date" ? (
                                                dateRangeMode[header.key] ? (
                                                    <div className={styles.dateFilter}>
                                                        <input
                                                            type="date"
                                                            value={filterValues[header.key]?.start || ""}
                                                            onChange={(e) => handleFilterChange(header.key, e.target.value, "start")}
                                                            className={styles.filterInput}
                                                        />
                                                        <span className={styles.dateSeparator}>–</span>
                                                        <input
                                                            type="date"
                                                            value={filterValues[header.key]?.end || ""}
                                                            onChange={(e) => handleFilterChange(header.key, e.target.value, "end")}
                                                            className={styles.filterInput}
                                                        />
                                                        <button
                                                            onClick={() => toggleDateRangeMode(header.key)}
                                                            className={styles.toggleButton}
                                                        >
                                                            Single
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className={styles.dateFilter}>
                                                        <select
                                                            value={filterValues[header.key]?.order || "on"}
                                                            onChange={(e) => handleFilterChange(header.key, e.target.value, "order")}
                                                            className={styles.filterSelect}
                                                        >
                                                            <option value="on">On</option>
                                                            <option value="before">Before</option>
                                                            <option value="after">After</option>
                                                        </select>
                                                        <input
                                                            type="date"
                                                            value={filterValues[header.key]?.value || ""}
                                                            onChange={(e) => handleFilterChange(header.key, e.target.value, "value")}
                                                            className={styles.filterInput}
                                                        />
                                                        <button
                                                            onClick={() => toggleDateRangeMode(header.key)}
                                                            className={styles.toggleButton}
                                                        >
                                                            Range
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
                                                    placeholder={`Filter ${header.name}`}
                                                    className={styles.filterInput}
                                                />
                                            )}
                                            <div className={styles.filterActions}>
                                                <button onClick={() => toggleFilter(header.key)} className={styles.doneButton}>
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
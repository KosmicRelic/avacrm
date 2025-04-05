import { useEffect, useState, useContext, useRef } from "react";
import styles from "./FilterModal.module.css";
import { MainContext } from "../Contexts/MainContext";

const FilterModal = ({ headers, rows, onApply, onClose }) => {
  const { headers: allHeaders } = useContext(MainContext);
  const [filterValues, setFilterValues] = useState({});
  const [dateRangeMode, setDateRangeMode] = useState({});
  const [numberRangeMode, setNumberRangeMode] = useState({});
  const [activeFilterIndex, setActiveFilterIndex] = useState(null);
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
      [headerKey]: { ...prev[headerKey], [type]: value },
    }));
  };

  const handleDropdownChange = (headerKey, e) => {
    const selectedValues = Array.from(e.target.selectedOptions, (option) => option.value);
    handleFilterChange(headerKey, selectedValues, "values");
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

  const toggleNumberRangeMode = (headerKey) => {
    setNumberRangeMode((prev) => ({
      ...prev,
      [headerKey]: !prev[headerKey],
    }));
    if (numberRangeMode[headerKey]) {
      setFilterValues((prev) => ({
        ...prev,
        [headerKey]: { value: prev[headerKey]?.value || "", order: "equals" },
      }));
    } else {
      setFilterValues((prev) => ({
        ...prev,
        [headerKey]: { start: "", end: "" },
      }));
    }
  };

  const editFilter = (index) => {
    setActiveFilterIndex(index);
  };

  const cancelEdit = () => {
    setActiveFilterIndex(null);
  };

  const handleApply = () => {
    onApply(filterValues);
    onClose();
  };

  const handleReset = () => {
    setFilterValues({});
    setDateRangeMode({});
    setNumberRangeMode({});
    setActiveFilterIndex(null);
  };

  const getFilterSummary = (header) => {
    const filter = filterValues[header.key];
    if (!filter) return "No filter";

    switch (header.type) {
      case "number":
        if (numberRangeMode[header.key]) {
          const start = filter.start || "";
          const end = filter.end || "";
          const sortOrder = filter.sortOrder || "";
          if (!start && !end && !sortOrder) return "No filter";
          return `${start ? `${start}` : ""}${start && end ? " - " : ""}${end ? `${end}` : ""}${
            sortOrder ? ` (${sortOrder})` : ""
          }`.trim();
        } else {
          const order = filter.order || "equals";
          const value = filter.value || "";
          const sortOrder = filter.sortOrder || "";
          if (!value && !sortOrder) return "No filter";
          const orderText =
            order === "greaterOrEqual" ? "≥" :
            order === "lessOrEqual" ? "≤" :
            order === "greater" ? ">" :
            order === "less" ? "<" :
            "=";
          return `${orderText}${value ? ` ${value}` : ""}${sortOrder ? ` (${sortOrder})` : ""}`.trim();
        }
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
      case "text":
        const condition = filter.condition || "equals";
        const value = filter.value || "";
        if (!value) return "No filter";
        return `${condition} "${value}"`;
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
          <button className={styles.closeButton} onClick={onClose}>
            Done
          </button>
        </div>
        <div className={styles.filterList}>
          {visibleHeaders.map((header, index) => (
            <div
              key={header.key}
              className={`${styles.filterItem} ${activeFilterIndex === index ? styles.activeItem : ""}`}
            >
              <div className={styles.filterRow}>
                <div className={styles.filterNameType}>
                  <span>{header.name}</span>
                  <span className={styles.filterType}>({header.type})</span>
                </div>
                <div className={styles.primaryButtons}>
                  <span className={styles.filterSummary}>{getFilterSummary(header)}</span>
                  <button
                    onClick={() => editFilter(index)}
                    className={styles.filterButton}
                    disabled={activeFilterIndex !== null && activeFilterIndex !== index}
                  >
                    Filter
                  </button>
                </div>
              </div>
              {activeFilterIndex === index && (
                <div className={styles.filterActions}>
                  {header.type === "number" ? (
                    <>
                      {numberRangeMode[header.key] ? (
                        <>
                          <input
                            type="number"
                            value={filterValues[header.key]?.start || ""}
                            onChange={(e) => handleFilterChange(header.key, e.target.value, "start")}
                            placeholder="Start"
                            className={styles.filterInput}
                          />
                          <span className={styles.separator}>–</span>
                          <input
                            type="number"
                            value={filterValues[header.key]?.end || ""}
                            onChange={(e) => handleFilterChange(header.key, e.target.value, "end")}
                            placeholder="End"
                            className={styles.filterInput}
                          />
                          <button
                            onClick={() => toggleNumberRangeMode(header.key)}
                            className={styles.actionButton}
                          >
                            Order
                          </button>
                        </>
                      ) : (
                        <>
                          <select
                            value={filterValues[header.key]?.order || "equals"}
                            onChange={(e) => handleFilterChange(header.key, e.target.value, "order")}
                            className={styles.filterSelectNoChevron}
                          >
                            <option value="equals">=</option>
                            <option value="greater"></option>
                            <option value="less"></option>
                            <option value="greaterOrEqual">≥</option>
                            <option value="lessOrEqual">≤</option>
                          </select>
                          <input
                            type="number"
                            value={filterValues[header.key]?.value || ""}
                            onChange={(e) => handleFilterChange(header.key, e.target.value, "value")}
                            placeholder="Value"
                            className={styles.filterInput}
                          />
                          <button
                            onClick={() => toggleNumberRangeMode(header.key)}
                            className={styles.actionButton}
                            disabled={filterValues[header.key]?.order !== "equals"}
                          >
                            Range
                          </button>
                        </>
                      )}
                      <select
                        value={filterValues[header.key]?.sortOrder || ""}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, "sortOrder")}
                        className={styles.filterSelect}
                      >
                        <option value="">No Sort</option>
                        <option value="ascending">Ascending</option>
                        <option value="descending">Descending</option>
                      </select>
                    </>
                  ) : header.type === "date" ? (
                    dateRangeMode[header.key] ? (
                      <>
                        <input
                          type="date"
                          value={filterValues[header.key]?.start || ""}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, "start")}
                          className={styles.filterInput}
                        />
                        <span className={styles.separator}>–</span>
                        <input
                          type="date"
                          value={filterValues[header.key]?.end || ""}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, "end")}
                          className={styles.filterInput}
                        />
                        <button
                          onClick={() => toggleDateRangeMode(header.key)}
                          className={styles.actionButton}
                        >
                          Single
                        </button>
                      </>
                    ) : (
                      <>
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
                          className={styles.actionButton}
                        >
                          Range
                        </button>
                      </>
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
                    <>
                      <select
                        value={filterValues[header.key]?.condition || "equals"}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, "condition")}
                        className={styles.filterSelect}
                      >
                        <option value="equals">Equals</option>
                        <option value="contains">Contains</option>
                        <option value="startsWith">Starts With</option>
                        <option value="endsWith">Ends With</option>
                      </select>
                      <input
                        type="text"
                        value={filterValues[header.key]?.value || ""}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, "value")}
                        placeholder={`Filter ${header.name}`}
                        className={styles.filterInput}
                      />
                    </>
                  )}
                  <button onClick={cancelEdit} className={styles.cancelButton}>
                    Done
                  </button>
                </div>
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
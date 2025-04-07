import { useEffect, useState, useContext, useRef, useMemo, useCallback } from "react";
import styles from "./FilterModal.module.css";
import { MainContext } from "../Contexts/MainContext";

const FilterModal = ({ headers, rows, onApply, onClose, filters: initialFilters = {} }) => {
  const { headers: allHeaders } = useContext(MainContext);
  const [filterValues, setFilterValues] = useState(initialFilters);
  const [dateRangeMode, setDateRangeMode] = useState(
    useMemo(() => {
      const initial = {};
      Object.entries(initialFilters).forEach(([key, filter]) => {
        if (filter.start || filter.end) initial[key] = true;
      });
      return initial;
    }, [initialFilters])
  );
  const [numberRangeMode, setNumberRangeMode] = useState(
    useMemo(() => {
      const initial = {};
      Object.entries(initialFilters).forEach(([key, filter]) => {
        if (filter.start || filter.end) initial[key] = true;
      });
      return initial;
    }, [initialFilters])
  );
  const [activeFilterIndex, setActiveFilterIndex] = useState(null);
  const [isClosing, setIsClosing] = useState(false); // Added for closing animation
  const dropdownRefs = useRef({});
  const modalRef = useRef(null);
  const filterActionsRef = useRef(null);

  const visibleHeaders = useMemo(() => headers.filter((header) => !header.hidden), [headers]);

  const getDropdownOptions = useCallback(
    (headerKey) => {
      const header = allHeaders.find((h) => Object.keys(h)[0] === headerKey);
      return header && header.type === "dropdown" ? header.options || [] : [];
    },
    [allHeaders]
  );

  const applyFilters = useCallback((filters) => {
    const cleanedFilters = Object.fromEntries(
      Object.entries(filters).map(([key, filter]) => {
        if (numberRangeMode[key]) {
          return [key, {
            start: filter.start ? Number(filter.start) : undefined,
            end: filter.end ? Number(filter.end) : undefined,
            sortOrder: filter.sortOrder || undefined,
          }];
        } else if (filter.order && filter.value) {
          return [key, {
            order: filter.order,
            value: filter.type === "number" ? Number(filter.value) : filter.value,
            sortOrder: filter.sortOrder || undefined,
          }];
        }
        return [key, filter];
      })
    );
    onApply(cleanedFilters);
  }, [numberRangeMode, onApply]);

  const handleFilterChange = useCallback((headerKey, value, type = "default") => {
    setFilterValues((prev) => {
      const newFilter = { ...prev[headerKey], [type]: value };
      if (type === "start" || type === "end" || type === "value") {
        if (value === "") delete newFilter[type];
      }
      const updatedFilters = { ...prev, [headerKey]: newFilter };
      setTimeout(() => applyFilters(updatedFilters), 0);
      return updatedFilters;
    });
  }, [applyFilters]);

  const handleDropdownChange = useCallback(
    (headerKey, e) => {
      const selectedValues = Array.from(e.target.selectedOptions, (option) => option.value);
      handleFilterChange(headerKey, selectedValues, "values");
    },
    [handleFilterChange]
  );

  const toggleDateRangeMode = useCallback((headerKey) => {
    setDateRangeMode((prev) => {
      const newMode = !prev[headerKey];
      setFilterValues((prevFilters) => {
        const updatedFilters = {
          ...prevFilters,
          [headerKey]: newMode
            ? { start: prevFilters[headerKey]?.start || "", end: prevFilters[headerKey]?.end || "" }
            : { value: prevFilters[headerKey]?.value || "", order: "on" },
        };
        setTimeout(() => applyFilters(updatedFilters), 0);
        return updatedFilters;
      });
      return { ...prev, [headerKey]: newMode };
    });
  }, [applyFilters]);

  const toggleNumberRangeMode = useCallback((headerKey) => {
    setNumberRangeMode((prev) => {
      const newMode = !prev[headerKey];
      setFilterValues((prevFilters) => {
        const updatedFilters = {
          ...prevFilters,
          [headerKey]: newMode
            ? { start: prevFilters[headerKey]?.start || "", end: prevFilters[headerKey]?.end || "" }
            : { value: prevFilters[headerKey]?.value || "", order: "equals" },
        };
        setTimeout(() => applyFilters(updatedFilters), 0);
        return updatedFilters;
      });
      return { ...prev, [headerKey]: newMode };
    });
  }, [applyFilters]);

  const toggleFilter = useCallback((index) => {
    setActiveFilterIndex(index);
  }, []);

  const clearFilter = useCallback((headerKey) => {
    setFilterValues((prev) => {
      const updatedFilters = { ...prev, [headerKey]: {} };
      applyFilters(updatedFilters);
      return updatedFilters;
    });
    setDateRangeMode((prev) => ({ ...prev, [headerKey]: false }));
    setNumberRangeMode((prev) => ({ ...prev, [headerKey]: false }));
  }, [applyFilters]);

  const handleReset = useCallback(() => {
    const clearedFilters = {};
    setFilterValues(clearedFilters);
    setDateRangeMode({});
    setNumberRangeMode({});
    setActiveFilterIndex(null);
    applyFilters(clearedFilters);
  }, [applyFilters]);

  const getFilterSummary = useCallback(
    (header) => {
      const filter = filterValues[header.key] || {};
      if (Object.keys(filter).length === 0) return "None";

      switch (header.type) {
        case "number":
          if (numberRangeMode[header.key]) {
            const start = filter.start || "";
            const end = filter.end || "";
            const sortOrder = filter.sortOrder || "";
            if (!start && !end && !sortOrder) return "None";
            return `${start}${start && end ? " – " : ""}${end}${sortOrder ? ` (${sortOrder})` : ""}`.trim();
          } else {
            const order = filter.order || "equals";
            const value = filter.value || "";
            const sortOrder = filter.sortOrder || "";
            if (!value && !sortOrder) return "None";
            const orderText =
              order === "greaterOrEqual" ? "≥" :
              order === "lessOrEqual" ? "≤" :
              order === "greater" ? ">" :
              order === "less" ? "<" : "=";
            return `${orderText}${value ? ` ${value}` : ""}${sortOrder ? ` (${sortOrder})` : ""}`.trim();
          }
        case "date":
          if (dateRangeMode[header.key]) {
            const start = filter.start || "";
            const end = filter.end || "";
            if (!start && !end) return "None";
            return `${start}${start && end ? " – " : ""}${end}`.trim();
          } else {
            const order = filter.order || "on";
            const value = filter.value || "";
            if (!value) return "None";
            return `${order} ${value}`;
          }
        case "dropdown":
          const values = filter.values || [];
          return values.length > 0 ? values.join(", ") : "None";
        case "text":
          const condition = filter.condition || "equals";
          const value = filter.value || "";
          if (!value) return "None";
          return `${condition} "${value}"`;
        default:
          return filter.value ? `"${filter.value}"` : "None";
      }
    },
    [filterValues, numberRangeMode, dateRangeMode]
  );

  const handleClose = () => {
    if (window.innerWidth <= 767) { // Animate on mobile
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 300); // Match animation duration
    } else {
      onClose(); // Immediate close on desktop
    }
  };

  useEffect(() => {
    const handleClickOutsideModal = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
  };

    const handleClickOutsideFilter = (event) => {
      if (
        filterActionsRef.current &&
        !filterActionsRef.current.contains(event.target) &&
        activeFilterIndex !== null &&
        !event.target.closest(`.${styles.filterItem}`)
      ) {
        setActiveFilterIndex(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutsideModal);
    document.addEventListener("mousedown", handleClickOutsideFilter);

    return () => {
      document.removeEventListener("mousedown", handleClickOutsideModal);
      document.removeEventListener("mousedown", handleClickOutsideFilter);
    };
  }, [onClose, activeFilterIndex]);

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${isClosing ? styles.closing : ""}`} ref={modalRef}>
        {/* iOS-style handle bar for mobile */}
        <div
          style={{
            width: "40px",
            height: "5px",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            borderRadius: "2.5px",
            margin: "0 auto 10px",
            display: "none",
            "@media (maxWidth: 767px)": {
              display: "block",
            },
          }}
        />
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Filters</h2>
          <button className={styles.doneButton} onClick={handleClose}>
            Done
          </button>
        </div>
        <div className={styles.filterList}>
          {visibleHeaders.map((header, index) => (
            <div
              key={header.key}
              className={`${styles.filterItem} ${activeFilterIndex === index ? styles.activeItem : ""}`}
              onClick={() => toggleFilter(index)}
            >
              <div className={styles.filterRow}>
                <div className={styles.filterNameType}>
                  <span>{header.name}</span>
                </div>
                <div className={styles.primaryButtons}>
                  <span className={styles.filterSummary}>{getFilterSummary(header)}</span>
                </div>
              </div>
              {activeFilterIndex === index && (
                <div className={styles.filterActions} ref={filterActionsRef}>
                  {header.type === "number" ? (
                    numberRangeMode[header.key] ? (
                      <>
                        <input
                          type="number"
                          value={filterValues[header.key]?.start || ""}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, "start")}
                          placeholder="From"
                          className={styles.filterInput}
                        />
                        <span className={styles.separator}>–</span>
                        <input
                          type="number"
                          value={filterValues[header.key]?.end || ""}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, "end")}
                          placeholder="To"
                          className={styles.filterInput}
                        />
                        <button onClick={() => toggleNumberRangeMode(header.key)} className={styles.actionButton}>
                          Value
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
                          <option value="greater">{">"}</option>
                          <option value="less">{"<"}</option>
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
                    )
                  ) : header.type === "date" ? (
                    dateRangeMode[header.key] ? (
                      <>
                        <input
                          type="date"
                          value={filterValues[header.key]?.start || ""}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, "start")}
                          placeholder="From"
                          className={styles.filterInput}
                        />
                        <span className={styles.separator}>–</span>
                        <input
                          type="date"
                          value={filterValues[header.key]?.end || ""}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, "end")}
                          placeholder="To"
                          className={styles.filterInput}
                        />
                        <button onClick={() => toggleDateRangeMode(header.key)} className={styles.actionButton}>
                          Date
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
                        <button onClick={() => toggleDateRangeMode(header.key)} className={styles.actionButton}>
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
                        placeholder={`Edit ${header.name}`}
                        className={styles.filterInput}
                      />
                    </>
                  )}
                  {header.type === "number" && (
                    <select
                      value={filterValues[header.key]?.sortOrder || ""}
                      onChange={(e) => handleFilterChange(header.key, e.target.value, "sortOrder")}
                      className={styles.filterSelect}
                    >
                      <option value="">No Sort</option>
                      <option value="ascending">Low to High</option>
                      <option value="descending">High to Low</option>
                    </select>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFilter(header.key);
                    }}
                    className={styles.clearButton}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className={styles.modalActions}>
          <button onClick={handleReset} className={styles.resetButton}>
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;
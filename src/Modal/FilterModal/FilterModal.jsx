import { useContext, useState, useCallback, useMemo, useRef, useEffect } from "react";
import styles from "./FilterModal.module.css";
import { MainContext } from "../../Contexts/MainContext"; // Corrected import path
import useClickOutside from "../Hooks/UseClickOutside";

const FilterModal = ({ headers, rows, tempData, setTempData }) => {
  const { headers: allHeaders } = useContext(MainContext);
  const [filterValues, setFilterValues] = useState(tempData.filterValues || {});
  const [dateRangeMode, setDateRangeMode] = useState(
    useMemo(() => {
      const initial = {};
      Object.entries(tempData.filterValues || {}).forEach(([key, filter]) => {
        if (filter.start || filter.end) initial[key] = true;
      });
      return initial;
    }, [tempData.filterValues])
  );
  const [numberRangeMode, setNumberRangeMode] = useState(
    useMemo(() => {
      const initial = {};
      Object.entries(tempData.filterValues || {}).forEach(([key, filter]) => {
        if (filter.start || filter.end) initial[key] = true;
      });
      return initial;
    }, [tempData.filterValues])
  );
  const [activeFilterIndex, setActiveFilterIndex] = useState(null);
  const filterActionsRef = useRef(null);

  const visibleHeaders = useMemo(() => headers.filter((header) => !header.hidden), [headers]);

  // Sync filterValues with tempData whenever filterValues changes
  useEffect(() => {
    const cleanedFilters = Object.fromEntries(
      Object.entries(filterValues).map(([key, filter]) => {
        if (numberRangeMode[key]) {
          return [
            key,
            {
              start: filter.start ? Number(filter.start) : undefined,
              end: filter.end ? Number(filter.end) : undefined,
              sortOrder: filter.sortOrder || undefined,
            },
          ];
        } else if (filter.order && filter.value) {
          return [
            key,
            {
              order: filter.order,
              value: filter.type === "number" ? Number(filter.value) : filter.value,
              sortOrder: filter.sortOrder || undefined,
            },
          ];
        }
        return [key, filter];
      })
    );
    setTempData((prev) => ({ ...prev, filterValues: cleanedFilters }));
  }, [filterValues, numberRangeMode, setTempData]);

  const getDropdownOptions = useCallback(
    (headerKey) => {
      const header = allHeaders.find((h) => Object.keys(h)[0] === headerKey);
      return header && header.type === "dropdown" ? header.options || [] : [];
    },
    [allHeaders]
  );

  const handleFilterChange = useCallback(
    (headerKey, value, type = "default") => {
      setFilterValues((prev) => {
        const newFilter = { ...prev[headerKey], [type]: value };
        if (type === "start" || type === "end" || type === "value") {
          if (value === "") delete newFilter[type];
        }
        return { ...prev, [headerKey]: newFilter };
      });
    },
    []
  );

  const handleDropdownChange = useCallback(
    (headerKey, e) => {
      const selectedValues = Array.from(e.target.selectedOptions, (option) => option.value);
      handleFilterChange(headerKey, selectedValues, "values");
    },
    [handleFilterChange]
  );

  const toggleRangeMode = useCallback(
    (headerKey, isDate = false) => {
      const setRangeMode = isDate ? setDateRangeMode : setNumberRangeMode;
      setRangeMode((prev) => {
        const newMode = !prev[headerKey];
        setFilterValues((prevFilters) => ({
          ...prevFilters,
          [headerKey]: newMode
            ? { start: prevFilters[headerKey]?.start || "", end: prevFilters[headerKey]?.end || "" }
            : { value: prevFilters[headerKey]?.value || "", order: isDate ? "on" : "equals" },
        }));
        return { ...prev, [headerKey]: newMode };
      });
    },
    []
  );

  const toggleDateRangeMode = (headerKey) => toggleRangeMode(headerKey, true);
  const toggleNumberRangeMode = (headerKey) => toggleRangeMode(headerKey, false);

  const toggleFilter = useCallback((index) => {
    setActiveFilterIndex((prev) => (prev === index ? null : index));
  }, []);

  const clearFilter = useCallback(
    (headerKey) => {
      setFilterValues((prev) => ({ ...prev, [headerKey]: {} }));
      setDateRangeMode((prev) => ({ ...prev, [headerKey]: false }));
      setNumberRangeMode((prev) => ({ ...prev, [headerKey]: false }));
    },
    []
  );

  const handleReset = useCallback(() => {
    const clearedFilters = {};
    setFilterValues(clearedFilters);
    setDateRangeMode({});
    setNumberRangeMode({});
    setActiveFilterIndex(null);
  }, []);

  const isFilterEmpty = (filter) =>
    Object.keys(filter).length === 0 || (!filter.start && !filter.end && !filter.value && !filter.values?.length);

  const getFilterSummary = useCallback(
    (header) => {
      const filter = filterValues[header.key] || {};
      if (isFilterEmpty(filter)) return "None";

      switch (header.type) {
        case "number":
          if (numberRangeMode[header.key]) {
            const start = filter.start || "";
            const end = filter.end || "";
            const sortOrder = filter.sortOrder || "";
            return `${start}${start && end ? " – " : ""}${end}${sortOrder ? ` (${sortOrder})` : ""}`.trim();
          } else {
            const order = filter.order || "equals";
            const value = filter.value || "";
            const sortOrder = filter.sortOrder || "";
            const orderText = { equals: "=", greaterOrEqual: "≥", lessOrEqual: "≤", greater: ">", less: "<" }[order];
            return `${orderText}${value ? ` ${value}` : ""}${sortOrder ? ` (${sortOrder})` : ""}`.trim();
          }
        case "date":
          if (dateRangeMode[header.key]) {
            const start = filter.start || "";
            const end = filter.end || "";
            return `${start}${start && end ? " – " : ""}${end}`.trim();
          } else {
            const order = filter.order || "on";
            const value = filter.value || "";
            return value ? `${order} ${value}` : "None";
          }
        case "dropdown":
          const values = filter.values || [];
          return values.length > 0 ? values.join(", ") : "None";
        case "text":
          const condition = filter.condition || "equals";
          const value = filter.value || "";
          return value ? `${condition} "${value}"` : "None";
        default:
          return filter.value ? `"${filter.value}"` : "None";
      }
    },
    [filterValues, numberRangeMode, dateRangeMode]
  );

  useClickOutside(filterActionsRef, activeFilterIndex !== null, () => setActiveFilterIndex(null));

  return (
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
            <div
              className={styles.filterActions}
              ref={filterActionsRef}
              onClick={(e) => e.stopPropagation()}
            >
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
      <div className={styles.modalActions}>
        <button onClick={handleReset} className={styles.resetButton}>
          Clear All
        </button>
      </div>
    </div>
  );
};

export default FilterModal;
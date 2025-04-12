import { useContext, useState, useCallback, useMemo, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import styles from "./FilterModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import useClickOutside from "../Hooks/UseClickOutside";

const FilterModal = ({ headers, rows, tempData, setTempData, onSave }) => {
  const { headers: allHeaders, isDarkTheme, registerModalSteps, setModalConfig, goToStep } = useContext(MainContext);
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
  const hasInitialized = useRef(false);

  // Initialize modal steps and config
  useEffect(() => {
    if (!hasInitialized.current) {
      registerModalSteps({
        steps: [
          {
            title: () => "Filters",
            rightButtons: () => [],
          },
        ],
      });
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Filters",
        backButtonTitle: "",
      });
      goToStep(1);
      hasInitialized.current = true;
    }
  }, [registerModalSteps, setModalConfig, goToStep]);

  // Initialize tempData
  useEffect(() => {
    if (!tempData.filterValues) {
      setTempData({ filterValues: {} });
    }
  }, [tempData, setTempData]);

  const filterValues = tempData.filterValues || {};

  const visibleHeaders = useMemo(
    () =>
      headers
        .filter((header) => !header.hidden)
        .map((header) => {
          const globalHeader = allHeaders.find((h) => h.key === header.key);
          return {
            ...header,
            name: globalHeader ? globalHeader.name : formatHeaderName(header.key),
            type: globalHeader ? globalHeader.type : header.type || "text",
            options: globalHeader?.options || [],
          };
        }),
    [headers, allHeaders]
  );

  const formatHeaderName = (key) => {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
  };

  const getDropdownOptions = useCallback(
    (headerKey) => {
      const header = allHeaders.find((h) => h.key === headerKey);
      return header && header.type === "dropdown" ? header.options || [] : [];
    },
    [allHeaders]
  );

  const updateTempFilters = useCallback(
    (newFilters) => {
      setTempData({ filterValues: { ...newFilters } });
    },
    [setTempData]
  );

  const applyFilters = useCallback(
    (filters) => {
      const cleanedFilters = Object.fromEntries(
        Object.entries(filters).map(([key, filter]) => {
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
      updateTempFilters(cleanedFilters);
    },
    [numberRangeMode, updateTempFilters]
  );

  const handleFilterChange = useCallback(
    (headerKey, value, type = "default") => {
      const newFilter = { ...filterValues[headerKey], [type]: value };
      if (type === "start" || type === "end" || type === "value") {
        if (value === "") delete newFilter[type];
      }
      const updatedFilters = { ...filterValues, [headerKey]: newFilter };
      applyFilters(updatedFilters);
    },
    [filterValues, applyFilters]
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
        const updatedFilters = {
          ...filterValues,
          [headerKey]: newMode
            ? { start: filterValues[headerKey]?.start || "", end: filterValues[headerKey]?.end || "" }
            : { value: filterValues[headerKey]?.value || "", order: isDate ? "on" : "equals" },
        };
        applyFilters(updatedFilters);
        return { ...prev, [headerKey]: newMode };
      });
    },
    [filterValues, applyFilters]
  );

  const toggleDateRangeMode = (headerKey) => toggleRangeMode(headerKey, true);
  const toggleNumberRangeMode = (headerKey) => toggleRangeMode(headerKey, false);

  const toggleFilter = useCallback((index) => {
    setActiveFilterIndex((prev) => (prev === index ? null : index));
  }, []);

  const clearFilter = useCallback(
    (headerKey) => {
      const updatedFilters = { ...filterValues, [headerKey]: {} };
      applyFilters(updatedFilters);
      setDateRangeMode((prev) => ({ ...prev, [headerKey]: false }));
      setNumberRangeMode((prev) => ({ ...prev, [headerKey]: false }));
    },
    [filterValues, applyFilters]
  );

  const handleReset = useCallback(() => {
    const clearedFilters = {};
    applyFilters(clearedFilters);
    setDateRangeMode({});
    setNumberRangeMode({});
    setActiveFilterIndex(null);
  }, [applyFilters]);

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
    <>
      <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ""}`}>
        {visibleHeaders.map((header, index) => (
          <div
            key={header.key}
            className={`${styles.filterItem} ${activeFilterIndex === index ? styles.activeItem : ""} ${
              isDarkTheme ? styles.darkTheme : ""
            }`}
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
                className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ""}`}
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
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                      />
                      <span className={styles.separator}>–</span>
                      <input
                        type="number"
                        value={filterValues[header.key]?.end || ""}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, "end")}
                        placeholder="To"
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                      />
                      <button
                        onClick={() => toggleNumberRangeMode(header.key)}
                        className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        Value
                      </button>
                      <select
                        value={filterValues[header.key]?.sortOrder || ""}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, "sortOrder")}
                        className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        <option value="">Sort...</option>
                        <option value="ascending">Ascending</option>
                        <option value="descending">Descending</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <select
                        value={filterValues[header.key]?.order || "equals"}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, "order")}
                        className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ""}`}
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
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                      />
                      <button
                        onClick={() => toggleNumberRangeMode(header.key)}
                        className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        Range
                      </button>
                      <select
                        value={filterValues[header.key]?.sortOrder || ""}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, "sortOrder")}
                        className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        <option value="">Sort...</option>
                        <option value="ascending">Ascending</option>
                        <option value="descending">Descending</option>
                      </select>
                    </>
                  )
                ) : header.type === "date" ? (
                  dateRangeMode[header.key] ? (
                    <>
                      <input
                        type="date"
                        value={filterValues[header.key]?.start || ""}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, "start")}
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                      />
                      <span className={styles.separator}>–</span>
                      <input
                        type="date"
                        value={filterValues[header.key]?.end || ""}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, "end")}
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                      />
                      <button
                        onClick={() => toggleDateRangeMode(header.key)}
                        className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        Exact
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        value={filterValues[header.key]?.order || "on"}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, "order")}
                        className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        <option value="on">On</option>
                        <option value="before">Before</option>
                        <option value="after">After</option>
                      </select>
                      <input
                        type="date"
                        value={filterValues[header.key]?.value || ""}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, "value")}
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                      />
                      <button
                        onClick={() => toggleDateRangeMode(header.key)}
                        className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                      >
                        Range
                      </button>
                    </>
                  )
                ) : header.type === "dropdown" ? (
                  <select
                    multiple
                    value={filterValues[header.key]?.values || []}
                    onChange={(e) => handleDropdownChange(header.key, e)}
                    className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ""}`}
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
                      className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ""}`}
                    >
                      <option value="equals">Equals</option>
                      <option value="contains">Contains</option>
                      <option value="startsWith">Starts with</option>
                      <option value="endsWith">Ends with</option>
                    </select>
                    <input
                      type="text"
                      value={filterValues[header.key]?.value || ""}
                      onChange={(e) => handleFilterChange(header.key, e.target.value, "value")}
                      placeholder="Value"
                      className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ""}`}
                    />
                  </>
                )}
                <button
                  onClick={() => clearFilter(header.key)}
                  className={`${styles.clearButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={`${styles.footer} ${isDarkTheme ? styles.darkTheme : ""}`}>
        <button
          onClick={handleReset}
          className={`${styles.resetButton} ${isDarkTheme ? styles.darkTheme : ""}`}
        >
          Reset All
        </button>
      </div>
    </>
  );
};

FilterModal.propTypes = {
  headers: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string,
      type: PropTypes.string,
      visible: PropTypes.bool,
      hidden: PropTypes.bool,
    })
  ).isRequired,
  rows: PropTypes.array.isRequired,
  tempData: PropTypes.shape({
    filterValues: PropTypes.object,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default FilterModal;
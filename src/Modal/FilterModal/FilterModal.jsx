import { useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './FilterModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';
import { IoMdArrowDropdown, IoMdFunnel, IoMdOptions } from 'react-icons/io';

const FilterModal = ({ headers, rows, tempData, setTempData }) => {
  const { cardTemplates, isDarkTheme, teamMembers, user } = useContext(MainContext);
  const { registerModalSteps, setModalConfig } = useContext(ModalNavigatorContext);
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
  const [sortFor, setSortFor] = useState({ headerKey: '', order: '' });
  const [showSortFor, setShowSortFor] = useState(false);
  const hasInitialized = useRef(false);

  const toggleFilter = useCallback((index) => {
    setActiveFilterIndex((prev) => (prev === index ? null : index));
  }, []);

  useEffect(() => {
    if (!hasInitialized.current) {
      registerModalSteps({
        steps: [
          {
            title: 'Filters',
            rightButton: null,
          },
        ],
      });
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: 'Filters',
        backButtonTitle: '',
        rightButton: null,
      });
      hasInitialized.current = true;
    }
  }, [registerModalSteps, setModalConfig]);

  useEffect(() => {
    if (!tempData.filterValues) {
      setTempData({ filterValues: {} });
    }
  }, [tempData, setTempData]);

  // Initialize sortFor from existing filterValues
  const filterValues = tempData.filterValues || {};

  useEffect(() => {
    const existingSort = Object.entries(filterValues).find(([_, filter]) => filter.sortOrder);
    if (existingSort) {
      const [headerKey, filter] = existingSort;
      setSortFor({ headerKey, order: filter.sortOrder });
    } else {
      setSortFor({ headerKey: '', order: '' });
    }
  }, [filterValues]);

  const visibleHeaders = useMemo(
    () =>
      headers
        .filter((header) => !header.hidden)
        .map((header) => {
          let mergedHeader = { ...header };
          // If dropdown or multi-select, try to get options from cardTemplates
          if ((header.type === 'dropdown' || header.type === 'multi-select') && cardTemplates) {
            // Find the first template that has this header key
            const templateHeader = cardTemplates
              .flatMap(t => t.headers || [])
              .find(h => h.key === header.key);
            if (templateHeader && Array.isArray(templateHeader.options)) {
              mergedHeader.options = templateHeader.options;
            }
          }
          return {
            ...mergedHeader,
            name: mergedHeader.name || formatHeaderName(mergedHeader.key),
            type: mergedHeader.type || 'text',
            options: mergedHeader.options || [],
          };
        }),
    [headers, cardTemplates]
  );

  const formatHeaderName = (key) => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  };

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
          } else if (filter.condition && filter.value !== undefined && filter.value !== null) {
            return [
              key,
              {
                condition: filter.condition,
                value: String(filter.value), // Always store as string
                sortOrder: filter.sortOrder || undefined,
              },
            ];
          } else if (filter.order && filter.value) {
            return [
              key,
              {
                order: filter.order,
                value: filter.type === 'number' ? Number(filter.value) : filter.value,
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
    (headerKey, value, type = 'default') => {
      const newFilter = { ...filterValues[headerKey], [type]: value };
      if (type === 'start' || type === 'end' || type === 'value' || type === 'sortOrder') {
        if (value === '') delete newFilter[type];
      }
      const updatedFilters = { ...filterValues, [headerKey]: newFilter };
      applyFilters(updatedFilters);
    },
    [filterValues, applyFilters]
  );

  const handleDropdownChange = useCallback(
    (headerKey, e) => {
      const selectedValues = Array.from(e.target.selectedOptions, (option) => option.value);
      handleFilterChange(headerKey, selectedValues, 'values');
    },
    [handleFilterChange]
  );

  const toggleNumberRangeMode = useCallback(
    (headerKey) => {
      setNumberRangeMode((prev) => {
        const newMode = !prev[headerKey];
        const updatedFilters = {
          ...filterValues,
          [headerKey]: newMode
            ? { start: filterValues[headerKey]?.start || '', end: filterValues[headerKey]?.end || '' }
            : { value: filterValues[headerKey]?.value || '', order: 'equals' },
        };
        applyFilters(updatedFilters);
        return { ...prev, [headerKey]: newMode };
      });
    },
    [filterValues, applyFilters]
  );

  const clearFilter = useCallback(
    (headerKey) => {
      const updatedFilters = { ...filterValues, [headerKey]: {} };
      applyFilters(updatedFilters);
      setNumberRangeMode((prev) => ({ ...prev, [headerKey]: false }));
    },
    [filterValues, applyFilters]
  );

  const handleReset = useCallback(() => {
    const clearedFilters = {};
    applyFilters(clearedFilters);
    setNumberRangeMode({});
    setActiveFilterIndex(null);
  }, [applyFilters]);

  const isFilterEmpty = (filter) =>
    Object.keys(filter).length === 0 || (!filter.start && !filter.end && !filter.value && !filter.values?.length && !filter.sortOrder);

  const getFilterSummary = useCallback(
    (header) => {
      const filter = filterValues[header.key] || {};
      if (isFilterEmpty(filter)) return 'None';

      switch (header.type) {
        case 'number':
          if (numberRangeMode[header.key]) {
            const start = filter.start || '';
            const end = filter.end || '';
            const sortOrder = filter.sortOrder || '';
            return `${start}${start && end ? ' – ' : ''}${end}${sortOrder ? ` (${sortOrder})` : ''}`.trim();
          } else {
            const order = filter.order || 'equals';
            const value = filter.value || '';
            const sortOrder = filter.sortOrder || '';
            const orderText = { equals: '=', greaterOrEqual: '≥', lessOrEqual: '≤', greater: '>', less: '<' }[order];
            return `${orderText}${value ? ` ${value}` : ''}${sortOrder ? ` (${sortOrder})` : ''}`.trim();
          }
        case 'date':
          const sortOrder = filter.sortOrder || '';
          return sortOrder ? sortOrder : 'None';
        case 'dropdown':
          const values = filter.values || [];
          return values.length > 0 ? values.join(', ') : 'None';
        case 'multi-select':
          const multiValues = filter.values || [];
          return multiValues.length > 0 ? multiValues.join(', ') : 'None';
        case 'text':
          const condition = filter.condition || 'equals';
          // Always treat value as string for summary
          const value = filter.value !== undefined && filter.value !== null ? String(filter.value) : '';
          return value ? `${condition} "${value}"` : 'None';
        default:
          return filter.value !== undefined && filter.value !== null
            ? `"${String(filter.value)}"`
            : 'None';
      }
    },
    [filterValues, numberRangeMode]
  );

  const getTeamMemberName = (uid) => {
    if (!uid) return '';
    if (uid === user?.uid) return user?.name && user?.surname ? `${user.name} ${user.surname}` : user?.email || 'Me';
    const member = teamMembers?.find((tm) => tm.uid === uid);
    return member ? `${member.name || ''} ${member.surname || ''}`.trim() : uid;
  };

  // Remove Apply button logic, update sortFor state and tempData on change
  useEffect(() => {
    if (!sortFor.headerKey || !sortFor.order) return;
    // Clear sortOrder from all filters
    const updatedFilters = { ...filterValues };
    Object.keys(updatedFilters).forEach((key) => {
      if (updatedFilters[key]) {
        delete updatedFilters[key].sortOrder;
      }
    });
    // Set sortOrder for selected header
    if (!updatedFilters[sortFor.headerKey]) updatedFilters[sortFor.headerKey] = {};
    updatedFilters[sortFor.headerKey].sortOrder = sortFor.order;
    applyFilters(updatedFilters);
    // eslint-disable-next-line
  }, [sortFor.headerKey, sortFor.order]);

  // Allow sort for all visible headers
  const sortableHeaders = useMemo(
    () => visibleHeaders,
    [visibleHeaders]
  );

  return (
    <div className={`${styles.filterContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {/* Sort For Section */}
      <div className={`${styles.section} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Sort & Filter</h2>
        <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>
          Configure sorting and filtering options for your data
        </p>
      </div>

      {/* Sort For Card */}
      <div
        className={`${styles.configCard} ${showSortFor ? styles.activeCard : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
        onClick={() => setShowSortFor((prev) => !prev)}
      >
        <div className={styles.cardHeader} onClick={(e) => { e.stopPropagation(); setShowSortFor((prev) => !prev); }}>
          <div className={styles.cardContent}>
            <div className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Sort By</div>
            <div className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>
              {(() => {
                if (!sortFor.headerKey || !sortFor.order) return 'Choose how to sort your data';
                const header = sortableHeaders.find(h => h.key === sortFor.headerKey);
                if (!header) return 'Choose how to sort your data';
                return `${header.name} (${sortFor.order === 'ascending' ? 'Ascending' : 'Descending'})`;
              })()}
            </div>
            <div className={`${styles.cardBadge} ${isDarkTheme ? styles.darkTheme : ''}`}>
              {(sortFor.headerKey && sortFor.order) ? 'Active' : 'None'}
            </div>
          </div>
          <div className={`${styles.cardArrow} ${showSortFor ? styles.expanded : ''} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <IoMdArrowDropdown />
          </div>
        </div>
        {showSortFor && (
          <>
            <div className={`${styles.cardDivider} ${isDarkTheme ? styles.darkTheme : ''}`}></div>
            <div
              className={`${styles.filterActions} ${styles.cardActions} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <select
                value={sortFor.headerKey}
                onChange={e => setSortFor(s => ({ ...s, headerKey: e.target.value }))}
                className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
              >
                <option value="">Select field...</option>
                {sortableHeaders.map((header) => (
                  <option key={header.key} value={header.key}>{header.name}</option>
                ))}
              </select>
              <select
                value={sortFor.order}
                onChange={e => setSortFor(s => ({ ...s, order: e.target.value }))}
                className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
              >
                <option value="">Sort order...</option>
                <option value="ascending">Ascending</option>
                <option value="descending">Descending</option>
              </select>
              {(sortFor.headerKey && sortFor.order) && (
                <button
                  onClick={() => {
                    const updatedFilters = { ...filterValues };
                    Object.keys(updatedFilters).forEach((key) => {
                      if (updatedFilters[key]) {
                        delete updatedFilters[key].sortOrder;
                      }
                    });
                    applyFilters(updatedFilters);
                    setSortFor({ headerKey: '', order: '' });
                  }}
                  className={`${styles.clearButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                >
                  Clear Sort
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Filter Cards */}
      <div className={`${styles.section} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <h2 className={`${styles.sectionTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>Filters</h2>
        <p className={`${styles.sectionDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>
          Set up filters to narrow down your data
        </p>
      </div>

      {visibleHeaders.length === 0 ? (
        <div className={`${styles.noCards} ${isDarkTheme ? styles.darkTheme : ''}`}>
          No filterable fields available
        </div>
      ) : (
        visibleHeaders.map((header, index) => (
          <div
            key={header.key}
            className={`${styles.configCard} ${activeFilterIndex === index ? styles.activeCard : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
          >
            <div className={styles.cardHeader} onClick={(e) => { e.stopPropagation(); setActiveFilterIndex(activeFilterIndex === index ? null : index); }}>
              <div className={styles.cardContent}>
                <div className={`${styles.cardTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>{header.name}</div>
                <div className={`${styles.cardDescription} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {header.type === 'text' && 'Filter by text content'}
                  {header.type === 'number' && 'Filter by numeric values'}
                  {header.type === 'date' && 'Filter by date ranges'}
                  {header.type === 'dropdown' && 'Filter by selected options'}
                  {header.type === 'multi-select' && 'Filter by multiple selections'}
                </div>
                <div className={`${styles.cardBadge} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {getFilterSummary(header) !== 'None' ? 'Active' : 'None'}
                </div>
              </div>
              <div className={`${styles.cardArrow} ${activeFilterIndex === index ? styles.expanded : ''} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <IoMdArrowDropdown />
              </div>
            </div>
            {activeFilterIndex === index && (
              <>
                <div className={`${styles.cardDivider} ${isDarkTheme ? styles.darkTheme : ''}`}></div>
                <div
                  className={`${styles.filterActions} ${styles.cardActions} ${isDarkTheme ? styles.darkTheme : ''}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {header.type === 'number' ? (
                    numberRangeMode[header.key] ? (
                      <>
                        <input
                          type="number"
                          value={filterValues[header.key]?.start || ''}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, 'start')}
                          placeholder="From"
                          className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                        />
                        <span className={`${styles.separator} ${isDarkTheme ? styles.darkTheme : ''}`}>–</span>
                        <input
                          type="number"
                          value={filterValues[header.key]?.end || ''}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, 'end')}
                          placeholder="To"
                          className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                        />
                        <button
                          onClick={() => toggleNumberRangeMode(header.key)}
                          className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          Value
                        </button>
                      </>
                    ) : (
                      <>
                        <select
                          value={filterValues[header.key]?.order || 'equals'}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, 'order')}
                          className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          <option value="equals">=</option>
                          <option value="greaterOrEqual">≥</option>
                          <option value="lessOrEqual">≤</option>
                          <option value="greater">&gt;</option>
                          <option value="less">&lt;</option>
                        </select>
                        <input
                          type="number"
                          value={filterValues[header.key]?.value || ''}
                          onChange={(e) => handleFilterChange(header.key, e.target.value, 'value')}
                          placeholder="Value"
                          className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                        />
                        <button
                          onClick={() => toggleNumberRangeMode(header.key)}
                          className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          Range
                        </button>
                      </>
                    )
                  ) : header.type === 'date' ? (
                    <select
                      value={filterValues[header.key]?.sortOrder || ''}
                      onChange={(e) => handleFilterChange(header.key, e.target.value, 'sortOrder')}
                      className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      <option value="">No date filter</option>
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  ) : header.type === 'dropdown' ? (
                    <select
                      multiple
                      value={filterValues[header.key]?.values || []}
                      onChange={(e) => {
                        const values = Array.from(e.target.selectedOptions, option => option.value);
                        handleFilterChange(header.key, values, 'values');
                      }}
                      className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      {header.options?.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : header.type === 'multi-select' ? (
                    <select
                      multiple
                      value={filterValues[header.key]?.values || []}
                      onChange={(e) => {
                        const values = Array.from(e.target.selectedOptions, option => option.value);
                        handleFilterChange(header.key, values, 'values');
                      }}
                      className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      {header.options?.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <select
                        value={filterValues[header.key]?.condition || 'equals'}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, 'condition')}
                        className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ''}`}
                      >
                        <option value="equals">Equals</option>
                        <option value="contains">Contains</option>
                        <option value="startsWith">Starts with</option>
                        <option value="endsWith">Ends with</option>
                      </select>
                      <input
                        type="text"
                        value={filterValues[header.key]?.value || ''}
                        onChange={(e) => handleFilterChange(header.key, e.target.value, 'value')}
                        placeholder="Filter value"
                        className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                      />
                    </>
                  )}
                  {getFilterSummary(header) !== 'None' && (
                    <button
                      onClick={() => {
                        const newFilters = { ...filterValues };
                        delete newFilters[header.key];
                        applyFilters(newFilters);
                      }}
                      className={`${styles.clearButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
};

// Utility: filter rows locally based on filterValues and headers (supports multi-select)
export function filterRowsLocally(rows, filterValues, headers) {
  return rows.filter(row => {
    return Object.entries(filterValues).every(([key, filter]) => {
      if (!filter || Object.keys(filter).length === 0) return true;
      const header = headers.find(h => h.key === key);
      if (!header) return true;
      const value = row[key];
      if (header.type === 'number') {
        if (filter.start !== undefined && filter.start !== '' && Number(value) < Number(filter.start)) return false;
        if (filter.end !== undefined && filter.end !== '' && Number(value) > Number(filter.end)) return false;
        if (filter.order && filter.value !== undefined && filter.value !== '') {
          const numVal = Number(filter.value);
          if (filter.order === 'equals' && Number(value) !== numVal) return false;
          if (filter.order === 'greater' && Number(value) <= numVal) return false;
          if (filter.order === 'less' && Number(value) >= numVal) return false;
          if (filter.order === 'greaterOrEqual' && Number(value) < numVal) return false;
          if (filter.order === 'lessOrEqual' && Number(value) > numVal) return false;
        }
        return true;
      }
      if (header.type === 'dropdown') {
        if (Array.isArray(filter.values) && filter.values.length > 0) {
          // Dropdown: value can be string or array, filter.values is array
          if (Array.isArray(value)) {
            // If value is array, match if any selected value is present
            return value.some(v => filter.values.includes(v));
          } else {
            // If value is string, match if it's included in selected values
            return filter.values.includes(value);
          }
        }
        return true;
      }
      if (header.type === 'multi-select') {
        if (Array.isArray(filter.values) && filter.values.length > 0) {
          // Multi-select: value is array, filter.values is array
          if (!Array.isArray(value)) return false;
          // Match if any selected value is present in the row's value array
          return value.some(v => filter.values.includes(v));
        }
        return true;
      }
      if (header.type === 'text') {
        if (filter.value !== undefined && filter.value !== '') {
          const strVal = String(value || '');
          const cond = filter.condition || 'equals';
          if (cond === 'equals' && strVal !== filter.value) return false;
          if (cond === 'contains' && !strVal.includes(filter.value)) return false;
          if (cond === 'startsWith' && !strVal.startsWith(filter.value)) return false;
          if (cond === 'endsWith' && !strVal.endsWith(filter.value)) return false;
        }
        return true;
      }
      if (header.type === 'date') {
        // Implement date filtering if needed
        return true;
      }
      // Default: no filter
      return true;
    });
  });
}

FilterModal.propTypes = {
  headers: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string,
      type: PropTypes.string,
      hidden: PropTypes.bool,
      options: PropTypes.array,
    })
  ).isRequired,
  rows: PropTypes.array.isRequired,
  tempData: PropTypes.shape({
    filterValues: PropTypes.object,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
};

export default FilterModal;
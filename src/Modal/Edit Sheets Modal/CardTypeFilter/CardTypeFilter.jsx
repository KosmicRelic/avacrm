import { useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from '../EditSheetsModal.module.css';
import { MainContext } from '../../../Contexts/MainContext';
import useClickOutside from '../../Hooks/UseClickOutside';
import { MdFilterAlt } from 'react-icons/md';

const CardTypeFilter = ({ cardType, headers, tempData, setTempData, showFilterSummary = true }) => {
  const { isDarkTheme, user } = useContext(MainContext);
  const [dateRangeMode, setDateRangeMode] = useState(
    useMemo(() => {
      const initial = {};
      Object.entries(tempData.cardTypeFilters?.[cardType] || {}).forEach(([key, filter]) => {
        if (key !== 'userFilter' && (filter.start || filter.end)) initial[key] = true;
      });
      return initial;
    }, [tempData.cardTypeFilters, cardType])
  );
  const [numberRangeMode, setNumberRangeMode] = useState(
    useMemo(() => {
      const initial = {};
      Object.entries(tempData.cardTypeFilters?.[cardType] || {}).forEach(([key, filter]) => {
        if (key !== 'userFilter' && (filter.start || filter.end)) initial[key] = true;
      });
      return initial;
    }, [tempData.cardTypeFilters, cardType])
  );
  const [activeFilterIndex, setActiveFilterIndex] = useState(null);
  const [showUserFilterForm, setShowUserFilterForm] = useState(false);
  const filterActionsRef = useRef(null);
  const userFilterRef = useRef(null);

  // Initialize filter values for this card type
  useEffect(() => {
    if (!tempData.cardTypeFilters?.[cardType]) {
      setTempData({
        ...tempData,
        cardTypeFilters: { ...tempData.cardTypeFilters, [cardType]: {} },
      });
    }
  }, [tempData, setTempData, cardType]);

  const filterValues = tempData.cardTypeFilters?.[cardType] || {};

  const visibleHeaders = useMemo(
    () =>
      headers
        .filter((header) => !header.hidden)
        .map((header) => ({
          ...header,
          name: header.name || formatHeaderName(header.key),
          type: header.type || 'text',
          options: header.options || [],
        })),
    [headers]
  );

  const formatHeaderName = (key) => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  };

  const updateTempFilters = useCallback(
    (newFilters) => {
      console.debug('Updating cardTypeFilters', { cardType, newFilters });
      setTempData({
        ...tempData,
        cardTypeFilters: {
          ...tempData.cardTypeFilters,
          [cardType]: newFilters,
        },
      });
    },
    [setTempData, tempData, cardType]
  );

  const applyFilters = useCallback(
    (filters) => {
      const cleanedFilters = Object.fromEntries(
        Object.entries(filters)
          .map(([key, filter]) => {
            // Initialize the cleaned filter object
            let cleanedFilter = {};

            if (key === 'userFilter') {
              if (filter.headerKey) {
                cleanedFilter = {
                  headerKey: filter.headerKey,
                  condition: 'equals',
                  value: user.uid, // Set to current user's UID
                };
              }
              return [key, cleanedFilter];
            }

            if (numberRangeMode[key]) {
              cleanedFilter = {
                start: filter.start ? Number(filter.start) : undefined,
                end: filter.end ? Number(filter.end) : undefined,
              };
            } else if (dateRangeMode[key]) {
              cleanedFilter = {
                start: filter.start || undefined,
                end: filter.end || undefined,
              };
            } else if (filter.order && filter.value) {
              cleanedFilter = {
                order: filter.order,
                value: filter.type === 'number' ? Number(filter.value) : filter.value,
              };
            } else if (filter.values?.length) {
              cleanedFilter = { values: filter.values };
            }

            // Only include sortOrder if it has a valid value
            if (filter.sortOrder === 'ascending' || filter.sortOrder === 'descending') {
              cleanedFilter.sortOrder = filter.sortOrder;
            }

            // Return the filter entry only if it has meaningful data
            return [key, Object.keys(cleanedFilter).length > 0 ? cleanedFilter : {}];
          })
          .filter(([_, filter]) => Object.keys(filter).length > 0) // Remove empty filter objects
      );

      updateTempFilters(cleanedFilters);
    },
    [numberRangeMode, dateRangeMode, updateTempFilters, user.uid]
  );

  const handleFilterChange = useCallback(
    (headerKey, value, type = 'default') => {
      const newFilter = { ...filterValues[headerKey], [type]: value };
      if (type === 'start' || type === 'end' || type === 'value') {
        if (value === '') delete newFilter[type];
      }
      const updatedFilters = { ...filterValues, [headerKey]: newFilter };
      applyFilters(updatedFilters);
    },
    [filterValues, applyFilters]
  );

  const handleUserFilterChange = useCallback(
    (headerKey) => {
      const newFilter = {
        headerKey: headerKey || undefined,
        condition: 'equals',
        value: headerKey ? user.uid : undefined, // Set to current user's UID
      };
      const updatedFilters = { ...filterValues, userFilter: headerKey ? newFilter : {} };
      applyFilters(updatedFilters);
    },
    [filterValues, applyFilters, user.uid]
  );

  const handleDropdownChange = useCallback(
    (headerKey, e) => {
      const selectedValues = Array.from(e.target.selectedOptions, (option) => option.value);
      handleFilterChange(headerKey, selectedValues, 'values');
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
            ? { start: filterValues[headerKey]?.start || '', end: filterValues[headerKey]?.end || '' }
            : { value: filterValues[headerKey]?.value || '', order: isDate ? 'on' : 'equals' },
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

  const clearUserFilter = useCallback(() => {
    const updatedFilters = { ...filterValues, userFilter: {} };
    applyFilters(updatedFilters);
    setShowUserFilterForm(false);
  }, [filterValues, applyFilters]);

  const handleReset = useCallback(() => {
    const clearedFilters = {};
    applyFilters(clearedFilters);
    setDateRangeMode({});
    setNumberRangeMode({});
    setActiveFilterIndex(null);
    setShowUserFilterForm(false);
  }, [applyFilters]);

  const isFilterEmpty = (filter) =>
    Object.keys(filter).length === 0 ||
    (!filter.start && !filter.end && !filter.value && !filter.values?.length && !filter.headerKey);

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
          return sortOrder ? `Sorted ${sortOrder}` : 'None';
        case 'dropdown': {
          const values = filter.values || [];
          const sortOrder = filter.sortOrder || '';
          return values.length > 0 ? `${values.join(', ')}${sortOrder ? ` (${sortOrder})` : ''}` : 'None';
        }
        case 'text': {
          const condition = filter.condition || 'equals';
          const value = filter.value || '';
          const sortOrder = filter.sortOrder || '';
          return value ? `${condition} "${value}"${sortOrder ? ` (${sortOrder})` : ''}` : 'None';
        }
        default: {
          const sortOrder = filter.sortOrder || '';
          return filter.value ? `"${filter.value}"${sortOrder ? ` (${sortOrder})` : ''}` : 'None';
        }
      }
    },
    [filterValues, numberRangeMode]
  );

  const userFilterSummary = useMemo(() => {
    const filter = filterValues.userFilter || {};
    if (!filter.headerKey) return 'None';
    const header = visibleHeaders.find((h) => h.key === filter.headerKey);
    return `${header?.name || filter.headerKey} = Current User`;
  }, [filterValues, visibleHeaders]);

  const hasActiveFilters = useMemo(() => {
    return (
      Object.entries(filterValues).some(([key, filter]) => !isFilterEmpty(filter)) ||
      !!filterValues.userFilter?.headerKey
    );
  }, [filterValues]);

  useClickOutside(filterActionsRef, activeFilterIndex !== null, () => setActiveFilterIndex(null));
  useClickOutside(userFilterRef, showUserFilterForm, () => setShowUserFilterForm(false));

  return (
    <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {/* Restrict by User Section */}
      <div
        className={`${styles.filterItem} ${showUserFilterForm ? styles.activeItem : ''} ${
          isDarkTheme ? styles.darkTheme : ''
        }`}
        onClick={() => setShowUserFilterForm((prev) => !prev)}
      >
        <div className={styles.filterRow}>
          <div className={styles.filterNameType}>
            <span>Restrict by User</span>
          </div>
          <div className={styles.primaryButtons}>
            {showFilterSummary ? (
              <span className={styles.filterSummary}>{userFilterSummary}</span>
            ) : (
              <MdFilterAlt
                className={`${styles.filterIcon} ${
                  filterValues.userFilter?.headerKey ? styles.active : ''
                }`}
              />
            )}
          </div>
        </div>
        {showUserFilterForm && (
          <div
            className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}
            ref={userFilterRef}
            onClick={(e) => e.stopPropagation()}
          >
            <select
              value={filterValues.userFilter?.headerKey || ''}
              onChange={(e) => handleUserFilterChange(e.target.value || '')}
              className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
            >
              <option value="">No User Filter</option>
              {visibleHeaders.map((header) => (
                <option key={header.key} value={header.key}>
                  {header.name}
                </option>
              ))}
            </select>
            <button
              onClick={clearUserFilter}
              className={`${styles.clearButton} ${isDarkTheme ? styles.darkTheme : ''}`}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Regular Filters */}
      {visibleHeaders.map((header, index) => (
        <div
          key={header.key}
          className={`${styles.filterItem} ${activeFilterIndex === index ? styles.activeItem : ''} ${
            isDarkTheme ? styles.darkTheme : ''
          }`}
          onClick={() => toggleFilter(index)}
        >
          <div className={styles.filterRow}>
            <div className={styles.filterNameType}>
              <span>{header.name}</span>
            </div>
            <div className={styles.primaryButtons}>
              {showFilterSummary ? (
                <span className={styles.filterSummary}>{getFilterSummary(header)}</span>
              ) : (
                <MdFilterAlt
                  className={`${styles.filterIcon} ${
                    !isFilterEmpty(filterValues[header.key]) ? styles.active : ''
                  }`}
                />
              )}
            </div>
          </div>
          {activeFilterIndex === index && (
            <div
              className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}
              ref={filterActionsRef}
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
                    <span className={styles.separator}>–</span>
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
                    <select
                      value={filterValues[header.key]?.sortOrder || ''}
                      onChange={(e) => handleFilterChange(header.key, e.target.value, 'sortOrder')}
                      className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      <option value="">Sort...</option>
                      <option value="ascending">Ascending</option>
                      <option value="descending">Descending</option>
                    </select>
                  </>
                ) : (
                  <>
                    <select
                      value={filterValues[header.key]?.order || 'equals'}
                      onChange={(e) => handleFilterChange(header.key, e.target.value, 'order')}
                      className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      <option value="equals">=</option>
                      <option value="greater">{'>'}</option>
                      <option value="less">{'<'}</option>
                      <option value="greaterOrEqual">≥</option>
                      <option value="lessOrEqual">≤</option>
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
                    <select
                      value={filterValues[header.key]?.sortOrder || ''}
                      onChange={(e) => handleFilterChange(header.key, e.target.value, 'sortOrder')}
                      className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      <option value="">Sort...</option>
                      <option value="ascending">Ascending</option>
                      <option value="descending">Descending</option>
                    </select>
                  </>
                )
              ) : header.type === 'date' ? (
                <select
                  value={filterValues[header.key]?.sortOrder || ''}
                  onChange={(e) => handleFilterChange(header.key, e.target.value, 'sortOrder')}
                  className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                >
                  <option value="">None</option>
                  <option value="ascending">Ascending</option>
                  <option value="descending">Descending</option>
                </select>
              ) : header.type === 'dropdown' ? (
                <>
                  <select
                    multiple
                    value={filterValues[header.key]?.values || []}
                    onChange={(e) => handleDropdownChange(header.key, e)}
                    className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                  >
                    {header.options.map((option, idx) => (
                      <option key={`${header.key}-option-${idx}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterValues[header.key]?.sortOrder || ''}
                    onChange={(e) => handleFilterChange(header.key, e.target.value, 'sortOrder')}
                    className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                  >
                    <option value="">Sort...</option>
                    <option value="ascending">Ascending</option>
                    <option value="descending">Descending</option>
                  </select>
                </>
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
                    placeholder="Value"
                    className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                  />
                  <select
                    value={filterValues[header.key]?.sortOrder || ''}
                    onChange={(e) => handleFilterChange(header.key, e.target.value, 'sortOrder')}
                    className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                  >
                    <option value="">Sort...</option>
                    <option value="ascending">Ascending</option>
                    <option value="descending">Descending</option>
                  </select>
                </>
              )}
              <button
                onClick={() => clearFilter(header.key)}
                className={`${styles.clearButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      ))}
      <div className={`${styles.footer} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <button
          onClick={handleReset}
          className={`${styles.resetButton} ${isDarkTheme ? styles.darkTheme : ''}`}
          disabled={!hasActiveFilters}
        >
          Reset All
        </button>
      </div>
    </div>
  );
};

CardTypeFilter.propTypes = {
  cardType: PropTypes.string.isRequired,
  headers: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string,
      type: PropTypes.string,
      hidden: PropTypes.bool,
      options: PropTypes.array,
    })
  ).isRequired,
  tempData: PropTypes.shape({
    cardTypeFilters: PropTypes.object,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  showFilterSummary: PropTypes.bool,
};

export default CardTypeFilter;
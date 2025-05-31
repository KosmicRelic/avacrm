import { useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './FilterModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';
import useClickOutside from '../Hooks/UseClickOutside';

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
  const filterActionsRef = useRef(null);
  const hasInitialized = useRef(false);

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

  const filterValues = tempData.filterValues || {};

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
      // console.log('Updating temp filters:', newFilters);
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

  const toggleFilter = useCallback((index) => {
    setActiveFilterIndex((prev) => (prev === index ? null : index));
  }, []);

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

  useClickOutside(filterActionsRef, activeFilterIndex !== null, () => setActiveFilterIndex(null));

  return (
    <>
      <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>
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
                <span className={styles.filterSummary}>{getFilterSummary(header)}</span>
              </div>
            </div>
            {activeFilterIndex === index && (
              <div
                className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}
                ref={filterActionsRef}
                onClick={(e) => e.stopPropagation()}
              >
                {header.key === 'assignedTo' ? (
                  <select
                    multiple
                    value={filterValues[header.key]?.values || []}
                    onChange={(e) => handleDropdownChange(header.key, e)}
                    className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                  >
                    {teamMembers.map((tm) => (
                      <option key={tm.uid} value={tm.uid}>
                        {tm.name && tm.surname ? `${tm.name} ${tm.surname}` : tm.email || tm.uid}
                      </option>
                    ))}
                  </select>
                ) : header.type === 'number' ? (
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
      </div>
      <div className={`${styles.footer} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <button
          onClick={handleReset}
          className={`${styles.resetButton} ${isDarkTheme ? styles.darkTheme : ''}`}
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
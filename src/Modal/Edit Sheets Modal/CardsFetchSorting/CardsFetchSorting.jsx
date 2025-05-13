import { useState, useEffect } from 'react';
import styles from '../EditSheetsModal.module.css';
import { FaRegCircle, FaRegCheckCircle } from 'react-icons/fa';

export default function CardsFetchSorting({ header, onSave, onRemove, isDarkTheme }) {
  const [sortType, setSortType] = useState(header.sortType || 'ascending');
  const [prioritizedValues, setPrioritizedValues] = useState(
    Array.isArray(header.sortOptions) ? header.sortOptions : header.sortOptions?.prioritizedValues || []
  );
  const [dropdownChecked, setDropdownChecked] = useState(() => {
    if (header.type === 'dropdown') {
      const checked = {};
      (header.options || []).forEach(opt => {
        checked[opt] = prioritizedValues.includes(opt);
      });
      return checked;
    }
    return {};
  });
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // For string equal value
  const [stringEqualValue, setStringEqualValue] = useState(header.sortOptions?.equalValue || '');

  // For number/timestamp: show/hide selector
  const [showSortSelector, setShowSortSelector] = useState(false);

  // Update parent immediately on change
  useEffect(() => {
    if (header.type === 'dropdown') {
      // Pass the array directly as sortOptions
      onSave(
        prioritizedValues && prioritizedValues.length > 0
          ? prioritizedValues
          : []
      );
      return;
    }

    // For non-dropdown, keep previous logic
    const sortOptions = {};
    if (header.type === 'string') {
      sortOptions.sortType = 'equal';
      sortOptions.equalValue = stringEqualValue;
    } else if (['number', 'timestamp', 'date'].includes(header.type)) {
      if (sortType === 'equal') {
        sortOptions.equalValue = header.sortOptions?.equalValue || '';
      }
    }

    onSave(sortType === 'equal' ? sortOptions : {});
    // eslint-disable-next-line
  }, [sortType, prioritizedValues, stringEqualValue, dropdownChecked]);

  // Drag-and-drop for dropdown order
  const handleDropdownDragStart = (idx) => {
    setDraggingIdx(idx);
    setDragOverIdx(idx);
  };
  const handleDropdownDragOver = (idx) => {
    if (draggingIdx === null || draggingIdx === idx) return;
    setDragOverIdx(idx);
  };
  const handleDropdownDrop = (idx) => {
    if (draggingIdx === null || draggingIdx === idx) {
      setDraggingIdx(null);
      setDragOverIdx(null);
      return;
    }
    setPrioritizedValues((prev) => {
      const checkedOptions = prev;
      const draggedOption = checkedOptions[draggingIdx];
      const newOrder = [...checkedOptions];
      newOrder.splice(draggingIdx, 1);
      newOrder.splice(idx, 0, draggedOption);
      return newOrder;
    });
    setDraggingIdx(null);
    setDragOverIdx(null);
  };
  const handleDropdownDragEnd = () => {
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  // Toggle check for dropdown
  const handleDropdownCheck = (opt) => {
    setDropdownChecked((prev) => {
      const checked = { ...prev, [opt]: !prev[opt] };
      const checkedOptions = Object.keys(checked).filter((k) => checked[k]);
      setPrioritizedValues((prevOrder) => {
        const newOrder = prevOrder.filter((o) => checked[o]);
        checkedOptions.forEach((o) => {
          if (!newOrder.includes(o)) newOrder.push(o);
        });
        return newOrder;
      });
      return checked;
    });
  };

  return (
    <div className={styles.sortByFiltersContainer + (isDarkTheme ? ' ' + styles.darkTheme : '')}>
      <div className={styles.headerSortTitleRow}>
        <span className={styles.cardTypeName + (isDarkTheme ? ' ' + styles.darkTheme : '')}>
          {header.name || header.key}
        </span>
      </div>
      {/* String header: show input for equal value */}
      {header.type === 'string' ? (
        <div>
          <div className={styles.headerSortSubTitle + (isDarkTheme ? ' ' + styles.darkTheme : '')}>
            Enter value to match:
          </div>
          <input
            type="text"
            value={stringEqualValue}
            onChange={e => setStringEqualValue(e.target.value)}
            className={styles.filterInput + (isDarkTheme ? ' ' + styles.darkTheme : '')}
            placeholder="Enter value"
            style={{ width: '100%', marginTop: 8, marginBottom: 8 }}
          />
        </div>
      ) : (['number', 'timestamp', 'date'].includes(header.type)) ? (
        <div>
          <button
            type="button"
            className={styles.addHeaderButton + (isDarkTheme ? ' ' + styles.darkTheme : '')}
            style={{ marginBottom: 12, width: '100%', textAlign: 'left' }}
            onClick={() => setShowSortSelector(v => !v)}
          >
            {sortType === 'ascending' && 'Ascending'}
            {sortType === 'descending' && 'Descending'}
            {sortType === 'equal' && 'Equal'}
            <span style={{ float: 'right', opacity: 0.6 }}>{showSortSelector ? '▲' : '▼'}</span>
          </button>
          {showSortSelector && (
            <div style={{
              background: isDarkTheme ? '#222' : '#fff',
              border: isDarkTheme ? '1px solid #444' : '1px solid #ddd',
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              marginBottom: 8,
              marginTop: -8,
              zIndex: 10,
              position: 'relative',
              width: '100%',
              maxWidth: 320,
            }}>
              <div
                className={styles.navItem + (isDarkTheme ? ' ' + styles.darkTheme : '')}
                style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none', cursor: 'pointer' }}
                onClick={() => { setSortType('ascending'); setShowSortSelector(false); }}
              >
                Ascending
              </div>
              <div
                className={styles.navItem + (isDarkTheme ? ' ' + styles.darkTheme : '')}
                style={{ borderRadius: 0, borderBottom: 'none', cursor: 'pointer' }}
                onClick={() => { setSortType('descending'); setShowSortSelector(false); }}
              >
                Descending
              </div>
              <div
                className={styles.navItem + (isDarkTheme ? ' ' + styles.darkTheme : '')}
                style={{ borderRadius: '0 0 8px 8px', cursor: 'pointer' }}
                onClick={() => { setSortType('equal'); setShowSortSelector(false); }}
              >
                Equal
              </div>
            </div>
          )}
          {sortType === 'equal' && (
            <input
              type="number"
              value={header.sortOptions?.equalValue || ''}
              onChange={e => {
                onSave({
                  equalValue: e.target.value,
                });
              }}
              className={styles.filterInput + (isDarkTheme ? ' ' + styles.darkTheme : '')}
              placeholder="Enter value"
              style={{ width: '100%', marginTop: 8 }}
            />
          )}
        </div>
      ) : header.type === 'dropdown' ? (
        <>
          <div className={styles.headerSortSubTitle + (isDarkTheme ? ' ' + styles.darkTheme : '')}>
            Select and prioritize options:
          </div>
          <div className={styles.dropdownPrioritizeList + (isDarkTheme ? ' ' + styles.darkTheme : '')}>
            {/* Only render checked options in prioritizedValues, then unchecked options */}
            {prioritizedValues.map((opt, idx) => (
              <div
                key={opt}
                className={
                  styles.dropdownPrioritizeItem +
                  (isDarkTheme ? ' ' + styles.darkTheme : '') +
                  (dropdownChecked[opt] ? ' ' + styles.dropdownPrioritizeItemChecked : '') +
                  (draggingIdx === idx ? ' ' + styles.dragging : '') +
                  (dragOverIdx === idx && draggingIdx !== null && draggingIdx !== idx ? ' ' + styles.dragOver : '')
                }
                draggable={dropdownChecked[opt]}
                onDragStart={() => dropdownChecked[opt] && handleDropdownDragStart(idx)}
                onDragOver={(e) => {
                  if (dropdownChecked[opt] && draggingIdx !== null) {
                    e.preventDefault();
                    handleDropdownDragOver(idx);
                  }
                }}
                onDrop={() => handleDropdownDrop(idx)}
                onDragEnd={handleDropdownDragEnd}
              >
                <button
                  type="button"
                  className={styles.dropdownPrioritizeCheckButton + (isDarkTheme ? ' ' + styles.darkTheme : '')}
                  onClick={() => handleDropdownCheck(opt)}
                  tabIndex={0}
                >
                  <span className={styles.customCheckbox + (isDarkTheme ? ' ' + styles.darkTheme : '')}>
                    <FaRegCheckCircle size={18} className={styles.checked} />
                  </span>
                  <span className={styles.cardTypeName + (isDarkTheme ? ' ' + styles.darkTheme : '')}>{opt}</span>
                </button>
                <span
                  className={styles.dragIcon + (isDarkTheme ? ' ' + styles.darkTheme : '')}
                  style={{ marginLeft: 'auto', cursor: 'grab' }}
                  tabIndex={-1}
                  title="Drag to reorder"
                >
                  ☰
                </span>
              </div>
            ))}
            {/* Render unchecked options below */}
            {(header.options || []).filter(opt => !dropdownChecked[opt]).map((opt) => (
              <div
                key={opt}
                className={
                  styles.dropdownPrioritizeItem +
                  (isDarkTheme ? ' ' + styles.darkTheme : '')
                }
                style={{ opacity: 0.5 }}
              >
                <button
                  type="button"
                  className={styles.dropdownPrioritizeCheckButton + (isDarkTheme ? ' ' + styles.darkTheme : '')}
                  onClick={() => handleDropdownCheck(opt)}
                  tabIndex={0}
                >
                  <span className={styles.customCheckbox + (isDarkTheme ? ' ' + styles.darkTheme : '')}>
                    <FaRegCircle size={18} />
                  </span>
                  <span className={styles.cardTypeName + (isDarkTheme ? ' ' + styles.darkTheme : '')}>{opt}</span>
                </button>
              </div>
            ))}
          </div>
          {prioritizedValues.length > 1 && (
            <div style={{ fontSize: 12, color: isDarkTheme ? '#aaa' : '#888', marginTop: 8 }}>
              Drag the icon to reorder selected options.
            </div>
          )}
        </>
      ) : (
        <div style={{ color: '#888' }}>No sort options for this header type.</div>
      )}
      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button
          className={styles.removePrioritizedHeaderButton + (isDarkTheme ? ' ' + styles.darkTheme : '')}
          onClick={onRemove}
          type="button"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
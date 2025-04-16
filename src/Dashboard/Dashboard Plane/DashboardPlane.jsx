// src/components/DashboardPlane/DashboardPlane.jsx
import React, { useContext, useState, useEffect, useRef } from 'react';
import styles from './DashboardPlane.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { FaPlus } from 'react-icons/fa';
import useLongPress from './useLongPress';

const Window = ({ size, children, className = '', style, onDelete, editMode }) => {
  const { isDarkTheme } = useContext(MainContext);

  const sizeClasses = {
    verySmall: styles.verySmallWindow,
    small: styles.smallWindow,
    medium: styles.mediumWindow,
    big: styles.bigWindow,
  };

  return (
    <div
      className={`${sizeClasses[size] || styles.smallWindow} ${className} ${isDarkTheme ? styles.darkTheme : ''} ${
        editMode ? styles.editMode : ''
      }`}
      style={style}
    >
      <div className={styles.windowContent}>
        {children}
        {editMode && (
          <button className={styles.removeButton} onClick={onDelete}>
            ×
          </button>
        )}
      </div>
    </div>
  );
};

const DashboardPlane = ({ initialWidgets = [] }) => {
  const { isDarkTheme } = useContext(MainContext);
  const [windows, setWindows] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const planeRef = useRef(null);

  const gridRef = useRef({
    columns: 2,
    rows: 4,
    occupied: Array(4).fill().map(() => Array(2).fill(false)),
  });

  const windowSizes = {
    verySmall: { width: 1, height: 1 },
    small: { width: 1, height: 2 },
    medium: { width: 2, height: 2 },
    big: { width: 2, height: 4 },
  };

  const windowScores = {
    verySmall: 12.5,
    small: 25,
    medium: 50,
    big: 100,
  };

  const sizeMap = {
    tiny: 'verySmall',
    small: 'small',
    medium: 'medium',
    large: 'big',
  };

  const calculateScore = (windows) => {
    return windows.reduce((sum, w) => sum + (windowScores[w.size] || 0), 0);
  };

  const canPlaceWindow = (size, row, col, skipIndex = null) => {
    const { width, height } = windowSizes[size];
    if (row < 0 || col < 0 || row + height > gridRef.current.rows || col + width > gridRef.current.columns) {
      return false;
    }

    const currentScore = calculateScore(windows.filter((_, idx) => idx !== skipIndex));
    const newScore = currentScore + windowScores[size];
    if (newScore > 100) {
      return false;
    }

    const occupied = gridRef.current.occupied.map(row => [...row]);
    if (skipIndex !== null) {
      const skippedWindow = windows[skipIndex];
      const { width: sWidth, height: sHeight } = windowSizes[skippedWindow.size];
      for (let r = skippedWindow.position.row; r < skippedWindow.position.row + sHeight; r++) {
        for (let c = skippedWindow.position.col; c < skippedWindow.position.col + sWidth; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) {
            occupied[r][c] = false;
          }
        }
      }
    }

    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        if (r >= 4 || c >= 2 || occupied[r][c]) {
          return false;
        }
      }
    }

    return true;
  };

  const findPositionForWindow = (size, skipIndex = null) => {
    for (let row = 0; row <= gridRef.current.rows - windowSizes[size].height; row++) {
      for (let col = 0; col <= gridRef.current.columns - windowSizes[size].width; col++) {
        if (canPlaceWindow(size, row, col, skipIndex)) {
          return { row, col };
        }
      }
    }
    return null;
  };

  const addWindow = (size, content) => {
    const position = findPositionForWindow(size);
    if (!position) {
      alert(`Cannot add ${size} window: No space or exceeds score`);
      return;
    }

    const newWindow = { size, content, position };
    setWindows((prev) => {
      const updatedWindows = [...prev, newWindow];
      const { width, height } = windowSizes[size];
      for (let r = position.row; r < position.row + height; r++) {
        for (let c = position.col; c < position.col + width; c++) {
          gridRef.current.occupied[r][c] = true;
        }
      }
      return updatedWindows;
    });
  };

  const removeWindow = (index) => {
    setWindows((prev) => {
      const windowToRemove = prev[index];
      const { size } = windowToRemove;
      const { width, height } = windowSizes[size];
      const { row, col } = windowToRemove.position;
      for (let r = row; r < row + height; r++) {
        for (let c = col; c < col + width; c++) {
          gridRef.current.occupied[r][c] = false;
        }
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Initialize windows from initialWidgets
  useEffect(() => {
    gridRef.current.occupied = Array(4).fill().map(() => Array(2).fill(false));
    let newWindows = [];
    let currentScore = 0;

    initialWidgets.forEach((widget) => {
      const size = sizeMap[widget.size] || 'small';
      const score = windowScores[size];

      if (currentScore + score > 100) {
        console.warn(`Skipping widget ${widget.title}: Exceeds score limit`);
        return;
      }

      const position = findPositionForWindow(size);
      if (!position) {
        console.warn(`Skipping widget ${widget.title}: No space available`);
        return;
      }

      newWindows.push({
        size,
        content: (
          <div className={styles.widgetWrapper}>
            <h3 className={`${styles.widgetTitle} ${isDarkTheme?styles.darkTheme:""}`}>{widget.title}</h3>
            <div className={`${styles.widgetData} ${isDarkTheme?styles.darkTheme:""}`}>{widget.data}</div>
          </div>
        ),
        position,
      });

      const { width, height } = windowSizes[size];
      for (let r = position.row; r < position.row + height; r++) {
        for (let c = position.col; c < position.col + width; c++) {
          gridRef.current.occupied[r][c] = true;
        }
      }

      currentScore += score;
    });

    setWindows(newWindows);
  }, [initialWidgets]);

  const longPressEvents = useLongPress(() => {
    setEditMode(true);
    document.dispatchEvent(new CustomEvent('exitEditMode', { detail: { planeRef } }));
  }, 500);

  useEffect(() => {
    const handleExitEditMode = (event) => {
      if (event.detail.planeRef !== planeRef && editMode) {
        setEditMode(false);
      }
    };

    document.addEventListener('exitEditMode', handleExitEditMode);
    return () => document.removeEventListener('exitEditMode', handleExitEditMode);
  }, [editMode]);

  return (
    <div
      className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ''} ${editMode ? styles.editModeContainer : ''}`}
      ref={planeRef}
      {...longPressEvents}
    >
      {editMode && (
        <div className={styles.controls}>
          <button className={styles.doneButton} onClick={() => setEditMode(false)}>
            Done
          </button>
          <button
            className={styles.addButton}
            onClick={() => addWindow('verySmall', (
              <div className={styles.widgetWrapper}>
                <h3 className={styles.widgetTitle}>New Widget</h3>
                <div className={styles.widgetData}>Add content</div>
              </div>
            ))}
          >
            <FaPlus /> Very Small
          </button>
          <button
            className={styles.addButton}
            onClick={() => addWindow('small', (
              <div className={styles.widgetWrapper}>
                <h3 className={styles.widgetTitle}>New Widget</h3>
                <div className={styles.widgetData}>Add content</div>
              </div>
            ))}
          >
            <FaPlus /> Small
          </button>
          <button
            className={styles.addButton}
            onClick={() => addWindow('medium', (
              <div className={styles.widgetWrapper}>
                <h3 className={styles.widgetTitle}>New Widget</h3>
                <div className={styles.widgetData}>Add content</div>
              </div>
            ))}
          >
            <FaPlus /> Medium
          </button>
          <button
            className={styles.addButton}
            onClick={() => addWindow('big', (
              <div className={styles.widgetWrapper}>
                <h3 className={styles.widgetTitle}>New Widget</h3>
                <div className={styles.widgetData}>Add content</div>
              </div>
            ))}
          >
            <FaPlus /> Big
          </button>
        </div>
      )}

      <div className={`${styles.dashboardWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
        {windows.map((window, index) => (
          <Window
            key={index}
            size={window.size}
            style={{
              gridRow: `${window.position.row + 1} / span ${windowSizes[window.size].height}`,
              gridColumn: `${window.position.col + 1} / span ${windowSizes[window.size].width}`,
            }}
            onDelete={() => removeWindow(index)}
            editMode={editMode}
          >
            {window.content}
          </Window>
        ))}
      </div>
    </div>
  );
};

export default DashboardPlane;
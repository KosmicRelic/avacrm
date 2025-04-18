import React, { useContext, useState, useEffect, useRef } from 'react';
import styles from './DashboardPlane.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { FaCircleMinus } from 'react-icons/fa6';

const Window = ({ size, widget, style, onDelete, editMode, onDragStart, dashboardId, index }) => {
  const { isDarkTheme } = useContext(MainContext);

  const sizeClasses = {
    verySmall: styles.verySmallWindow,
    small: styles.smallWindow,
    medium: styles.mediumWindow,
    large: styles.largeWindow,
  };

  return (
    <div
      className={`${sizeClasses[size] || styles.smallWindow} ${isDarkTheme ? styles.darkTheme : ''} ${
        editMode ? styles.editMode : ''
      }`}
      style={style}
      draggable={editMode}
      onDragStart={(e) => {
        if (editMode) {
          onDragStart(e, { dashboardId, index, widget, size, position: { row: style.gridRowStart - 1, col: style.gridColumnStart - 1 } });
        }
      }}
      onDragEnd={(e) => {
        e.target.classList.remove(styles.dragging);
      }}
    >
      <div className={styles.windowContent}>
        <div className={styles.widgetWrapper}>
          <h3 className={`${styles.widgetTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
            {widget.title}
          </h3>
          <div className={`${styles.widgetData} ${isDarkTheme ? styles.darkTheme : ''}`}>
            {widget.data || 'No data'}
          </div>
        </div>
        {editMode && (
          <button className={styles.removeButton} onClick={onDelete}>
            <FaCircleMinus />
          </button>
        )}
      </div>
    </div>
  );
};

const DashboardPlane = ({
  dashboardId,
  initialWidgets = [],
  editMode,
  updateWidgets,
  onDragStart,
  onDrop,
}) => {
  const { isDarkTheme } = useContext(MainContext);
  const [windows, setWindows] = useState([]);
  const planeRef = useRef(null);
  const prevWidgetsRef = useRef(null);

  const gridRef = useRef({
    columns: 2,
    rows: 4,
    occupied: Array(4).fill().map(() => Array(2).fill(false)),
  });

  const windowSizes = {
    verySmall: { width: 1, height: 1 },
    small: { width: 1, height: 2 },
    medium: { width: 2, height: 2 },
    large: { width: 2, height: 4 },
  };

  const windowScores = {
    verySmall: 10,
    small: 20,
    medium: 40,
    large: 80,
  };

  const sizeMap = {
    tiny: 'verySmall',
    verySmall: 'verySmall',
    small: 'small',
    medium: 'medium',
    large: 'large',
  };

  const calculateScore = (windows) => {
    const score = windows.reduce((sum, w) => (windowScores[w.size] || 0) + sum, 0);
    console.log(`Calculated score: ${score}, widgets:`, windows.map(w => ({ id: w.originalWidget.id, size: w.size })));
    return score;
  };

  const canPlaceWindow = (size, row, col, skipWidgets = [], customGrid = null, currentWindows = windows) => {
    const { width, height } = windowSizes[size] || windowSizes.small;
    if (row < 0 || col < 0 || row + height > gridRef.current.rows || col + width > gridRef.current.columns) {
      console.log(`Cannot place window: Invalid position row=${row}, col=${col}, size=${size}`);
      return false;
    }

    if (size === 'small' && row % 2 !== 0) return false;
    if (size === 'medium' && (row !== 0 && row !== 2)) return false;
    if (size === 'large' && (row !== 0 || col !== 0)) return false;

    const occupied = customGrid
      ? customGrid.map((row) => [...row])
      : gridRef.current.occupied.map((row) => [...row]);

    currentWindows.forEach((win) => {
      if (skipWidgets.some((sw) => sw.id === win.originalWidget.id)) return;
      const { width: wWidth, height: wHeight } = windowSizes[win.size] || windowSizes.small;
      for (let r = win.position.row; r < win.position.row + wHeight; r++) {
        for (let c = win.position.col; c < win.position.col + wWidth; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) {
            occupied[r][c] = true;
          }
        }
      }
    });

    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        if (r >= 4 || c >= 2 || occupied[r][c]) {
          console.log(`Cannot place window: Position row=${r}, col=${c} is occupied or out of bounds`);
          return false;
        }
      }
    }
    return true;
  };

  const getValidPosition = (size, row, col) => {
    switch (size) {
      case 'verySmall':
        return { row, col };
      case 'small':
        return { row: row <= 1 ? 0 : 2, col };
      case 'medium':
        return { row: row <= 1 ? 0 : 2, col: 0 };
      case 'large':
        return { row: 0, col: 0 };
      default:
        console.warn(`Invalid size: ${size}, defaulting to small`);
        return { row: row <= 1 ? 0 : 2, col };
    }
  };

  const findFreePosition = (size, skipWidgets = [], customGrid = null, currentWindows = []) => {
    const possiblePositions = [];
    if (size === 'verySmall') {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 2; c++) {
          possiblePositions.push({ row: r, col: c });
        }
      }
    } else if (size === 'small') {
      possiblePositions.push(
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 2, col: 0 },
        { row: 2, col: 1 }
      );
    } else if (size === 'medium') {
      possiblePositions.push(
        { row: 0, col: 0 },
        { row: 2, col: 0 }
      );
    } else if (size === 'large') {
      possiblePositions.push({ row: 0, col: 0 });
    }

    for (const pos of possiblePositions) {
      if (canPlaceWindow(size, pos.row, pos.col, skipWidgets, customGrid, currentWindows)) {
        return pos;
      }
    }
    console.log(`No free position found for size=${size}`);
    return null;
  };

  const removeWindow = (index) => {
    setWindows((prev) => {
      const windowToRemove = prev[index];
      if (!windowToRemove) {
        console.log(`Window index ${index} not found for removal`);
        return prev;
      }
      const { size, position } = windowToRemove;
      const { width, height } = windowSizes[size] || windowSizes.small;
      for (let r = position.row; r < position.row + height; r++) {
        for (let c = position.col; c < position.col + width; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) {
            gridRef.current.occupied[r][c] = false;
          }
        }
      }
      const newWindows = prev.filter((_, i) => i !== index);
      console.log(`Removed window index ${index} (${windowToRemove.originalWidget.id}) from dashboard ${dashboardId}`);
      updateWidgets(dashboardId, newWindows.map((win) => ({ ...win.originalWidget, position: win.position })));
      return newWindows;
    });
  };

  const areWidgetsEqual = (prev, next) => {
    if (!prev || prev.length !== next.length) return false;
    return prev.every((p, i) => {
      const n = next[i];
      return (
        p.id === n.id &&
        p.size === n.size &&
        p.title === n.title &&
        p.data === n.data &&
        p.section === n.section &&
        JSON.stringify(p.position || {}) === JSON.stringify(n.position || {})
      );
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    planeRef.current.classList.add(styles.dropTarget);
  };

  const handleDragLeave = () => {
    planeRef.current.classList.remove(styles.dropTarget);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    planeRef.current.classList.remove(styles.dropTarget);
    const clientX = e.clientX;
    const clientY = e.clientY;
    const rect = planeRef.current.getBoundingClientRect();
    const cellWidth = rect.width / 2;
    const cellHeight = rect.height / 4;
    const col = Math.floor((clientX - rect.left) / cellWidth);
    const row = Math.floor((clientY - rect.top) / cellHeight);

    if (row >= 0 && row < 4 && col >= 0 && col < 2) {
      onDrop({ dashboardId, row, col });
    } else {
      console.log(`Invalid drop position: row=${row}, col=${col}`);
    }
  };

  useEffect(() => {
    if (areWidgetsEqual(prevWidgetsRef.current, initialWidgets)) {
      console.log(`Dashboard ${dashboardId}: Widgets unchanged, skipping initialization`);
      return;
    }

    console.log(`Dashboard ${dashboardId}: Initializing widgets`, initialWidgets);
    gridRef.current.occupied = Array(4).fill().map(() => Array(2).fill(false));
    let newWindows = [];
    let tempGrid = Array(4).fill().map(() => Array(2).fill(false));

    // Remove duplicates by ID, keeping the last occurrence
    const uniqueWidgets = [];
    const seenIds = new Set();
    const discardedWidgets = [];
    for (const widget of initialWidgets.reverse()) {
      if (!seenIds.has(widget.id)) {
        uniqueWidgets.push(widget);
        seenIds.add(widget.id);
      } else {
        console.warn(`Duplicate widget ID ${widget.id} detected in initialWidgets, keeping last occurrence`);
        discardedWidgets.push(widget);
      }
    }
    uniqueWidgets.reverse();

    if (discardedWidgets.length > 0) {
      console.log(`Discarded duplicate widgets:`, discardedWidgets.map(w => ({ id: w.id, size: w.size })));
    }

    const sortedWidgets = [...uniqueWidgets].sort((a, b) => {
      const sizeA = sizeMap[a.size] || 'small';
      const sizeB = sizeMap[b.size] || 'small';
      return windowScores[sizeB] - windowScores[sizeA];
    });

    try {
      sortedWidgets.forEach((widget) => {
        const size = sizeMap[widget.size] || 'small';
        if (!windowScores[size]) {
          console.warn(`Dashboard ${dashboardId}: Invalid widget size "${size}" for widget ${widget.id}, skipping`);
          return;
        }
        const currentScore = calculateScore(newWindows);
        console.log(
          `Dashboard ${dashboardId}: Processing widget ${widget.id}, size: ${size}, current score: ${currentScore}`
        );
        if (currentScore + windowScores[size] > 80) {
          console.log(`Dashboard ${dashboardId}: Skipping widget ${widget.id}: score limit exceeded`);
          return;
        }

        let position;
        if (
          widget.position &&
          typeof widget.position.row !== 'undefined' &&
          typeof widget.position.col !== 'undefined' &&
          canPlaceWindow(size, widget.position.row, widget.position.col, [], tempGrid, newWindows)
        ) {
          position = widget.position;
          console.log(`Dashboard ${dashboardId}: Using predefined position for widget ${widget.id}`, position);
        } else {
          position = findFreePosition(size, [], tempGrid, newWindows);
          if (!position) {
            console.log(`Dashboard ${dashboardId}: No valid position found for widget ${widget.id}`);
            return;
          }
          console.log(`Dashboard ${dashboardId}: Assigned new position for widget ${widget.id}`, position);
        }

        newWindows.push({ originalWidget: widget, size, position });
        const { width, height } = windowSizes[size] || windowSizes.small;
        for (let r = position.row; r < position.row + height; r++) {
          for (let c = position.col; c < position.col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) {
              tempGrid[r][c] = true;
            }
          }
        }
      });

      console.log(`Dashboard ${dashboardId}: Initialized ${newWindows.length} widgets`, newWindows.map(w => ({ id: w.originalWidget.id, size: w.size, position: w.position })));
      setWindows(newWindows);
      gridRef.current.occupied = tempGrid;
      prevWidgetsRef.current = uniqueWidgets;
      updateWidgets(dashboardId, newWindows.map((win) => ({ ...win.originalWidget, position: win.position })));
    } catch (error) {
      console.error(`Dashboard ${dashboardId}: Error initializing widgets`, error);
    }
  }, [initialWidgets, dashboardId, updateWidgets]);

  return (
    <div
      className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ''} ${
        editMode ? styles.editModeContainer : ''
      } ${windows.length === 0 ? styles.empty : ''}`}
      ref={planeRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`${styles.dashboardWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
        {Array.from({ length: 4 }).map((_, row) =>
          Array.from({ length: 2 }).map((_, col) => (
            <div
              key={`${dashboardId}-grid-${row}-${col}`}
              className={`${styles.gridCell} ${editMode ? styles.gridCellEditable : ''}`}
              style={{
                gridRow: row + 1,
                gridColumn: col + 1,
              }}
            />
          ))
        )}
        {windows.map((window, index) => (
          <Window
            key={`${dashboardId}-${window.originalWidget.id}-${index}`}
            size={window.size}
            widget={window.originalWidget}
            style={{
              gridRow: `${window.position.row + 1} / span ${(windowSizes[window.size] || windowSizes.small).height}`,
              gridColumn: `${window.position.col + 1} / span ${(windowSizes[window.size] || windowSizes.small).width}`,
            }}
            onDelete={() => removeWindow(index)}
            editMode={editMode}
            onDragStart={onDragStart}
            dashboardId={dashboardId}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

export default DashboardPlane;
import React, { useContext, useState, useEffect, useRef } from 'react';
import styles from './DashboardPlane.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { FaCircleMinus } from 'react-icons/fa6';

const Window = ({ size, widget, style, onDelete, editMode, onDragStart, dashboardId, index, isAnimating, animationTransform }) => {
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
      } ${isAnimating ? styles.animating : ''}`}
      style={{
        ...style,
        transform: animationTransform || 'none',
        transition: editMode && !isAnimating ? 'none' : 'transform 0.3s ease, opacity 0.2s ease',
      }}
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
            <FaCircleMinus size={20} />
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
  const [validDropCells, setValidDropCells] = useState([]);
  const [animatingWidgets, setAnimatingWidgets] = useState(new Set());
  const planeRef = useRef(null);
  const prevWidgetsRef = useRef(null);
  const prevPositionsRef = useRef({});

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
    return windows.reduce((sum, w) => (windowScores[w.size] || 0) + sum, 0);
  };

  const canPlaceWindow = (size, row, col, skipWidgets = [], customGrid = null, currentWindows = windows) => {
    const { width, height } = windowSizes[size] || windowSizes.small;
    if (row < 0 || col < 0 || row + height > gridRef.current.rows || col + width > gridRef.current.columns) {
      return false;
    }

    if (size === 'small' && row % 2 !== 0) {
      return false;
    }
    if (size === 'medium' && (row !== 0 && row !== 2)) {
      return false;
    }
    if (size === 'large' && (row !== 0 || col !== 0)) {
      return false;
    }

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
    return null;
  };

  const updateValidDropCells = (widgetInfo) => {
    if (!widgetInfo || !editMode) {
      setValidDropCells([]);
      return;
    }

    const { size, dashboardId: sourceDashboardId, widget } = widgetInfo;
    const skipWidgets = sourceDashboardId === dashboardId ? [widget] : [];
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

    const validCells = possiblePositions.filter((pos) =>
      canPlaceWindow(size, pos.row, pos.col, skipWidgets, null, windows)
    );
    setValidDropCells(validCells);
  };

  const removeWindow = (index) => {
    setWindows((prev) => {
      const windowToRemove = prev[index];
      if (!windowToRemove) {
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
    try {
      const widgetInfo = JSON.parse(e.dataTransfer.getData('text/plain'));
      updateValidDropCells(widgetInfo);
    } catch (error) {
      setValidDropCells([]);
    }
  };

  const handleDragLeave = () => {
    setValidDropCells([]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setValidDropCells([]);
    const clientX = e.clientX;
    const clientY = e.clientY;
    const rect = planeRef.current.getBoundingClientRect();
    const cellWidth = rect.width / 2;
    const cellHeight = rect.height / 4;
    const col = Math.floor((clientX - rect.left) / cellWidth);
    const row = Math.floor((clientY - rect.top) / cellHeight);

    if (row >= 0 && row < 4 && col >= 0 && col < 2) {
      onDrop({ dashboardId, row, col });
    }
  };

  useEffect(() => {
    if (areWidgetsEqual(prevWidgetsRef.current, initialWidgets)) {
      return;
    }

    gridRef.current.occupied = Array(4).fill().map(() => Array(2).fill(false));
    let newWindows = [];
    let tempGrid = Array(4).fill().map(() => Array(2).fill(false));
    const newAnimatingWidgets = new Set();

    const uniqueWidgets = [];
    const seenIds = new Set();
    for (const widget of initialWidgets.reverse()) {
      if (!seenIds.has(widget.id)) {
        uniqueWidgets.push(widget);
        seenIds.add(widget.id);
      }
    }
    uniqueWidgets.reverse();

    const sortedWidgets = [...uniqueWidgets].sort((a, b) => {
      const sizeA = sizeMap[a.size] || 'small';
      const sizeB = sizeMap[b.size] || 'small';
      return windowScores[sizeB] - windowScores[sizeA];
    });

    try {
      sortedWidgets.forEach((widget) => {
        const size = sizeMap[widget.size] || 'small';
        if (!windowScores[size]) {
          return;
        }
        const currentScore = calculateScore(newWindows);
        if (currentScore + windowScores[size] > 80) {
          return;
        }

        let position;
        if (
          widget.position &&
          typeof widget.position.row !== 'undefined' &&
          typeof widget.position.col !== 'undefined' &&
          !isNaN(widget.position.row) &&
          !isNaN(widget.position.col) &&
          canPlaceWindow(size, widget.position.row, widget.position.col, [], tempGrid, newWindows)
        ) {
          position = widget.position;
        } else {
          position = findFreePosition(size, [], tempGrid, newWindows) || { row: 0, col: 0 };
        }

        const prevPos = prevPositionsRef.current[widget.id];
        if (prevPos && (prevPos.row !== position.row || prevPos.col !== position.col)) {
          newAnimatingWidgets.add(widget.id);
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

      setWindows(newWindows);
      setAnimatingWidgets(newAnimatingWidgets);
      gridRef.current.occupied = tempGrid;
      prevWidgetsRef.current = uniqueWidgets;
      updateWidgets(dashboardId, newWindows.map((win) => ({ ...win.originalWidget, position: win.position })));

      const newPositions = {};
      newWindows.forEach((win) => {
        newPositions[win.originalWidget.id] = win.position;
      });
      prevPositionsRef.current = newPositions;

      if (newAnimatingWidgets.size > 0) {
        setTimeout(() => {
          setAnimatingWidgets(new Set());
        }, 300);
      }
    } catch (error) {
      // Handle error silently
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
              className={`${styles.gridCell} ${
                editMode && validDropCells.some((pos) => pos.row === row && pos.col === col)
                  ? styles.validDropCell
                  : ''
              }`}
              style={{
                gridRow: row + 1,
                gridColumn: col + 1,
              }}
            />
          ))
        )}
        {windows.map((window, index) => {
          const { size, position, originalWidget } = window;
          if (!position || isNaN(position.row) || isNaN(position.col)) {
            return null;
          }

          let animationTransform = null;
          if (animatingWidgets.has(originalWidget.id)) {
            const prevPos = prevPositionsRef.current[originalWidget.id];
            if (prevPos) {
              const deltaX = (prevPos.col - position.col) * 50;
              const deltaY = (prevPos.row - position.row) * 50;
              animationTransform = `translate(${deltaX}%, ${deltaY}%)`;
            }
          }

          return (
            <Window
              key={`${dashboardId}-${originalWidget.id}-${index}`}
              size={size}
              widget={originalWidget}
              style={{
                gridRow: `${position.row + 1} / span ${(windowSizes[size] || windowSizes.small).height}`,
                gridColumn: `${position.col + 1} / span ${(windowSizes[size] || windowSizes.small).width}`,
                gridRowStart: position.row + 1,
                gridColumnStart: position.col + 1,
              }}
              onDelete={() => removeWindow(index)}
              editMode={editMode}
              onDragStart={onDragStart}
              dashboardId={dashboardId}
              index={index}
              isAnimating={animatingWidgets.has(originalWidget.id)}
              animationTransform={animationTransform}
            />
          );
        }).filter(Boolean)}
      </div>
    </div>
  );
};

export default DashboardPlane;
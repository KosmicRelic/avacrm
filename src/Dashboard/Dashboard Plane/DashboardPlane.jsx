import React, { useContext, useState, useEffect, useRef } from 'react';
import styles from './DashboardPlane.module.css';
import { MainContext } from '../../Contexts/MainContext';

const Window = ({ size, widget, style, onDelete, editMode, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) => {
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
          <div className={styles.editControls}>
            <button className={styles.removeButton} onClick={onDelete}>
              ×
            </button>
            <div className={styles.moveButtons}>
              <button
                className={styles.moveButton}
                onClick={onMoveUp}
                disabled={!canMoveUp}
                title="Move Up"
              >
                ↑
              </button>
              <button
                className={styles.moveButton}
                onClick={onMoveDown}
                disabled={!canMoveDown}
                title="Move Down"
              >
                ↓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DashboardPlane = ({
  dashboardId,
  initialWidgets = [],
  editMode,
  isSelected,
  onSelect,
  updateWidgets,
  getDashboardWidgets,
  dashboards,
  dashboardIndex,
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
    const score = windows.reduce((sum, w) => {
      const score = windowScores[w.size] || 0;
      console.log(`Window ${w.originalWidget?.id || 'unknown'}, size: ${w.size}, score: ${score}`);
      return sum + score;
    }, 0);
    console.log(`Total score: ${score}`);
    return score;
  };

  const canPlaceWindow = (size, row, col, skipIndices = [], customGrid = null, currentWindows = windows) => {
    console.log(`Checking if window of size ${size} can be placed at row: ${row}, col: ${col}, skipIndices: ${skipIndices}`);
    const { width, height } = windowSizes[size] || windowSizes.small;
    if (row < 0 || col < 0 || row + height > gridRef.current.rows || col + width > gridRef.current.columns) {
      console.log('Placement out of bounds');
      return false;
    }

    const occupied = customGrid
      ? customGrid.map((row) => [...row])
      : gridRef.current.occupied.map((row) => [...row]);

    skipIndices.forEach((skipIndex) => {
      const skippedWindow = currentWindows[skipIndex];
      if (!skippedWindow) return;
      const { width: sWidth, height: sHeight } = windowSizes[skippedWindow.size] || windowSizes.small;
      for (let r = skippedWindow.position.row; r < skippedWindow.position.row + sHeight; r++) {
        for (let c = skippedWindow.position.col; c < skippedWindow.position.col + sWidth; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) {
            occupied[r][c] = false;
          }
        }
      }
    });

    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        if (r >= 4 || c >= 2 || occupied[r][c]) {
          console.log(`Position blocked at row: ${r}, col: ${c}`);
          return false;
        }
      }
    }
    console.log('Placement valid');
    return true;
  };

  const findPositionForWindow = (size, skipIndices = [], customGrid = null, currentWindows = windows) => {
    console.log(`Finding position for window of size ${size}, skipIndices: ${skipIndices}`);
    for (let row = 0; row <= gridRef.current.rows - (windowSizes[size]?.height || 2); row++) {
      for (let col = 0; col <= gridRef.current.columns - (windowSizes[size]?.width || 1); col++) {
        if (canPlaceWindow(size, row, col, skipIndices, customGrid, currentWindows)) {
          console.log(`Found position at row: ${row}, col: ${col}`);
          return { row, col };
        }
      }
    }
    console.log('No valid position found');
    return null;
  };

  const removeWindow = (index) => {
    console.log(`Removing window at index ${index} from dashboard ${dashboardId}`);
    setWindows((prev) => {
      const windowToRemove = prev[index];
      if (!windowToRemove) return prev;
      const { size } = windowToRemove;
      const { width, height } = windowSizes[size] || windowSizes.small;
      const { row, col } = windowToRemove.position;
      for (let r = row; r < row + height; r++) {
        for (let c = col; c < col + width; c++) {
          gridRef.current.occupied[r][c] = false;
        }
      }
      const newWindows = prev.filter((_, i) => i !== index);
      updateWidgets(dashboardId, newWindows.map((win) => win.originalWidget));
      return newWindows;
    });
  };

  const moveWindow = (index, direction) => {
    console.log(`Moving window at index ${index} ${direction} in dashboard ${dashboardId}`);
    const currentDashboard = dashboards.find((d) => d.id === dashboardId);
    const currentDashboardIndex = dashboards.findIndex((d) => d.id === dashboardId);

    if (!currentDashboard) {
      console.log(`Dashboard ${dashboardId} not found`);
      return;
    }

    // Intra-dashboard movement
    if (
      (direction === 'up' && index > 0) ||
      (direction === 'down' && index < windows.length - 1)
    ) {
      setWindows((prev) => {
        const newWindows = [...prev];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // Swap positions
        [newWindows[index], newWindows[targetIndex]] = [newWindows[targetIndex], newWindows[index]];

        // Reset grid
        gridRef.current.occupied = Array(4).fill().map(() => Array(2).fill(false));

        // Reassign positions
        const repositionedWindows = newWindows.map((win) => {
          const size = sizeMap[win.originalWidget.size] || win.size || 'small';
          const position = findPositionForWindow(size, [], gridRef.current.occupied, newWindows) || { row: 0, col: 0 };
          const { width, height } = windowSizes[size] || windowSizes.small;
          for (let r = position.row; r < position.row + height; r++) {
            for (let c = position.col; c < position.col + width; c++) {
              if (r >= 0 && r < 4 && c >= 0 && c < 2) {
                gridRef.current.occupied[r][c] = true;
              }
            }
          }
          return { ...win, position };
        });

        updateWidgets(dashboardId, repositionedWindows.map((win) => ({
          ...win.originalWidget,
          position: win.position,
        })));
        return repositionedWindows;
      });
    }
    // Cross-dashboard movement
    else if (
      (direction === 'up' && index === 0 && currentDashboardIndex > 0) ||
      (direction === 'down' && index === windows.length - 1 && currentDashboardIndex < dashboards.length - 1)
    ) {
      const targetDashboardIndex = direction === 'up' ? currentDashboardIndex - 1 : currentDashboardIndex + 1;
      const targetDashboard = dashboards[targetDashboardIndex];
      const widgetToMove = windows[index];

      if (!widgetToMove || !targetDashboard) {
        console.log(`Cannot move: widget or target dashboard not found`);
        return;
      }

      const widgetScore = windowScores[widgetToMove.size] || 0;
      const targetWidgets = getDashboardWidgets(targetDashboard.id);
      const targetCurrentScore = targetWidgets.reduce((sum, w) => sum + (windowScores[w.size] || 0), 0);

      if (targetCurrentScore + widgetScore > 80) {
        console.log(`Cannot move widget to dashboard ${targetDashboard.id}: score limit exceeded`);
        alert(`Cannot move widget: Dashboard ${targetDashboard.id} score limit reached`);
        return;
      }

      setWindows((prev) => {
        // Remove widget from current dashboard
        const newCurrentWindows = prev.filter((_, i) => i !== index);
        const newCurrentWidgets = newCurrentWindows.map((win) => win.originalWidget);

        // Reset current dashboard grid
        gridRef.current.occupied = Array(4).fill().map(() => Array(2).fill(false));

        // Reassign positions for current dashboard
        const repositionedCurrentWindows = newCurrentWindows.map((win) => {
          const size = sizeMap[win.originalWidget.size] || win.size || 'small';
          const position = findPositionForWindow(size, [], gridRef.current.occupied, newCurrentWindows) || { row: 0, col: 0 };
          const { width, height } = windowSizes[size] || windowSizes.small;
          for (let r = position.row; r < position.row + height; r++) {
            for (let c = position.col; c < position.col + width; c++) {
              if (r >= 0 && r < 4 && c >= 0 && c < 2) {
                gridRef.current.occupied[r][c] = true;
              }
            }
          }
          return { ...win, position };
        });

        // Update current dashboard
        updateWidgets(dashboardId, repositionedCurrentWindows.map((win) => ({
          ...win.originalWidget,
          position: win.position,
        })));

        // Add widget to target dashboard
        const targetWidgetsUpdated = direction === 'up'
          ? [...targetWidgets, widgetToMove.originalWidget]
          : [widgetToMove.originalWidget, ...targetWidgets];

        // Update target dashboard
        updateWidgets(targetDashboard.id, targetWidgetsUpdated);

        return repositionedCurrentWindows;
      });
    }
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

  useEffect(() => {
    console.log(`Checking initialization for dashboard ${dashboardId}, widgets: ${initialWidgets.length}`);
    if (areWidgetsEqual(prevWidgetsRef.current, initialWidgets)) {
      console.log(`Widgets unchanged for ${dashboardId}, skipping initialization`);
      return;
    }

    console.log(`Initializing windows for dashboard ${dashboardId}`);
    gridRef.current.occupied = Array(4).fill().map(() => Array(2).fill(false));
    let newWindows = [];
    let currentScore = 0;
    let tempGrid = Array(4).fill().map(() => Array(2).fill(false));

    const sortedWidgets = [...initialWidgets].sort((a, b) => {
      const sizeA = sizeMap[a.size] || 'small';
      const sizeB = sizeMap[b.size] || 'small';
      return windowScores[sizeB] - windowScores[sizeA];
    });

    sortedWidgets.forEach((widget) => {
      const size = sizeMap[widget.size] || 'small';
      const score = windowScores[size];

      console.log(`Processing widget ${widget.id}, size ${size}, score ${score}`);

      if (currentScore + score > 80) {
        console.log(`Skipping widget ${widget.id}: score limit exceeded`);
        return;
      }

      let position;
      if (widget.position && canPlaceWindow(size, widget.position.row, widget.position.col, [], tempGrid, newWindows)) {
        position = widget.position;
        console.log(`Using predefined position for ${widget.id}: ${JSON.stringify(position)}`);
      } else {
        position = findPositionForWindow(size, [], tempGrid, newWindows);
        if (!position) {
          console.log(`Skipping widget ${widget.id}: no valid position`);
          return;
        }
      }

      newWindows.push({
        originalWidget: widget,
        size,
        position,
      });

      const { width, height } = windowSizes[size] || windowSizes.small;
      for (let r = position.row; r < position.row + height; r++) {
        for (let c = position.col; c < position.col + width; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) {
            tempGrid[r][c] = true;
          }
        }
      }

      currentScore += score;
    });

    console.log(`Windows initialized for ${dashboardId}: ${newWindows.length} windows, total score: ${currentScore}`);
    setWindows(newWindows);
    gridRef.current.occupied = tempGrid;
    prevWidgetsRef.current = initialWidgets;
  }, [initialWidgets, dashboardId]);

  return (
    <div
      className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ''} ${
        editMode ? styles.editModeContainer : ''
      } ${isSelected ? styles.selectedDashboard : ''} ${windows.length === 0 ? styles.empty : ''}`}
      ref={planeRef}
      onClick={() => editMode && onSelect()}
    >
      <div className={`${styles.dashboardWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
        {windows.map((window, index) => (
          <Window
            key={`${dashboardId}-${window.originalWidget.id}`}
            size={window.size}
            widget={window.originalWidget}
            style={{
              gridRow: `${window.position.row + 1} / span ${(windowSizes[window.size] || windowSizes.small).height}`,
              gridColumn: `span ${(windowSizes[window.size] || windowSizes.small).width}`,
            }}
            onDelete={() => removeWindow(index)}
            editMode={editMode}
            onMoveUp={() => moveWindow(index, 'up')}
            onMoveDown={() => moveWindow(index, 'down')}
            canMoveUp={index > 0 || dashboardIndex > 0}
            canMoveDown={index < windows.length - 1 || dashboardIndex < dashboards.length - 1}
          />
        ))}
      </div>
    </div>
  );
};

export default DashboardPlane;
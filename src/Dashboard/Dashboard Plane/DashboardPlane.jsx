import React, { useContext, useState, useEffect, useRef } from 'react';
import styles from './DashboardPlane.module.css';
import { MainContext } from '../../Contexts/MainContext';

const Window = ({ size, originalWidget, className = '', style, onDelete, editMode, isSelected, onClick }) => {
  const { isDarkTheme } = useContext(MainContext);

  const sizeClasses = {
    verySmall: styles.verySmallWindow,
    small: styles.smallWindow,
    medium: styles.mediumWindow,
    large: styles.largeWindow,
  };

  return (
    <div
      className={`${sizeClasses[size] || styles.smallWindow} ${className} ${
        isDarkTheme ? styles.darkTheme : ''
      } ${editMode ? styles.editMode : ''} ${isSelected ? styles.selected : ''}`}
      style={style}
      onClick={editMode ? onClick : undefined}
    >
      <div className={styles.windowContent}>
        <div className={styles.widgetWrapper}>
          <h3 className={`${styles.widgetTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
            {originalWidget.title}
          </h3>
          <div className={`${styles.widgetData} ${isDarkTheme ? styles.darkTheme : ''}`}>
            {originalWidget.data || 'No data'}
          </div>
        </div>
        {editMode && (
          <button className={styles.removeButton} onClick={onDelete}>
            ×
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
  onWindowSelect,
  selectedWindow,
  getDashboardWidgets,
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
    return windows.reduce((sum, w) => sum + (windowScores[w.size] || 0), 0);
  };

  const canPlaceWindow = (size, row, col, skipIndices = [], customGrid = null) => {
    console.log(`Checking if window of size ${size} can be placed at row: ${row}, col: ${col}, skipIndices: ${skipIndices}`);
    const { width, height } = windowSizes[size] || windowSizes.small;
    if (row < 0 || col < 0 || row + height > gridRef.current.rows || col + width > gridRef.current.columns) {
      console.log('Placement out of bounds');
      return false;
    }

    const currentScore = calculateScore(windows.filter((_, idx) => !skipIndices.includes(idx)));
    const newScore = currentScore + (windowScores[size] || 0);
    if (newScore > 80) {
      console.log(`Score limit exceeded: current ${currentScore}, new ${newScore}`);
      return false;
    }

    const occupied = customGrid
      ? customGrid.map((row) => [...row])
      : gridRef.current.occupied.map((row) => [...row]);

    skipIndices.forEach((skipIndex) => {
      const skippedWindow = windows[skipIndex];
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

  const findPositionForWindow = (size, skipIndices = [], customGrid = null) => {
    console.log(`Finding position for window of size ${size}, skipIndices: ${skipIndices}`);
    const height = windowSizes[size]?.height || 2;
    const width = windowSizes[size]?.width || 1;
    for (let row = 0; row <= gridRef.current.rows - height; row++) {
      for (let col = 0; col <= gridRef.current.columns - width; col++) {
        if (canPlaceWindow(size, row, col, skipIndices, customGrid)) {
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
          if (r >= 0 && r < 4 && c >= 0 && c < 2) {
            gridRef.current.occupied[r][c] = false;
          }
        }
      }
      const newWindows = prev.filter((_, i) => i !== index);
      updateWidgets(dashboardId, newWindows.map((win) => win.originalWidget));
      return newWindows;
    });
  };

  const attemptSameDashboardSwap = (indexA, indexB) => {
    console.log(`Attempting same-dashboard swap in ${dashboardId}: ${indexA} ↔ ${indexB}`);
    const localWindows = windows.map((win) => ({
      ...win,
      position: win.position || findPositionForWindow(win.size) || { row: 0, col: 0 },
    }));

    const windowA = localWindows[indexA];
    const sizeA = sizeMap[windowA?.size] || windowA?.size || 'small';
    const posA = windowA?.position || { row: 0, col: 0 };
    const { width: widthA, height: heightA } = windowSizes[sizeA] || windowSizes.small;
    const areaA = widthA * heightA;

    const windowB = localWindows[indexB];
    const sizeB = sizeMap[windowB?.size] || windowB?.size || 'small';
    const posB = windowB?.position || { row: 0, col: 0 };
    const { width: widthB, height: heightB } = windowSizes[sizeB] || windowSizes.small;
    const areaB = widthB * heightB;

    console.log(`Window A: size ${sizeA}, pos ${JSON.stringify(posA)}, area ${areaA}`);
    console.log(`Window B: size ${sizeB}, pos ${JSON.stringify(posB)}, area ${areaB}`);

    if (areaA === areaB) {
      console.log('Attempting direct swap');
      if (
        canPlaceWindow(sizeA, posB.row, posB.col, [indexA, indexB]) &&
        canPlaceWindow(sizeB, posA.row, posA.col, [indexA, indexB])
      ) {
        const updatedWindows = localWindows.map((win, idx) =>
          idx === indexA
            ? { ...win, position: posB }
            : idx === indexB
            ? { ...win, position: posA }
            : win
        );
        console.log('Direct swap successful, updating windows');
        setWindows(updatedWindows);
        gridRef.current.occupied = Array(4).fill().map(() => Array(2).fill(false));
        updatedWindows.forEach((win) => {
          const { width, height } = windowSizes[win.size] || windowSizes.small;
          for (let r = win.position.row; r < win.position.row + height; r++) {
            for (let c = win.position.col; c < win.position.col + width; c++) {
              if (r >= 0 && r < 4 && c >= 0 && c < 2) {
                gridRef.current.occupied[r][c] = true;
              }
            }
          }
        });
        updateWidgets(dashboardId, updatedWindows.map((win) => win.originalWidget));
        return true;
      } else {
        console.log('Direct swap failed: invalid positions');
      }
    }

    console.log('Attempting group swap');
    const [largeIndex, smallIndex, largeSize, smallSize, largeArea] =
      areaA > areaB
        ? [indexA, indexB, sizeA, sizeB, areaA]
        : [indexB, indexA, sizeB, sizeA, areaB];

    const groupSmall = findMatchingGroup(localWindows, smallIndex, largeArea);
    if (groupSmall && groupSmall.indices.length > 1) {
      console.log(`Found group: ${JSON.stringify(groupSmall)}`);
      const { indices, minRow, minCol, relativePositions } = groupSmall;

      const groupGrid = Array(4).fill().map(() => Array(2).fill(false));
      localWindows.forEach((win, idx) => {
        if (indices.includes(idx)) return;
        const { width, height } = windowSizes[win.size] || windowSizes.small;
        for (let r = win.position.row; r < win.position.row + height; r++) {
          for (let c = win.position.col; c < win.position.col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) groupGrid[r][c] = true;
          }
        }
      });

      if (canPlaceWindow(largeSize, minRow, minCol, [], groupGrid)) {
        let canPlaceGroup = true;
        const groupPositions = [];
        const tempGrid = Array(4).fill().map(() => Array(2).fill(false));
        localWindows.forEach((win, idx) => {
          if (idx === largeIndex || indices.includes(idx)) return;
          const { width, height } = windowSizes[win.size] || windowSizes.small;
          for (let r = win.position.row; r < win.position.row + height; r++) {
            for (let c = win.position.col; c < win.position.col + width; c++) {
              if (r >= 0 && r < 4 && c >= 0 && c < 2) tempGrid[r][c] = true;
            }
          }
        });

        for (const { index } of relativePositions) {
          const win = localWindows[index];
          const size = win.size;
          const pos = findPositionForWindow(size, [], tempGrid);
          if (pos) {
            groupPositions.push({ index, position: pos });
            const { width, height } = windowSizes[size] || windowSizes.small;
            for (let r = pos.row; r < pos.row + height; r++) {
              for (let c = pos.col; c < pos.col + width; c++) {
                if (r >= 0 && r < 4 && c >= 0 && c < 2) tempGrid[r][c] = true;
              }
            }
          } else {
            console.log(`No position for group window ${index}`);
            canPlaceGroup = false;
            break;
          }
        }

        if (canPlaceGroup) {
          const updatedWindows = localWindows.map((win, idx) =>
            idx === largeIndex
              ? { ...win , position: { row: minRow, col: minCol } }
              : groupPositions.find((gp) => gp.index === idx)
              ? { ...win, position: groupPositions.find((gp) => gp.index === idx).position }
              : win
          );

          const finalGrid = Array(4).fill().map(() => Array(2).fill(false));
          let hasOverlap = false;
          for (const win of updatedWindows) {
            const { width, height } = windowSizes[win.size] || windowSizes.small;
            const { row, col } = win.position;
            for (let r = row; r < row + height; r++) {
              for (let c = col; c < col + width; c++) {
                if (r >= 0 && r < 4 && c >= 0 && c < 2) {
                  if (finalGrid[r][c]) {
                    console.log(`Overlap detected at row: ${r}, col: ${c}`);
                    hasOverlap = true;
                  }
                  finalGrid[r][c] = true;
                }
              }
            }
          }

          if (!hasOverlap) {
            console.log('Group swap successful, updating windows');
            setWindows(updatedWindows);
            gridRef.current.occupied = finalGrid;
            updateWidgets(dashboardId, updatedWindows.map((win) => win.originalWidget));
            return true;
          } else {
            console.log('Group swap failed: windows overlap');
          }
        } else {
          console.log('Group swap failed: cannot place all group windows');
        }
      } else {
        console.log('Group swap failed: cannot place large window');
      }
    }

    console.log('Attempting fallback swap');
    const largeWin = localWindows[largeIndex];
    const smallWin = localWindows[smallIndex];
    const largePos = smallWin.position;
    const smallPos = largeWin.position;

    const tempGrid = Array(4).fill().map(() => Array(2).fill(false));
    localWindows.forEach((win, idx) => {
      if (idx === largeIndex || idx === smallIndex) return;
      const { width, height } = windowSizes[win.size] || windowSizes.small;
      for (let r = win.position.row; r < win.position.row + height; r++) {
        for (let c = win.position.col; c < win.position.col + width; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) tempGrid[r][c] = true;
        }
      }
    });

    let canSwap = true;
    if (!canPlaceWindow(largeWin.size, largePos.row, largePos.col, [], tempGrid)) {
      console.log('Cannot place large window at small window position');
      canSwap = false;
    }
    if (canSwap && !canPlaceWindow(smallWin.size, smallPos.row, smallPos.col, [], tempGrid)) {
      console.log('Cannot place small window at large window position');
      canSwap = false;
    }

    if (canSwap) {
      const updatedWindows = localWindows.map((win, idx) =>
        idx === largeIndex
          ? { ...win, position: largePos }
          : idx === smallIndex
          ? { ...win, position: smallPos }
          : win
      );

      const finalGrid = Array(4).fill().map(() => Array(2).fill(false));
      let hasOverlap = false;
      for (const win of updatedWindows) {
        const { width, height } = windowSizes[win.size] || windowSizes.small;
        const { row, col } = win.position;
        for (let r = row; r < row + height; r++) {
          for (let c = col; c < col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) {
              if (finalGrid[r][c]) {
                console.log(`Overlap detected at row: ${r}, col: ${c}`);
                hasOverlap = true;
              }
              finalGrid[r][c] = true;
            }
          }
        }
      }

      if (!hasOverlap) {
        console.log('Direct fallback swap successful, updating windows');
        console.log(`Updated windows: ${JSON.stringify(updatedWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
        setWindows(updatedWindows);
        gridRef.current.occupied = finalGrid;
        updateWidgets(dashboardId, updatedWindows.map((win) => win.originalWidget));
        return true;
      } else {
        console.log('Direct fallback swap failed: windows overlap');
      }
    }

    console.log('Direct swap failed, finding new positions');
    const newLargePos = findPositionForWindow(largeWin.size, [smallIndex], tempGrid);
    if (!newLargePos) {
      console.log('Fallback swap failed: no position for large window');
      return false;
    }

    const { width: largeWidth, height: largeHeight } = windowSizes[largeWin.size] || windowSizes.small;
    for (let r = newLargePos.row; r < newLargePos.row + largeHeight; r++) {
      for (let c = newLargePos.col; c < newLargePos.col + largeWidth; c++) {
        if (r >= 0 && r < 4 && c >= 0 && c < 2) tempGrid[r][c] = true;
      }
    }

    const newSmallPos = findPositionForWindow(smallWin.size, [largeIndex], tempGrid);
    if (!newSmallPos) {
      console.log('Fallback swap failed: no position for small window');
      return false;
    }

    const updatedWindows = localWindows.map((win, idx) =>
      idx === largeIndex
        ? { ...win, position: newLargePos }
        : idx === smallIndex
        ? { ...win, position: newSmallPos }
        : win
    );

    const finalGrid = Array(4).fill().map(() => Array(2).fill(false));
    let hasOverlap = false;
    for (const win of updatedWindows) {
      const { width, height } = windowSizes[win.size] || windowSizes.small;
      const { row, col } = win.position;
      for (let r = row; r < row + height; r++) {
        for (let c = col; c < col + width; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) {
            if (finalGrid[r][c]) {
              console.log(`Overlap detected at row: ${r}, col: ${c}`);
              hasOverlap = true;
            }
            finalGrid[r][c] = true;
          }
        }
      }
    }

    if (!hasOverlap) {
      console.log('Fallback swap successful, updating windows');
      console.log(`Updated windows: ${JSON.stringify(updatedWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
      setWindows(updatedWindows);
      gridRef.current.occupied = finalGrid;
      updateWidgets(dashboardId, updatedWindows.map((win) => win.originalWidget));
      return true;
    } else {
      console.log('Fallback swap failed: windows overlap');
      return false;
    }
  };

  const attemptCrossDashboardSwap = (
    sourceDashboardId,
    sourceIndex,
    targetDashboardId,
    targetIndex
  ) => {
    console.log(
      `Attempting cross-dashboard swap: ${sourceDashboardId} index ${sourceIndex} ↔ ${targetDashboardId} index ${targetIndex}`
    );

    const sourceWidgets = getDashboardWidgets(sourceDashboardId) || [];
    const targetWidgets = getDashboardWidgets(targetDashboardId) || [];

    console.log(`Source widgets: ${JSON.stringify(sourceWidgets.map(w => w.id))}`);
    console.log(`Target widgets: ${JSON.stringify(targetWidgets.map(w => w.id))}`);

    if (sourceIndex >= sourceWidgets.length || targetIndex >= targetWidgets.length) {
      console.log(`Invalid indices: sourceIndex=${sourceIndex}, targetIndex=${targetIndex}`);
      return false;
    }

    let sourceWindows = dashboardId === sourceDashboardId ? windows : [];
    let targetWindows = dashboardId === targetDashboardId ? windows : [];

    const sourceGrid = Array(4).fill().map(() => Array(2).fill(false));
    const targetGrid = Array(4).fill().map(() => Array(2).fill(false));

    if (dashboardId !== sourceDashboardId) {
      sourceWidgets.forEach((widget, idx) => {
        const size = sizeMap[widget.size] || 'small';
        const position = findPositionForWindow(size, [], sourceGrid) || { row: 0, col: 0 };
        sourceWindows.push({
          originalWidget: widget,
          size,
          position,
        });
        const { width, height } = windowSizes[size] || windowSizes.small;
        for (let r = position.row; r < position.row + height; r++) {
          for (let c = position.col; c < position.col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) sourceGrid[r][c] = true;
          }
        }
        console.log(`Source window ${idx}: ${widget.id}, size ${size}, pos ${JSON.stringify(position)}`);
      });
    }

    if (dashboardId !== targetDashboardId) {
      targetWidgets.forEach((widget, idx) => {
        const size = sizeMap[widget.size] || 'small';
        const position = findPositionForWindow(size, [], targetGrid) || { row: 0, col: 0 };
        targetWindows.push({
          originalWidget: widget,
          size,
          position,
        });
        const { width, height } = windowSizes[size] || windowSizes.small;
        for (let r = position.row; r < position.row + height; r++) {
          for (let c = position.col; c < position.col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) targetGrid[r][c] = true;
          }
        }
        console.log(`Target window ${idx}: ${widget.id}, size ${size}, pos ${JSON.stringify(position)}`);
      });
    }

    const windowA = sourceWindows[sourceIndex];
    const windowB = targetWindows[targetIndex];

    if (!windowA || !windowB) {
      console.log(`Invalid windows: windowA=${!!windowA}, windowB=${!!windowB}`);
      return false;
    }

    const sizeA = windowA.size;
    const posA = windowA.position;
    const { width: widthA, height: heightA } = windowSizes[sizeA] || windowSizes.small;
    const areaA = widthA * heightA;

    const sizeB = windowB.size;
    const posB = windowB.position;
    const { width: widthB, height: heightB } = windowSizes[sizeB] || windowSizes.small;
    const areaB = widthB * heightB;

    console.log(`Source window: size ${sizeA}, pos ${JSON.stringify(posA)}, area ${areaA}`);
    console.log(`Target window: size ${sizeB}, pos ${JSON.stringify(posB)}, area ${areaB}`);

    const sourceGridExcl = Array(4).fill().map(() => Array(2).fill(false));
    sourceWindows.forEach((win, idx) => {
      if (idx === sourceIndex) return;
      const { width, height } = windowSizes[win.size] || windowSizes.small;
      for (let r = win.position.row; r < win.position.row + height; r++) {
        for (let c = win.position.col; c < win.position.col + width; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) sourceGridExcl[r][c] = true;
        }
      }
    });

    const targetGridExcl = Array(4).fill().map(() => Array(2).fill(false));
    targetWindows.forEach((win, idx) => {
      if (idx === targetIndex) return;
      const { width, height } = windowSizes[win.size] || windowSizes.small;
      for (let r = win.position.row; r < win.position.row + height; r++) {
        for (let c = win.position.col; c < win.position.col + width; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) targetGridExcl[r][c] = true;
        }
      }
    });

    console.log(`Source grid (excluding sourceIndex ${sourceIndex}): ${JSON.stringify(sourceGridExcl)}`);
    console.log(`Target grid (excluding targetIndex ${targetIndex}): ${JSON.stringify(targetGridExcl)}`);

    if (
      canPlaceWindow(sizeA, posB.row, posB.col, [], targetGridExcl) &&
      canPlaceWindow(sizeB, posA.row, posA.col, [], sourceGridExcl)
    ) {
      console.log('Attempting direct cross-dashboard swap');
      const updatedSourceWindows = sourceWindows.map((win, idx) =>
        idx === sourceIndex ? { ...win, originalWidget: windowB.originalWidget, size: sizeB, position: posA } : win
      );
      const updatedTargetWindows = targetWindows.map((win, idx) =>
        idx === targetIndex ? { ...win, originalWidget: windowA.originalWidget, size: sizeA, position: posB } : win
      );

      const sourceFinalGrid = Array(4).fill().map(() => Array(2).fill(false));
      const targetFinalGrid = Array(4).fill().map(() => Array(2).fill(false));
      let hasOverlap = false;

      for (const win of updatedSourceWindows) {
        const { width, height } = windowSizes[win.size] || windowSizes.small;
        const { row, col } = win.position;
        for (let r = row; r < row + height; r++) {
          for (let c = col; c < col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) {
              if (sourceFinalGrid[r][c]) {
                console.log(`Overlap in source dashboard at row: ${r}, col: ${c}`);
                hasOverlap = true;
              }
              sourceFinalGrid[r][c] = true;
            }
          }
        }
      }

      for (const win of updatedTargetWindows) {
        const { width, height } = windowSizes[win.size] || windowSizes.small;
        const { row, col } = win.position;
        for (let r = row; r < row + height; r++) {
          for (let c = col; c < col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) {
              if (targetFinalGrid[r][c]) {
                console.log(`Overlap in target dashboard at row: ${r}, col: ${c}`);
                hasOverlap = true;
              }
              targetFinalGrid[r][c] = true;
            }
          }
        }
      }

      if (!hasOverlap) {
        console.log('Direct cross-dashboard swap successful');
        console.log(`Updated source windows: ${JSON.stringify(updatedSourceWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
        console.log(`Updated target windows: ${JSON.stringify(updatedTargetWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
        updateWidgets(sourceDashboardId, updatedSourceWindows.map((win) => win.originalWidget));
        updateWidgets(targetDashboardId, updatedTargetWindows.map((win) => win.originalWidget));
        if (dashboardId === sourceDashboardId) setWindows(updatedSourceWindows);
        else if (dashboardId === targetDashboardId) setWindows(updatedTargetWindows);
        return true;
      } else {
        console.log('Direct cross-dashboard swap failed: windows overlap');
      }
    }

    console.log('Attempting group or fallback cross-dashboard swap');
    const [largeIndex, smallIndex, largeWindows, smallWindows, largeDashboardId, smallDashboardId, largeArea, largeGrid, smallGrid] =
      areaA > areaB
        ? [sourceIndex, targetIndex, sourceWindows, targetWindows, sourceDashboardId, targetDashboardId, areaA, sourceGridExcl, targetGridExcl]
        : [targetIndex, sourceIndex, targetWindows, sourceWindows, targetDashboardId, sourceDashboardId, areaB, targetGridExcl, sourceGridExcl];

    const groupSmall = findMatchingGroup(smallWindows, smallIndex, largeArea);
    if (groupSmall && groupSmall.indices.length > 1) {
      console.log(`Found group in ${smallDashboardId}: ${JSON.stringify(groupSmall)}`);
      const { indices, minRow, minCol, relativePositions } = groupSmall;

      const groupGrid = Array(4).fill().map(() => Array(2).fill(false));
      smallWindows.forEach((win, idx) => {
        if (indices.includes(idx)) return;
        const { width, height } = windowSizes[win.size] || windowSizes.small;
        for (let r = win.position.row; r < win.position.row + height; r++) {
          for (let c = win.position.col; c < win.position.col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) groupGrid[r][c] = true;
          }
        }
      });

      let canPlaceLarge = canPlaceWindow(largeWindows[largeIndex].size, minRow, minCol, [], groupGrid);
      let newGroupGrid = groupGrid;
      let remainingSmallWindows = smallWindows.filter((_, idx) => !indices.includes(idx));

      if (!canPlaceLarge) {
        console.log('Large window placement failed, attempting to reposition remaining widgets');
        const tempWindows = [];
        newGroupGrid = Array(4).fill().map(() => Array(2).fill(false));
        let canReposition = true;

        remainingSmallWindows.forEach((win) => {
          const size = win.size;
          const pos = findPositionForWindow(size, [], newGroupGrid);
          if (pos) {
            tempWindows.push({ ...win, position: pos });
            const { width, height } = windowSizes[size] || windowSizes.small;
            for (let r = pos.row; r < pos.row + height; r++) {
              for (let c = pos.col; c < pos.col + width; c++) {
                if (r >= 0 && r < 4 && c >= 0 && c < 2) newGroupGrid[r][c] = true;
              }
            }
          } else {
            console.log(`Cannot reposition window ${win.originalWidget.id}`);
            canReposition = false;
          }
        });

        if (canReposition && canPlaceWindow(largeWindows[largeIndex].size, minRow, minCol, [], newGroupGrid)) {
          canPlaceLarge = true;
          remainingSmallWindows = tempWindows;
        }
      }

      if (canPlaceLarge) {
        let canPlaceGroup = true;
        const groupPositions = [];
        const tempGroupGrid = Array(4).fill().map(() => Array(2).fill(false));
        const remainingSourceWindows = largeWindows.filter((_, idx) => idx !== largeIndex);

        remainingSourceWindows.forEach((win) => {
          const { width, height } = windowSizes[win.size] || windowSizes.small;
          for (let r = win.position.row; r < win.position.row + height; r++) {
            for (let c = win.position.col; c < win.position.col + width; c++) {
              if (r >= 0 && r < 4 && c >= 0 && c < 2) tempGroupGrid[r][c] = true;
            }
          }
        });

        for (const { index } of relativePositions) {
          const win = smallWindows[index];
          const size = win.size;
          const pos = findPositionForWindow(size, [], tempGroupGrid);
          if (pos) {
            groupPositions.push({ index, position: pos });
            const { width, height } = windowSizes[size] || windowSizes.small;
            for (let r = pos.row; r < pos.row + height; r++) {
              for (let c = pos.col; c < pos.col + width; c++) {
                if (r >= 0 && r < 4 && c >= 0 && c < 2) tempGroupGrid[r][c] = true;
              }
            }
          } else {
            console.log(`No position for group window ${index}`);
            canPlaceGroup = false;
            break;
          }
        }

        if (canPlaceGroup) {
          const updatedLargeWindows = remainingSourceWindows.concat(
            groupPositions.map(({ index, position }) => ({
              ...smallWindows[index],
              position,
            }))
          );
          const updatedSmallWindows = remainingSmallWindows.concat([
            { ...largeWindows[largeIndex], position: { row: minRow, col: minCol } },
          ]);

          console.log('Group cross-dashboard swap successful');
          console.log(`Updated large windows: ${JSON.stringify(updatedLargeWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
          console.log(`Updated small windows: ${JSON.stringify(updatedSmallWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
          updateWidgets(largeDashboardId, updatedLargeWindows.map((win) => win.originalWidget));
          updateWidgets(smallDashboardId, updatedSmallWindows.map((win) => win.originalWidget));
          if (dashboardId === largeDashboardId) setWindows(updatedLargeWindows);
          else if (dashboardId === smallDashboardId) setWindows(updatedSmallWindows);
          return true;
        } else {
          console.log('Group cross-dashboard swap failed: cannot place all group windows');
        }
      } else {
        console.log('Group cross-dashboard swap failed: cannot place large window');
      }
    }

    console.log('No valid group found, attempting fallback cross-dashboard swap');
    const largeWin = largeWindows[largeIndex];
    const smallWin = smallWindows[smallIndex];

    if (
      canPlaceWindow(largeWin.size, smallWin.position.row, smallWin.position.col, [], smallGrid) &&
      canPlaceWindow(smallWin.size, largeWin.position.row, largeWin.position.col, [], largeGrid)
    ) {
      const updatedLargeWindows = largeWindows.map((win, idx) =>
        idx === largeIndex ? { ...win, originalWidget: smallWin.originalWidget, size: smallWin.size, position: largeWin.position } : win
      );
      const updatedSmallWindows = smallWindows.map((win, idx) =>
        idx === smallIndex ? { ...win, originalWidget: largeWin.originalWidget, size: largeWin.size, position: smallWin.position } : win
      );

      const sourceFinalGrid = Array(4).fill().map(() => Array(2).fill(false));
      const targetFinalGrid = Array(4).fill().map(() => Array(2).fill(false));
      let hasOverlap = false;

      for (const win of updatedLargeWindows) {
        const { width, height } = windowSizes[win.size] || windowSizes.small;
        const { row, col } = win.position;
        for (let r = row; r < row + height; r++) {
          for (let c = col; c < col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) {
              if (sourceFinalGrid[r][c]) {
                console.log(`Overlap in large dashboard at row: ${r}, col: ${c}`);
                hasOverlap = true;
              }
              sourceFinalGrid[r][c] = true;
            }
          }
        }
      }

      for (const win of updatedSmallWindows) {
        const { width, height } = windowSizes[win.size] || windowSizes.small;
        const { row, col } = win.position;
        for (let r = row; r < row + height; r++) {
          for (let c = col; c < col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) {
              if (targetFinalGrid[r][c]) {
                console.log(`Overlap in small dashboard at row: ${r}, col: ${c}`);
                hasOverlap = true;
              }
              targetFinalGrid[r][c] = true;
            }
          }
        }
      }

      if (!hasOverlap) {
        console.log('Direct fallback cross-dashboard swap successful');
        console.log(`Updated large windows: ${JSON.stringify(updatedLargeWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
        console.log(`Updated small windows: ${JSON.stringify(updatedSmallWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
        updateWidgets(largeDashboardId, updatedLargeWindows.map((win) => win.originalWidget));
        updateWidgets(smallDashboardId, updatedSmallWindows.map((win) => win.originalWidget));
        if (dashboardId === largeDashboardId) setWindows(updatedLargeWindows);
        else if (dashboardId === smallDashboardId) setWindows(updatedSmallWindows);
        return true;
      } else {
        console.log('Direct fallback cross-dashboard swap failed: windows overlap');
      }
    }

    const largePos = findPositionForWindow(largeWin.size, [], smallGrid);
    const smallPos = findPositionForWindow(smallWin.size, [], largeGrid);
    if (largePos && smallPos) {
      const updatedLargeWindows = largeWindows
        .filter((_, idx) => idx !== largeIndex)
        .concat([{ ...smallWin, position: smallPos }]);
      const updatedSmallWindows = smallWindows
        .filter((_, idx) => idx !== smallIndex)
        .concat([{ ...largeWin, position: largePos }]);

      console.log('Fallback cross-dashboard swap successful');
      console.log(`Updated large windows: ${JSON.stringify(updatedLargeWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
      console.log(`Updated small windows: ${JSON.stringify(updatedSmallWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
      updateWidgets(largeDashboardId, updatedLargeWindows.map((win) => win.originalWidget));
      updateWidgets(smallDashboardId, updatedSmallWindows.map((win) => win.originalWidget));
      if (dashboardId === largeDashboardId) setWindows(updatedLargeWindows);
      else if (dashboardId === smallDashboardId) setWindows(updatedSmallWindows);
      return true;
    } else {
      console.log('Fallback cross-dashboard swap failed: invalid positions');
      return false;
    }
  };

  const findMatchingGroup = (windows, startIndex, targetArea) => {
    console.log(`Finding group for target area ${targetArea} starting at index ${startIndex}`);
    const queue = [
      {
        indices: [startIndex],
        area:
          (windowSizes[windows[startIndex]?.size] || windowSizes.small).width *
          (windowSizes[windows[startIndex]?.size] || windowSizes.small).height,
      },
    ];
    const visited = new Set();

    const startWindow = windows[startIndex];
    if (!startWindow || !startWindow.position) {
      console.log(`Invalid start window at index ${startIndex}`);
      return {
        indices: [startIndex],
        minRow: 0,
        minCol: 0,
        relativePositions: [{ index: startIndex, relRow: 0, relCol: 0 }],
      };
    }

    const startSize = startWindow.size || 'small';
    const startPos = startWindow.position;
    const startArea = (windowSizes[startSize]?.width || 1) * (windowSizes[startSize]?.height || 2);

    if (targetArea === 4 && startSize === 'small') {
      for (let i = 0; i < windows.length; i++) {
        if (i === startIndex) continue;
        const win = windows[i];
        if (!win || !win.position || win.size !== 'small') {
          console.log(`Skipping invalid window at index ${i}: ${!win ? 'undefined' : !win.position ? 'no position' : 'wrong size'}`);
          continue;
        }
        const pos = win.position;
        const isHorizontal = pos.row === startPos.row && Math.abs(pos.col - startPos.col) === 1;
        const isVertical = pos.col === startPos.col && Math.abs(pos.row - startPos.row) === 2;
        if (isHorizontal || isVertical) {
          const indices = [startIndex, i];
          const boundingBox = getBoundingBox(windows, indices);
          const relativePositions = indices.map((idx) => ({
            index: idx,
            relRow: windows[idx].position.row - boundingBox.minRow,
            relCol: windows[idx].position.col - boundingBox.minCol,
          }));
          console.log(`Group found: ${JSON.stringify({ indices, minRow: boundingBox.minRow, minCol: boundingBox.minCol, relativePositions })}`);
          return { indices, minRow: boundingBox.minRow, minCol: boundingBox.minCol, relativePositions };
        }
      }
    } else if (targetArea === 2 && startSize === 'verySmall') {
      for (let i = 0; i < windows.length; i++) {
        if (i === startIndex) continue;
        const win = windows[i];
        if (!win || !win.position || win.size !== 'verySmall') {
          console.log(`Skipping invalid window at index ${i}: ${!win ? 'undefined' : !win.position ? 'no position' : 'wrong size'}`);
          continue;
        }
        const pos = win.position;
        const isVertical = pos.col === startPos.col && Math.abs(pos.row - startPos.row) === 1;
        if (isVertical) {
          const indices = [startIndex, i];
          const boundingBox = getBoundingBox(windows, indices);
          const relativePositions = indices.map((idx) => ({
            index: idx,
            relRow: windows[idx].position.row - boundingBox.minRow,
            relCol: windows[idx].position.col - boundingBox.minCol,
          }));
          console.log(`Group found: ${JSON.stringify({ indices, minRow: boundingBox.minRow, minCol: boundingBox.minCol, relativePositions })}`);
          return { indices, minRow: boundingBox.minRow, minCol: boundingBox.minCol, relativePositions };
        }
      }
    }

    while (queue.length > 0) {
      const { indices, area } = queue.shift();
      console.log(`Checking group: indices ${indices}, area ${area}`);
      if (area === targetArea) {
        const boundingBox = getBoundingBox(windows, indices);
        const relativePositions = indices.map((idx) => ({
          index: idx,
          relRow: windows[idx].position.row - boundingBox.minRow,
          relCol: windows[idx].position.col - boundingBox.minCol,
        }));
        console.log(`Group found: ${JSON.stringify({ indices, minRow: boundingBox.minRow, minCol: boundingBox.minCol, relativePositions })}`);
        return { indices, minRow: boundingBox.minRow, minCol: boundingBox.minCol, relativePositions };
      }
      if (area > targetArea) continue;

      for (let i = 0; i < windows.length; i++) {
        if (indices.includes(i) || visited.has([...indices, i].sort().join(','))) continue;
        const win = windows[i];
        if (!win || !win.position) {
          console.log(`Skipping invalid window at index ${i}: ${!win ? 'undefined' : 'no position'}`);
          continue;
        }
        const newIndices = [...indices, i];
        const newArea = newIndices.reduce((sum, idx) => {
          const size = windows[idx]?.size || 'small';
          return sum + (windowSizes[size]?.width || 1) * (windowSizes[size]?.height || 2);
        }, 0);
        console.log(`Considering new group: indices ${newIndices}, area ${newArea}`);
        if (newArea <= targetArea) {
          queue.push({ indices: newIndices, area: newArea });
          visited.add(newIndices.sort().join(','));
        }
      }
    }

    console.log(`No group found, returning single widget at index ${startIndex}`);
    const boundingBox = getBoundingBox(windows, [startIndex]);
    const relativePositions = [{ index: startIndex, relRow: 0, relCol: 0 }];
    return {
      indices: [startIndex],
      minRow: startPos.row,
      minCol: startPos.col,
      relativePositions,
    };
  };

  const getBoundingBox = (windows, indices) => {
    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;

    indices.forEach((idx) => {
      const win = windows[idx];
      if (!win) return;
      const { row, col } = win.position || { row: 0, col: 0 };
      const { width, height } = windowSizes[win.size] || windowSizes.small;
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row + height - 1);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col + width - 1);
    });

    return {
      minRow,
      minCol,
      width: maxCol - minCol + 1,
      height: maxRow - minRow + 1,
    };
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
        p.section === n.section
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

      const position = findPositionForWindow(size);
      if (!position) {
        console.log(`Skipping widget ${widget.id}: no valid position`);
        return;
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
            gridRef.current.occupied[r][c] = true;
          }
        }
      }

      currentScore += score;
    });

    console.log(`Windows initialized for ${dashboardId}: ${newWindows.length} windows`);
    setWindows(newWindows);
    prevWidgetsRef.current = initialWidgets;
  }, [initialWidgets, dashboardId]);

  const handleWindowClick = (index, event) => {
    if (!editMode) {
      console.log('Edit mode off, ignoring window click');
      return;
    }

    event.stopPropagation();
    console.log(`Window clicked at index ${index} in dashboard ${dashboardId}`);

    // Check if this window is already selected (to allow deselection)
    if (
      selectedWindow &&
      selectedWindow.dashboardId === dashboardId &&
      selectedWindow.index === index
    ) {
      console.log(`Deselecting window at index ${index} in dashboard ${dashboardId}`);
      onWindowSelect(null); // Clear selection
      return;
    }

    // If no window is selected, select this as the source
    if (!selectedWindow) {
      console.log(`Selecting source window at index ${index} in dashboard ${dashboardId}`);
      onWindowSelect({ dashboardId, index });
      return;
    }

    // If a window is already selected, attempt to swap
    console.log(
      `Attempting swap: source ${selectedWindow.dashboardId}:${selectedWindow.index} → target ${dashboardId}:${index}`
    );
    const swapSuccess = onWindowSelect(
      { dashboardId, index },
      (sourceDashboardId, sourceIndex, targetDashboardId, targetIndex) => {
        if (sourceDashboardId === targetDashboardId) {
          if (attemptSameDashboardSwap(sourceIndex, targetIndex)) {
            console.log('Same-dashboard swap completed');
            return true;
          } else {
            console.log('Same-dashboard swap failed');
            return false;
          }
        } else {
          if (attemptCrossDashboardSwap(sourceDashboardId, sourceIndex, targetDashboardId, targetIndex)) {
            console.log('Cross-dashboard swap completed');
            return true;
          } else {
            console.log('Cross-dashboard swap failed');
            return false;
          }
        }
      }
    );

    if (swapSuccess) {
      console.log('Swap successful, clearing selection');
      onWindowSelect(null); // Clear selection after successful swap
    } else {
      console.log('Swap failed, keeping source window selected');
      // Keep the original selection to allow retrying with a different destination
    }
  };

  return (
    <div
      className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ''} ${
        editMode ? styles.editModeContainer : ''
      } ${windows.length === 0 ? styles.empty : ''}`}
      ref={planeRef}
    >
      <div className={`${styles.dashboardWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
        {windows.map((window, index) => (
          <Window
            key={`${dashboardId}-${window.originalWidget.id}`}
            size={window.size}
            originalWidget={window.originalWidget}
            style={{
              gridRow: `${window.position.row + 1} / span ${(windowSizes[window.size] || windowSizes.small).height}`,
              gridColumn: `${window.position.col + 1} / span ${(windowSizes[window.size] || windowSizes.small).width}`,
            }}
            onDelete={() => removeWindow(index)}
            editMode={editMode}
            isSelected={selectedWindow && selectedWindow.dashboardId === dashboardId && selectedWindow.index === index}
            onClick={(e) => handleWindowClick(index, e)}
          />
        ))}
      </div>
    </div>
  );
};

export default DashboardPlane;
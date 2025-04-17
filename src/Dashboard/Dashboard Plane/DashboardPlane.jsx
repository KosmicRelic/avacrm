import React, { useContext, useState, useEffect, useRef } from 'react';
import styles from './DashboardPlane.module.css';
import { MainContext } from '../../Contexts/MainContext';

const Window = ({ size, children, className = '', style, onDelete, editMode, isSelected, onClick }) => {
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
      } ${isSelected ? styles.selected : ''}`}
      style={style}
      onClick={editMode ? onClick : undefined}
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

const DashboardPlane = ({
  dashboardId,
  initialWidgets = [],
  editMode,
  isSelected,
  onSelect,
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
    big: { width: 2, height: 4 },
  };

  const windowScores = {
    verySmall: 10,
    small: 20,
    medium: 40,
    big: 80,
  };

  const sizeMap = {
    tiny: 'verySmall',
    verySmall: 'verySmall',
    small: 'small',
    medium: 'medium',
    large: 'big',
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
    if (newScore > 200) {
      console.log(`Score limit exceeded: current ${currentScore}, new ${newScore}`);
      return false;
    }

    const occupied = customGrid
      ? customGrid.map(row => [...row])
      : gridRef.current.occupied.map(row => [...row]);

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
    for (let row = 0; row <= gridRef.current.rows - (windowSizes[size]?.height || 2); row++) {
      for (let col = 0; col <= gridRef.current.columns - (windowSizes[size]?.width || 1); col++) {
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
          gridRef.current.occupied[r][c] = false;
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
      if (canPlaceWindow(sizeA, posB.row, posB.col, [indexA, indexB]) && canPlaceWindow(sizeB, posA.row, posA.col, [indexA, indexB])) {
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
    } else {
      console.log('Attempting group or fallback swap');
      const [largeIndex, smallIndex, largeArea] =
        areaA > areaB ? [indexA, indexB, areaA] : [indexB, indexA, areaB];
      const groupSmall = findMatchingGroup(localWindows, smallIndex, largeArea);
      if (groupSmall) {
        console.log(`Found group: ${JSON.stringify(groupSmall)}`);
        const { indices, minRow, minCol, relativePositions } = groupSmall;
        if (canPlaceWindow(localWindows[largeIndex].size, minRow, minCol, indices)) {
          let canPlaceGroup = true;
          const groupPositions = [];
          const baseRow = localWindows[largeIndex].position.row;
          const baseCol = localWindows[largeIndex].position.col;

          for (const { index, relRow, relCol } of relativePositions) {
            const win = localWindows[index];
            const size = win.size;
            const newRow = baseRow + relRow;
            const newCol = baseCol + relCol;
            console.log(`Checking group window ${index} at row: ${newRow}, col: ${newCol}`);
            if (canPlaceWindow(size, newRow, newCol, [largeIndex, ...indices])) {
              groupPositions.push({ index, position: { row: newRow, col: newCol } });
            } else {
              const pos = findPositionForWindow(size, [largeIndex, ...indices]);
              if (pos) {
                console.log(`Alternative position for ${index}: ${JSON.stringify(pos)}`);
                groupPositions.push({ index, position: pos });
              } else {
                console.log(`No position for group window ${index}`);
                canPlaceGroup = false;
                break;
              }
            }
          }

          if (canPlaceGroup) {
            const updatedWindows = localWindows.map((win, idx) =>
              idx === largeIndex
                ? { ...win, position: { row: minRow, col: minCol } }
                : groupPositions.find((gp) => gp.index === idx)
                ? { ...win, position: groupPositions.find((gp) => gp.index === idx).position }
                : win
            );
            console.log('Group swap successful, updating windows');
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
            console.log('Group swap failed: cannot place all group windows');
          }
        } else {
          console.log('Group swap failed: cannot place large window');
        }
      } else {
        console.log('No group found, attempting fallback swap');
        const largeWin = localWindows[largeIndex];
        const smallWin = localWindows[smallIndex];
        if (
          canPlaceWindow(largeWin.size, smallWin.position.row, smallWin.position.col, [largeIndex, smallIndex]) &&
          canPlaceWindow(smallWin.size, largeWin.position.row, largeWin.position.col, [largeIndex, smallIndex])
        ) {
          const updatedWindows = localWindows.map((win, idx) =>
            idx === largeIndex
              ? { ...win, position: smallWin.position }
              : idx === smallIndex
              ? { ...win, position: largeWin.position }
              : win
          );
          console.log('Fallback swap successful, updating windows');
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
          console.log('Fallback swap failed: invalid positions');
        }
      }
    }
    console.log('Swap failed: no valid configuration found');
    return false;
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

    console.log(`Source widgets: ${JSON.stringify(sourceWidgets.map(w => ({ id: w.id, size: w.size })))}`);
    console.log(`Target widgets: ${JSON.stringify(targetWidgets.map(w => ({ id: w.id, size: w.size })))}`);

    if (sourceIndex >= sourceWidgets.length || targetIndex >= targetWidgets.length) {
      console.log(`Invalid indices: sourceIndex=${sourceIndex}, targetIndex=${targetIndex}`);
      return false;
    }

    const sourceWindows = dashboardId === sourceDashboardId ? windows : sourceWidgets.map((widget, idx) => {
      const size = sizeMap[widget.size] || 'small';
      const position = findPositionForWindow(size, [], Array(4).fill().map(() => Array(2).fill(false))) || { row: 0, col: 0 };
      return {
        originalWidget: widget,
        size,
        position,
      };
    }).filter(win => win.originalWidget);

    const targetGrid = Array(4).fill().map(() => Array(2).fill(false));
    const targetWindows = [];
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
    });

    console.log(`Source windows: ${JSON.stringify(sourceWindows.map(w => ({ id: w.originalWidget.id, size: w.size, pos: w.position })))}`);
    console.log(`Target windows: ${JSON.stringify(targetWindows.map(w => ({ id: w.originalWidget.id, size: w.size, pos: w.position })))}`);

    const windowA = sourceWindows[sourceIndex];
    const windowB = targetWindows[targetIndex];

    if (!windowA || !windowB) {
      console.log(`Invalid windows: windowA=${!!windowA}, windowB=${!!windowB}`);
      return false;
    }

    const sizeA = sizeMap[windowA.originalWidget.size] || windowA.size || 'small';
    const posA = windowA.position;
    const { width: widthA, height: heightA } = windowSizes[sizeA] || windowSizes.small;
    const areaA = widthA * heightA;

    const sizeB = sizeMap[windowB.originalWidget.size] || windowB.size || 'small';
    const posB = windowB.position;
    const { width: widthB, height: heightB } = windowSizes[sizeB] || windowSizes.small;
    const areaB = widthB * heightB;

    console.log(`Source window: size ${sizeA}, pos ${JSON.stringify(posA)}, area ${areaA}`);
    console.log(`Target window: size ${sizeB}, pos ${JSON.stringify(posB)}, area ${areaB}`);

    const sourceGrid = Array(4).fill().map(() => Array(2).fill(false));
    sourceWindows.forEach((win, idx) => {
      if (idx === sourceIndex) return;
      const { width, height } = windowSizes[win.size] || windowSizes.small;
      for (let r = win.position.row; r < win.position.row + height; r++) {
        for (let c = win.position.col; c < win.position.col + width; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) sourceGrid[r][c] = true;
        }
      }
    });

    const updatedTargetGrid = Array(4).fill().map(() => Array(2).fill(false));
    targetWindows.forEach((win, idx) => {
      if (idx === targetIndex) return;
      const { width, height } = windowSizes[win.size] || windowSizes.small;
      for (let r = win.position.row; r < win.position.row + height; r++) {
        for (let c = win.position.col; c < win.position.col + width; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) updatedTargetGrid[r][c] = true;
        }
      }
    });

    if (areaA === areaB) {
      console.log('Attempting direct cross-dashboard swap');
      if (
        canPlaceWindow(sizeA, posB.row, posB.col, [sourceIndex], updatedTargetGrid) &&
        canPlaceWindow(sizeB, posA.row, posA.col, [targetIndex], sourceGrid)
      ) {
        const updatedSourceWindows = sourceWindows
          .filter((_, idx) => idx !== sourceIndex)
          .concat([{ ...windowB, originalWidget: windowB.originalWidget, position: posA, size: sizeB }]);
        const updatedTargetWindows = targetWindows
          .filter((_, idx) => idx !== targetIndex)
          .concat([{ ...windowA, originalWidget: windowA.originalWidget, position: posB, size: sizeA }]);

        console.log(`Direct cross-dashboard swap successful`);
        console.log(`Updated source windows: ${JSON.stringify(updatedSourceWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
        console.log(`Updated target windows: ${JSON.stringify(updatedTargetWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
        updateWidgets(sourceDashboardId, updatedSourceWindows.map((win) => win.originalWidget));
        updateWidgets(targetDashboardId, updatedTargetWindows.map((win) => win.originalWidget));
        if (dashboardId === sourceDashboardId) setWindows(updatedSourceWindows);
        else if (dashboardId === targetDashboardId) setWindows(updatedTargetWindows);
        return true;
      } else {
        console.log('Direct cross-dashboard swap failed: invalid positions');
      }
    } else {
      console.log('Attempting group or fallback cross-dashboard swap');
      const [largeIndex, smallIndex, largeWindows, smallWindows, largeDashboardId, smallDashboardId, largeArea, largeGrid, smallGrid] =
        areaA > areaB
          ? [sourceIndex, targetIndex, sourceWindows, targetWindows, sourceDashboardId, targetDashboardId, areaA, sourceGrid, updatedTargetGrid]
          : [targetIndex, sourceIndex, targetWindows, sourceWindows, targetDashboardId, sourceDashboardId, areaB, updatedTargetGrid, sourceGrid];

      const groupSmall = findMatchingGroup(smallWindows, smallIndex, largeArea);
      if (groupSmall) {
        console.log(`Found group in ${smallDashboardId}: ${JSON.stringify(groupSmall)}`);
        const { indices, minRow, minCol, relativePositions } = groupSmall;

        let largePosition = findPositionForWindow(largeWindows[largeIndex].size, indices, smallGrid);
        if (!largePosition) {
          console.log('Attempting to reposition small dashboard widgets');
          const tempWindows = smallWindows.filter((_, idx) => !indices.includes(idx));
          const tempGrid = Array(4).fill().map(() => Array(2).fill(false));
          const repositionedWindows = [];
          let canReposition = true;

          tempWindows.forEach((win, idx) => {
            const pos = findPositionForWindow(win.size, [], tempGrid);
            if (pos) {
              repositionedWindows.push({ ...win, position: pos });
              const { width, height } = windowSizes[win.size] || windowSizes.small;
              for (let r = pos.row; r < pos.row + height; r++) {
                for (let c = pos.col; c < pos.col + width; c++) {
                  if (r >= 0 && r < 4 && c >= 0 && c < 2) tempGrid[r][c] = true;
                }
              }
            } else {
              canReposition = false;
            }
          });

          if (canReposition) {
            largePosition = findPositionForWindow(largeWindows[largeIndex].size, [], tempGrid);
          }
        }

        if (largePosition) {
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

          console.log(`Initial tempGroupGrid for ${largeDashboardId}: ${JSON.stringify(tempGroupGrid)}`);

          for (const { index } of relativePositions) {
            const win = smallWindows[index];
            const size = win.size;
            const pos = findPositionForWindow(size, [], tempGroupGrid);
            if (pos) {
              console.log(`Position for group window ${index} (${win.originalWidget.id}): ${JSON.stringify(pos)}`);
              groupPositions.push({ index, position: pos });
              const { width, height } = windowSizes[size] || windowSizes.small;
              for (let r = pos.row; r < pos.row + height; r++) {
                for (let c = pos.col; c < pos.col + width; c++) {
                  if (r >= 0 && r < 4 && c >= 0 && c < 2) tempGroupGrid[r][c] = true;
                }
              }
              console.log(`Updated tempGroupGrid after placing ${win.originalWidget.id}: ${JSON.stringify(tempGroupGrid)}`);
            } else {
              console.log(`No position for group window ${index} (${win.originalWidget.id})`);
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
            const updatedSmallWindows = smallWindows
              .filter((_, idx) => !indices.includes(idx))
              .map((win) => {
                const tempGrid = Array(4).fill().map(() => Array(2).fill(false));
                const pos = findPositionForWindow(win.size, [], tempGrid) || { row: 0, col: 0 };
                return { ...win, position: pos };
              })
              .concat([
                {
                  ...largeWindows[largeIndex],
                  position: largePosition,
                },
              ]);

            console.log(`Group cross-dashboard swap successful`);
            console.log(`Updated large windows (${largeDashboardId}): ${JSON.stringify(updatedLargeWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
            console.log(`Updated small windows (${smallDashboardId}): ${JSON.stringify(updatedSmallWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
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
      } else {
        console.log('No group found, attempting fallback cross-dashboard swap');
        const largeWin = largeWindows[largeIndex];
        const smallWin = smallWindows[smallIndex];
        const largePos = findPositionForWindow(largeWin.size, [smallIndex], smallGrid);
        const smallPos = findPositionForWindow(smallWin.size, [largeIndex], largeGrid);
        if (largePos && smallPos) {
          const updatedLargeWindows = largeWindows
            .filter((_, idx) => idx !== largeIndex)
            .concat([{ ...smallWin, position: smallPos }]);
          const updatedSmallWindows = smallWindows
            .filter((_, idx) => idx !== smallIndex)
            .concat([{ ...largeWin, position: largePos }]);

          console.log('Fallback cross-dashboard swap successful');
          console.log(`Updated large windows (${largeDashboardId}): ${JSON.stringify(updatedLargeWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
          console.log(`Updated small windows (${smallDashboardId}): ${JSON.stringify(updatedSmallWindows.map(w => ({ id: w.originalWidget.id, pos: w.position })))}`);
          updateWidgets(largeDashboardId, updatedLargeWindows.map((win) => win.originalWidget));
          updateWidgets(smallDashboardId, updatedSmallWindows.map((win) => win.originalWidget));
          if (dashboardId === largeDashboardId) setWindows(updatedLargeWindows);
          else if (dashboardId === smallDashboardId) setWindows(updatedSmallWindows);
          return true;
        } else {
          console.log('Fallback cross-dashboard swap failed: invalid positions');
        }
      }
    }
    console.log('Cross-dashboard swap failed: no valid configuration found');
    return false;
  };

  const findMatchingGroup = (windows, startIndex, targetArea) => {
    console.log(`Finding group for target area ${targetArea} starting at index ${startIndex}`);
    const queue = [
      {
        indices: [startIndex],
        area: (windowSizes[windows[startIndex]?.size] || windowSizes.small).width *
              (windowSizes[windows[startIndex]?.size] || windowSizes.small).height,
      },
    ];
    const visited = new Set();

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
    console.log('No group found');
    return null;
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

      if (currentScore + score > 200) {
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
        content: (
          <div className={styles.widgetWrapper}>
            <h3 className={`${styles.widgetTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
              {widget.title}
            </h3>
            <div className={`${styles.widgetData} ${isDarkTheme ? styles.darkTheme : ''}`}>
              {widget.data || 'No data'}
            </div>
          </div>
        ),
        position,
      });

      const { width, height } = windowSizes[size] || windowSizes.small;
      for (let r = position.row; r < position.row + height; r++) {
        for (let c = position.col; c < position.col + width; c++) {
          gridRef.current.occupied[r][c] = true;
        }
      }

      currentScore += score;
    });

    console.log(`Windows initialized for ${dashboardId}: ${newWindows.length} windows`);
    setWindows(newWindows);
    prevWidgetsRef.current = initialWidgets;
  }, [initialWidgets, isDarkTheme, dashboardId]);

  const handleWindowClick = (index, event) => {
    if (!editMode) {
      console.log('Edit mode off, ignoring window click');
      return;
    }

    event.stopPropagation();
    console.log(`Window clicked at index ${index} in dashboard ${dashboardId}`);
    onWindowSelect(dashboardId, index, (sourceDashboardId, sourceIndex, targetDashboardId, targetIndex) => {
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
    });
  };

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
            style={{
              gridRow: `${window.position.row + 1} / span ${(windowSizes[window.size] || windowSizes.small).height}`,
              gridColumn: `${window.position.col + 1} / span ${(windowSizes[window.size] || windowSizes.small).width}`,
            }}
            onDelete={() => removeWindow(index)}
            editMode={editMode}
            isSelected={selectedWindow && selectedWindow.dashboardId === dashboardId && selectedWindow.index === index}
            onClick={(e) => handleWindowClick(index, e)}
          >
            {window.content}
          </Window>
        ))}
      </div>
    </div>
  );
};

export default DashboardPlane;
import React, { useContext, useState, useEffect, useRef } from 'react';
import styles from './DashboardPlane.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { FaPlus } from 'react-icons/fa';

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

const DashboardPlane = ({ initialWidgets = [] }) => {
  const { isDarkTheme } = useContext(MainContext);
  const [windows, setWindows] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
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

  const canPlaceWindow = (size, row, col, skipIndices = []) => {
    const { width, height } = windowSizes[size];
    if (row < 0 || col < 0 || row + height > gridRef.current.rows || col + width > gridRef.current.columns) {
      return false;
    }

    const currentScore = calculateScore(windows.filter((_, idx) => !skipIndices.includes(idx)));
    const newScore = currentScore + windowScores[size];
    if (newScore > 200) {
      return false;
    }

    const occupied = gridRef.current.occupied.map((row) => [...row]);
    skipIndices.forEach((skipIndex) => {
      const skippedWindow = windows[skipIndex];
      const { width: sWidth, height: sHeight } = windowSizes[skippedWindow.size];
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
          return false;
        }
      }
    }

    return true;
  };

  const findPositionForWindow = (size, skipIndices = []) => {
    for (let row = 0; row <= gridRef.current.rows - windowSizes[size].height; row++) {
      for (let col = 0; col <= gridRef.current.columns - windowSizes[size].width; col++) {
        if (canPlaceWindow(size, row, col, skipIndices)) {
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
    if (selectedIndex === index) {
      setSelectedIndex(null);
    }
  };

  const handleWindowClick = (index) => {
    if (!editMode) return;

    if (selectedIndex === null) {
      setSelectedIndex(index);
    } else if (selectedIndex !== index) {
      attemptSmartSwap(selectedIndex, index);
      setSelectedIndex(null);
    } else {
      setSelectedIndex(null);
    }
  };

  const attemptSmartSwap = (indexA, indexB) => {
    const windowA = windows[indexA];
    const sizeA = windowA.size;
    const posA = windowA.position;
    const { width: widthA, height: heightA } = windowSizes[sizeA];
    const areaA = widthA * heightA;

    const windowB = windows[indexB];
    const sizeB = windowB.size;
    const posB = windowB.position;
    const { width: widthB, height: heightB } = windowSizes[sizeB];
    const areaB = widthB * heightB;

    if (areaA === areaB) {
      // Direct swap for equal areas
      const canPlaceAatB = canPlaceWindow(sizeA, posB.row, posB.col, [indexA, indexB]);
      const canPlaceBatA = canPlaceWindow(sizeB, posA.row, posA.col, [indexA, indexB]);

      if (canPlaceAatB && canPlaceBatA) {
        setWindows((prev) => {
          const updatedWindows = [...prev];
          updatedWindows[indexA] = { ...windowA, position: posB };
          updatedWindows[indexB] = { ...windowB, position: posA };

          // Update grid occupancy
          for (let r = posA.row; r < posA.row + heightA; r++) {
            for (let c = posA.col; c < posA.col + widthA; c++) {
              gridRef.current.occupied[r][c] = false;
            }
          }
          for (let r = posB.row; r < posB.row + heightB; r++) {
            for (let c = posB.col; c < posB.col + widthB; c++) {
              gridRef.current.occupied[r][c] = false;
            }
          }

          for (let r = posB.row; r < posB.row + heightA; r++) {
            for (let c = posB.col; c < posB.col + widthA; c++) {
              gridRef.current.occupied[r][c] = true;
            }
          }
          for (let r = posA.row; r < posA.row + heightB; r++) {
            for (let c = posA.col; c < posA.col + widthB; c++) {
              gridRef.current.occupied[r][c] = true;
            }
          }

          return updatedWindows;
        });
      } else {
        alert('Cannot swap windows: Invalid positioning or space conflict');
      }
    } else {
      // Determine which window has the larger area
      const [largeIndex, smallIndex, largeSize, largePos, largeArea, smallArea] =
        areaB > areaA
          ? [indexB, indexA, sizeB, posB, areaB, areaA]
          : [indexA, indexB, sizeA, posA, areaA, areaB];

      // Find a group starting with the smaller-area window that matches the larger-area window's area
      const groupSmall = findMatchingGroup(smallIndex, largeArea);
      if (!groupSmall) {
        // Try direct swap as fallback
        const canPlaceAatB = canPlaceWindow(sizeA, posB.row, posB.col, [indexA, indexB]);
        const canPlaceBatA = canPlaceWindow(sizeB, posA.row, posA.col, [indexA, indexB]);

        if (canPlaceAatB && canPlaceBatA) {
          setWindows((prev) => {
            const updatedWindows = [...prev];
            updatedWindows[indexA] = { ...windowA, position: posB };
            updatedWindows[indexB] = { ...windowB, position: posA };

            // Update grid occupancy
            for (let r = posA.row; r < posA.row + heightA; r++) {
              for (let c = posA.col; c < posA.col + widthA; c++) {
                gridRef.current.occupied[r][c] = false;
              }
            }
            for (let r = posB.row; r < posB.row + heightB; r++) {
              for (let c = posB.col; c < posB.col + widthB; c++) {
                gridRef.current.occupied[r][c] = false;
              }
            }

            for (let r = posB.row; r < posB.row + heightA; r++) {
              for (let c = posB.col; c < posB.col + widthA; c++) {
                gridRef.current.occupied[r][c] = true;
              }
            }
            for (let r = posA.row; r < posA.row + heightB; r++) {
              for (let c = posA.col; c < posA.col + widthB; c++) {
                gridRef.current.occupied[r][c] = true;
              }
            }

            return updatedWindows;
          });
        } else {
          alert('Cannot swap windows: Invalid positioning or space conflict');
        }
        return;
      }

      // Proceed with group swap
      const { minRow: groupRow, minCol: groupCol, relativePositions } = groupSmall;
      const largeWindow = windows[largeIndex];
      const canPlaceLargeAtGroup = canPlaceWindow(largeSize, groupRow, groupCol, groupSmall.indices);

      // Try to place group windows in large window's position, preserving relative structure
      let canPlaceGroupAtLarge = true;
      const groupPositions = [];
      const baseRow = largePos.row;
      const baseCol = largePos.col;

      for (const { index, relRow, relCol } of relativePositions) {
        const win = windows[index];
        const newRow = baseRow + relRow;
        const newCol = baseCol + relCol;
        const canPlace = canPlaceWindow(win.size, newRow, newCol, [largeIndex, ...groupSmall.indices]);
        if (canPlace) {
          groupPositions.push({ index, position: { row: newRow, col: newCol } });
        } else {
          // Fall back to finding any valid position
          const pos = findPositionForWindow(win.size, [largeIndex, ...groupSmall.indices]);
          if (pos) {
            groupPositions.push({ index, position: pos });
          } else {
            canPlaceGroupAtLarge = false;
            break;
          }
        }
      }

      if (canPlaceLargeAtGroup && canPlaceGroupAtLarge) {
        setWindows((prev) => {
          const updatedWindows = [...prev];

          // Clear all affected grid positions
          for (let r = largePos.row; r < largePos.row + windowSizes[largeSize].height; r++) {
            for (let c = largePos.col; c < largePos.col + windowSizes[largeSize].width; c++) {
              gridRef.current.occupied[r][c] = false;
            }
          }
          for (const idx of groupSmall.indices) {
            const win = windows[idx];
            const { width, height } = windowSizes[win.size];
            for (let r = win.position.row; r < win.position.row + height; r++) {
              for (let c = win.position.col; c < win.position.col + width; c++) {
                gridRef.current.occupied[r][c] = false;
              }
            }
          }

          // Place large window in group's position
          updatedWindows[largeIndex] = { ...largeWindow, position: { row: groupRow, col: groupCol } };
          for (let r = groupRow; r < groupRow + windowSizes[largeSize].height; r++) {
            for (let c = groupCol; c < groupCol + windowSizes[largeSize].width; c++) {
              gridRef.current.occupied[r][c] = true;
            }
          }

          // Place group windows in new positions
          for (const { index, position } of groupPositions) {
            updatedWindows[index] = { ...windows[index], position };
            const { width, height } = windowSizes[windows[index].size];
            for (let r = position.row; r < position.row + height; r++) {
              for (let c = position.col; c < position.col + width; c++) {
                gridRef.current.occupied[r][c] = true;
              }
            }
          }

          return updatedWindows;
        });
      } else {
        alert('Cannot swap windows: Cannot place all windows');
      }
    }
  };

  const findMatchingGroup = (startIndex, targetArea) => {
    const queue = [{ indices: [startIndex], area: windowSizes[windows[startIndex].size].width * windowSizes[windows[startIndex].size].height }];
    const visited = new Set();

    while (queue.length > 0) {
      const { indices, area } = queue.shift();
      if (area === targetArea) {
        const boundingBox = getBoundingBox(indices);
        // Calculate relative positions for each window in the group
        const relativePositions = indices.map((idx) => ({
          index: idx,
          relRow: windows[idx].position.row - boundingBox.minRow,
          relCol: windows[idx].position.col - boundingBox.minCol,
        }));
        return { indices, minRow: boundingBox.minRow, minCol: boundingBox.minCol, relativePositions };
      }
      if (area > targetArea) continue;

      for (let i = 0; i < windows.length; i++) {
        if (indices.includes(i) || visited.has([...indices, i].sort().join(','))) continue;
        const newIndices = [...indices, i];
        const newArea = newIndices.reduce((sum, idx) => {
          const { width, height } = windowSizes[windows[idx].size];
          return sum + width * height;
        }, 0);
        if (newArea <= targetArea) {
          queue.push({ indices: newIndices, area: newArea });
          visited.add(newIndices.sort().join(','));
        }
      }
    }

    return null;
  };

  const getBoundingBox = (indices) => {
    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;

    indices.forEach((idx) => {
      const win = windows[idx];
      const { row, col } = win.position;
      const { width, height } = windowSizes[win.size];
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

  useEffect(() => {
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

      if (currentScore + score > 200) {
        return;
      }

      const position = findPositionForWindow(size);
      if (!position) {
        return;
      }

      newWindows.push({
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

      const { width, height } = windowSizes[size];
      for (let r = position.row; r < position.row + height; r++) {
        for (let c = position.col; c < position.col + width; c++) {
          gridRef.current.occupied[r][c] = true;
        }
      }

      currentScore += score;
    });

    setWindows(newWindows);
  }, [initialWidgets, isDarkTheme]);

  useEffect(() => {
    const handleExitEditMode = (event) => {
      if (event.detail.planeRef !== planeRef && editMode) {
        setEditMode(false);
        setSelectedIndex(null);
      }
    };

    document.addEventListener('exitEditMode', handleExitEditMode);
    return () => document.removeEventListener('exitEditMode', handleExitEditMode);
  }, [editMode]);

  const toggleEditMode = () => {
    setEditMode((prev) => {
      const newEditMode = !prev;
      if (newEditMode) {
        document.dispatchEvent(new CustomEvent('exitEditMode', { detail: { planeRef } }));
      }
      setSelectedIndex(null);
      return newEditMode;
    });
  };

  return (
    <div
      className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ''} ${editMode ? styles.editModeContainer : ''}`}
      ref={planeRef}
    >
      <button className={styles.toggleEditButton} onClick={toggleEditMode}>
        {editMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
      </button>
      {editMode && (
        <div className={styles.controls}>
          <button className={styles.doneButton} onClick={() => setEditMode(false)}>
            Done
          </button>
          <button
            className={styles.addButton}
            onClick={() =>
              addWindow('verySmall', (
                <div className={styles.widgetWrapper}>
                  <h3 className={styles.widgetTitle}>New Widget</h3>
                  <div className={styles.widgetData}>Add content</div>
                </div>
              ))
            }
          >
            <FaPlus /> Very Small
          </button>
          <button
            className={styles.addButton}
            onClick={() =>
              addWindow('small', (
                <div className={styles.widgetWrapper}>
                  <h3 className={styles.widgetTitle}>New Widget</h3>
                  <div className={styles.widgetData}>Add content</div>
                </div>
              ))
            }
          >
            <FaPlus /> Small
          </button>
          <button
            className={styles.addButton}
            onClick={() =>
              addWindow('medium', (
                <div className={styles.widgetWrapper}>
                  <h3 className={styles.widgetTitle}>New Widget</h3>
                  <div className={styles.widgetData}>Add content</div>
                </div>
              ))
            }
          >
            <FaPlus /> Medium
          </button>
          <button
            className={styles.addButton}
            onClick={() =>
              addWindow('big', (
                <div className={styles.widgetWrapper}>
                  <h3 className={styles.widgetTitle}>New Widget</h3>
                  <div className={styles.widgetData}>Add content</div>
                </div>
              ))
            }
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
            isSelected={selectedIndex === index}
            onClick={() => handleWindowClick(index)}
          >
            {window.content}
          </Window>
        ))}
      </div>
    </div>
  );
};

export default DashboardPlane;
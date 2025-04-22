import React, { useRef, useContext, useState, useMemo } from 'react';
import styles from './Dashboard.module.css';
import { MainContext } from '../Contexts/MainContext';
import DashboardPlane from './Dashboard Plane/DashboardPlane';
import { FaPlus } from 'react-icons/fa';
import useModal from '../Modal/Hooks/UseModal';
import Modal from '../Modal/Modal';
import WidgetSizeModal from '../Modal/WidgetSizeModal/WidgetSizeModal';

const Dashboard = ({ onWidgetClick, activeDashboardId, onDashboardChange }) => {
  const { isDarkTheme, dashboards, setDashboards, metricsCategories } = useContext(MainContext);
  const [editMode, setEditMode] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const widgetSizeModal = useModal();

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

  const toggleEditMode = () => {
    setEditMode((prev) => !prev);
    setDraggedWidget(null);
  };

  const validateDashboardScore = (currentWidgets, newWidgets) => {
    const totalScore = newWidgets.reduce((sum, widget) => {
      const size = widget.size || 'small';
      return sum + (windowScores[size] || 0);
    }, 0);
    return totalScore <= 80;
  };

  const canPlaceWidget = (dashboard, widget, row, col, skipWidgets = [], customGrid = null) => {
    const size = widget.size;
    const { width, height } = windowSizes[size] || windowSizes.small;
    if (row < 0 || col < 0 || row + height > 4 || col + width > 2) {
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
      : Array(4)
          .fill()
          .map(() => Array(2).fill(false));

    dashboard.dashboardWidgets.forEach((w) => {
      if (skipWidgets.some((sw) => sw.id === w.id)) return;
      if (!w.position || typeof w.position.row === 'undefined' || typeof w.position.col === 'undefined') {
        return;
      }
      const { width: wWidth, height: wHeight } = windowSizes[w.size] || windowSizes.small;
      for (let r = w.position.row; r < w.position.row + wHeight; r++) {
        for (let c = w.position.col; c < w.position.col + wWidth; c++) {
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

  const findFreePosition = (dashboard, size, skipWidgets = [], customGrid = null) => {
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
      if (canPlaceWidget(dashboard, { id: 'temp', size }, pos.row, pos.col, skipWidgets, customGrid)) {
        return pos;
      }
    }
    return null;
  };

  const cleanupEmptyDashboards = (currentDashboards) => {
    let newDashboards = currentDashboards.filter((dashboard) => dashboard.dashboardWidgets.length > 0);
    if (newDashboards.length === 0) {
      newDashboards = [
        {
          id: `dashboard-${Date.now()}`,
          dashboardWidgets: [],
        },
      ];
    }
    return newDashboards;
  };

  const addWindowToDashboard = (size) => {
    const newWidgetId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newWidget = {
      id: newWidgetId,
      size,
      title: 'Untitled',
      metrics: [],
      category: null,
      position: { row: 0, col: 0 },
      dashboardId: activeDashboardId,
    };

    let targetDashboard = null;
    let freePosition = null;

    // Prioritize the active dashboard
    const activeDashboard = dashboards.find((d) => d.id === activeDashboardId);
    if (activeDashboard) {
      const existingWidgetIds = new Set(activeDashboard.dashboardWidgets.map((w) => w.id));
      if (existingWidgetIds.has(newWidgetId)) {
        alert('Error: Duplicate widget ID. Please try again.');
        widgetSizeModal.close();
        return;
      }

      const newWidgets = [...activeDashboard.dashboardWidgets, { ...newWidget, position: { row: 0, col: 0 } }];
      if (validateDashboardScore(activeDashboard.dashboardWidgets, newWidgets)) {
        freePosition = findFreePosition(activeDashboard, size);
        if (freePosition) {
          targetDashboard = activeDashboard;
        }
      }
    }

    // If active dashboard can't fit, check other dashboards
    if (!targetDashboard || !freePosition) {
      for (const dashboard of dashboards) {
        if (dashboard.id === activeDashboardId) continue;
        const existingWidgetIds = new Set(dashboard.dashboardWidgets.map((w) => w.id));
        if (existingWidgetIds.has(newWidgetId)) {
          alert('Error: Duplicate widget ID. Please try again.');
          widgetSizeModal.close();
          return;
        }

        const newWidgets = [...dashboard.dashboardWidgets, { ...newWidget, position: { row: 0, col: 0 } }];
        if (!validateDashboardScore(dashboard.dashboardWidgets, newWidgets)) {
          continue;
        }

        freePosition = findFreePosition(dashboard, size);
        if (freePosition) {
          targetDashboard = dashboard;
          break;
        }
      }
    }

    // If no dashboard can fit, create a new one
    if (!targetDashboard || !freePosition) {
      const newDashboardId = `dashboard-${Date.now()}`;
      targetDashboard = { id: newDashboardId, dashboardWidgets: [] };
      freePosition = findFreePosition(targetDashboard, size);
      if (!freePosition) {
        alert('Cannot add widget: No valid position available.');
        widgetSizeModal.close();
        return;
      }

      setDashboards((prev) => {
        const newDashboards = [
          ...prev,
          {
            ...targetDashboard,
            dashboardWidgets: [{ ...newWidget, position: freePosition, dashboardId: newDashboardId }],
          },
        ];
        widgetSizeModal.close();
        return cleanupEmptyDashboards(newDashboards);
      });
      onDashboardChange(newDashboardId);
      return;
    }

    setDashboards((prev) => {
      const newDashboards = prev.map((dashboard) =>
        dashboard.id === targetDashboard.id
          ? {
              ...dashboard,
              dashboardWidgets: [
                ...dashboard.dashboardWidgets,
                { ...newWidget, position: freePosition, dashboardId: targetDashboard.id },
              ],
            }
          : dashboard
      );
      widgetSizeModal.close();
      return cleanupEmptyDashboards(newDashboards);
    });
  };

  const reassignOverlappingWidgets = (
    dashboard,
    overlappingWidgets,
    targetPos,
    draggedWidgetData,
    draggedSize,
    sourceDashboard = null,
    sourcePos = null
  ) => {
    let tempGrid = Array(4)
      .fill()
      .map(() => Array(2).fill(false));
    let newWidgets = dashboard.dashboardWidgets.filter((w) => !overlappingWidgets.some((ow) => ow.id === w.id));
    let skipWidgets = [draggedWidgetData];

    if (
      !canPlaceWidget(
        { dashboardWidgets: newWidgets },
        { id: draggedWidgetData.id, size: draggedSize },
        targetPos.row,
        targetPos.col,
        skipWidgets,
        tempGrid
      )
    ) {
      return null;
    }
    newWidgets.push({ ...draggedWidgetData, size: draggedSize, position: targetPos });
    const { width, height } = windowSizes[draggedSize];
    for (let r = targetPos.row; r < targetPos.row + height; r++) {
      for (let c = targetPos.col; c < targetPos.col + width; c++) {
        if (r >= 0 && r < 4 && c >= 0 && c < 2) {
          tempGrid[r][c] = true;
        }
      }
    }

    const targetDashboard = sourceDashboard || dashboard;
    const isSameDashboard = !sourceDashboard;

    let canSwap = true;
    let targetTempGrid = Array(4)
      .fill()
      .map(() => Array(2).fill(false));
    const targetSkipWidgets = [draggedWidgetData];
    const targetWidgets = isSameDashboard
      ? newWidgets
      : targetDashboard.dashboardWidgets.filter((w) => w.id !== draggedWidgetData.id);
    let tempTargetWidgets = [...targetWidgets];

    for (const widget of overlappingWidgets) {
      const size = widget.size;
      const freePos = findFreePosition({ dashboardWidgets: tempTargetWidgets }, size, targetSkipWidgets, targetTempGrid);
      if (freePos) {
        tempTargetWidgets.push({ ...widget, position: freePos });
        targetSkipWidgets.push(widget);
        const { width: wWidth, height: wHeight } = windowSizes[size];
        for (let r = freePos.row; r < freePos.row + wHeight; r++) {
          for (let c = freePos.col; c < freePos.col + wWidth; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) {
              targetTempGrid[r][c] = true;
            }
          }
        }
      } else {
        canSwap = false;
        break;
      }
    }

    if (canSwap) {
      if (isSameDashboard) {
        const finalWidgets = tempTargetWidgets
          .filter((w) => w.id !== draggedWidgetData.id)
          .concat({
            ...draggedWidgetData,
            size: draggedSize,
            position: targetPos,
          });
        return { targetWidgets: finalWidgets };
      }
      return {
        targetWidgets: newWidgets,
        sourceWidgets: tempTargetWidgets,
      };
    }

    const remainingWidgets = [...overlappingWidgets];
    const placedWidgets = [];

    while (remainingWidgets.length > 0) {
      const widget = remainingWidgets.shift();
      const size = widget.size;
      const freePos = findFreePosition({ dashboardWidgets: newWidgets }, size, skipWidgets, tempGrid);
      if (freePos) {
        newWidgets.push({ ...widget, position: freePos });
        skipWidgets.push(widget);
        placedWidgets.push(widget);
        const { width: wWidth, height: wHeight } = windowSizes[size];
        for (let r = freePos.row; r < freePos.row + wHeight; r++) {
          for (let c = freePos.col; c < freePos.col + wWidth; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) {
              tempGrid[r][c] = true;
            }
          }
        }
      } else {
        remainingWidgets.push(widget);
        break;
      }
    }

    if (remainingWidgets.length === 0) {
      return { targetWidgets: newWidgets };
    }

    return null;
  };

  const handleDrop = ({ dashboardId, row, col }) => {
    if (!draggedWidget || !editMode || !isInitialized) {
      setDraggedWidget(null);
      return;
    }

    const sourceDashboardId = draggedWidget.dashboardId;
    const sourceIndex = draggedWidget.index;
    const draggedSize = draggedWidget.size;
    const draggedWidgetData = draggedWidget.widget;
    const draggedOriginalPos = draggedWidget.position;

    if (sourceDashboardId === dashboardId && draggedWidget.position.row === row && draggedWidget.position.col === col) {
      setDraggedWidget(null);
      return;
    }

    setDashboards((prev) => {
      if (!prev || !Array.isArray(prev)) {
        alert('Error: Dashboard state is corrupted. Please refresh.');
        setDraggedWidget(null);
        return prev || [];
      }

      const sourceDashboard = prev.find((d) => d.id === sourceDashboardId);
      const targetDashboard = prev.find((d) => d.id === dashboardId);
      if (!sourceDashboard || !targetDashboard) {
        setDraggedWidget(null);
        return prev;
      }

      const targetPos = getValidPosition(draggedSize, row, col);
      if (!targetPos || isNaN(targetPos.row) || isNaN(targetPos.col)) {
        alert(`Cannot place widget: Invalid position for ${draggedSize} widget`);
        setDraggedWidget(null);
        return prev;
      }

      const skipWidgets = sourceDashboardId === dashboardId ? [draggedWidgetData] : [];
      const overlappingWidgets = targetDashboard.dashboardWidgets.filter((w) => {
        if (skipWidgets.some((sw) => sw.id === w.id)) return false;
        if (!w.position || isNaN(w.position.row) || isNaN(w.position.col)) {
          return false;
        }
        const { width, height } = windowSizes[w.size] || windowSizes.small;
        const wRow = w.position.row;
        const wCol = w.position.col;
        const tRow = targetPos.row;
        const tCol = targetPos.col;
        const tWidth = windowSizes[draggedSize].width;
        const tHeight = windowSizes[draggedSize].height;

        return wRow < tRow + tHeight && wRow + height > tRow && wCol < tCol + tWidth && wCol + width > tCol;
      });

      if (sourceDashboardId === dashboardId && overlappingWidgets.length > 0) {
        const reassignment = reassignOverlappingWidgets(
          targetDashboard,
          overlappingWidgets,
          targetPos,
          draggedWidgetData,
          draggedSize
        );

        if (reassignment) {
          const { targetWidgets } = reassignment;
          if (!validateDashboardScore(targetDashboard.dashboardWidgets, targetWidgets)) {
            alert('Cannot move widget: Score limit reached');
            setDraggedWidget(null);
            return prev;
          }

          return cleanupEmptyDashboards(
            prev.map((dashboard) =>
              dashboard.id === dashboardId ? { ...dashboard, dashboardWidgets: targetWidgets } : dashboard
            )
          );
        }

        alert('Cannot drop widget: No valid positions for displaced widgets');
        setDraggedWidget(null);
        return prev;
      }

      if (sourceDashboardId !== dashboardId && overlappingWidgets.length === 1) {
        const overlappingWidget = overlappingWidgets[0];
        const sourceWidgets = sourceDashboard.dashboardWidgets.filter((w) => w.id !== draggedWidgetData.id);
        const possiblePositions = overlappingWidget.size === 'small'
          ? [
              { row: draggedOriginalPos.row, col: draggedOriginalPos.col },
              { row: draggedOriginalPos.row, col: draggedOriginalPos.col + 1 },
            ].filter((pos) => pos.row < 4 && pos.col < 2 && (pos.row === 0 || pos.row === 2))
          : overlappingWidget.size === 'verySmall'
          ? [
              { row: draggedOriginalPos.row, col: draggedOriginalPos.col },
              { row: draggedOriginalPos.row, col: draggedOriginalPos.col + 1 },
              { row: draggedOriginalPos.row + 1, col: draggedOriginalPos.col },
              { row: draggedOriginalPos.row + 1, col: draggedOriginalPos.col + 1 },
              { row: 0, col: 0 },
              { row: 0, col: 1 },
              { row: 1, col: 0 },
              { row: 1, col: 1 },
              { row: 2, col: 0 },
              { row: 2, col: 1 },
              { row: 3, col: 0 },
              { row: 3, col: 1 },
            ].filter((pos) => pos.row < 4 && pos.col < 2)
          : [{ row: draggedOriginalPos.row, col: draggedOriginalPos.col }];

        for (const pos of possiblePositions) {
          if (
            canPlaceWidget(
              targetDashboard,
              { id: draggedWidgetData.id, size: draggedSize },
              targetPos.row,
              targetPos.col,
              [overlappingWidget]
            ) &&
            canPlaceWidget(
              { dashboardWidgets: sourceWidgets },
              { id: overlappingWidget.id, size: overlappingWidget.size },
              pos.row,
              pos.col,
              []
            )
          ) {
            const targetNewWidgets = [
              ...targetDashboard.dashboardWidgets.filter((w) => w.id !== overlappingWidget.id),
              { ...draggedWidgetData, size: draggedSize, position: targetPos },
            ];
            const sourceNewWidgets = [
              ...sourceDashboard.dashboardWidgets.filter((w) => w.id !== draggedWidgetData.id),
              { ...overlappingWidget, size: overlappingWidget.size, position: pos },
            ];

            if (
              !validateDashboardScore(targetDashboard.dashboardWidgets, targetNewWidgets) ||
              !validateDashboardScore(sourceDashboard.dashboardWidgets, sourceNewWidgets)
            ) {
              alert('Cannot swap widgets: Score limit reached');
              setDraggedWidget(null);
              return prev;
            }

            return cleanupEmptyDashboards(
              prev.map((dashboard) => {
                if (dashboard.id === sourceDashboardId) {
                  return { ...dashboard, dashboardWidgets: sourceNewWidgets };
                }
                if (dashboard.id === dashboardId) {
                  return { ...dashboard, dashboardWidgets: targetNewWidgets };
                }
                return dashboard;
              })
            );
          }
        }

        const freePos = findFreePosition({ dashboardWidgets: sourceWidgets }, overlappingWidget.size, []);
        if (freePos && !isNaN(freePos.row) && !isNaN(freePos.col)) {
          const targetNewWidgets = [
            ...targetDashboard.dashboardWidgets.filter((w) => w.id !== overlappingWidget.id),
            { ...draggedWidgetData, size: draggedSize, position: targetPos },
          ];
          const sourceNewWidgets = [
            ...sourceDashboard.dashboardWidgets.filter((w) => w.id !== draggedWidgetData.id),
            { ...overlappingWidget, size: overlappingWidget.size, position: freePos },
          ];

          if (
            !validateDashboardScore(targetDashboard.dashboardWidgets, targetNewWidgets) ||
            !validateDashboardScore(sourceDashboard.dashboardWidgets, sourceNewWidgets)
          ) {
            alert('Cannot swap widgets: Score limit reached');
            setDraggedWidget(null);
            return prev;
          }

          return cleanupEmptyDashboards(
            prev.map((dashboard) => {
              if (dashboard.id === sourceDashboardId) {
                return { ...dashboard, dashboardWidgets: sourceNewWidgets };
              }
              if (dashboard.id === dashboardId) {
                return { ...dashboard, dashboardWidgets: targetNewWidgets };
              }
              return dashboard;
            })
          );
        }

        alert('Cannot swap widget: No valid position for displaced widget');
        setDraggedWidget(null);
        return prev;
      }

      if (sourceDashboardId !== dashboardId && overlappingWidgets.length > 0) {
        const reassignment = reassignOverlappingWidgets(
          targetDashboard,
          overlappingWidgets,
          targetPos,
          draggedWidgetData,
          draggedSize,
          sourceDashboard,
          draggedOriginalPos
        );

        if (reassignment) {
          const { targetWidgets, sourceWidgets } = reassignment;
          if (
            !validateDashboardScore(targetDashboard.dashboardWidgets, targetWidgets) ||
            (sourceWidgets && !validateDashboardScore(sourceDashboard.dashboardWidgets, sourceWidgets))
          ) {
            alert('Cannot move widget: Score limit reached');
            setDraggedWidget(null);
            return prev;
          }

          return cleanupEmptyDashboards(
            prev.map((dashboard) => {
              if (dashboard.id === sourceDashboardId && sourceWidgets) {
                return { ...dashboard, dashboardWidgets: sourceWidgets };
              }
              if (dashboard.id === dashboardId) {
                return { ...dashboard, dashboardWidgets: targetWidgets };
              }
              return dashboard;
            })
          );
        }

        alert('Cannot drop widget: No valid positions for displaced widgets');
        setDraggedWidget(null);
        return prev;
      }

      if (sourceDashboardId !== dashboardId && overlappingWidgets.length === 0) {
        const targetNewWidgets = [
          ...targetDashboard.dashboardWidgets,
          { ...draggedWidgetData, size: draggedSize, position: targetPos },
        ];
        const sourceNewWidgets = sourceDashboard.dashboardWidgets.filter((_, i) => i !== sourceIndex);

        if (
          !validateDashboardScore(targetDashboard.dashboardWidgets, targetNewWidgets) ||
          !validateDashboardScore(sourceDashboard.dashboardWidgets, sourceNewWidgets)
        ) {
          alert('Cannot move widget: Score limit reached');
          setDraggedWidget(null);
          return prev;
        }

        return cleanupEmptyDashboards(
          prev.map((dashboard) => {
            if (dashboard.id === sourceDashboardId) {
              return { ...dashboard, dashboardWidgets: sourceNewWidgets };
            }
            if (dashboard.id === dashboardId) {
              return { ...dashboard, dashboardWidgets: targetNewWidgets };
            }
            return dashboard;
          })
        );
      }

      const draggedElement = document.querySelector(`.${styles.dragging}`);
      if (draggedElement) {
        draggedElement.classList.remove(styles.dragging);
      }
      setDraggedWidget(null);
      return prev;
    });
  };

  const handleDragStart = (e, widgetInfo) => {
    if (!editMode || !isInitialized) return;
    setDraggedWidget(widgetInfo);
    e.dataTransfer.setData('text/plain', JSON.stringify(widgetInfo));
    e.target.classList.add(styles.dragging);
    e.target.addEventListener(
      'dragend',
      () => {
        e.target.classList.remove(styles.dragging);
      },
      { once: true }
    );
  };

  const updateWidgets = (dashboardId, newWidgets) => {
    const dashboard = dashboards.find((d) => d.id === dashboardId);
    if (!dashboard) {
      return;
    }

    const uniqueWidgets = [];
    const seenIds = new Set();
    for (const widget of newWidgets.reverse()) {
      if (!seenIds.has(widget.id)) {
        uniqueWidgets.push({
          ...widget,
          position: widget.position || { row: 0, col: 0 },
        });
        seenIds.add(widget.id);
      }
    }
    uniqueWidgets.reverse();

    if (!validateDashboardScore(dashboard.dashboardWidgets, uniqueWidgets)) {
      return;
    }

    setDashboards((prev) => {
      const newDashboards = prev.map((dashboard) =>
        dashboard.id === dashboardId ? { ...dashboard, dashboardWidgets: uniqueWidgets } : dashboard
      );
      return cleanupEmptyDashboards(newDashboards);
    });
    setIsInitialized(true);
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

  const handleAddWidgetClick = () => {
    widgetSizeModal.open();
  };

  const handleWidgetSizeSelect = (size) => {
    addWindowToDashboard(size);
  };

  const handleWidgetClick = (payload) => {
    onWidgetClick(payload);
  };

  const memoizedDashboards = useMemo(() => {
    return dashboards.map((d) => ({
      ...d,
      dashboardWidgets: d.dashboardWidgets.map((w) => ({ ...w })),
    }));
  }, [dashboards]);

  return (
    <div className={`${styles.dashboardWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={styles.buttonGroup}>
        {editMode && (
          <div className={styles.controls}>
            <button className={styles.addButton} onClick={handleAddWidgetClick}>
              <FaPlus /> Add
            </button>
          </div>
        )}
        {editMode && (
          <button
            className={`${styles.editHeaderButton} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={toggleEditMode}
          >
            Done
          </button>
        )}

      </div>

      <div className={styles.windowsSection}>
        {memoizedDashboards.map((dashboard) => (
          <DashboardPlane
            key={dashboard.id}
            dashboardId={dashboard.id}
            initialWidgets={dashboard.dashboardWidgets}
            editMode={editMode}
            updateWidgets={updateWidgets}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onWidgetClick={handleWidgetClick}
          />
        ))}
      </div>

      {widgetSizeModal.isOpen && (
        <Modal onClose={widgetSizeModal.close} modalType="widgetSize">
          <WidgetSizeModal handleClose={widgetSizeModal.close} onSelectSize={handleWidgetSizeSelect} />
        </Modal>
      )}
      {!editMode && (
        <button
          className={`${styles.editHeaderButton} ${isDarkTheme ? styles.darkTheme : ''}`}
          onClick={toggleEditMode}
        >
          Edit
        </button>
      )}
    </div>
  );
};

export default Dashboard;
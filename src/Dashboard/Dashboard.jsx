import React, { useRef, useContext, useState, useMemo, useCallback } from 'react';
import styles from './Dashboard.module.css';
import { MainContext } from '../Contexts/MainContext';
import DashboardPlane from './Dashboard Plane/DashboardPlane';
import { FaPlus } from 'react-icons/fa';
import useModal from '../Modal/Hooks/UseModal';
import Modal from '../Modal/Modal';
import WidgetSizeModal from '../Modal/WidgetSizeModal/WidgetSizeModal';

const Dashboard = ({ onWidgetClick, activeDashboardId, onDashboardChange }) => {
  const { isDarkTheme, dashboards, setDashboards } = useContext(MainContext);
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

  const getWidgetArea = (size) => {
    const { width, height } = windowSizes[size] || windowSizes.small;
    return width * height;
  };

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
    setDraggedWidget(null);
  }, []);

  const validateDashboardScore = useCallback((currentWidgets, newWidgets) => {
    const totalScore = newWidgets.reduce((sum, widget) => {
      const size = widget.size || 'small';
      return sum + (windowScores[size] || 0);
    }, 0);
    return totalScore <= 80;
  }, []);

  const canPlaceWidget = useCallback((dashboard, widget, row, col, skipWidgets = [], customGrid = null) => {
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
      if (skipWidgets.some((sw) => sw.id === w.id && (
        !sw.position || !w.position ||
        (sw.position.row === w.position.row && sw.position.col === w.position.col)
      ))) return;
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
  }, []);

  const findFreePosition = useCallback((dashboard, size, skipWidgets = [], customGrid = null) => {
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
  }, [canPlaceWidget]);

  const cleanupEmptyDashboards = useCallback((currentDashboards) => {
    let newDashboards = currentDashboards.filter((dashboard) => dashboard.dashboardWidgets.length > 0);
    if (newDashboards.length === 0) {
      newDashboards = [
        {
          docId: `dashboard-${Date.now()}`,
          id: `dashboard-${Date.now()}`,
          dashboardWidgets: [],
          isModified: true,
          action: 'add',
        },
      ];
      onDashboardChange(newDashboards[0].id);
    } else if (!newDashboards.some((d) => d.id === activeDashboardId)) {
      onDashboardChange(newDashboards[0].id);
    }
    return newDashboards;
  }, [onDashboardChange, activeDashboardId]);

  const addWindowToDashboard = useCallback((size) => {
    const newWidgetId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newWidget = {
      id: newWidgetId,
      size,
      metrics: [],
      category: null,
      position: { row: 0, col: 0 },
      dashboardId: activeDashboardId,
    };

    let targetDashboard = null;
    let freePosition = null;

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

    if (!targetDashboard || !freePosition) {
      const newDashboardId = `dashboard-${Date.now()}`;
      targetDashboard = { docId: newDashboardId, id: newDashboardId, dashboardWidgets: [], isModified: true, action: 'add' };
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
              isModified: true,
              action: dashboard.action || 'update',
            }
          : dashboard
      );
      widgetSizeModal.close();
      return cleanupEmptyDashboards(newDashboards);
    });
  }, [activeDashboardId, dashboards, setDashboards, onDashboardChange, widgetSizeModal, validateDashboardScore, findFreePosition, cleanupEmptyDashboards]);

  const getValidPosition = useCallback((size, row, col) => {
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
  }, []);

  const reassignOverlappingWidgets = (targetDashboard, overlappingWidgets, targetPos, draggedWidgetData, draggedSize, sourceDashboard = null, draggedOriginalPos = null) => {
    const remainingWidgets = targetDashboard.dashboardWidgets.filter((w) => !overlappingWidgets.some((ow) => ow.id === w.id));
    const newTargetWidgets = [...remainingWidgets, { ...draggedWidgetData, size: draggedSize, position: targetPos }];
    let sourceWidgets = sourceDashboard ? sourceDashboard.dashboardWidgets.filter((w) => w.id !== draggedWidgetData.id) : null;

    const tempGrid = Array(4).fill().map(() => Array(2).fill(false));
    newTargetWidgets.forEach((w) => {
      const { width, height } = windowSizes[w.size] || windowSizes.small;
      for (let r = w.position.row; r < w.position.row + height; r++) {
        for (let c = w.position.col; c < w.position.col + width; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) {
            tempGrid[r][c] = true;
          }
        }
      }
    });

    for (const widget of overlappingWidgets) {
      const pos = findFreePosition({ dashboardWidgets: newTargetWidgets }, widget.size, [], tempGrid);
      if (pos) {
        newTargetWidgets.push({ ...widget, position: pos });
        const { width, height } = windowSizes[widget.size] || windowSizes.small;
        for (let r = pos.row; r < pos.row + height; r++) {
          for (let c = pos.col; c < pos.col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) {
              tempGrid[r][c] = true;
            }
          }
        }
      } else if (sourceDashboard && draggedOriginalPos) {
        const sourcePos = draggedOriginalPos;
        if (canPlaceWidget({ dashboardWidgets: sourceWidgets || [] }, widget, sourcePos.row, sourcePos.col, [])) {
          sourceWidgets = [...(sourceWidgets || []), { ...widget, position: sourcePos }];
        } else {
          const newSourcePos = findFreePosition({ dashboardWidgets: sourceWidgets || [] }, widget.size, []);
          if (newSourcePos) {
            sourceWidgets = [...(sourceWidgets || []), { ...widget, position: newSourcePos }];
          } else {
            return null;
          }
        }
      } else {
        return null;
      }
    }

    return { targetWidgets: newTargetWidgets, sourceWidgets };
  };

  const handleDrop = useCallback(({ dashboardId, row, col }) => {
    console.log('[handleDrop] called', { dashboardId, row, col, draggedWidget, editMode, isInitialized });
    if (!draggedWidget || !editMode || !isInitialized) {
      console.log('[handleDrop] Not dropping: missing draggedWidget, editMode, or not initialized');
      setDraggedWidget(null);
      return;
    }

    const sourceDashboardId = draggedWidget.dashboardId;
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

          const updatedDashboards = prev.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  dashboardWidgets: targetWidgets.map((w) => ({
                    ...w,
                    dashboardId: dashboardId,
                  })),
                  isModified: true,
                  action: dashboard.action || 'update',
                }
              : dashboard
          );
          return cleanupEmptyDashboards(updatedDashboards);
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
              { ...draggedWidgetData, size: draggedSize, position: targetPos, dashboardId: dashboardId },
            ];
            const sourceNewWidgets = [
              ...sourceDashboard.dashboardWidgets.filter((w) => w.id !== draggedWidgetData.id),
              { ...overlappingWidget, size: overlappingWidget.size, position: pos, dashboardId: sourceDashboardId },
            ];

            if (
              !validateDashboardScore(targetDashboard.dashboardWidgets, targetNewWidgets) ||
              !validateDashboardScore(sourceDashboard.dashboardWidgets, sourceNewWidgets)
            ) {
              alert('Cannot swap widgets: Score limit reached');
              setDraggedWidget(null);
              return prev;
            }

            const updatedDashboards = prev.map((dashboard) => {
              if (dashboard.id === sourceDashboardId) {
                return {
                  ...dashboard,
                  dashboardWidgets: sourceNewWidgets,
                  isModified: true,
                  action: sourceNewWidgets.length === 0 ? 'remove' : (dashboard.action || 'update'),
                };
              }
              if (dashboard.id === dashboardId) {
                return {
                  ...dashboard,
                  dashboardWidgets: targetNewWidgets,
                  isModified: true,
                  action: dashboard.action || 'update',
                };
              }
              return dashboard;
            });
            return cleanupEmptyDashboards(updatedDashboards);
          }
        }

        const freePos = findFreePosition({ dashboardWidgets: sourceWidgets }, overlappingWidget.size, []);
        if (freePos && !isNaN(freePos.row) && !isNaN(freePos.col)) {
          const targetNewWidgets = [
            ...targetDashboard.dashboardWidgets.filter((w) => w.id !== overlappingWidget.id),
            { ...draggedWidgetData, size: draggedSize, position: targetPos, dashboardId: dashboardId },
          ];
          const sourceNewWidgets = [
            ...sourceDashboard.dashboardWidgets.filter((w) => w.id !== draggedWidgetData.id),
            { ...overlappingWidget, size: overlappingWidget.size, position: freePos, dashboardId: sourceDashboardId },
          ];

          if (
            !validateDashboardScore(targetDashboard.dashboardWidgets, targetNewWidgets) ||
            !validateDashboardScore(sourceDashboard.dashboardWidgets, sourceNewWidgets)
          ) {
            alert('Cannot swap widgets: Score limit reached');
            setDraggedWidget(null);
            return prev;
          }

          const updatedDashboards = prev.map((dashboard) => {
            if (dashboard.id === sourceDashboardId) {
              return {
                ...dashboard,
                dashboardWidgets: sourceNewWidgets,
                isModified: true,
                action: sourceNewWidgets.length === 0 ? 'remove' : (dashboard.action || 'update'),
              };
            }
            if (dashboard.id === dashboardId) {
              return {
                ...dashboard,
                dashboardWidgets: targetNewWidgets,
                isModified: true,
                action: dashboard.action || 'update',
              };
            }
            return dashboard;
          });
          return cleanupEmptyDashboards(updatedDashboards);
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

          const updatedDashboards = prev.map((dashboard) => {
            if (dashboard.id === sourceDashboardId && sourceWidgets) {
              return {
                ...dashboard,
                dashboardWidgets: sourceWidgets.map((w) => ({
                  ...w,
                  dashboardId: sourceDashboardId,
                })),
                isModified: true,
                action: sourceWidgets.length === 0 ? 'remove' : (dashboard.action || 'update'),
              };
            }
            if (dashboard.id === dashboardId) {
              return {
                ...dashboard,
                dashboardWidgets: targetWidgets.map((w) => ({
                  ...w,
                  dashboardId: dashboardId,
                })),
                isModified: true,
                action: dashboard.action || 'update',
              };
            }
            return dashboard;
          });
          return cleanupEmptyDashboards(updatedDashboards);
        }

        alert('Cannot drop widget: No valid positions for displaced widgets');
        setDraggedWidget(null);
        return prev;
      }

      if (sourceDashboardId !== dashboardId && overlappingWidgets.length === 0) {
        const targetNewWidgets = [
          ...targetDashboard.dashboardWidgets,
          { ...draggedWidgetData, size: draggedSize, position: targetPos, dashboardId: dashboardId },
        ];
        const sourceNewWidgets = sourceDashboard.dashboardWidgets.filter((w) => w.id !== draggedWidgetData.id);

        if (
          !validateDashboardScore(targetDashboard.dashboardWidgets, targetNewWidgets) ||
          !validateDashboardScore(sourceDashboard.dashboardWidgets, sourceNewWidgets)
        ) {
          alert('Cannot move widget: Score limit reached');
          setDraggedWidget(null);
          return prev;
        }

        const updatedDashboards = prev.map((dashboard) => {
          if (dashboard.id === sourceDashboardId) {
            return {
              ...dashboard,
              dashboardWidgets: sourceNewWidgets,
              isModified: true,
              action: sourceNewWidgets.length === 0 ? 'remove' : (dashboard.action || 'update'),
            };
          }
          if (dashboard.id === dashboardId) {
            return {
              ...dashboard,
              dashboardWidgets: targetNewWidgets,
              isModified: true,
              action: dashboard.action || 'update',
            };
          }
          return dashboard;
        });
        return cleanupEmptyDashboards(updatedDashboards);
      }

      const draggedElement = document.querySelector(`.${styles.dragging}`);
      if (draggedElement) {
        draggedElement.classList.remove(styles.dragging);
      }
      setDraggedWidget(null);
      return prev;
    });
  }, [draggedWidget, editMode, isInitialized, setDashboards, validateDashboardScore, cleanupEmptyDashboards, getValidPosition, canPlaceWidget, findFreePosition]);

  const handleDragStart = useCallback((e, widgetInfo) => {
    console.log('[handleDragStart] called', { widgetInfo, editMode, isInitialized });
    if (!editMode) return;
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
    setIsInitialized(true);
  }, [editMode]);

  const updateWidgets = useCallback((dashboardId, newWidgets) => {
    setDashboards((prev) => {
      const newDashboards = prev.map((dashboard) => {
        if (dashboard.id === dashboardId) {
          const uniqueWidgets = [];
          const seenIds = new Set();
          for (const widget of newWidgets.reverse()) {
            if (!seenIds.has(widget.id)) {
              uniqueWidgets.push({
                ...widget,
                position: widget.position || { row: 0, col: 0 },
                dashboardId: dashboardId,
              });
              seenIds.add(widget.id);
            }
          }
          uniqueWidgets.reverse();

          if (!validateDashboardScore(dashboard.dashboardWidgets, uniqueWidgets)) {
            return dashboard;
          }

          const isEmpty = uniqueWidgets.length === 0;
          return {
            ...dashboard,
            dashboardWidgets: uniqueWidgets,
            isModified: true,
            action: isEmpty ? 'remove' : 'update',
          };
        }
        return dashboard;
      });
      return cleanupEmptyDashboards(newDashboards);
    });
    setIsInitialized(true);
  }, [setDashboards, validateDashboardScore, cleanupEmptyDashboards]);

  const handleAddWidgetClick = useCallback(() => {
    widgetSizeModal.open();
  }, [widgetSizeModal]);

  const handleWidgetSizeSelect = useCallback((size) => {
    addWindowToDashboard(size);
  }, [addWindowToDashboard]);

  const handleWidgetClick = useCallback((payload) => {
    onWidgetClick(payload);
  }, [onWidgetClick]);

  const swapWidgets = useCallback(({ dashboardId, row, col, targetWidget }) => {
    if (!draggedWidget || !editMode || !isInitialized) {
      return false;
    }

    const sourceDashboardId = draggedWidget.dashboardId;
    const draggedWidgetData = draggedWidget.widget;
    const draggedOriginalPos = draggedWidget.position;
    const draggedSize = draggedWidget.size;

    const targetDashboard = dashboards.find((d) => d.id === dashboardId);
    if (!targetDashboard) return false;

    const targetPos = getValidPosition(draggedSize, row, col);
    const draggedArea = getWidgetArea(draggedSize);

    const overlappedWidgets = targetDashboard.dashboardWidgets.filter((w) => {
      if (!w.position || isNaN(w.position.row) || isNaN(w.position.col)) return false;
      const { width, height } = windowSizes[w.size] || windowSizes.small;
      const wRow = w.position.row;
      const wCol = w.position.col;
      const tRow = targetPos.row;
      const tCol = targetPos.col;
      const tWidth = windowSizes[draggedSize].width;
      const tHeight = windowSizes[draggedSize].height;
      return wRow < tRow + tHeight && wRow + height > tRow && wCol < tCol + tWidth && wCol + width > tCol;
    });

    const overlappedArea = overlappedWidgets.reduce((sum, w) => sum + getWidgetArea(w.size), 0);

    // --- INTRA-PLANE SWAP LOGIC ---
    if (sourceDashboardId === dashboardId && overlappedWidgets.length > 0 && draggedArea >= overlappedArea) {
      setDashboards((prev) => {
        const dashboard = prev.find((d) => d.id === dashboardId);
        if (!dashboard) return prev;

        // Remove dragged and overlapped widgets from dashboard
        let newWidgets = dashboard.dashboardWidgets.filter(
          (w) => w.id !== draggedWidgetData.id && !overlappedWidgets.some((ow) => ow.id === w.id)
        );

        // Place dragged widget at target position
        newWidgets.push({
          ...draggedWidgetData,
          size: draggedSize,
          position: targetPos,
          dashboardId,
        });

        // Try to place all overlapped widgets at the original position of the dragged widget (if they fit together)
        let canFitAll = true;
        let tempGrid = Array(4).fill().map(() => Array(2).fill(false));
        // Mark all newWidgets as occupied
        newWidgets.forEach((w) => {
          const { width, height } = windowSizes[w.size] || windowSizes.small;
          for (let r = w.position.row; r < w.position.row + height; r++) {
            for (let c = w.position.col; c < w.position.col + width; c++) {
              tempGrid[r][c] = true;
            }
          }
        });

        // Try to fit all overlapped widgets at the original position of the dragged widget
        let placedWidgets = [];
        let origRow = draggedOriginalPos.row;
        let origCol = draggedOriginalPos.col;
        let origWidth = windowSizes[draggedSize].width;
        let origHeight = windowSizes[draggedSize].height;

        // Try to pack all overlapped widgets into the original area
        // Simple greedy: try all permutations (since max 4 widgets), but for now, try sequentially
        let areaGrid = Array(origHeight).fill().map(() => Array(origWidth).fill(false));
        let canPackAll = true;
        for (let ow of overlappedWidgets) {
          const { width, height } = windowSizes[ow.size] || windowSizes.small;
          let found = false;
          for (let r = 0; r <= origHeight - height; r++) {
            for (let c = 0; c <= origWidth - width; c++) {
              // Check if fits in areaGrid
              let fits = true;
              for (let rr = r; rr < r + height; rr++) {
                for (let cc = c; cc < c + width; cc++) {
                  if (areaGrid[rr][cc]) fits = false;
                }
              }
              if (fits) {
                // Place it
                for (let rr = r; rr < r + height; rr++) {
                  for (let cc = c; cc < c + width; cc++) {
                    areaGrid[rr][cc] = true;
                  }
                }
                placedWidgets.push({
                  ...ow,
                  position: { row: origRow + r, col: origCol + c },
                  dashboardId,
                });
                found = true;
                break;
              }
            }
            if (found) break;
          }
          if (!found) {
            canPackAll = false;
            break;
          }
        }

        if (canPackAll) {
          // Mark these as occupied in tempGrid
          placedWidgets.forEach((w) => {
            const { width, height } = windowSizes[w.size] || windowSizes.small;
            for (let r = w.position.row; r < w.position.row + height; r++) {
              for (let c = w.position.col; c < w.position.col + width; c++) {
                tempGrid[r][c] = true;
              }
            }
          });
          newWidgets = [...newWidgets, ...placedWidgets];
        } else {
          // If can't pack all, try to find free positions for each
          for (let ow of overlappedWidgets) {
            const pos = findFreePosition({ dashboardWidgets: newWidgets }, ow.size, [], tempGrid);
            if (pos) {
              newWidgets.push({
                ...ow,
                position: pos,
                dashboardId,
              });
              // Mark as occupied
              const { width, height } = windowSizes[ow.size] || windowSizes.small;
              for (let r = pos.row; r < pos.row + height; r++) {
                for (let c = pos.col; c < pos.col + width; c++) {
                  tempGrid[r][c] = true;
                }
              }
            } else {
              canFitAll = false;
              break;
            }
          }
        }

        if (
          !validateDashboardScore(dashboard.dashboardWidgets, newWidgets) ||
          !canFitAll
        ) {
          return prev;
        }

        const updatedDashboards = prev.map((d) =>
          d.id === dashboardId
            ? {
                ...d,
                dashboardWidgets: newWidgets,
                isModified: true,
                action: d.action || 'update',
              }
            : d
        );

        setDraggedWidget(null);
        return cleanupEmptyDashboards(updatedDashboards);
      });
      return true;
    }

    // --- INTER-PLANE SWAP LOGIC ---
    if (sourceDashboardId !== dashboardId && overlappedWidgets.length > 0 && draggedArea >= overlappedArea) {
      setDashboards((prev) => {
        const sourceDashboard = prev.find((d) => d.id === sourceDashboardId);
        const targetDashboard = prev.find((d) => d.id === dashboardId);
        if (!sourceDashboard || !targetDashboard) return prev;

        let newTargetWidgets = targetDashboard.dashboardWidgets.filter(
          (w) => !overlappedWidgets.some((ow) => ow.id === w.id)
        );
        newTargetWidgets.push({
          ...draggedWidgetData,
          size: draggedSize,
          position: targetPos,
          dashboardId: dashboardId,
        });

        let newSourceWidgets = sourceDashboard.dashboardWidgets.filter((w) => w.id !== draggedWidgetData.id);
        let canPlaceAll = true;
        overlappedWidgets.forEach((w) => {
          if (
            canPlaceWidget(
              { dashboardWidgets: newSourceWidgets },
              w,
              draggedOriginalPos.row,
              draggedOriginalPos.col,
              []
            )
          ) {
            newSourceWidgets.push({
              ...w,
              position: draggedOriginalPos,
              dashboardId: sourceDashboardId,
            });
          } else {
            const freePos = findFreePosition({ dashboardWidgets: newSourceWidgets }, w.size, []);
            if (freePos) {
              newSourceWidgets.push({
                ...w,
                position: freePos,
                dashboardId: sourceDashboardId,
              });
            } else {
              canPlaceAll = false;
            }
          }
        });

        if (
          !validateDashboardScore(targetDashboard.dashboardWidgets, newTargetWidgets) ||
          !validateDashboardScore(sourceDashboard.dashboardWidgets, newSourceWidgets) ||
          !canPlaceAll
        ) {
          return prev;
        }

        const updatedDashboards = prev.map((dashboard) => {
          if (dashboard.id === sourceDashboardId) {
            return {
              ...dashboard,
              dashboardWidgets: newSourceWidgets,
              isModified: true,
              action: newSourceWidgets.length === 0 ? 'remove' : (dashboard.action || 'update'),
            };
          }
          if (dashboard.id === dashboardId) {
            return {
              ...dashboard,
              dashboardWidgets: newTargetWidgets,
              isModified: true,
              action: dashboard.action || 'update',
            };
          }
          return dashboard;
        });

        setDraggedWidget(null);
        return cleanupEmptyDashboards(updatedDashboards);
      });
      return true;
    }

    // fallback: do nothing
    return false;
  }, [
    draggedWidget,
    editMode,
    isInitialized,
    setDashboards,
    cleanupEmptyDashboards,
    canPlaceWidget,
    findFreePosition,
    getValidPosition,
    dashboards,
    validateDashboardScore,
    windowSizes,
    getWidgetArea,
  ]);

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
            swapWidgets={swapWidgets}
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
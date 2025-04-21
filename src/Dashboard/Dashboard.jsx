// src/Dashboard/Dashboard.js
import React, { useRef, useContext, useState, useEffect, useMemo } from 'react';
import styles from './Dashboard.module.css';
import { MainContext } from '../Contexts/MainContext';
import DashboardPlane from './Dashboard Plane/DashboardPlane';
import { FaPlus } from 'react-icons/fa';
import useModal from '../Modal/Hooks/UseModal';
import Modal from '../Modal/Modal';
import WidgetSizeModal from '../Modal/WidgetSizeModal/WidgetSizeModal';

const Dashboard = ({
  onWidgetClick, // Add this prop
}) => {
  const { isDarkTheme, cards, dashboards, setDashboards } = useContext(MainContext);
  const [metrics, setMetrics] = useState({
    revenue: 0,
    closeRate: 0,
    costPerLead: 0,
    bottleneck: 'None',
    campaignROI: 0,
    pendingPayouts: 0,
    topCampaigns: [],
  });

  const [editMode, setEditMode] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState(null);
  const prevWidgetConfigRef = useRef(null);
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

  useEffect(() => {
    const totalLeads = cards.length;
    const closedLeads = cards.filter((card) => card.nextActions === 'Close deal').length;
    const closeRate = totalLeads ? ((closedLeads / totalLeads) * 100).toFixed(1) : 0;
    const bottleneck = closeRate < 10 ? 'Low close rate: Improve sales process' : 'None';
    const revenue = closedLeads * 2000;
    const costPerLead = totalLeads ? (1000 / totalLeads).toFixed(2) : 0;
    const campaignROI = 2.5;
    const pendingPayouts = closedLeads * 1200;
    const topCampaigns = [
      { name: 'Facebook Ad #1', leads: 5, costPerLead: 20 },
      { name: 'Google Ad #1', leads: 3, costPerLead: 25 },
    ];

    setMetrics({
      revenue,
      closeRate,
      costPerLead,
      bottleneck,
      campaignROI,
      pendingPayouts,
      topCampaigns,
    });
  }, [cards]);

  const widgetConfig = useMemo(
    () => [
      {
        id: 'revenue',
        name: 'Revenue',
        size: 'large',
        title: 'Revenue',
        data: `$${metrics.revenue.toLocaleString()}`,
        section: 'Financials',
      },
      {
        id: 'close-rate',
        name: 'Close Rate',
        size: 'medium',
        title: 'Close Rate',
        data: `${metrics.closeRate}%`,
        section: 'Lead Metrics',
      },
      {
        id: 'cost-per-lead',
        name: 'Cost Per Lead',
        size: 'small',
        title: 'Cost Per Lead',
        data: `$${metrics.costPerLead}`,
        section: 'Lead Metrics',
      },
      {
        id: 'bottleneck',
        name: 'Bottleneck',
        size: 'verySmall',
        title: 'Bottleneck',
        data: metrics.bottleneck,
        section: 'Lead Metrics',
      },
      {
        id: 'campaign-roi',
        name: 'Campaign ROI',
        size: 'small',
        title: 'Campaign ROI',
        data: `${metrics.campaignROI}x`,
        section: 'Marketing',
      },
      {
        id: 'top-campaigns',
        name: 'Top Campaigns',
        size: 'small',
        title: 'Top Campaigns',
        data: metrics.topCampaigns.map((c) => `${c.name}: ${c.leads} leads`).join(', '),
        section: 'Marketing',
      },
    ],
    [metrics]
  );

  useEffect(() => {
    if (JSON.stringify(widgetConfig) === JSON.stringify(prevWidgetConfigRef.current)) {
      return;
    }

    setDashboards((prev) =>
      prev.map((dashboard) => ({
        ...dashboard,
        widgets: dashboard.widgets.map((widget) => {
          const config = widgetConfig.find((wc) => wc.id === widget.id);
          return config ? { ...widget, data: config.data } : widget;
        }),
      }))
    );
    prevWidgetConfigRef.current = widgetConfig;
  }, [widgetConfig, setDashboards]);

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
      : Array(4).fill().map(() => Array(2).fill(false));

    dashboard.widgets.forEach((w) => {
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
        let newDashboards = currentDashboards.filter((dashboard) => dashboard.widgets.length > 0);
        if (newDashboards.length === 0) {
            newDashboards = [
                {
                    id: `dashboard-${Date.now()}`,
                    widgets: [],
                },
            ];
        }
        return newDashboards;
    };

    const addWindowToDashboard = (size, content) => {
        const newWidgetId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newWidget = {
            id: newWidgetId,
            size,
            title: 'New Widget',
            data: content,
            section: 'Custom',
            position: { row: 0, col: 0 },
        };

        let targetDashboard = null;
        let freePosition = null;

        for (const dashboard of dashboards) {
            const existingWidgetIds = new Set(dashboard.widgets.map((w) => w.id));
            if (existingWidgetIds.has(newWidgetId)) {
                alert('Error: Duplicate widget ID. Please try again.');
                return;
            }

            const newWidgets = [...dashboard.widgets, { ...newWidget, position: { row: 0, col: 0 } }];
            if (!validateDashboardScore(dashboard.widgets, newWidgets)) {
                continue;
            }

            freePosition = findFreePosition(dashboard, size);
            if (freePosition) {
                targetDashboard = dashboard;
                break;
            }
        }

        if (!targetDashboard || !freePosition) {
            const newDashboardId = `dashboard-${Date.now()}`;
            targetDashboard = { id: newDashboardId, widgets: [] };
            freePosition = findFreePosition(targetDashboard, size);
            if (!freePosition) {
                alert('Cannot add widget: No valid position available.');
                return;
            }

            setDashboards((prev) => {
                const newDashboards = [
                    ...prev,
                    {
                        ...targetDashboard,
                        widgets: [{ ...newWidget, position: freePosition }],
                    },
                ];
                return cleanupEmptyDashboards(newDashboards);
            });
            return;
        }

        setDashboards((prev) => {
            const newDashboards = prev.map((dashboard) =>
                dashboard.id === targetDashboard.id
                    ? {
                          ...dashboard,
                          widgets: [...dashboard.widgets, { ...newWidget, position: freePosition }],
                      }
                    : dashboard
            );
            return cleanupEmptyDashboards(newDashboards);
        });
    };

    const reassignOverlappingWidgets = (dashboard, overlappingWidgets, targetPos, draggedWidgetData, draggedSize, sourceDashboard = null, sourcePos = null) => {
        let tempGrid = Array(4).fill().map(() => Array(2).fill(false));
        let newWidgets = dashboard.widgets.filter(w => !overlappingWidgets.some(ow => ow.id === w.id));
        let skipWidgets = [draggedWidgetData];

        if (!canPlaceWidget({ widgets: newWidgets }, { id: draggedWidgetData.id, size: draggedSize }, targetPos.row, targetPos.col, skipWidgets, tempGrid)) {
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
        let targetTempGrid = Array(4).fill().map(() => Array(2).fill(false));
        const targetSkipWidgets = [draggedWidgetData];
        const targetWidgets = isSameDashboard
            ? newWidgets
            : targetDashboard.widgets.filter(w => w.id !== draggedWidgetData.id);
        let tempTargetWidgets = [...targetWidgets];

        for (const widget of overlappingWidgets) {
            const size = widget.size;
            const freePos = findFreePosition({ widgets: tempTargetWidgets }, size, targetSkipWidgets, targetTempGrid);
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
                const finalWidgets = tempTargetWidgets.filter(w => w.id !== draggedWidgetData.id).concat({
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
            const freePos = findFreePosition({ widgets: newWidgets }, size, skipWidgets, tempGrid);
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
            const overlappingWidgets = targetDashboard.widgets.filter((w) => {
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

                return (
                    wRow < tRow + tHeight &&
                    wRow + height > tRow &&
                    wCol < tCol + tWidth &&
                    wCol + width > tCol
                );
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
                    if (!validateDashboardScore(targetDashboard.widgets, targetWidgets)) {
                        alert('Cannot move widget: Score limit reached');
                        setDraggedWidget(null);
                        return prev;
                    }

                    return cleanupEmptyDashboards(prev.map((dashboard) =>
                        dashboard.id === dashboardId ? { ...dashboard, widgets: targetWidgets } : dashboard
                    ));
                }

                alert('Cannot drop widget: No valid positions for displaced widgets');
                setDraggedWidget(null);
                return prev;
            }

            if (sourceDashboardId !== dashboardId && overlappingWidgets.length === 1) {
                const overlappingWidget = overlappingWidgets[0];
                const sourceWidgets = sourceDashboard.widgets.filter((w) => w.id !== draggedWidgetData.id);
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
                        canPlaceWidget(targetDashboard, { id: draggedWidgetData.id, size: draggedSize }, targetPos.row, targetPos.col, [overlappingWidget]) &&
                        canPlaceWidget({ widgets: sourceWidgets }, { id: overlappingWidget.id, size: overlappingWidget.size }, pos.row, pos.col, [])
                    ) {
                        const targetNewWidgets = [
                            ...targetDashboard.widgets.filter((w) => w.id !== overlappingWidget.id),
                            { ...draggedWidgetData, size: draggedSize, position: targetPos },
                        ];
                        const sourceNewWidgets = [
                            ...sourceDashboard.widgets.filter((w) => w.id !== draggedWidgetData.id),
                            { ...overlappingWidget, size: overlappingWidget.size, position: pos },
                        ];

                        if (
                            !validateDashboardScore(targetDashboard.widgets, targetNewWidgets) ||
                            !validateDashboardScore(sourceDashboard.widgets, sourceNewWidgets)
                        ) {
                            alert('Cannot swap widgets: Score limit reached');
                            setDraggedWidget(null);
                            return prev;
                        }

                        return cleanupEmptyDashboards(prev.map((dashboard) => {
                            if (dashboard.id === sourceDashboardId) {
                                return { ...dashboard, widgets: sourceNewWidgets };
                            }
                            if (dashboard.id === dashboardId) {
                                return { ...dashboard, widgets: targetNewWidgets };
                            }
                            return dashboard;
                        }));
                    }
                }

                const freePos = findFreePosition({ widgets: sourceWidgets }, overlappingWidget.size, []);
                if (freePos && !isNaN(freePos.row) && !isNaN(freePos.col)) {
                    const targetNewWidgets = [
                        ...targetDashboard.widgets.filter((w) => w.id !== overlappingWidget.id),
                        { ...draggedWidgetData, size: draggedSize, position: targetPos },
                    ];
                    const sourceNewWidgets = [
                        ...sourceDashboard.widgets.filter((w) => w.id !== draggedWidgetData.id),
                        { ...overlappingWidget, size: overlappingWidget.size, position: freePos },
                    ];

                    if (
                        !validateDashboardScore(targetDashboard.widgets, targetNewWidgets) ||
                        !validateDashboardScore(sourceDashboard.widgets, sourceNewWidgets)
                    ) {
                        alert('Cannot swap widgets: Score limit reached');
                        setDraggedWidget(null);
                        return prev;
                    }

                    return cleanupEmptyDashboards(prev.map((dashboard) => {
                        if (dashboard.id === sourceDashboardId) {
                            return { ...dashboard, widgets: sourceNewWidgets };
                        }
                        if (dashboard.id === dashboardId) {
                            return { ...dashboard, widgets: targetNewWidgets };
                        }
                        return dashboard;
                    }));
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
                    if (!validateDashboardScore(targetDashboard.widgets, targetWidgets) || (sourceWidgets && !validateDashboardScore(sourceDashboard.widgets, sourceWidgets))) {
                        alert('Cannot move widget: Score limit reached');
                        setDraggedWidget(null);
                        return prev;
                    }

                    return cleanupEmptyDashboards(prev.map((dashboard) => {
                        if (dashboard.id === sourceDashboardId && sourceWidgets) {
                            return { ...dashboard, widgets: sourceWidgets };
                        }
                        if (dashboard.id === dashboardId) {
                            return { ...dashboard, widgets: targetWidgets };
                        }
                        return dashboard;
                    }));
                }

                alert('Cannot drop widget: No valid positions for displaced widgets');
                setDraggedWidget(null);
                return prev;
            }

            if (sourceDashboardId !== dashboardId && overlappingWidgets.length === 0) {
                const targetNewWidgets = [
                    ...targetDashboard.widgets,
                    { ...draggedWidgetData, size: draggedSize, position: targetPos },
                ];
                const sourceNewWidgets = sourceDashboard.widgets.filter((_, i) => i !== sourceIndex);

                if (
                    !validateDashboardScore(targetDashboard.widgets, targetNewWidgets) ||
                    !validateDashboardScore(sourceDashboard.widgets, sourceNewWidgets)
                ) {
                    alert('Cannot move widget: Score limit reached');
                    setDraggedWidget(null);
                    return prev;
                }

                return cleanupEmptyDashboards(prev.map((dashboard) => {
                    if (dashboard.id === sourceDashboardId) {
                        return { ...dashboard, widgets: sourceNewWidgets };
                    }
                    if (dashboard.id === dashboardId) {
                        return { ...dashboard, widgets: targetNewWidgets };
                    }
                    return dashboard;
                }));
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
        e.target.addEventListener('dragend', () => {
            e.target.classList.remove(styles.dragging);
        }, { once: true });
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

        if (!validateDashboardScore(dashboard.widgets, uniqueWidgets)) {
            return;
        }

        setDashboards((prev) => {
            const newDashboards = prev.map((dashboard) =>
                dashboard.id === dashboardId
                    ? { ...dashboard, widgets: uniqueWidgets }
                    : dashboard
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
        addWindowToDashboard(size, 'Add content');
    };

    const memoizedDashboards = useMemo(() => {
        return dashboards.map((d) => ({
            ...d,
            widgets: d.widgets.map((w) => ({ ...w })),
        }));
    }, [dashboards]);

    return (
        <div className={`${styles.dashboardWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
            <div className={styles.buttonGroup}>
                {editMode && (
                    <div className={styles.controls}>
                        <button
                            className={styles.addButton}
                            onClick={handleAddWidgetClick}
                        >
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
                        initialWidgets={dashboard.widgets}
                        editMode={editMode}
                        updateWidgets={updateWidgets}
                        onDragStart={handleDragStart}
                        onDrop={handleDrop}
                        onWidgetClick={onWidgetClick} // Pass the prop
                    />
                ))}
            </div>

            {widgetSizeModal.isOpen && (
                <Modal
                    onClose={widgetSizeModal.close}
                    modalType="widgetSize"
                >
                    <WidgetSizeModal
                        handleClose={widgetSizeModal.close}
                        onSelectSize={handleWidgetSizeSelect}
                    />
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
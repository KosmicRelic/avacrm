import React, { useRef, useContext, useState, useEffect, useMemo } from 'react';
import styles from './Dashboard.module.css';
import { MainContext } from '../Contexts/MainContext';
import DashboardPlane from './Dashboard Plane/DashboardPlane';
import DatePicker from './Date Picker/DatePicker';
import { FaPlus, FaTrash } from 'react-icons/fa';

const Dashboard = () => {
  const { isDarkTheme, cards } = useContext(MainContext);
  const [metrics, setMetrics] = useState({
    revenue: 0,
    closeRate: 0,
    costPerLead: 0,
    bottleneck: 'None',
    campaignROI: 0,
    pendingPayouts: 0,
    topCampaigns: [],
  });
  const [dashboards, setDashboards] = useState([
    {
      id: 'dashboard-1',
      widgets: [
        {
          id: 'widget-revenue-1',
          size: 'verySmall',
          title: 'Total Revenue',
          data: '$10,000',
          section: 'Financials',
          position: { row: 0, col: 0 },
        },
        {
          id: 'widget-revenue-3',
          size: 'small',
          title: 'Total Revenue',
          data: '$10,000',
          section: 'Financials',
          position: { row: 0, col: 0 },
        },
        {
          id: 'widget-pending-4',
          size: 'verySmall',
          title: 'Pending Payouts',
          data: '$1,200',
          section: 'Financials',
          position: { row: 0, col: 0 },
        },
        {
          id: 'widget-pending-2',
          size: 'medium',
          title: 'Pending Payouts',
          data: '$1,200',
          section: 'Financials',
          position: { row: 2, col: 0 },
        },
      ],
    },
    {
      id: 'dashboard-2',
      widgets: [
        {
          id: 'widget-close-rate',
          size: 'medium',
          title: 'Close Rate',
          data: '15%',
          section: 'Lead Metrics',
          position: { row: 0, col: 0 },
        },
        {
          id: 'widget-cost-per-lead',
          size: 'small',
          title: 'Cost Per Lead',
          data: '$25.00',
          section: 'Lead Metrics',
          position: { row: 0, col: 0 },
        },
        {
          id: 'widget-bottleneck',
          size: 'verySmall',
          title: 'Bottleneck',
          data: 'Low close rate',
          section: 'Lead Metrics',
          position: { row: 0, col: 0 },
        },
      ],
    },
    {
      id: 'dashboard-3',
      widgets: [
        {
          id: 'widget-campaign-roi',
          size: 'small',
          title: 'Campaign ROI',
          data: '2.5x',
          section: 'Marketing',
          position: { row: 0, col: 0 },
        },
        {
          id: 'widget-top-campaign-1',
          size: 'small',
          title: 'Top Campaign: FB Ad',
          data: '5 leads, $20/lead',
          section: 'Marketing',
          position: { row: 0, col: 0 },
        },
        {
          id: 'widget-top-campaign-2',
          size: 'small',
          title: 'Top Campaign: Google Ad',
          data: '3 leads, $25/lead',
          section: 'Marketing',
          position: { row: 0, col: 0 },
        },
        {
          id: 'widget-campaign-status',
          size: 'verySmall',
          title: 'Campaign Status',
          data: 'Active',
          section: 'Marketing',
          position: { row: 0, col: 0 },
        },
      ],
    },
  ]);
  const [editMode, setEditMode] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState(null);
  const prevWidgetConfigRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);

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
      console.log('Widget config unchanged, skipping dashboard initialization');
      return;
    }

    console.log('Updating dashboards with dynamic widgets');
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
  }, [widgetConfig]);

  const addDashboard = () => {
    console.log('Adding new dashboard');
    const newDashboardId = `dashboard-${dashboards.length + 1}`;
    const newWidget = {
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      size: 'verySmall',
      title: 'New Widget',
      data: 'Add content',
      section: 'Custom',
      position: { row: 0, col: 0 },
    };
    setDashboards((prev) => [
      ...prev,
      {
        id: newDashboardId,
        widgets: [newWidget],
      },
    ]);
  };

  const removeDashboard = (dashboardId) => {
    console.log(`Removing dashboard: ${dashboardId}`);
    setDashboards((prev) => prev.filter((dashboard) => dashboard.id !== dashboardId));
  };

  const toggleEditMode = () => {
    console.log('Toggling edit mode, current:', editMode);
    setEditMode((prev) => !prev);
    setDraggedWidget(null);
  };

  const validateDashboardScore = (currentWidgets, newWidgets) => {
    const totalScore = newWidgets.reduce((sum, widget) => {
      const size = widget.size || 'small';
      return sum + (windowScores[size] || 0);
    }, 0);
    if (totalScore > 80) {
      console.log(`Cannot update widgets: total score ${totalScore} exceeds limit of 80`);
      return false;
    }
    console.log(`Score validation passed: new score ${totalScore}`);
    return true;
  };

  const canPlaceWidget = (dashboard, widget, row, col, skipWidgets = [], customGrid = null) => {
    const size = widget.size;
    const { width, height } = windowSizes[size] || windowSizes.small;
    if (row < 0 || col < 0 || row + height > 4 || col + width > 2) {
      console.log(`Cannot place widget ${widget.id}: Invalid position row=${row}, col=${col}`);
      return false;
    }

    if (size === 'small' && row % 2 !== 0) return false;
    if (size === 'medium' && (row !== 0 && row !== 2)) return false;
    if (size === 'large' && (row !== 0 || col !== 0)) return false;

    const occupied = customGrid
      ? customGrid.map((row) => [...row])
      : Array(4).fill().map(() => Array(2).fill(false));

    dashboard.widgets.forEach((w) => {
      if (skipWidgets.some((sw) => sw.id === w.id)) return;
      if (!w.position || typeof w.position.row === 'undefined' || typeof w.position.col === 'undefined') {
        console.warn(`Widget ${w.id} has no valid position, skipping in canPlaceWidget`);
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
          console.log(`Cannot place widget ${widget.id}: Position row=${r}, col=${c} is occupied`);
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
      if (canPlaceWidget(dashboard, { size, id: 'temp' }, pos.row, pos.col, skipWidgets, customGrid)) {
        return pos;
      }
    }
    console.log(`No free position found for size=${size}`);
    return null;
  };

  const handleDragStart = (e, widgetInfo) => {
    if (!editMode || !isInitialized) return;
    console.log(`Starting drag for widget ${widgetInfo.widget.id} from dashboard ${widgetInfo.dashboardId}`);
    setDraggedWidget(widgetInfo);
    e.dataTransfer.setData('text/plain', JSON.stringify(widgetInfo));
    e.target.classList.add(styles.dragging);
  };

  const handleDrop = ({ dashboardId, row, col }) => {
    if (!draggedWidget || !editMode || !isInitialized) {
      console.log('Drop aborted: No dragged widget, edit mode off, or not initialized');
      return;
    }

    const sourceDashboardId = draggedWidget.dashboardId;
    const sourceIndex = draggedWidget.index;
    const draggedSize = draggedWidget.size;
    const draggedWidgetData = draggedWidget.widget;

    console.log(`Dropping widget ${draggedWidgetData.id} from ${sourceDashboardId} to ${dashboardId} at row=${row}, col=${col}`);

    if (sourceDashboardId === dashboardId && draggedWidget.position.row === row && draggedWidget.position.col === col) {
      console.log(`Drop ignored: Widget ${draggedWidgetData.id} dropped at same position`);
      setDraggedWidget(null);
      return;
    }

    setDashboards((prev) => {
      const sourceDashboard = prev.find((d) => d.id === sourceDashboardId);
      const targetDashboard = prev.find((d) => d.id === dashboardId);
      if (!sourceDashboard || !targetDashboard) {
        console.log(`Drop aborted: Source (${sourceDashboardId}) or target (${dashboardId}) dashboard not found`);
        setDraggedWidget(null);
        return prev;
      }

      // Validate target position
      const targetPos = getValidPosition(draggedSize, row, col);
      if (!targetPos || !canPlaceWidget(targetDashboard, { id: draggedWidgetData.id, size: draggedSize }, targetPos.row, targetPos.col, [], null)) {
        console.log(`Invalid target position for widget ${draggedWidgetData.id}, size=${draggedSize}, row=${targetPos?.row}, col=${targetPos?.col}`);
        alert('Cannot place widget at this position');
        setDraggedWidget(null);
        return prev;
      }

      // Identify overlapping widgets
      const overlappingWidgets = targetDashboard.widgets.filter((w) => {
        if (!w.position || typeof w.position.row === 'undefined' || typeof w.position.col === 'undefined') {
          console.warn(`Widget ${w.id} has no valid position, skipping in overlap check`);
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

      console.log(`Overlapping widgets at target position:`, overlappingWidgets.map(w => w.id));

      // Prepare temporary grids
      let targetTempGrid = Array(4).fill().map(() => Array(2).fill(false));
      targetDashboard.widgets.forEach((w) => {
        if (overlappingWidgets.some((ow) => ow.id === w.id)) return;
        const { width, height } = windowSizes[w.size] || windowSizes.small;
        for (let r = w.position.row; r < w.position.row + height; r++) {
          for (let c = w.position.col; c < w.position.col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) {
              targetTempGrid[r][c] = true;
            }
          }
        }
      });

      // Place dragged widget in target dashboard
      const newDraggedWidget = { ...draggedWidgetData, size: draggedSize, position: targetPos };
      let targetNewWidgets = [
        ...targetDashboard.widgets.filter((w) => !overlappingWidgets.some((ow) => ow.id === w.id)),
        newDraggedWidget,
      ];

      // Validate target dashboard score
      if (!validateDashboardScore(targetDashboard.widgets, targetNewWidgets)) {
        console.log(`Target dashboard score limit exceeded for widget ${draggedWidgetData.id}`);
        alert('Cannot place widget: Target dashboard score limit reached');
        setDraggedWidget(null);
        return prev;
      }

      // Update target grid with dragged widget
      const { width: tWidth, height: tHeight } = windowSizes[draggedSize] || windowSizes.small;
      for (let r = targetPos.row; r < targetPos.row + tHeight; r++) {
        for (let c = targetPos.col; c < targetPos.col + tWidth; c++) {
          if (r >= 0 && r < 4 && c >= 0 && c < 2) {
            targetTempGrid[r][c] = true;
          }
        }
      }

      // Prepare source dashboard grid
      let sourceTempGrid = Array(4).fill().map(() => Array(2).fill(false));
      sourceDashboard.widgets.forEach((w, i) => {
        if (i === sourceIndex) return;
        if (!w.position || typeof w.position.row === 'undefined' || typeof w.position.col === 'undefined') {
          console.warn(`Widget ${w.id} has no valid position, skipping in source grid`);
          return;
        }
        const { width, height } = windowSizes[w.size] || windowSizes.small;
        for (let r = w.position.row; r < w.position.row + height; r++) {
          for (let c = w.position.col; c < w.position.col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) {
              sourceTempGrid[r][c] = true;
            }
          }
        }
      });

      // Place overlapping widgets in source dashboard
      const placedOverlappingWidgets = [];
      for (const widget of overlappingWidgets) {
        const pos = findFreePosition(
          { widgets: sourceDashboard.widgets.filter((_, i) => i !== sourceIndex) },
          widget.size,
          [draggedWidgetData],
          sourceTempGrid
        );
        if (!pos) {
          console.log(`Cannot place overlapping widget ${widget.id} in source dashboard`);
          alert('Cannot move widget: No valid position for displaced widgets');
          setDraggedWidget(null);
          return prev;
        }
        placedOverlappingWidgets.push({ ...widget, position: pos });

        const { width, height } = windowSizes[widget.size] || windowSizes.small;
        for (let r = pos.row; r < pos.row + height; r++) {
          for (let c = pos.col; c < pos.col + width; c++) {
            if (r >= 0 && r < 4 && c >= 0 && c < 2) {
              sourceTempGrid[r][c] = true;
            }
          }
        }
      }

      // Prepare source dashboard widgets
      let sourceNewWidgets = [
        ...sourceDashboard.widgets.filter((_, i) => i !== sourceIndex),
        ...placedOverlappingWidgets,
      ];

      // Validate source dashboard score
      if (!validateDashboardScore(sourceDashboard.widgets, sourceNewWidgets)) {
        console.log(`Source dashboard score limit exceeded`);
        alert('Cannot move widget: Source dashboard score limit reached');
        setDraggedWidget(null);
        return prev;
      }

      // Ensure all widgets have valid positions
      targetNewWidgets = targetNewWidgets.map((w) => ({
        ...w,
        position: w.position || findFreePosition(targetDashboard, w.size) || { row: 0, col: 0 },
      }));
      sourceNewWidgets = sourceNewWidgets.map((w) => ({
        ...w,
        position: w.position || findFreePosition(sourceDashboard, w.size) || { row: 0, col: 0 },
      }));

      console.log(`Updating dashboards:`, {
        sourceDashboardId,
        sourceNewWidgets: sourceNewWidgets.map(w => ({ id: w.id, position: w.position })),
        targetDashboardId: dashboardId,
        targetNewWidgets: targetNewWidgets.map(w => ({ id: w.id, position: w.position })),
      });

      return prev.map((dashboard) => {
        if (dashboard.id === sourceDashboardId) {
          return {
            ...dashboard,
            widgets: sourceNewWidgets,
          };
        }
        if (dashboard.id === dashboardId) {
          return {
            ...dashboard,
            widgets: targetNewWidgets,
          };
        }
        return dashboard;
      });
    });

    setDraggedWidget(null);
  };

  const addWindowToDashboard = (dashboardId, size, content) => {
    const dashboard = dashboards.find((d) => d.id === dashboardId);
    if (!dashboard) {
      console.log(`Dashboard ${dashboardId} not found`);
      return;
    }

    const newWidgetId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newWidget = {
      id: newWidgetId,
      size,
      title: 'New Widget',
      data: content,
      section: 'Custom',
      position: { row: 0, col: 0 },
    };

    const existingWidgetIds = new Set(dashboard.widgets.map((w) => w.id));
    if (existingWidgetIds.has(newWidgetId)) {
      console.error(`Duplicate widget ID ${newWidgetId} detected, aborting add`);
      alert('Error: Duplicate widget ID. Please try again.');
      return;
    }

    const newWidgets = [...dashboard.widgets, newWidget];
    if (!validateDashboardScore(dashboard.widgets, newWidgets)) {
      alert('Cannot add widget: Dashboard score limit reached');
      return;
    }

    console.log(`Adding ${size} widget to dashboard: ${dashboardId}, widget ID: ${newWidgetId}`);
    setDashboards((prev) =>
      prev.map((dashboard) =>
        dashboard.id === dashboardId
          ? {
              ...dashboard,
              widgets: newWidgets,
            }
          : dashboard
      )
    );
  };

  const updateWidgets = (dashboardId, newWidgets) => {
    console.log(`Updating widgets for dashboard ${dashboardId}, widgets: ${newWidgets.length}`);
    const dashboard = dashboards.find((d) => d.id === dashboardId);
    if (!dashboard) {
      console.log(`Dashboard ${dashboardId} not found`);
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
      } else {
        console.warn(`Duplicate widget ID ${widget.id} detected in updateWidgets, keeping last occurrence`);
      }
    }
    uniqueWidgets.reverse();

    if (!validateDashboardScore(dashboard.widgets, uniqueWidgets)) {
      console.log(`Widget update rejected for dashboard ${dashboardId}: score limit exceeded`);
      return;
    }

    setDashboards((prev) =>
      prev.map((dashboard) =>
        dashboard.id === dashboardId
          ? {
              ...dashboard,
              widgets: uniqueWidgets,
            }
          : dashboard
      )
    );
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
        console.warn(`Invalid size: ${size}, defaulting to small`);
        return { row: row <= 1 ? 0 : 2, col };
    }
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
        {!editMode && <DatePicker />}
        <button
          className={`${styles.editHeaderButton} ${isDarkTheme ? styles.darkTheme : ''}`}
          onClick={toggleEditMode}
        >
          {editMode ? 'Done' : 'Edit'}
        </button>

        {editMode && (
          <div className={styles.controls}>
            <button
              className={styles.addButton}
              onClick={() => addWindowToDashboard(dashboards[0].id, 'verySmall', 'Add content')}
            >
              <FaPlus /> Very Small
            </button>
            <button
              className={styles.addButton}
              onClick={() => addWindowToDashboard(dashboards[0].id, 'small', 'Add content')}
            >
              <FaPlus /> Small
            </button>
            <button
              className={styles.addButton}
              onClick={() => addWindowToDashboard(dashboards[0].id, 'medium', 'Add content')}
            >
              <FaPlus /> Medium
            </button>
            <button
              className={styles.addButton}
              onClick={() => addWindowToDashboard(dashboards[0].id, 'large', 'Add content')}
            >
              <FaPlus /> Large
            </button>
            <button className={styles.addButton} onClick={addDashboard}>
              <FaPlus /> Dashboard
            </button>
            {dashboards.map((dashboard) => (
              <button
                key={dashboard.id}
                className={styles.addButton}
                onClick={() => removeDashboard(dashboard.id)}
              >
                <FaTrash /> Remove {dashboard.id}
              </button>
            ))}
          </div>
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
          />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
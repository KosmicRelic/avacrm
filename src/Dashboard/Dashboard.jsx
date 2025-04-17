import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import styles from './Dashboard.module.css';
import { MainContext } from '../Contexts/MainContext';
import DashboardPlane from './Dashboard Plane/DashboardPlane';
import DatePicker from './Date Picker/DatePicker';
import { FaPlus } from 'react-icons/fa';

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

  // Compute widgetConfig once to use in initial state
  const widgetConfig = useMemo(
    () => [
      {
        id: 'revenue',
        name: 'Revenue',
        size: 'medium',
        title: 'Revenue',
        data: `$${metrics.revenue.toLocaleString()}`,
        section: 'Financials',
      },
      {
        id: 'pending-payouts',
        name: 'Pending Payouts',
        size: 'small',
        title: 'Pending Payouts',
        data: `$${metrics.pendingPayouts.toLocaleString()}`,
        section: 'Financials',
      },
      {
        id: 'close-rate',
        name: 'Close Rate',
        size: 'small',
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
        size: 'small',
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
        size: 'verySmall',
        title: 'Top Campaigns',
        data: JSON.stringify(metrics.topCampaigns),
        section: 'Marketing',
      },
    ],
    [metrics]
  );

  // Initialize dashboards with widgets directly in state
  const [dashboards, setDashboards] = useState(
    Array.from({ length: 6 }, (_, index) => ({
      id: `dashboard-${index + 1}`,
      widgets:
        index < 3
          ? widgetConfig.filter((w) => w.section === ['Financials', 'Lead Metrics', 'Marketing'][index])
          : widgetConfig.slice(0, 2),
    }))
  );

  const [editMode, setEditMode] = useState(false);
  const [selectedWindow, setSelectedWindow] = useState(null); // { dashboardId, index }
  const editControlsRef = useRef(null);

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

  // Update widget data when metrics change, without reinitializing dashboards
  useEffect(() => {
    console.log('Updating widget data due to metrics change');
    setDashboards((prev) =>
      prev.map((dashboard) => ({
        ...dashboard,
        widgets: dashboard.widgets.map((widget) => {
          const config = widgetConfig.find((w) => w.id === widget.id);
          return config ? { ...widget, data: config.data } : widget;
        }),
      }))
    );
  }, [widgetConfig]);

  const addDashboard = () => {
    console.log('Adding new dashboard');
    setDashboards((prev) => [
      ...prev,
      {
        id: `dashboard-${prev.length + 1}`,
        widgets: [],
      },
    ]);
  };

  const toggleEditMode = () => {
    console.log('Toggling edit mode, current:', editMode);
    setEditMode((prev) => {
      const newEditMode = !prev;
      if (!newEditMode) {
        console.log('Exiting edit mode, clearing selections');
        setSelectedWindow(null);
      }
      return newEditMode;
    });
  };

  const addWindowToDashboard = (size, content) => {
    console.log(`Attempting to add ${size} widget to a dashboard`);

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

    const widgetSize = sizeMap[size] || 'small';
    const widgetScore = windowScores[widgetSize] || 20;

    const calculateScore = (widgets) => {
      return widgets.reduce((sum, w) => {
        const wSize = sizeMap[w.size] || 'small';
        return sum + (windowScores[wSize] || 0);
      }, 0);
    };

    let targetDashboard = null;
    for (const dashboard of dashboards) {
      const currentScore = calculateScore(dashboard.widgets);
      if (currentScore + widgetScore > 200) {
        console.log(`Dashboard ${dashboard.id} score too high: ${currentScore} + ${widgetScore} > 200`);
        continue;
      }
      targetDashboard = dashboard;
      break;
    }

    if (!targetDashboard) {
      console.log('No dashboard has enough space to add the widget');
      return;
    }

    const newWidget = {
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      size: widgetSize,
      title: 'New Widget',
      data: content,
    };

    console.log(`Adding ${widgetSize} widget to dashboard: ${targetDashboard.id}`);
    setDashboards((prev) =>
      prev.map((dashboard) =>
        dashboard.id === targetDashboard.id
          ? { ...dashboard, widgets: [...dashboard.widgets, newWidget] }
          : dashboard
      )
    );
  };

  const updateWidgets = (dashboardId, newWidgets) => {
    console.log(`Updating widgets for dashboard ${dashboardId}, widgets: ${newWidgets.length}`);
    setDashboards((prev) =>
      prev.map((dashboard) =>
        dashboard.id === dashboardId ? { ...dashboard, widgets: newWidgets } : dashboard
      )
    );
  };

  const getDashboardWidgets = (dashboardId) => {
    console.log(`Getting widgets for ${dashboardId}, dashboards: ${JSON.stringify(dashboards.map(d => d.id))}`);
    const dashboard = dashboards.find((d) => d.id === dashboardId);
    const widgets = dashboard ? dashboard.widgets : [];
    console.log(`Widgets for ${dashboardId}: ${JSON.stringify(widgets.map(w => w.id))}`);
    return widgets;
  };

  const handleWindowSelect = (windowInfo, swapHandler) => {
    if (!editMode) {
      console.log('Edit mode off, ignoring window selection');
      return false;
    }

    console.log(`Handle window select: ${JSON.stringify(windowInfo)}, previous: ${JSON.stringify(selectedWindow)}`);

    if (!windowInfo) {
      console.log('Clearing selected window');
      setSelectedWindow(null);
      return true;
    }

    const { dashboardId, index } = windowInfo;

    if (
      selectedWindow &&
      selectedWindow.dashboardId === dashboardId &&
      selectedWindow.index === index
    ) {
      console.log(`Deselecting window at dashboard ${dashboardId}, index ${index}`);
      setSelectedWindow(null);
      return true;
    }

    if (!selectedWindow) {
      console.log(`Selecting source window: dashboard ${dashboardId}, index ${index}`);
      setSelectedWindow({ dashboardId, index });
      return true;
    }

    console.log(
      `Attempting swap: ${selectedWindow.dashboardId}:${selectedWindow.index} ↔ ${dashboardId}:${index}`
    );
    const success = swapHandler(
      selectedWindow.dashboardId,
      selectedWindow.index,
      dashboardId,
      index
    );

    if (success) {
      console.log('Swap successful, clearing selected window');
      setSelectedWindow(null);
    } else {
      console.log('Swap failed, keeping source window selected');
    }

    return success;
  };

  const handleContainerClick = () => {
    if (editMode && selectedWindow) {
      console.log('Container clicked, clearing selected window');
      setSelectedWindow(null);
    }
  };

  const memoizedDashboards = useMemo(() => {
    return dashboards.map((d) => ({
      ...d,
      widgets: d.widgets.map((w) => ({ ...w })),
    }));
  }, [dashboards]);

  return (
    <div
      className={`${styles.dashboardWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}
      onClick={handleContainerClick}
    >
      <DatePicker />
      <div className={styles.buttonGroup}>
        <button
          className={`${styles.editHeaderButton} ${isDarkTheme ? styles.darkTheme : ''}`}
          onClick={toggleEditMode}
        >
          {editMode ? 'Done' : 'Edit'}
        </button>
      </div>
      {editMode && (
        <div className={styles.controls} ref={editControlsRef}>
          <button
            className={styles.addButton}
            onClick={() => addWindowToDashboard('verySmall', 'Add content')}
          >
            <FaPlus /> Very Small
          </button>
          <button
            className={styles.addButton}
            onClick={() => addWindowToDashboard('small', 'Add content')}
          >
            <FaPlus /> Small
          </button>
          <button
            className={styles.addButton}
            onClick={() => addWindowToDashboard('medium', 'Add content')}
          >
            <FaPlus /> Medium
          </button>
          <button
            className={styles.addButton}
            onClick={() => addWindowToDashboard('big', 'Add content')}
          >
            <FaPlus /> Big
          </button>
          <button className={styles.addButton} onClick={addDashboard}>
            <FaPlus /> Dashboard
          </button>
        </div>
      )}
      <div className={styles.windowsSection}>
        {memoizedDashboards.map((dashboard) => (
          <DashboardPlane
            key={dashboard.id}
            dashboardId={dashboard.id}
            initialWidgets={dashboard.widgets}
            editMode={editMode}
            updateWidgets={updateWidgets}
            onWindowSelect={handleWindowSelect}
            selectedWindow={selectedWindow}
            getDashboardWidgets={getDashboardWidgets}
          />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
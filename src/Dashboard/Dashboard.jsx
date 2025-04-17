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
  const [dashboards, setDashboards] = useState(
    Array.from({ length: 6 }, (_, index) => ({
      id: `dashboard-${index + 1}`,
      widgets: [],
    }))
  );
  const [editMode, setEditMode] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState(null);
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

  useEffect(() => {
    console.log('Initializing dashboards with widgets');
    setDashboards((prev) =>
      prev.map((dashboard, index) => ({
        ...dashboard,
        widgets:
          index < 3
            ? widgetConfig.filter((w) => w.section === ['Financials', 'Lead Metrics', 'Marketing'][index])
            : widgetConfig.slice(0, 2),
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
        setSelectedDashboardId(null);
        setSelectedWindow(null);
      }
      return newEditMode;
    });
  };

  const handleDashboardSelect = (dashboardId) => {
    if (editMode) {
      console.log(`Selecting dashboard: ${dashboardId}`);
      setSelectedDashboardId(dashboardId);
    }
  };

  const addWindowToDashboard = (size, content) => {
    if (!selectedDashboardId) {
      console.log('No dashboard selected for adding widget');
      alert('Please select a dashboard to add a widget to');
      return;
    }
    console.log(`Adding ${size} widget to dashboard: ${selectedDashboardId}`);
    const newWidget = {
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      size,
      title: 'New Widget',
      data: content,
    };
    setDashboards((prev) =>
      prev.map((dashboard) =>
        dashboard.id === selectedDashboardId
          ? {
              ...dashboard,
              widgets: [...dashboard.widgets, newWidget],
            }
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
    const dashboard = dashboards.find((d) => d.id === dashboardId);
    return dashboard ? dashboard.widgets : [];
  };

  const handleWindowSelect = (dashboardId, index, attemptSwap) => {
    if (!editMode) {
      console.log('Edit mode off, ignoring window selection');
      return;
    }
    console.log(`Window selected: dashboard ${dashboardId}, index ${index}, previous: ${JSON.stringify(selectedWindow)}`);
    if (!selectedWindow) {
      setSelectedWindow({ dashboardId, index });
      handleDashboardSelect(dashboardId);
    } else {
      attemptSwap(selectedWindow.dashboardId, selectedWindow.index, dashboardId, index);
      setSelectedWindow(null);
    }
  };

  // Memoize dashboards with deep comparison
  const memoizedDashboards = useMemo(() => {
    return dashboards.map((d) => ({
      ...d,
      widgets: d.widgets.map((w) => ({ ...w })),
    }));
  }, [dashboards]);

  return (
    <div className={`${styles.dashboardWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <DatePicker />
      <button
        className={`${styles.toggleEditButton} ${isDarkTheme ? styles.darkTheme : ''}`}
        onClick={toggleEditMode}
      >
        {editMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
      </button>
      {editMode && (
        <div className={styles.controls} ref={editControlsRef}>
          <button className={styles.doneButton} onClick={() => setEditMode(false)}>
            Done
          </button>
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
        </div>
      )}
      <button
        className={`${styles.addDashboardButton} ${isDarkTheme ? styles.darkTheme : ''}`}
        onClick={addDashboard}
      >
        <FaPlus /> Add Dashboard
      </button>
      <div className={styles.windowsSection}>
        {memoizedDashboards.map((dashboard) => (
          <DashboardPlane
            key={dashboard.id}
            dashboardId={dashboard.id}
            initialWidgets={dashboard.widgets}
            editMode={editMode}
            isSelected={selectedDashboardId === dashboard.id}
            onSelect={() => handleDashboardSelect(dashboard.id)}
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
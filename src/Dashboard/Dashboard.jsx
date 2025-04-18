import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
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
        },
        {
          id: 'widget-revenue-3',
          size: 'small',
          title: 'Total Revenue',
          data: '$10,000',
          section: 'Financials',
        },
        {
          id: 'widget-pending-4',
          size: 'verySmall',
          title: 'Pending Payouts',
          data: '$1,200',
          section: 'Financials',
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
        },
        {
          id: 'widget-cost-per-lead',
          size: 'small',
          title: 'Cost Per Lead',
          data: '$25.00',
          section: 'Lead Metrics',
        },
        {
          id: 'widget-bottleneck',
          size: 'verySmall',
          title: 'Bottleneck',
          data: 'Low close rate',
          section: 'Lead Metrics',
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
        },
        {
          id: 'widget-top-campaign-1',
          size: 'small',
          title: 'Top Campaign: FB Ad',
          data: '5 leads, $20/lead',
          section: 'Marketing',
        },
        {
          id: 'widget-top-campaign-2',
          size: 'small',
          title: 'Top Campaign: Google Ad',
          data: '3 leads, $25/lead',
          section: 'Marketing',
        },
        {
          id: 'widget-campaign-status',
          size: 'verySmall',
          title: 'Campaign Status',
          data: 'Active',
          section: 'Marketing',
        },
      ],
    },
  ]);
  const [editMode, setEditMode] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState(null);
  const [selectedWindow, setSelectedWindow] = useState(null);
  const editControlsRef = useRef(null);
  const prevWidgetConfigRef = useRef(null);

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
    };
    setDashboards((prev) => [
      ...prev,
      {
        id: newDashboardId,
        widgets: [newWidget],
      },
    ]);
    setSelectedDashboardId(newDashboardId);
  };

  const removeDashboard = () => {
    if (!selectedDashboardId) {
      console.log('No dashboard selected for removal');
      alert('Please select a dashboard to remove');
      return;
    }
    console.log(`Removing dashboard: ${selectedDashboardId}`);
    setDashboards((prev) => prev.filter((dashboard) => dashboard.id !== selectedDashboardId));
    setSelectedDashboardId(null);
    setSelectedWindow(null);
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

  const windowScores = {
    verySmall: 10,
    small: 20,
    medium: 40,
    large: 80,
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

  const addWindowToDashboard = (size, content) => {
    if (!selectedDashboardId) {
      console.log('No dashboard selected for adding widget');
      alert('Please select a dashboard to add a widget to');
      return;
    }

    const dashboard = dashboards.find((d) => d.id === selectedDashboardId);
    if (!dashboard) {
      console.log(`Dashboard ${selectedDashboardId} not found`);
      return;
    }

    const newWidget = {
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      size,
      title: 'New Widget',
      data: content,
      section: 'Custom',
    };
    const newWidgets = [...dashboard.widgets, newWidget];
    if (!validateDashboardScore(dashboard.widgets, newWidgets)) {
      alert('Cannot add widget: Dashboard score limit reached');
      return;
    }

    console.log(`Adding ${size} widget to dashboard: ${selectedDashboardId}`);
    setDashboards((prev) =>
      prev.map((dashboard) =>
        dashboard.id === selectedDashboardId
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
    if (!validateDashboardScore(dashboard.widgets, newWidgets)) {
      console.log(`Widget update rejected for dashboard ${dashboardId}: score limit exceeded`);
      return;
    }
    setDashboards((prev) =>
      prev.map((dashboard) =>
        dashboard.id === dashboardId
          ? {
              ...dashboard,
              widgets: newWidgets.map((widget) => ({
                ...widget,
                position: widget.position || { row: 0, col: 0 }, // Use default position if none provided
              })),
            }
          : dashboard
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
    console.log(
      `Window selected: dashboard ${dashboardId}, index ${index}, previous: ${JSON.stringify(selectedWindow)}`
    );
    if (!selectedWindow) {
      setSelectedWindow({ dashboardId, index });
      if (selectedDashboardId !== dashboardId) {
        handleDashboardSelect(dashboardId);
      }
    } else {
      const success = attemptSwap(selectedWindow.dashboardId, selectedWindow.index, dashboardId, index);
      if (success) {
        console.log('Swap successful, clearing selected window');
        setSelectedWindow(null);
      } else {
        console.log('Swap failed, preserving selected window');
      }
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
              onClick={() => addWindowToDashboard('large', 'Add content')}
            >
              <FaPlus /> Large
            </button>
            <button className={styles.addButton} onClick={addDashboard}>
              <FaPlus /> Dashboard
            </button>
            <button
              className={styles.addButton}
              onClick={removeDashboard}
              disabled={!selectedDashboardId}
            >
              <FaTrash /> Remove Dashboard
            </button>
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
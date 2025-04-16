import React, { useContext, useState, useEffect } from 'react';
import styles from './Dashboard.module.css';
import { MainContext } from '../Contexts/MainContext';
import DashboardPlane from './Dashboard Plane/DashboardPlane';
import DatePicker from './Date Picker/DatePicker';

const Widget = ({ id, name, size, title, children, darkTheme }) => {
  return (
    <div
      className={`${styles.windowContainer} ${styles[size]} ${darkTheme ? styles.darkTheme : ''}`}
      data-id={id}
      data-name={name}
    >
      <h3 className={styles.widgetTitle}>{title}</h3>
      <div className={styles.data}>{children}</div>
    </div>
  );
};

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

  // Calculate critical metrics from context cards
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

  // Widget configuration
  const widgetConfig = [
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
      data: (
        <ul className={`${styles.campaignList} ${isDarkTheme ? styles.darkTheme : ''}`}>
          {metrics.topCampaigns.map((campaign, index) => (
            <li key={index}>
              {campaign.name}: {campaign.leads} leads, ${campaign.costPerLead}/lead
            </li>
          ))}
        </ul>
      ),
      section: 'Marketing',
    },
  ];

  // Distribute widgets across three DashboardPlanes
  const dashboardPlanes = [
    widgetConfig.filter((w) => w.section === 'Financials'),
    widgetConfig.filter((w) => w.section === 'Lead Metrics'),
    widgetConfig.filter((w) => w.section === 'Marketing'),
  ];

  return (
    <div className={`${styles.dashboardWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <DatePicker />
      <div className={styles.windowsSection}>
        {dashboardPlanes.map((widgets, index) => (
          <DashboardPlane key={index} initialWidgets={widgets} />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
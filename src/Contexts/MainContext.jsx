import { createContext, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

export const MainContext = createContext();

export const MainContextProvider = ({ children }) => {
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) return storedTheme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const themeRef = useRef(isDarkTheme ? 'dark' : 'light');

  const [sheets, setSheets] = useState({
    allSheets: [
      {
        id: 'primarySheet',
        sheetName: 'All Cards',
        headers: [
          { key: 'id', visible: true, hidden: false },
          { key: 'name', visible: true, hidden: false },
          { key: 'phone', visible: true, hidden: false },
          { key: 'email', visible: true, hidden: false },
          { key: 'leadScore', visible: true, hidden: false },
          { key: 'nextActions', visible: true, offcanvas: true },
          { key: 'followUpDate', visible: true, hidden: false },
        ],
        pinnedHeaders: ['id', 'name'],
        rows: [
          '100001',
          '100002',
          '100003',
          '100004',
          '100005',
          '100006',
          '100007',
          '100008',
          '100009',
          '100010',
          '100011',
          '100012',
          '100013',
          '100014',
          '100015',
          '100016',
          '100017',
          '100018',
          '100019',
          '100020',
        ],
        isActive: true,
      },
      {
        id: 'sheet2',
        sheetName: 'Business Partners',
        headers: [
          { key: 'id', visible: true, hidden: false },
          { key: 'fullName', visible: true, hidden: false },
          { key: 'address', visible: true, hidden: false },
          { key: 'status', visible: true, hidden: false },
        ],
        pinnedHeaders: ['id'],
        rows: [],
        isActive: false,
      },
      {
        id: 'sheet3',
        sheetName: 'Vendors',
        headers: [
          { key: 'id', visible: true, hidden: false },
          { key: 'name', visible: true, hidden: false },
          { key: 'contact', visible: true, hidden: false },
        ],
        pinnedHeaders: ['id'],
        rows: [],
        isActive: false,
      },
      {
        id: 'sheet4',
        sheetName: 'Tasks',
        headers: [
          { key: 'id', visible: true, hidden: false },
          { key: 'description', visible: true, hidden: false },
          { key: 'dueDate', visible: true, hidden: false },
          { key: 'priority', visible: true, hidden: false },
        ],
        pinnedHeaders: ['id'],
        rows: [],
        isActive: false,
      },
    ],
    structure: [
      { sheetName: 'All Cards' },
      {
        folderName: 'Partners',
        sheets: ['Business Partners', 'Vendors'],
      },
      { sheetName: 'Tasks' },
    ],
  });

  const [cards, setCards] = useState([
    {
      id: '100001',
      typeOfCards: 'Leads',
      name: 'Periklis Papadopoulos',
      phone: '6986600023',
      email: 'periklis@example.com',
      leadScore: '80',
      nextActions: 'Call back',
      followUpDate: '2025-04-05',
      history: [
        {
          field: 'leadScore',
          value: '80',
          timestamp: { _seconds: 1737417600, _nanoseconds: 0 }, // January 21, 2025
        },
        {
          field: 'nextActions',
          value: 'Call back',
          timestamp: { _seconds: 1741651200, _nanoseconds: 0 }, // March 10, 2025
        },
        {
          field: 'name',
          value: 'Periklis Papadopoulous',
          timestamp: { _seconds: 1677657600, _nanoseconds: 0 }, // March 1, 2023
        },
        {
          field: 'phone',
          value: '6986600024',
          timestamp: { _seconds: 1685577600, _nanoseconds: 0 }, // June 1, 2023
        },
        {
          field: 'email',
          value: 'periklis.pap@example.com',
          timestamp: { _seconds: 1699488000, _nanoseconds: 0 }, // November 9, 2023
        },
        {
          field: 'leadScore',
          value: '70',
          timestamp: { _seconds: 1709251200, _nanoseconds: 0 }, // March 1, 2024
        },
      ],
    },
    {
      id: '100002',
      typeOfCards: 'Leads',
      name: 'Maria Ioannou',
      phone: '6977554321',
      email: 'maria@example.com',
      leadScore: '90',
      nextActions: 'Send offer',
      followUpDate: '2025-04-06',
      history: [
        {
          field: 'phone',
          value: '6977554321',
          timestamp: { _seconds: 1739577600, _nanoseconds: 0 }, // February 15, 2025
        },
        {
          field: 'email',
          value: 'maria.ioannou@example.com',
          timestamp: { _seconds: 1678838400, _nanoseconds: 0 }, // March 15, 2023
        },
        {
          field: 'leadScore',
          value: '85',
          timestamp: { _seconds: 1693526400, _nanoseconds: 0 }, // September 1, 2023
        },
        {
          field: 'nextActions',
          value: 'Follow-up call',
          timestamp: { _seconds: 1711929600, _nanoseconds: 0 }, // April 1, 2024
        },
      ],
    },
    {
      id: '100003',
      typeOfCards: 'Leads',
      name: 'Dimitris Georgiou',
      phone: '6999887766',
      email: 'dimitris@example.com',
      leadScore: '75',
      nextActions: 'Follow-up email',
      followUpDate: '2025-04-07',
      history: [
        {
          field: 'email',
          value: 'dimitris@example.com',
          timestamp: { _seconds: 1745107200, _nanoseconds: 0 }, // April 21, 2025
        },
        {
          field: 'phone',
          value: '6999887765',
          timestamp: { _seconds: 1680307200, _nanoseconds: 0 }, // April 1, 2023
        },
        {
          field: 'leadScore',
          value: '70',
          timestamp: { _seconds: 1698796800, _nanoseconds: 0 }, // November 1, 2023
        },
        {
          field: 'followUpDate',
          value: '2024-03-15',
          timestamp: { _seconds: 1710460800, _nanoseconds: 0 }, // March 15, 2024
        },
      ],
    },
    {
      id: '100004',
      typeOfCards: 'Leads',
      name: 'Eleni Christodoulou',
      phone: '6933445566',
      email: 'eleni@example.com',
      leadScore: '85',
      nextActions: 'Schedule meeting',
      followUpDate: '2025-04-08',
      history: [
        {
          field: 'name',
          value: 'Eleni Christodoulous',
          timestamp: { _seconds: 1676246400, _nanoseconds: 0 }, // February 13, 2023
        },
        {
          field: 'email',
          value: 'eleni.c@example.com',
          timestamp: { _seconds: 1688169600, _nanoseconds: 0 }, // July 1, 2023
        },
        {
          field: 'leadScore',
          value: '80',
          timestamp: { _seconds: 1706745600, _nanoseconds: 0 }, // February 1, 2024
        },
        {
          field: 'nextActions',
          value: 'Send proposal',
          timestamp: { _seconds: 1725148800, _nanoseconds: 0 }, // September 1, 2024
        },
      ],
    },
    {
      id: '100005',
      typeOfCards: 'Leads',
      name: 'Nikos Pappas',
      phone: '6955332211',
      email: 'nikos@example.com',
      leadScore: '60',
      nextActions: 'Send reminder',
      followUpDate: '2025-04-09',
      history: [
        {
          field: 'phone',
          value: '6955332210',
          timestamp: { _seconds: 1678838400, _nanoseconds: 0 }, // March 15, 2023
        },
        {
          field: 'leadScore',
          value: '55',
          timestamp: { _seconds: 1696118400, _nanoseconds: 0 }, // October 1, 2023
        },
        {
          field: 'nextActions',
          value: 'Initial outreach',
          timestamp: { _seconds: 1709251200, _nanoseconds: 0 }, // March 1, 2024
        },
      ],
    },
    {
      id: '100006',
      typeOfCards: 'Leads',
      name: 'Georgia Alexiou',
      phone: '6900112233',
      email: 'georgia@example.com',
      leadScore: '95',
      nextActions: 'Close deal',
      followUpDate: '2025-04-10',
      history: [
        {
          field: 'email',
          value: 'georgia.alexiou@example.com',
          timestamp: { _seconds: 1682899200, _nanoseconds: 0 }, // May 1, 2023
        },
        {
          field: 'leadScore',
          value: '90',
          timestamp: { _seconds: 1699488000, _nanoseconds: 0 }, // November 9, 2023
        },
        {
          field: 'nextActions',
          value: 'Negotiate terms',
          timestamp: { _seconds: 1719792000, _nanoseconds: 0 }, // July 1, 2024
        },
        {
          field: 'followUpDate',
          value: '2024-12-01',
          timestamp: { _seconds: 1733011200, _nanoseconds: 0 }, // December 1, 2024
        },
      ],
    },
    {
      id: '100007',
      typeOfCards: 'Leads',
      name: 'Kostas Leventis',
      phone: '6999001122',
      email: 'kostas@example.com',
      leadScore: '70',
      nextActions: 'Cold call',
      followUpDate: '2025-04-11',
      history: [
        {
          field: 'phone',
          value: '6999001123',
          timestamp: { _seconds: 1677657600, _nanoseconds: 0 }, // March 1, 2023
        },
        {
          field: 'leadScore',
          value: '65',
          timestamp: { _seconds: 1693526400, _nanoseconds: 0 }, // September 1, 2023
        },
        {
          field: 'email',
          value: 'kostas.l@example.com',
          timestamp: { _seconds: 1711929600, _nanoseconds: 0 }, // April 1, 2024
        },
      ],
    },
    {
      id: '100008',
      typeOfCards: 'Leads',
      name: 'Sofia Karamanou',
      phone: '6977889900',
      email: 'sofia@example.com',
      leadScore: '88',
      nextActions: 'Send brochure',
      followUpDate: '2025-04-12',
      history: [
        {
          field: 'name',
          value: 'Sofia Karamanous',
          timestamp: { _seconds: 1680307200, _nanoseconds: 0 }, // April 1, 2023
        },
        {
          field: 'leadScore',
          value: '85',
          timestamp: { _seconds: 1698796800, _nanoseconds: 0 }, // November 1, 2023
        },
        {
          field: 'nextActions',
          value: 'Initial contact',
          timestamp: { _seconds: 1714521600, _nanoseconds: 0 }, // May 1, 2024
        },
        {
          field: 'followUpDate',
          value: '2024-06-15',
          timestamp: { _seconds: 1718409600, _nanoseconds: 0 }, // June 15, 2024
        },
      ],
    },
    {
      id: '100009',
      typeOfCards: 'Leads',
      name: 'Michalis Xanthopoulos',
      phone: '6933556677',
      email: 'michalis@example.com',
      leadScore: '78',
      nextActions: 'Call and pitch',
      followUpDate: '2025-04-13',
      history: [
        {
          field: 'email',
          value: 'michalis.x@example.com',
          timestamp: { _seconds: 1676246400, _nanoseconds: 0 }, // February 13, 2023
        },
        {
          field: 'phone',
          value: '6933556678',
          timestamp: { _seconds: 1690934400, _nanoseconds: 0 }, // August 2, 2023
        },
        {
          field: 'leadScore',
          value: '75',
          timestamp: { _seconds: 1706745600, _nanoseconds: 0 }, // February 1, 2024
        },
      ],
    },
    {
      id: '100010',
      typeOfCards: 'Leads',
      name: 'Vasiliki Antoniou',
      phone: '6911223344',
      email: 'vasiliki@example.com',
      leadScore: '92',
      nextActions: 'Confirm interest',
      followUpDate: '2025-04-14',
      history: [
        {
          field: 'leadScore',
          value: '90',
          timestamp: { _seconds: 1685577600, _nanoseconds: 0 }, // June 1, 2023
        },
        {
          field: 'nextActions',
          value: 'Send details',
          timestamp: { _seconds: 1699488000, _nanoseconds: 0 }, // November 9, 2023
        },
        {
          field: 'email',
          value: 'vasiliki.a@example.com',
          timestamp: { _seconds: 1719792000, _nanoseconds: 0 }, // July 1, 2024
        },
        {
          field: 'followUpDate',
          value: '2024-09-01',
          timestamp: { _seconds: 1725148800, _nanoseconds: 0 }, // September 1, 2024
        },
      ],
    },
    {
      id: '100011',
      typeOfCards: 'Leads',
      name: 'Giannis Korres',
      phone: '6901122334',
      email: 'giannis@example.com',
      leadScore: '73',
      nextActions: 'Send follow-up',
      followUpDate: '2025-04-15',
      history: [
        {
          field: 'phone',
          value: '6901122335',
          timestamp: { _seconds: 1678838400, _nanoseconds: 0 }, // March 15, 2023
        },
        {
          field: 'leadScore',
          value: '70',
          timestamp: { _seconds: 1696118400, _nanoseconds: 0 }, // October 1, 2023
        },
        {
          field: 'nextActions',
          value: 'Cold outreach',
          timestamp: { _seconds: 1711929600, _nanoseconds: 0 }, // April 1, 2024
        },
      ],
    },
    {
      id: '100012',
      typeOfCards: 'Leads',
      name: 'Katerina Liosi',
      phone: '6944332211',
      email: 'katerina@example.com',
      leadScore: '81',
      nextActions: 'Call again',
      followUpDate: '2025-04-16',
      history: [
        {
          field: 'email',
          value: 'katerina.l@example.com',
          timestamp: { _seconds: 1682899200, _nanoseconds: 0 }, // May 1, 2023
        },
        {
          field: 'leadScore',
          value: '78',
          timestamp: { _seconds: 1698796800, _nanoseconds: 0 }, // November 1, 2023
        },
        {
          field: 'nextActions',
          value: 'Send email',
          timestamp: { _seconds: 1714521600, _nanoseconds: 0 }, // May 1, 2024
        },
        {
          field: 'followUpDate',
          value: '2024-07-01',
          timestamp: { _seconds: 1719792000, _nanoseconds: 0 }, // July 1, 2024
        },
      ],
    },
    {
      id: '100013',
      typeOfCards: 'Leads',
      name: 'Panagiotis Rizos',
      phone: '6988112233',
      email: 'panagiotis@example.com',
     
  
   leadScore: '68',
      nextActions: 'Schedule call',
      followUpDate: '2025-04-17',
      history: [
        {
          field: 'phone',
          value: '6988112234',
          timestamp: { _seconds: 1676246400, _nanoseconds: 0 }, // February 13, 2023
        },
        {
          field: 'leadScore',
          value: '65',
          timestamp: { _seconds: 1693526400, _nanoseconds: 0 }, // September 1, 2023
        },
        {
          field: 'email',
          value: 'panagiotis.r@example.com',
          timestamp: { _seconds: 1709251200, _nanoseconds: 0 }, // March 1, 2024
        },
      ],
    },
    {
      id: '100014',
      typeOfCards: 'Leads',
      name: 'Anna Petridou',
      phone: '6990001122',
      email: 'anna@example.com',
      leadScore: '94',
      nextActions: 'Close deal',
      followUpDate: '2025-04-18',
      history: [
        {
          field: 'name',
          value: 'Anna Petridous',
          timestamp: { _seconds: 1680307200, _nanoseconds: 0 }, // April 1, 2023
        },
        {
          field: 'leadScore',
          value: '90',
          timestamp: { _seconds: 1699488000, _nanoseconds: 0 }, // November 9, 2023
        },
        {
          field: 'nextActions',
          value: 'Negotiate deal',
          timestamp: { _seconds: 1717200000, _nanoseconds: 0 }, // June 1, 2024
        },
        {
          field: 'followUpDate',
          value: '2024-10-01',
          timestamp: { _seconds: 1727740800, _nanoseconds: 0 }, // October 1, 2024
        },
      ],
    },
    {
      id: '100015',
      typeOfCards: 'Leads',
      name: 'Stelios Nikas',
      phone: '6977223344',
      email: 'stelios@example.com',
      leadScore: '76',
      nextActions: 'Final meeting',
      followUpDate: '2025-04-19',
      history: [
        {
          field: 'phone',
          value: '6977223345',
          timestamp: { _seconds: 1678838400, _nanoseconds: 0 }, // March 15, 2023
        },
        {
          field: 'leadScore',
          value: '72',
          timestamp: { _seconds: 1696118400, _nanoseconds: 0 }, // October 1, 2023
        },
        {
          field: 'email',
          value: 'stelios.n@example.com',
          timestamp: { _seconds: 1711929600, _nanoseconds: 0 }, // April 1, 2024
        },
      ],
    },
    {
      id: '100016',
      typeOfCards: 'Leads',
      name: 'Eirini Valasi',
      phone: '6955887766',
      email: 'eirini@example.com',
      leadScore: '89',
      nextActions: 'Confirm schedule',
      followUpDate: '2025-04-20',
      history: [
        {
          field: 'email',
          value: 'eirini.v@example.com',
          timestamp: { _seconds: 1685577600, _nanoseconds: 0 }, // June 1, 2023
        },
        {
          field: 'leadScore',
          value: '85',
          timestamp: { _seconds: 1698796800, _nanoseconds: 0 }, // November 1, 2023
        },
        {
          field: 'nextActions',
          value: 'Send reminder',
          timestamp: { _seconds: 1719792000, _nanoseconds: 0 }, // July 1, 2024
        },
        {
          field: 'followUpDate',
          value: '2024-11-01',
          timestamp: { _seconds: 1730419200, _nanoseconds: 0 }, // November 1, 2024
        },
      ],
    },
    {
      id: '100017',
      typeOfCards: 'Leads',
      name: 'Apostolos Zannis',
      phone: '6900332211',
      email: 'apostolos@example.com',
      leadScore: '84',
      nextActions: 'Send contract',
      followUpDate: '2025-04-21',
      history: [
        {
          field: 'phone',
          value: '6900332212',
          timestamp: { _seconds: 1676246400, _nanoseconds: 0 }, // February 13, 2023
        },
        {
          field: 'leadScore',
          value: '80',
          timestamp: { _seconds: 1693526400, _nanoseconds: 0 }, // September 1, 2023
        },
        {
          field: 'email',
          value: 'apostolos.z@example.com',
          timestamp: { _seconds: 1709251200, _nanoseconds: 0 }, // March 1, 2024
        },
      ],
    },
    {
      id: '100018',
      typeOfCards: 'Leads',
      name: 'Ioanna Michou',
      phone: '6933221100',
      email: 'ioanna@example.com',
      leadScore: '91',
      nextActions: 'Onboard',
      followUpDate: '2025-04-22',
      history: [
        {
          field: 'name',
          value: 'Ioanna Michous',
          timestamp: { _seconds: 1682899200, _nanoseconds: 0 }, // May 1, 2023
        },
        {
          field: 'leadScore',
          value: '88',
          timestamp: { _seconds: 1699488000, _nanoseconds: 0 }, // November 9, 2023
        },
        {
          field: 'nextActions',
          value: 'Sign contract',
          timestamp: { _seconds: 1717200000, _nanoseconds: 0 }, // June 1, 2024
        },
        {
          field: 'followUpDate',
          value: '2024-12-01',
          timestamp: { _seconds: 1733011200, _nanoseconds: 0 }, // December 1, 2024
        },
      ],
    },
    {
      id: '100019',
      typeOfCards: 'Leads',
      name: 'Christos Makris',
      phone: '6988776655',
      email: 'christos@example.com',
      leadScore: '67',
      nextActions: 'Check-in call',
      followUpDate: '2025-04-23',
      history: [
        {
          field: 'phone',
          value: '6988776656',
          timestamp: { _seconds: 1678838400, _nanoseconds: 0 }, // March 15, 2023
        },
        {
          field: 'leadScore',
          value: '62',
          timestamp: { _seconds: 1696118400, _nanoseconds: 0 }, // October 1, 2023
        },
        {
          field: 'email',
          value: 'christos.m@example.com',
          timestamp: { _seconds: 1711929600, _nanoseconds: 0 }, // April 1, 2024
        },
      ],
    },
    {
      id: '100020',
      typeOfCards: 'Leads',
      name: 'Zoi Karra',
      phone: '6911220088',
      email: 'zoi@example.com',
      leadScore: '86',
      nextActions: 'Upsell offer',
      followUpDate: '2025-04-24',
      history: [
        {
          field: 'email',
          value: 'zoi.karra@example.com',
          timestamp: { _seconds: 1685577600, _nanoseconds: 0 }, // June 1, 2023
        },
        {
          field: 'leadScore',
          value: '82',
          timestamp: { _seconds: 1698796800, _nanoseconds: 0 }, // November 1, 2023
        },
        {
          field: 'nextActions',
          value: 'Follow-up offer',
          timestamp: { _seconds: 1719792000, _nanoseconds: 0 }, // July 1, 2024
        },
        {
          field: 'followUpDate',
          value: '2024-11-15',
          timestamp: { _seconds: 1731628800, _nanoseconds: 0 }, // November 15, 2024
        },
      ],
    },
  ]);

  const [headers, setHeaders] = useState([
    { key: 'typeOfCards', name: 'TYPE OF CARDS', type: 'text' },
    { key: 'id', name: 'ID', type: 'number' },
    { key: 'name', name: 'NAME', type: 'text' },
    { key: 'phone', name: 'PHONE', type: 'text' },
    { key: 'email', name: 'EMAIL', type: 'text' },
    { key: 'leadScore', name: 'LEAD SCORE', type: 'number' },
    {
      key: 'nextActions',
      name: 'NEXT ACTION',
      type: 'dropdown',
      options: [
        'Call back',
        'Send offer',
        'Follow-up email',
        'Schedule meeting',
        'Close deal',
      ],
    },
    { key: 'followUpDate', name: 'FOLLOW UP DATE', type: 'date' },
    { key: 'fullName', name: 'FULL NAME', type: 'text' },
    { key: 'address', name: 'ADDRESS', type: 'text' },
    {
      key: 'status',
      name: 'STATUS',
      type: 'dropdown',
      options: ['Active', 'Inactive', 'Pending'],
    },
    { key: 'contact', name: 'CONTACT', type: 'text' },
    { key: 'description', name: 'DESCRIPTION', type: 'text' },
    { key: 'dueDate', name: 'DUE DATE', type: 'date' },
    {
      key: 'priority',
      name: 'PRIORITY',
      type: 'dropdown',
      options: ['High', 'Medium', 'Low'],
    },
  ]);

  const [cardTemplates, setCardTemplates] = useState([
    {
      name: 'Leads',
      typeOfCards: 'Leads',
      sections: [
        {
          name: 'Contact Information',
          keys: ['id', 'name', 'phone', 'email', 'leadScore', 'nextActions', 'followUpDate'],
        },
        {
          name: 'Sales Process',
          keys: [],
        },
      ],
    },
    {
      name: 'Business',
      typeOfCards: 'Business',
      sections: [
        {
          name: 'Business Details',
          keys: ['id', 'fullName', 'address', 'status'],
        },
      ],
    },
  ]);

  const [metrics, setMetrics] = useState([
    {
      category: 'Financials',
      metrics: [
        { id: 'metric-revenue', name: 'Total Revenue', type: 'currency', value: '$10,000' },
        { id: 'metric-payouts', name: 'Pending Payouts', type: 'currency', value: '$1,200' },
        {
          id: 'metric-revenue-trend',
          name: 'Revenue Trend',
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            values: [8000, 9000, 8500, 10000, 9500, 11000],
          },
        },
      ],
    },
    {
      category: 'Marketing',
      metrics: [
        { id: 'metric-campaign-roi', name: 'Campaign ROI', type: 'multiplier', value: '2.5x' },
        { id: 'metric-fb-ad', name: 'FB Ad Leads', type: 'text', value: '5 leads, $20/lead' },
        { id: 'metric-google-ad', name: 'Google Ad Leads', type: 'text', value: '3 leads, $25/lead' },
        { id: 'metric-campaign-status', name: 'Campaign Status', type: 'text', value: 'Active' },
        {
          id: 'metric-ad-spend',
          name: 'Ad Spend Distribution',
          type: 'pie',
          data: {
            labels: ['Facebook', 'Google', 'LinkedIn', 'Other'],
            values: [5000, 3000, 1500, 1000],
          },
        },
      ],
    },
    {
      category: 'Leads',
      metrics: [
        { id: 'metric-leads-score', name: 'Leads Score', type: 'number', value: '74' },
        { id: 'metric-total-leads', name: 'Total Leads', type: 'number', value: '20' },
        {
          id: 'metric-close-rate',
          name: 'Close Rate',
          type: 'speedometer',
          data: { value: 75 },
        },
        { id: 'metric-cost-per-lead', name: 'Cost Per Lead', type: 'currency', value: '$25.00' },
        { id: 'metric-bottleneck', name: 'Bottleneck', type: 'text', value: 'Low close rate' },
        {
          id: 'metric-lead-growth',
          name: 'Lead Growth',
          type: 'bar',
          data: {
            labels: ['Q1', 'Q2', 'Q3', 'Q4'],
            values: [10, 15, 12, 20],
          },
        },
      ],
    },
  ]);
  
  const [dashboards, setDashboards] = useState([
    {
      id: 'dashboard-1',
      dashboardWidgets: [
        {
          id: 'widget-revenue-3',
          size: 'small',
          title: 'Leads',
          metricId: 'metric-lead-growth',
          position: { row: 0, col: 0 },
          dashboardId: 'dashboard-1',
        },
        {
          id: 'widget-revenue-1',
          size: 'verySmall',
          title: 'Financials',
          metricId: 'metric-revenue',
          position: { row: 0, col: 1 },
          dashboardId: 'dashboard-1',
        },
        {
          id: 'widget-pending-4',
          size: 'verySmall',
          title: 'Financials',
          metricId: 'metric-payouts',
          position: { row: 1, col: 1 },
          dashboardId: 'dashboard-1',
        },
        {
          id: 'widget-pending-2',
          size: 'medium',
          title: 'Leads',
          metricId: 'metric-revenue-trend',
          position: { row: 2, col: 0 },
          dashboardId: 'dashboard-1',
        },
      ],
    },
    {
      id: 'dashboard-2',
      dashboardWidgets: [
        {
          id: 'widget-close-rate',
          size: 'large',
          title: 'Marketing',
          metricId: 'metric-ad-spend',
          position: { row: 0, col: 0 },
          dashboardId: 'dashboard-2',
        },
      ],
    },
    {
      id: 'dashboard-3',
      dashboardWidgets: [
        {
          id: 'widget-campaign-roi',
          size: 'small',
          title: 'Marketing',
          metricId: 'metric-campaign-roi',
          position: { row: 0, col: 0 },
          dashboardId: 'dashboard-3',
        },
        {
          id: 'widget-top-campaign-1',
          size: 'small',
          title: 'Marketing',
          metricId: 'metric-fb-ad',
          position: { row: 0, col: 1 },
          dashboardId: 'dashboard-3',
        },
        {
          id: 'widget-top-campaign-2',
          size: 'medium',
          title: 'Marketing',
          metricId: 'metric-lead-growth',
          position: { row: 2, col: 0 },
          dashboardId: 'dashboard-3',
        },
      ],
    },
  ]);

  useEffect(() => {
    setMetrics((prevMetrics) =>
      prevMetrics.map((category) => ({
        ...category,
        metrics: category.metrics.map((metric) => {
          if (metric.config) {
            // Check for cardTemplates or cards
            const filteredCards = metric.config.cardTemplates
              ? cards.filter((card) => metric.config.cardTemplates.includes(card.typeOfCards))
              : metric.config.cards
              ? cards.filter((card) => metric.config.cards.includes(card.id))
              : cards; // Fallback to all cards
            const data = computeMetricData(filteredCards, metric.config);
            return {
              ...metric,
              data,
              value:
                metric.type === 'number'
                  ? data.datasets?.[0]?.data?.[data.datasets[0].data.length - 1] || 0
                  : metric.value, // Preserve existing value for non-number metrics
            };
          }
          return metric;
        }),
      }))
    );
  }, [cards]);

  const [tempData, setTempData] = useState(null);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(null);
  const [editMode, setEditMode] = useState(false);

  // Sync "All Cards" sheet rows with all card IDs
  useEffect(() => {
    setSheets((prev) => ({
      ...prev,
      allSheets: prev.allSheets.map((sheet) =>
        sheet.id === 'primarySheet'
          ? { ...sheet, rows: cards.map((card) => card.id) }
          : sheet
      ),
    }));
  }, [cards]);

  useEffect(() => {
    themeRef.current = isDarkTheme ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', themeRef.current);
    document.body.style.backgroundColor = isDarkTheme ? 'black' : 'rgb(243, 242, 248)';
    document.body.style.color = isDarkTheme ? 'rgb(243, 242, 248)' : 'rgb(0, 0, 0)';
    if (localStorage.getItem('theme') !== null) {
      localStorage.setItem('theme', themeRef.current);
    }
  }, [isDarkTheme]);

  useEffect(() => {
    console.log(metrics[2]);
  }
  , [metrics]);

  return (
    <MainContext.Provider
      value={{
        sheets,
        setSheets,
        cards,
        setCards,
        headers,
        setHeaders,
        isDarkTheme,
        setIsDarkTheme,
        themeRef,
        cardTemplates,
        setCardTemplates,
        tempData,
        setTempData,
        selectedTemplateIndex,
        setSelectedTemplateIndex,
        currentSectionIndex,
        setCurrentSectionIndex,
        editMode,
        setEditMode,
        dashboards,
        setDashboards,
        metrics,
        setMetrics,
      }}
    >
      {children}
    </MainContext.Provider>
  );
};

MainContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default MainContextProvider;
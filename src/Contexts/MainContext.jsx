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
        sheetName: 'All',
        headers: [],
        pinnedHeaders: [],
        rows: [],
        filters: {},
        isActive: true,
      },
      {
        id: 'leadsSheet',
        sheetName: 'Leads',
        headers: [
          { key: 'id', name: 'ID', type: 'text', visible: true, hidden: false },
          { key: 'name', name: 'Name', type: 'text', visible: true, hidden: false },
          { key: 'phone', name: 'Phone', type: 'text', visible: true, hidden: false },
          { key: 'email', name: 'Email', type: 'text', visible: true, hidden: false },
          { key: 'leadStatus', name: 'Lead Status', type: 'dropdown', options: ['New', 'Contacted', 'Qualified', 'Lost'], visible: true, hidden: false },
          { key: 'leadSource', name: 'Lead Source', type: 'dropdown', options: ['Website', 'Referral', 'Ad Campaign'], visible: true, hidden: false },
          { key: 'followUpDate', name: 'Follow-Up Date', type: 'date', visible: true, hidden: false },
          { key: 'conversionValue', name: 'Conversion Value', type: 'number', visible: true, hidden: false },
        ],
        pinnedHeaders: ['id', 'name'],
        rows: [
          '100001', '100002', '100003', '100004', '100005', '100006', '100007', '100008', '100009', '100010',
          '100011', '100012', '100013', '100014', '100015', '100016', '100017', '100018', '100019', '100020',
        ],
        filters: {},
        isActive: false,
      },
      {
        id: 'campaignsSheet',
        sheetName: 'Ad Campaigns',
        headers: [
          { key: 'id', name: 'ID', type: 'text', visible: true, hidden: false },
          { key: 'campaignName', name: 'Campaign Name', type: 'text', visible: true, hidden: false },
          { key: 'platform', name: 'Platform', type: 'dropdown', options: ['Google', 'Facebook', 'LinkedIn'], visible: true, hidden: false },
          { key: 'adSpend', name: 'Ad Spend', type: 'number', visible: true, hidden: false },
          { key: 'leadsGenerated', name: 'Leads Generated', type: 'number', visible: true, hidden: false },
          { key: 'costPerLead', name: 'Cost Per Lead', type: 'number', visible: true, hidden: false },
          { key: 'startDate', name: 'Start Date', type: 'date', visible: true, hidden: false },
          { key: 'status', name: 'Status', type: 'dropdown', options: ['Active', 'Paused', 'Completed'], visible: true, hidden: false },
        ],
        pinnedHeaders: ['id'],
        rows: ['200001', '200002', '200003', '200004', '200005', '200006'],
        filters: {},
        isActive: false,
      },
      {
        id: 'partnersSheet',
        sheetName: 'Business Partners',
        headers: [
          { key: 'id', name: 'ID', type: 'text', visible: true, hidden: false },
          { key: 'businessName', name: 'Business Name', type: 'text', visible: true, hidden: false },
          { key: 'contact', name: 'Contact', type: 'text', visible: true, hidden: false },
          { key: 'negotiatedRate', name: 'Negotiated Rate', type: 'number', visible: true, hidden: false },
          { key: 'status', name: 'Status', type: 'dropdown', options: ['Active', 'Inactive'], visible: true, hidden: false },
        ],
        pinnedHeaders: ['id'],
        rows: ['300001', '300002', '300003', '300004'],
        filters: {},
        isActive: false,
      },
      {
        id: 'paymentsSheet',
        sheetName: 'Payments',
        headers: [
          { key: 'id', name: 'ID', type: 'text', visible: true, hidden: false },
          { key: 'leadId', name: 'Lead ID', type: 'text', visible: true, hidden: false },
          { key: 'clientPayment', name: 'Client Payment', type: 'number', visible: true, hidden: false },
          { key: 'partnerPayment', name: 'Partner Payment', type: 'number', visible: true, hidden: false },
          { key: 'paymentDate', name: 'Payment Date', type: 'date', visible: true, hidden: false },
          { key: 'status', name: 'Status', type: 'dropdown', options: ['Pending', 'Completed', 'Failed'], visible: true, hidden: false },
        ],
        pinnedHeaders: ['id'],
        rows: ['400001', '400002', '400003', '400004', '400005', '400006', '400007', '400008', '400009', '400010'],
        filters: {},
        isActive: false,
      },
    ],
    structure: [
      { sheetName: 'All' },
      { sheetName: 'Leads' },
      { sheetName: 'Ad Campaigns' },
      { sheetName: 'Business Partners' },
      { sheetName: 'Payments' },
      { folderName: 'Test', sheets:["Leads"] },
    ],
  });

  const [cards, setCards] = useState([
    // Lead Cards (20)
    {
      id: '100001',
      typeOfCards: 'Leads',
      name: 'John Smith',
      phone: '555-0101',
      email: 'john.smith@example.com',
      leadStatus: 'Converted',
      leadSource: 'Facebook Ads',
      followUpDate: '2025-04-10',
      conversionValue: 5000,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1735689600, _nanoseconds: 0 } }, // Jan 1, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1735776000, _nanoseconds: 0 } }, // Jan 2, 2025
        { field: 'followUpDate', value: '2025-04-10', timestamp: { _seconds: 1735862400, _nanoseconds: 0 } }, // Jan 3, 2025
        { field: 'leadStatus', value: 'Converted', timestamp: { _seconds: 1743984000, _nanoseconds: 0 } }, // Apr 8, 2025
        { field: 'conversionValue', value: 5000, timestamp: { _seconds: 1744070400, _nanoseconds: 0 } }, // Apr 9, 2025
      ],
    },
    {
      id: '100002',
      typeOfCards: 'Leads',
      name: 'Emily Johnson',
      phone: '555-0102',
      email: 'emily.problematic@example.com',
      leadStatus: 'Contacted',
      leadSource: 'Google Ads',
      followUpDate: '2025-04-15',
      conversionValue: 0,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1735689600, _nanoseconds: 0 } }, // Jan 1, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1735948800, _nanoseconds: 0 } }, // Jan 4, 2025
        { field: 'followUpDate', value: '2025-04-15', timestamp: { _seconds: 1736035200, _nanoseconds: 0 } }, // Jan 5, 2025
      ],
    },
    {
      id: '100003',
      typeOfCards: 'Leads',
      name: 'Michael Chen',
      phone: '555-0103',
      email: 'michael.chen@example.com',
      leadStatus: 'New',
      leadSource: 'Facebook Ads',
      followUpDate: '2025-04-12',
      conversionValue: 0,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1735776000, _nanoseconds: 0 } }, // Jan 2, 2025
        { field: 'followUpDate', value: '2025-04-12', timestamp: { _seconds: 1735862400, _nanoseconds: 0 } }, // Jan 3, 2025
      ],
    },
    {
      id: '100004',
      typeOfCards: 'Leads',
      name: 'Sarah Davis',
      phone: '555-0104',
      email: 'sarah.davis@example.com',
      leadStatus: 'Converted',
      leadSource: 'Google Ads',
      followUpDate: '2025-04-08',
      conversionValue: 7500,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1735689600, _nanoseconds: 0 } }, // Jan 1, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1735776000, _nanoseconds: 0 } }, // Jan 2, 2025
        { field: 'followUpDate', value: '2025-04-08', timestamp: { _seconds: 1735862400, _nanoseconds: 0 } }, // Jan 3, 2025
        { field: 'leadStatus', value: 'Converted', timestamp: { _seconds: 1743724800, _nanoseconds: 0 } }, // Apr 5, 2025
        { field: 'conversionValue', value: 7500, timestamp: { _seconds: 1743811200, _nanoseconds: 0 } }, // Apr 6, 2025
      ],
    },
    {
      id: '100005',
      typeOfCards: 'Leads',
      name: 'David Wilson',
      phone: '555-0105',
      email: 'david.w@example.com',
      leadStatus: 'Contacted',
      leadSource: 'Facebook Ads',
      followUpDate: '2025-04-20',
      conversionValue: 0,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1735948800, _nanoseconds: 0 } }, // Jan 4, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1736035200, _nanoseconds: 0 } }, // Jan 5, 2025
        { field: 'followUpDate', value: '2025-04-20', timestamp: { _seconds: 1736121600, _nanoseconds: 0 } }, // Jan 6, 2025
      ],
    },
    {
      id: '100006',
      typeOfCards: 'Leads',
      name: 'Laura Martinez',
      phone: '555-0106',
      email: 'laura.m@example.com',
      leadStatus: 'Converted',
      leadSource: 'Google Ads',
      followUpDate: '2025-04-11',
      conversionValue: 6000,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1735776000, _nanoseconds: 0 } }, // Jan 2, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1735862400, _nanoseconds: 0 } }, // Jan 3, 2025
        { field: 'followUpDate', value: '2025-04-11', timestamp: { _seconds: 1735948800, _nanoseconds: 0 } }, // Jan 4, 2025
        { field: 'leadStatus', value: 'Converted', timestamp: { _seconds: 1743897600, _nanoseconds: 0 } }, // Apr 7, 2025
        { field: 'conversionValue', value: 6000, timestamp: { _seconds: 1743984000, _nanoseconds: 0 } }, // Apr 8, 2025
      ],
    },
    {
      id: '100007',
      typeOfCards: 'Leads',
      name: 'James Brown',
      phone: '555-0107',
      email: 'james.b@example.com',
      leadStatus: 'New',
      leadSource: 'Facebook Ads',
      followUpDate: '2025-04-18',
      conversionValue: 0,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1736035200, _nanoseconds: 0 } }, // Jan 5, 2025
        { field: 'followUpDate', value: '2025-04-18', timestamp: { _seconds: 1736121600, _nanoseconds: 0 } }, // Jan 6, 2025
      ],
    },
    {
      id: '100008',
      typeOfCards: 'Leads',
      name: 'Olivia Taylor',
      phone: '555-0108',
      email: 'olivia.t@example.com',
      leadStatus: 'Contacted',
      leadSource: 'Google Ads',
      followUpDate: '2025-04-16',
      conversionValue: 0,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1735862400, _nanoseconds: 0 } }, // Jan 3, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1735948800, _nanoseconds: 0 } }, // Jan 4, 2025
        { field: 'followUpDate', value: '2025-04-16', timestamp: { _seconds: 1736035200, _nanoseconds: 0 } }, // Jan 5, 2025
      ],
    },
    {
      id: '100009',
      typeOfCards: 'Leads',
      name: 'William Lee',
      phone: '555-0109',
      email: 'william.l@example.com',
      leadStatus: 'Converted',
      leadSource: 'Facebook Ads',
      followUpDate: '2025-04-09',
      conversionValue: 8000,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1735689600, _nanoseconds: 0 } }, // Jan 1, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1735776000, _nanoseconds: 0 } }, // Jan 2, 2025
        { field: 'followUpDate', value: '2025-04-09', timestamp: { _seconds: 1735862400, _nanoseconds: 0 } }, // Jan 3, 2025
        { field: 'leadStatus', value: 'Converted', timestamp: { _seconds: 1743811200, _nanoseconds: 0 } }, // Apr 6, 2025
        { field: 'conversionValue', value: 8000, timestamp: { _seconds: 1743897600, _nanoseconds: 0 } }, // Apr 7, 2025
      ],
    },
    {
      id: '100010',
      typeOfCards: 'Leads',
      name: 'Sophia Anderson',
      phone: '555-0110',
      email: 'sophia.a@example.com',
      leadStatus: 'Contacted',
      leadSource: 'Google Ads',
      followUpDate: '2025-04-17',
      conversionValue: 0,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1735948800, _nanoseconds: 0 } }, // Jan 4, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1736035200, _nanoseconds: 0 } }, // Jan 5, 2025
        { field: 'followUpDate', value: '2025-04-17', timestamp: { _seconds: 1736121600, _nanoseconds: 0 } }, // Jan 6, 2025
      ],
    },
    {
      id: '100011',
      typeOfCards: 'Leads',
      name: 'Daniel Kim',
      phone: '555-0111',
      email: 'daniel.k@example.com',
      leadStatus: 'Converted',
      leadSource: 'LinkedIn Ads',
      followUpDate: '2025-04-14',
      conversionValue: 9000,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1736294400, _nanoseconds: 0 } }, // Jan 8, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1736380800, _nanoseconds: 0 } }, // Jan 9, 2025
        { field: 'followUpDate', value: '2025-04-14', timestamp: { _seconds: 1736467200, _nanoseconds: 0 } }, // Jan 10, 2025
        { field: 'leadStatus', value: 'Converted', timestamp: { _seconds: 1744156800, _nanoseconds: 0 } }, // Apr 10, 2025
        { field: 'conversionValue', value: 9000, timestamp: { _seconds: 1744243200, _nanoseconds: 0 } }, // Apr 11, 2025
      ],
    },
    {
      id: '100012',
      typeOfCards: 'Leads',
      name: 'Emma White',
      phone: '555-0112',
      email: 'emma.w@example.com',
      leadStatus: 'Contacted',
      leadSource: 'Facebook Ads',
      followUpDate: '2025-04-22',
      conversionValue: 0,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1736553600, _nanoseconds: 0 } }, // Jan 12, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1736640000, _nanoseconds: 0 } }, // Jan 13, 2025
        { field: 'followUpDate', value: '2025-04-22', timestamp: { _seconds: 1736726400, _nanoseconds: 0 } }, // Jan 14, 2025
      ],
    },
    {
      id: '100013',
      typeOfCards: 'Leads',
      name: 'Liam Harris',
      phone: '555-0113',
      email: 'liam.h@example.com',
      leadStatus: 'Converted',
      leadSource: 'Google Ads',
      followUpDate: '2025-04-13',
      conversionValue: 6500,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1736812800, _nanoseconds: 0 } }, // Jan 15, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1736899200, _nanoseconds: 0 } }, // Jan 16, 2025
        { field: 'followUpDate', value: '2025-04-13', timestamp: { _seconds: 1736985600, _nanoseconds: 0 } }, // Jan 17, 2025
        { field: 'leadStatus', value: 'Converted', timestamp: { _seconds: 1744070400, _nanoseconds: 0 } }, // Apr 9, 2025
        { field: 'conversionValue', value: 6500, timestamp: { _seconds: 1744156800, _nanoseconds: 0 } }, // Apr 10, 2025
      ],
    },
    {
      id: '100014',
      typeOfCards: 'Leads',
      name: 'Ava Clark',
      phone: '555-0114',
      email: 'ava.c@example.com',
      leadStatus: 'New',
      leadSource: 'LinkedIn Ads',
      followUpDate: '2025-04-19',
      conversionValue: 0,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1737072000, _nanoseconds: 0 } }, // Jan 18, 2025
        { field: 'followUpDate', value: '2025-04-19', timestamp: { _seconds: 1737158400, _nanoseconds: 0 } }, // Jan 19, 2025
      ],
    },
    {
      id: '100015',
      typeOfCards: 'Leads',
      name: 'Noah Lewis',
      phone: '555-0115',
      email: 'noah.l@example.com',
      leadStatus: 'Converted',
      leadSource: 'Facebook Ads',
      followUpDate: '2025-04-15',
      conversionValue: 7000,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1737244800, _nanoseconds: 0 } }, // Jan 20, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1737331200, _nanoseconds: 0 } }, // Jan 21, 2025
        { field: 'followUpDate', value: '2025-04-15', timestamp: { _seconds: 1737417600, _nanoseconds: 0 } }, // Jan 22, 2025
        { field: 'leadStatus', value: 'Converted', timestamp: { _seconds: 1744243200, _nanoseconds: 0 } }, // Apr 11, 2025
        { field: 'conversionValue', value: 7000, timestamp: { _seconds: 1744329600, _nanoseconds: 0 } }, // Apr 12, 2025
      ],
    },
    {
      id: '100016',
      typeOfCards: 'Leads',
      name: 'Mia Walker',
      phone: '555-0116',
      email: 'mia.w@example.com',
      leadStatus: 'Contacted',
      leadSource: 'Google Ads',
      followUpDate: '2025-04-21',
      conversionValue: 0,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1737504000, _nanoseconds: 0 } }, // Jan 23, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1737590400, _nanoseconds: 0 } }, // Jan 24, 2025
        { field: 'followUpDate', value: '2025-04-21', timestamp: { _seconds: 1737676800, _nanoseconds: 0 } }, // Jan 25, 2025
      ],
    },
    {
      id: '100017',
      typeOfCards: 'Leads',
      name: 'Ethan Young',
      phone: '555-0117',
      email: 'ethan.y@example.com',
      leadStatus: 'Converted',
      leadSource: 'Facebook Ads',
      followUpDate: '2025-04-16',
      conversionValue: 8500,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1737763200, _nanoseconds: 0 } }, // Jan 26, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1737849600, _nanoseconds: 0 } }, // Jan 27, 2025
        { field: 'followUpDate', value: '2025-04-16', timestamp: { _seconds: 1737936000, _nanoseconds: 0 } }, // Jan 28, 2025
        { field: 'leadStatus', value: 'Converted', timestamp: { _seconds: 1744329600, _nanoseconds: 0 } }, // Apr 12, 2025
        { field: 'conversionValue', value: 8500, timestamp: { _seconds: 1744416000, _nanoseconds: 0 } }, // Apr 13, 2025
      ],
    },
    {
      id: '100018',
      typeOfCards: 'Leads',
      name: 'Isabella Hall',
      phone: '555-0118',
      email: 'isabella.h@example.com',
      leadStatus: 'Lost',
      leadSource: 'Google Ads',
      followUpDate: '2025-04-17',
      conversionValue: 0,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1738022400, _nanoseconds: 0 } }, // Jan 29, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1738108800, _nanoseconds: 0 } }, // Jan 30, 2025
        { field: 'followUpDate', value: '2025-04-17', timestamp: { _seconds: 1738195200, _nanoseconds: 0 } }, // Jan 31, 2025
        { field: 'leadStatus', value: 'Lost', timestamp: { _seconds: 1744416000, _nanoseconds: 0 } }, // Apr 13, 2025
      ],
    },
    {
      id: '100019',
      typeOfCards: 'Leads',
      name: 'Alexander Allen',
      phone: '555-0119',
      email: 'alexander.a@example.com',
      leadStatus: 'Converted',
      leadSource: 'LinkedIn Ads',
      followUpDate: '2025-04-18',
      conversionValue: 4000,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1738281600, _nanoseconds: 0 } }, // Feb 1, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1738368000, _nanoseconds: 0 } }, // Feb 2, 2025
        { field: 'followUpDate', value: '2025-04-18', timestamp: { _seconds: 1738454400, _nanoseconds: 0 } }, // Feb 3, 2025
        { field: 'leadStatus', value: 'Converted', timestamp: { _seconds: 1744502400, _nanoseconds: 0 } }, // Apr 14, 2025
        { field: 'conversionValue', value: 4000, timestamp: { _seconds: 1744588800, _nanoseconds: 0 } }, // Apr 15, 2025
      ],
    },
    {
      id: '100020',
      typeOfCards: 'Leads',
      name: 'Charlotte King',
      phone: '555-0120',
      email: 'charlotte.k@example.com',
      leadStatus: 'Converted',
      leadSource: 'Facebook Ads',
      followUpDate: '2025-04-19',
      conversionValue: 6000,
      history: [
        { field: 'leadStatus', value: 'New', timestamp: { _seconds: 1738540800, _nanoseconds: 0 } }, // Feb 4, 2025
        { field: 'leadStatus', value: 'Contacted', timestamp: { _seconds: 1738627200, _nanoseconds: 0 } }, // Feb 5, 2025
        { field: 'followUpDate', value: '2025-04-19', timestamp: { _seconds: 1738713600, _nanoseconds: 0 } }, // Feb 6, 2025
        { field: 'leadStatus', value: 'Converted', timestamp: { _seconds: 1744588800, _nanoseconds: 0 } }, // Apr 15, 2025
        { field: 'conversionValue', value: 6000, timestamp: { _seconds: 1744675200, _nanoseconds: 0 } }, // Apr 16, 2025
      ],
    },
    // Ad Campaign Cards (6)
    {
      id: '200001',
      typeOfCards: 'Ad Campaigns',
      campaignName: 'FB Lead Gen Q1',
      platform: 'Facebook',
      adSpend: 3000,
      leadsGenerated: 8,
      costPerLead: 375,
      startDate: '2025-01-01',
      status: 'Active',
      history: [
        { field: 'adSpend', value: 1500, timestamp: { _seconds: 1735689600, _nanoseconds: 0 } }, // Jan 1, 2025
        { field: 'leadsGenerated', value: 4, timestamp: { _seconds: 1735776000, _nanoseconds: 0 } }, // Jan 2, 2025
        { field: 'adSpend', value: 3000, timestamp: { _seconds: 1735862400, _nanoseconds: 0 } }, // Jan 3, 2025
        { field: 'leadsGenerated', value: 8, timestamp: { _seconds: 1735948800, _nanoseconds: 0 } }, // Jan 4, 2025
      ],
    },
    {
      id: '200002',
      typeOfCards: 'Ad Campaigns',
      campaignName: 'Google Lead Gen Q1',
      platform: 'Google',
      adSpend: 2500,
      leadsGenerated: 6,
      costPerLead: 416.67,
      startDate: '2025-01-01',
      status: 'Active',
      history: [
        { field: 'adSpend', value: 1250, timestamp: { _seconds: 1735689600, _nanoseconds: 0 } }, // Jan 1, 2025
        { field: 'leadsGenerated', value: 3, timestamp: { _seconds: 1735776000, _nanoseconds: 0 } }, // Jan 2, 2025
        { field: 'adSpend', value: 2500, timestamp: { _seconds: 1735862400, _nanoseconds: 0 } }, // Jan 3, 2025
        { field: 'leadsGenerated', value: 6, timestamp: { _seconds: 1735948800, _nanoseconds: 0 } }, // Jan 4, 2025
      ],
    },
    {
      id: '200003',
      typeOfCards: 'Ad Campaigns',
      campaignName: 'FB Lead Gen Q2',
      platform: 'Facebook',
      adSpend: 2000,
      leadsGenerated: 4,
      costPerLead: 500,
      startDate: '2025-02-01',
      status: 'Active',
      history: [
        { field: 'adSpend', value: 1000, timestamp: { _seconds: 1738281600, _nanoseconds: 0 } }, // Feb 1, 2025
        { field: 'leadsGenerated', value: 2, timestamp: { _seconds: 1738368000, _nanoseconds: 0 } }, // Feb 2, 2025
        { field: 'adSpend', value: 2000, timestamp: { _seconds: 1738454400, _nanoseconds: 0 } }, // Feb 3, 2025
        { field: 'leadsGenerated', value: 4, timestamp: { _seconds: 1738540800, _nanoseconds: 0 } }, // Feb 4, 2025
      ],
    },
    {
      id: '200004',
      typeOfCards: 'Ad Campaigns',
      campaignName: 'Google Lead Gen Q2',
      platform: 'Google',
      adSpend: 1500,
      leadsGenerated: 3,
      costPerLead: 500,
      startDate: '2025-02-01',
      status: 'Active',
      history: [
        { field: 'adSpend', value: 750, timestamp: { _seconds: 1738281600, _nanoseconds: 0 } }, // Feb 1, 2025
        { field: 'leadsGenerated', value: 1, timestamp: { _seconds: 1738368000, _nanoseconds: 0 } }, // Feb 2, 2025
        { field: 'adSpend', value: 1500, timestamp: { _seconds: 1738454400, _nanoseconds: 0 } }, // Feb 3, 2025
        { field: 'leadsGenerated', value: 3, timestamp: { _seconds: 1738540800, _nanoseconds: 0 } }, // Feb 4, 2025
      ],
    },
    {
      id: '200005',
      typeOfCards: 'Ad Campaigns',
      campaignName: 'LinkedIn Lead Gen Q1',
      platform: 'LinkedIn',
      adSpend: 2000,
      leadsGenerated: 2,
      costPerLead: 1000,
      startDate: '2025-01-15',
      status: 'Inactive',
      history: [
        { field: 'adSpend', value: 1000, timestamp: { _seconds: 1736812800, _nanoseconds: 0 } }, // Jan 15, 2025
        { field: 'leadsGenerated', value: 1, timestamp: { _seconds: 1736899200, _nanoseconds: 0 } }, // Jan 16, 2025
        { field: 'adSpend', value: 2000, timestamp: { _seconds: 1736985600, _nanoseconds: 0 } }, // Jan 17, 2025
        { field: 'leadsGenerated', value: 2, timestamp: { _seconds: 1737072000, _nanoseconds: 0 } }, // Jan 18, 2025
        { field: 'status', value: 'Inactive', timestamp: { _seconds: 1737158400, _nanoseconds: 0 } }, // Jan 19, 2025
      ],
    },
    {
      id: '200006',
      typeOfCards: 'Ad Campaigns',
      campaignName: 'FB Lead Gen Jan',
      platform: 'Facebook',
      adSpend: 1000,
      leadsGenerated: 2,
      costPerLead: 500,
      startDate: '2025-01-10',
      status: 'Completed',
      history: [
        { field: 'adSpend', value: 500, timestamp: { _seconds: 1736467200, _nanoseconds: 0 } }, // Jan 10, 2025
        { field: 'leadsGenerated', value: 1, timestamp: { _seconds: 1736553600, _nanoseconds: 0 } }, // Jan 11, 2025
        { field: 'adSpend', value: 1000, timestamp: { _seconds: 1736640000, _nanoseconds: 0 } }, // Jan 12, 2025
        { field: 'leadsGenerated', value: 2, timestamp: { _seconds: 1736726400, _nanoseconds: 0 } }, // Jan 13, 2025
        { field: 'status', value: 'Completed', timestamp: { _seconds: 1736812800, _nanoseconds: 0 } }, // Jan 14, 2025
      ],
    },
    // Business Partner Cards (4)
    {
      id: '300001',
      typeOfCards: 'Business Partners',
      businessName: 'FitGym Inc.',
      contact: 'contact@fitgym.com',
      negotiatedRate: 2000,
      status: 'Active',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1735689600, _nanoseconds: 0 } }, // Jan 1, 2025
        { field: 'status', value: 'Active', timestamp: { _seconds: 1735776000, _nanoseconds: 0 } }, // Jan 2, 2025
        { field: 'negotiatedRate', value: 2000, timestamp: { _seconds: 1735776000, _nanoseconds: 0 } }, // Jan 2, 2025
      ],
    },
    {
      id: '300002',
      typeOfCards: 'Business Partners',
      businessName: 'HealthCo',
      contact: 'info@healthco.com',
      negotiatedRate: 2500,
      status: 'Active',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1735689600, _nanoseconds: 0 } }, // Jan 1, 2025
        { field: 'status', value: 'Active', timestamp: { _seconds: 1735776000, _nanoseconds: 0 } }, // Jan 2, 2025
        { field: 'negotiatedRate', value: 2500, timestamp: { _seconds: 1735776000, _nanoseconds: 0 } }, // Jan 2, 2025
      ],
    },
    {
      id: '300003',
      typeOfCards: 'Business Partners',
      businessName: 'Wellness Pros',
      contact: 'support@wellnesspros.com',
      negotiatedRate: 3000,
      status: 'Pending',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1738281600, _nanoseconds: 0 } }, // Feb 1, 2025
        { field: 'negotiatedRate', value: 3000, timestamp: { _seconds: 1738368000, _nanoseconds: 0 } }, // Feb 2, 2025
      ],
    },
    {
      id: '300004',
      typeOfCards: 'Business Partners',
      businessName: 'ActiveLife',
      contact: 'info@activelife.com',
      negotiatedRate: 1500,
      status: 'Inactive',
      history: [
        { field: 'status', value: 'Active', timestamp: { _seconds: 1735689600, _nanoseconds: 0 } }, // Jan 1, 2025
        { field: 'negotiatedRate', value: 1500, timestamp: { _seconds: 1735776000, _nanoseconds: 0 } }, // Jan 2, 2025
        { field: 'status', value: 'Inactive', timestamp: { _seconds: 1738540800, _nanoseconds: 0 } }, // Feb 4, 2025
      ],
    },
    // Payment Cards (10)
    {
      id: '400001',
      typeOfCards: 'Payments',
      leadId: '100001',
      clientPayment: 5000,
      partnerPayment: 2000,
      paymentDate: '2025-04-10',
      status: 'Completed',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1743984000, _nanoseconds: 0 } }, // Apr 8, 2025
        { field: 'status', value: 'Completed', timestamp: { _seconds: 1744070400, _nanoseconds: 0 } }, // Apr 9, 2025
      ],
    },
    {
      id: '400002',
      typeOfCards: 'Payments',
      leadId: '100004',
      clientPayment: 7500,
      partnerPayment: 2500,
      paymentDate: '2025-04-08',
      status: 'Completed',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1743724800, _nanoseconds: 0 } }, // Apr 5, 2025
        { field: 'status', value: 'Completed', timestamp: { _seconds: 1743811200, _nanoseconds: 0 } }, // Apr 6, 2025
      ],
    },
    {
      id: '400003',
      typeOfCards: 'Payments',
      leadId: '100006',
      clientPayment: 6000,
      partnerPayment: 2000,
      paymentDate: '2025-04-11',
      status: 'Completed',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1743897600, _nanoseconds: 0 } }, // Apr 7, 2025
        { field: 'status', value: 'Completed', timestamp: { _seconds: 1743984000, _nanoseconds: 0 } }, // Apr 8, 2025
      ],
    },
    {
      id: '400004',
      typeOfCards: 'Payments',
      leadId: '100009',
      clientPayment: 8000,
      partnerPayment: 2500,
      paymentDate: '2025-04-09',
      status: 'Completed',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1743811200, _nanoseconds: 0 } }, // Apr 6, 2025
        { field: 'status', value: 'Completed', timestamp: { _seconds: 1743897600, _nanoseconds: 0 } }, // Apr 7, 2025
      ],
    },
    {
      id: '400005',
      typeOfCards: 'Payments',
      leadId: '100011',
      clientPayment: 9000,
      partnerPayment: 3000,
      paymentDate: '2025-04-12',
      status: 'Completed',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1744156800, _nanoseconds: 0 } }, // Apr 10, 2025
        { field: 'status', value: 'Completed', timestamp: { _seconds: 1744243200, _nanoseconds: 0 } }, // Apr 11, 2025
      ],
    },
    {
      id: '400006',
      typeOfCards: 'Payments',
      leadId: '100013',
      clientPayment: 6500,
      partnerPayment: 2000,
      paymentDate: '2025-04-10',
      status: 'Completed',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1744070400, _nanoseconds: 0 } }, // Apr 9, 2025
        { field: 'status', value: 'Completed', timestamp: { _seconds: 1744156800, _nanoseconds: 0 } }, // Apr 10, 2025
      ],
    },
    {
      id: '400007',
      typeOfCards: 'Payments',
      leadId: '100015',
      clientPayment: 7000,
      partnerPayment: 2500,
      paymentDate: '2025-04-13',
      status: 'Completed',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1744243200, _nanoseconds: 0 } }, // Apr 11, 2025
        { field: 'status', value: 'Completed', timestamp: { _seconds: 1744329600, _nanoseconds: 0 } }, // Apr 12, 2025
      ],
    },
    {
      id: '400008',
      typeOfCards: 'Payments',
      leadId: '100017',
      clientPayment: 8500,
      partnerPayment: 3000,
      paymentDate: '2025-04-14',
      status: 'Completed',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1744329600, _nanoseconds: 0 } }, // Apr 12, 2025
        { field: 'status', value: 'Completed', timestamp: { _seconds: 1744416000, _nanoseconds: 0 } }, // Apr 13, 2025
      ],
    },
    {
      id: '400009',
      typeOfCards: 'Payments',
      leadId: '100019',
      clientPayment: 4000,
      partnerPayment: 1500,
      paymentDate: '2025-04-15',
      status: 'Completed',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1744502400, _nanoseconds: 0 } }, // Apr 14, 2025
        { field: 'status', value: 'Completed', timestamp: { _seconds: 1744588800, _nanoseconds: 0 } }, // Apr 15, 2025
      ],
    },
    {
      id: '400010',
      typeOfCards: 'Payments',
      leadId: '100020',
      clientPayment: 6000,
      partnerPayment: 2000,
      paymentDate: '2025-04-16',
      status: 'Completed',
      history: [
        { field: 'status', value: 'Pending', timestamp: { _seconds: 1744588800, _nanoseconds: 0 } }, // Apr 15, 2025
        { field: 'status', value: 'Completed', timestamp: { _seconds: 1744675200, _nanoseconds: 0 } }, // Apr 16, 2025
      ],
    },
  ]);

  const [cardTemplates, setCardTemplates] = useState([
    {
      name: "Leads",
      typeOfCards: "Leads",
      headers: [
        { key: "id", name: "ID", type: "number", section: "Contact Information", isUsed: true },
        { key: "name", name: "Name", type: "text", section: "Contact Information", isUsed: true },
        { key: "phone", name: "Phone", type: "text", section: "Contact Information", isUsed: true },
        { key: "email", name: "Email", type: "text", section: "Contact Information", isUsed: true },
        {
          key: "leadStatus",
          name: "Lead Status",
          type: "dropdown",
          options: ["New", "Contacted", "Converted", "Lost"],
          section: "Lead Details",
          isUsed: true,
        },
        { key: "leadSource", name: "Lead Source", type: "text", section: "Lead Details", isUsed: true },
        { key: "followUpDate", name: "Follow Up Date", type: "date", section: "Lead Details", isUsed: true },
        { key: "conversionValue", name: "Conversion Value", type: "currency", section: "Lead Details", isUsed: true },
      ],
      sections: [
        {
          name: "Contact Information",
          keys: ["id", "name", "phone", "email"],
        },
        {
          name: "Lead Details",
          keys: ["leadStatus", "leadSource", "followUpDate", "conversionValue"],
        },
      ],
    },
    {
      name: "Ad Campaigns",
      typeOfCards: "Ad Campaigns",
      headers: [
        { key: "id", name: "ID", type: "number", section: "Campaign Information", isUsed: true },
        { key: "campaignName", name: "Campaign Name", type: "text", section: "Campaign Information", isUsed: true },
        { key: "platform", name: "Platform", type: "text", section: "Campaign Information", isUsed: true },
        { key: "adSpend", name: "Ad Spend", type: "currency", section: "Campaign Information", isUsed: true },
        { key: "leadsGenerated", name: "Leads Generated", type: "number", section: "Campaign Information", isUsed: true },
        { key: "costPerLead", name: "Cost Per Lead", type: "currency", section: "Campaign Information", isUsed: true },
        { key: "startDate", name: "Start Date", type: "date", section: "Campaign Information", isUsed: true },
        {
          key: "status",
          name: "Status",
          type: "dropdown",
          options: ["Active", "Paused", "Completed"],
          section: "Campaign Information",
          isUsed: true,
        },
      ],
      sections: [
        {
          name: "Campaign Information",
          keys: ["id", "campaignName", "platform", "adSpend", "leadsGenerated", "costPerLead", "startDate", "status"],
        },
      ],
    },
    {
      name: "Business Partners",
      typeOfCards: "Business Partners",
      headers: [
        { key: "id", name: "ID", type: "number", section: "Partner Information", isUsed: true },
        { key: "businessName", name: "Business Name", type: "text", section: "Partner Information", isUsed: true },
        { key: "contact", name: "Contact", type: "text", section: "Partner Information", isUsed: true },
        { key: "negotiatedRate", name: "Negotiated Rate", type: "currency", section: "Partner Information", isUsed: true },
        { key: "status", name: "Status", type: "dropdown", options: ["Active", "Inactive"], section: "Partner Information", isUsed: true },
      ],
      sections: [
        {
          name: "Partner Information",
          keys: ["id", "businessName", "contact", "negotiatedRate", "status"],
        },
      ],
    },
    {
      name: "Payments",
      typeOfCards: "Payments",
      headers: [
        { key: "id", name: "ID", type: "number", section: "Payment Information", isUsed: true },
        { key: "leadId", name: "Lead ID", type: "text", section: "Payment Information", isUsed: true },
        { key: "clientPayment", name: "Client Payment", type: "currency", section: "Payment Information", isUsed: true },
        { key: "partnerPayment", name: "Partner Payment", type: "currency", section: "Payment Information", isUsed: true },
        { key: "paymentDate", name: "Payment Date", type: "date", section: "Payment Information", isUsed: true },
        {
          key: "status",
          name: "Status",
          type: "dropdown",
          options: ["Pending", "Completed", "Failed"],
          section: "Payment Information",
          isUsed: true,
        },
      ],
      sections: [
        {
          name: "Payment Information",
          keys: ["id", "leadId", "clientPayment", "partnerPayment", "paymentDate", "status"],
        },
      ],
    },
  ]);

  const [metrics, setMetrics] = useState([
    {
      category: 'Financials',
      metrics: [
        { id: 'metric-revenue', name: 'Total Revenue', type: 'currency', value: '$81,500' },
        { id: 'metric-net-profit', name: 'Net Profit', type: 'currency', value: '$37,500' },
        {
          id: 'metric-revenue-trend',
          name: 'Revenue Trend',
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr'],
            values: [0, 15000, 30000, 81500],
          },
        },
        { id: 'metric-avg-client-payment', name: 'Avg Client Payment', type: 'currency', value: '$8,150' },
      ],
    },
    {
      category: 'Marketing',
      metrics: [
        { id: 'metric-campaign-roi', name: 'Campaign ROI', type: 'multiplier', value: '6.79x' },
        { id: 'metric-fb-leads', name: 'FB Ad Leads', type: 'text', value: '10 leads, $600/lead' },
        { id: 'metric-google-leads', name: 'Google Ad Leads', type: 'text', value: '7 leads, $571.43/lead' },
        { id: 'metric-linkedin-leads', name: 'LinkedIn Ad Leads', type: 'text', value: '3 leads, $666.67/lead' },
        {
          id: 'metric-ad-spend',
          name: 'Ad Spend Distribution',
          type: 'pie',
          data: {
            labels: ['Facebook', 'Google', 'LinkedIn'],
            values: [6000, 4000, 2000],
          },
        },
        {
          id: 'metric-campaign-performance',
          name: 'Campaign Performance',
          type: 'bar',
          data: {
            labels: ['FB Q1', 'Google Q1', 'FB Q2', 'Google Q2', 'LinkedIn Q1', 'FB Jan'],
            values: [8, 6, 4, 3, 2, 2],
          },
        },
      ],
    },
    {
      category: 'Leads',
      metrics: [
        { id: 'metric-conversion-rate', name: 'Conversion Rate', type: 'percentage', value: '50%' },
        { id: 'metric-total-leads', name: 'Total Leads', type: 'number', value: '20' },
        { id: 'metric-cost-per-lead', name: 'Cost Per Lead', type: 'currency', value: '$600' },
        {
          id: 'metric-lead-growth',
          name: 'Lead Growth',
          type: 'bar',
          data: {
            labels: ['Q1', 'Q2'],
            values: [15, 5],
          },
        },
        { id: 'metric-fb-conversion', name: 'FB Conversion Rate', type: 'percentage', value: '60%' },
        { id: 'metric-google-conversion', name: 'Google Conversion Rate', type: 'percentage', value: '42.86%' },
        { id: 'metric-linkedin-conversion', name: 'LinkedIn Conversion Rate', type: 'percentage', value: '66.67%' },
      ],
    },
  ]);

  const [dashboards, setDashboards] = useState([
    {
      id: 'dashboard-1',
      dashboardWidgets: [
        {
          id: 'widget-leads',
          size: 'small',
          title: 'Leads',
          metricId: 'metric-lead-growth',
          position: { row: 0, col: 0 },
          dashboardId: 'dashboard-1',
        },
        {
          id: 'widget-revenue',
          size: 'verySmall',
          title: 'Financials',
          metricId: 'metric-revenue',
          position: { row: 0, col: 1 },
          dashboardId: 'dashboard-1',
        },
        {
          id: 'widget-profit',
          size: 'verySmall',
          title: 'Financials',
          metricId: 'metric-net-profit',
          position: { row: 1, col: 1 },
          dashboardId: 'dashboard-1',
        },
        {
          id: 'widget-trend',
          size: 'medium',
          title: 'Financials',
          metricId: 'metric-revenue-trend',
          position: { row: 2, col: 0 },
          dashboardId: 'dashboard-1',
        },
        {
          id: 'widget-avg-payment',
          size: 'small',
          title: 'Financials',
          metricId: 'metric-avg-client-payment',
          position: { row: 2, col: 1 },
          dashboardId: 'dashboard-1',
        },
      ],
    },
    {
      id: 'dashboard-2',
      dashboardWidgets: [
        {
          id: 'widget-ad-spend',
          size: 'large',
          title: 'Marketing',
          metricId: 'metric-ad-spend',
          position: { row: 0, col: 0 },
          dashboardId: 'dashboard-2',
        },
        {
          id: 'widget-campaign-performance',
          size: 'medium',
          title: 'Marketing',
          metricId: 'metric-campaign-performance',
          position: { row: 1, col: 0 },
          dashboardId: 'dashboard-2',
        },
        {
          id: 'widget-roi',
          size: 'small',
          title: 'Marketing',
          metricId: 'metric-campaign-roi',
          position: { row: 1, col: 1 },
          dashboardId: 'dashboard-2',
        },
      ],
    },
    {
      id: 'dashboard-3',
      dashboardWidgets: [
        {
          id: 'widget-conversion-rate',
          size: 'small',
          title: 'Leads',
          metricId: 'metric-conversion-rate',
          position: { row: 0, col: 0 },
          dashboardId: 'dashboard-3',
        },
        {
          id: 'widget-fb-conversion',
          size: 'small',
          title: 'Leads',
          metricId: 'metric-fb-conversion',
          position: { row: 0, col: 1 },
          dashboardId: 'dashboard-3',
        },
        {
          id: 'widget-google-conversion',
          size: 'small',
          title: 'Leads',
          metricId: 'metric-google-conversion',
          position: { row: 1, col: 0 },
          dashboardId: 'dashboard-3',
        },
        {
          id: 'widget-linkedin-conversion',
          size: 'small',
          title: 'Leads',
          metricId: 'metric-linkedin-conversion',
          position: { row: 1, col: 1 },
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
            const filteredCards = metric.config.cardTemplates
              ? cards.filter((card) => metric.config.cardTemplates.includes(card.typeOfCards))
              : metric.config.cards
              ? cards.filter((card) => metric.config.cards.includes(card.id))
              : cards;
            const data = computeMetricData(filteredCards, metric.config);
            return {
              ...metric,
              data,
              value:
                metric.type === 'number'
                  ? data.datasets?.[0]?.data?.[data.datasets[0].data.length - 1] || 0
                  : metric.value,
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

  useEffect(() => {
    setSheets((prev) => ({
      ...prev,
      allSheets: prev.allSheets.map((sheet) => {
        if (sheet.id === 'leadsSheet') {
          return { ...sheet, rows: cards.filter((card) => card.typeOfCards === 'Leads').map((card) => card.id) };
        } else if (sheet.id === 'campaignsSheet') {
          return { ...sheet, rows: cards.filter((card) => card.typeOfCards === 'Ad Campaigns').map((card) => card.id) };
        } else if (sheet.id === 'partnersSheet') {
          return { ...sheet, rows: cards.filter((card) => card.typeOfCards === 'Business Partners').map((card) => card.id) };
        } else if (sheet.id === 'paymentsSheet') {
          return { ...sheet, rows: cards.filter((card) => card.typeOfCards === 'Payments').map((card) => card.id) };
        }
        return sheet;
      }),
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

  useEffect(()=>{
    // console.log(sheets)
  },[])

  return (
    <MainContext.Provider
      value={{
        sheets,
        setSheets,
        cards,
        setCards,
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
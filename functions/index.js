const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const cors = require('cors');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const resend = new Resend('re_C1GAhxiY_KvM6xMG96EHQwAZnC6Cp2k5s');
// CORS configuration
const corsOptions = {
  origin: ['https://www.apx.gr', 'http://localhost:5173'],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};
const corsMiddleware = cors(corsOptions);

// Backend-safe helper to get headers for a given card template key
function getHeaders(templateKey, cardTemplatesArr) {
  if (!Array.isArray(cardTemplatesArr)) return [];
  const template = cardTemplatesArr.find(
    t => (t.name || t.typeOfCards) === templateKey
  );
  return template && Array.isArray(template.headers) ? template.headers : [];
}

exports.businessSignUp = functions.https.onCall(async (data, context) => {
  try {
    // Log raw data to inspect its structure
    functions.logger.info('businessSignUp started', { rawData: data });

    // Destructure from data.data (Firebase wraps payload) or fallback to data or empty object
    const { email, password, businessName, invitationCode, userType } = data.data || data || {};

    // Log destructured fields
    functions.logger.info('Destructured data', {
      email,
      password: password ? '[REDACTED]' : undefined,
      businessName,
      invitationCode,
      userType,
    });

    // Check for missing fields with specific error message
    if (!email || !password || !businessName || !invitationCode || !userType) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Missing required fields: ${
          !email ? 'email ' : ''
        }${
          !password ? 'password ' : ''
        }${
          !businessName ? 'businessName ' : ''
        }${
          !invitationCode ? 'invitationCode ' : ''
        }${
          !userType ? 'userType' : ''
        }`
      );
    }

    if (invitationCode !== '0000') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid invitation code');
    }

    functions.logger.info('Creating user', { email });
    const userRecord = await auth.createUser({ email, password });
    const user = userRecord;

    functions.logger.info('Writing user data', { uid: user.uid });
    const userData = {
      uid: user.uid,
      email: user.email,
      businessName,
      userType,
      invitationCode,
      createdAt: new Date().toISOString(),
    };
    await db.collection('users').doc(user.uid).set(userData);

    const businessId = user.uid;
    const batch = db.batch();

    functions.logger.info('Writing business data', { businessId });
    const businessDocRef = db.collection('businesses').doc(businessId);
    batch.set(businessDocRef, {
      businessInfo: {
        name: businessName || 'Unnamed Business',
        createdAt: new Date(),
        ownerUid: user.uid,
      },
    });

    // Sheets
    const sheets = {
      allSheets: [
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
          typeOfCardsToDisplay: ['Leads'],
          cardTypeFilters: {
            Leads: {
              leadStatus: { condition: 'equals', value: 'New' }
            }
          },
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
          typeOfCardsToDisplay: ['Ad Campaigns'],
          cardTypeFilters: {
            'Ad Campaigns': {
              status: { condition: 'equals', value: 'Active' }
            }
          },
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
          typeOfCardsToDisplay: ['Business Partners'],
          cardTypeFilters: {
            'Business Partners': {}
          },
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
          typeOfCardsToDisplay: ['Payments'],
          cardTypeFilters: {
            Payments: {}
          },
        },
      ],
      structure: [
        { sheetName: 'Leads' },
        { sheetName: 'Ad Campaigns' },
        { sheetName: 'Business Partners' },
        { sheetName: 'Payments' },
      ],
    };

    // Save sheets to Firestore
    functions.logger.info('Writing sheets');
    sheets.allSheets.forEach((sheet) => {
      const sheetRef = db.collection('businesses').doc(businessId).collection('sheets').doc(sheet.id);
      batch.set(sheetRef, sheet);
    });
    const structureRef = db.collection('businesses').doc(businessId).collection('sheetsStructure').doc('structure');
    batch.set(structureRef, { structure: sheets.structure });
    
    // Cards
    const cards = [
      // Leads
      {
        id: '100001',
        typeOfCards: 'Leads',
        name: 'John Smith',
        phone: '555-0101',
        email: 'john.smith@example.com',
        leadStatus: 'Converted',
        leadSource: 'Facebook Ads',
        followUpDate: { seconds: Math.floor(new Date('2025-04-10').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 5000,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-10').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-03').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Converted', timestamp: { seconds: Math.floor(new Date('2025-04-08').getTime() / 1000), nanoseconds: 0 } },
          { field: 'conversionValue', value: 5000, timestamp: { seconds: Math.floor(new Date('2025-04-09').getTime() / 1000), nanoseconds: 0 } },
          // Added recent leadStatus change for May 2025
          { field: 'leadStatus', value: 'Followed Up', timestamp: { seconds: Math.floor(new Date('2025-05-15').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-15').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 0,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-04').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-15').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-05').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-12').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 0,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-12').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-03').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-08').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 7500,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-08').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-03').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Converted', timestamp: { seconds: Math.floor(new Date('2025-04-05').getTime() / 1000), nanoseconds: 0 } },
          { field: 'conversionValue', value: 7500, timestamp: { seconds: Math.floor(new Date('2025-04-06').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-20').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 0,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-04').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-05').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-20').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-06').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-11').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 6000,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-03').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-11').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-04').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Converted', timestamp: { seconds: Math.floor(new Date('2025-04-07').getTime() / 1000), nanoseconds: 0 } },
          { field: 'conversionValue', value: 6000, timestamp: { seconds: Math.floor(new Date('2025-04-08').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-18').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 0,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-05').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-18').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-06').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-16').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 0,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-03').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-04').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-16').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-05').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-09').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 8000,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-09').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-03').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Converted', timestamp: { seconds: Math.floor(new Date('2025-04-06').getTime() / 1000), nanoseconds: 0 } },
          { field: 'conversionValue', value: 8000, timestamp: { seconds: Math.floor(new Date('2025-04-07').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-17').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 0,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-04').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-05').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-17').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-06').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-14').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 9000,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-08').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-09').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-14').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-10').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Converted', timestamp: { seconds: Math.floor(new Date('2025-04-10').getTime() / 1000), nanoseconds: 0 } },
          { field: 'conversionValue', value: 9000, timestamp: { seconds: Math.floor(new Date('2025-04-11').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-22').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 0,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-12').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-13').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-22').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-14').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-13').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 6500,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-15').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-16').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-13').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-17').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Converted', timestamp: { seconds: Math.floor(new Date('2025-04-09').getTime() / 1000), nanoseconds: 0 } },
          { field: 'conversionValue', value: 6500, timestamp: { seconds: Math.floor(new Date('2025-04-10').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-19').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 0,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-18').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-19').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-19').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-15').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 7000,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-20').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-21').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-15').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-22').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Converted', timestamp: { seconds: Math.floor(new Date('2025-04-11').getTime() / 1000), nanoseconds: 0 } },
          { field: 'conversionValue', value: 7000, timestamp: { seconds: Math.floor(new Date('2025-04-12').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-21').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 0,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-23').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-24').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-21').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-25').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-16').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 8500,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-26').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-27').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-16').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-28').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Converted', timestamp: { seconds: Math.floor(new Date('2025-04-12').getTime() / 1000), nanoseconds: 0 } },
          { field: 'conversionValue', value: 8500, timestamp: { seconds: Math.floor(new Date('2025-04-13').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-17').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 0,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-01-29').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-01-30').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-17').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-01-31').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Lost', timestamp: { seconds: Math.floor(new Date('2025-04-13').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-18').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 4000,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-02-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-02-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-18').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-02-03').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Converted', timestamp: { seconds: Math.floor(new Date('2025-04-14').getTime() / 1000), nanoseconds: 0 } },
          { field: 'conversionValue', value: 4000, timestamp: { seconds: Math.floor(new Date('2025-04-15').getTime() / 1000), nanoseconds: 0 } },
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
        followUpDate: { seconds: Math.floor(new Date('2025-04-19').getTime() / 1000), nanoseconds: 0 },
        conversionValue: 6000,
        history: [
          { field: 'leadStatus', value: 'New', timestamp: { seconds: Math.floor(new Date('2025-02-04').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Contacted', timestamp: { seconds: Math.floor(new Date('2025-02-05').getTime() / 1000), nanoseconds: 0 } },
          { field: 'followUpDate', value: { seconds: Math.floor(new Date('2025-04-19').getTime() / 1000), nanoseconds: 0 }, timestamp: { seconds: Math.floor(new Date('2025-02-06').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadStatus', value: 'Converted', timestamp: { seconds: Math.floor(new Date('2025-04-15').getTime() / 1000), nanoseconds: 0 } },
          { field: 'conversionValue', value: 6000, timestamp: { seconds: Math.floor(new Date('2025-04-16').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
      // Ad Campaign Cards
      {
        id: '200001',
        typeOfCards: 'Ad Campaigns',
        campaignName: 'FB Lead Gen Q1',
        platform: 'Facebook',
        adSpend: 3000,
        leadsGenerated: 8,
        costPerLead: 375,
        startDate: { seconds: Math.floor(new Date('2025-01-01').getTime() / 1000), nanoseconds: 0 },
        status: 'Active',
        history: [
          { field: 'adSpend', value: 1500, timestamp: { seconds: Math.floor(new Date('2025-01-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadsGenerated', value: 4, timestamp: { seconds: Math.floor(new Date('2025-01-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'adSpend', value: 3000, timestamp: { seconds: Math.floor(new Date('2025-01-03').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadsGenerated', value: 8, timestamp: { seconds: Math.floor(new Date('2025-01-04').getTime() / 1000), nanoseconds: 0 } },
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
        startDate: { seconds: Math.floor(new Date('2025-01-01').getTime() / 1000), nanoseconds: 0 },
        status: 'Active',
        history: [
          { field: 'adSpend', value: 1250, timestamp: { seconds: Math.floor(new Date('2025-01-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadsGenerated', value: 3, timestamp: { seconds: Math.floor(new Date('2025-01-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'adSpend', value: 2500, timestamp: { seconds: Math.floor(new Date('2025-01-03').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadsGenerated', value: 6, timestamp: { seconds: Math.floor(new Date('2025-01-04').getTime() / 1000), nanoseconds: 0 } },
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
        startDate: { seconds: Math.floor(new Date('2025-02-01').getTime() / 1000), nanoseconds: 0 },
        status: 'Active',
        history: [
          { field: 'adSpend', value: 1000, timestamp: { seconds: Math.floor(new Date('2025-02-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadsGenerated', value: 2, timestamp: { seconds: Math.floor(new Date('2025-02-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'adSpend', value: 2000, timestamp: { seconds: Math.floor(new Date('2025-02-03').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadsGenerated', value: 4, timestamp: { seconds: Math.floor(new Date('2025-02-04').getTime() / 1000), nanoseconds: 0 } },
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
        startDate: { seconds: Math.floor(new Date('2025-02-01').getTime() / 1000), nanoseconds: 0 },
        status: 'Active',
        history: [
          { field: 'adSpend', value: 750, timestamp: { seconds: Math.floor(new Date('2025-02-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadsGenerated', value: 1, timestamp: { seconds: Math.floor(new Date('2025-02-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'adSpend', value: 1500, timestamp: { seconds: Math.floor(new Date('2025-02-03').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadsGenerated', value: 3, timestamp: { seconds: Math.floor(new Date('2025-02-04').getTime() / 1000), nanoseconds: 0 } },
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
        startDate: { seconds: Math.floor(new Date('2025-01-15').getTime() / 1000), nanoseconds: 0 },
        status: 'Inactive',
        history: [
          { field: 'adSpend', value: 1000, timestamp: { seconds: Math.floor(new Date('2025-01-15').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadsGenerated', value: 1, timestamp: { seconds: Math.floor(new Date('2025-01-16').getTime() / 1000), nanoseconds: 0 } },
          { field: 'adSpend', value: 2000, timestamp: { seconds: Math.floor(new Date('2025-01-17').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadsGenerated', value: 2, timestamp: { seconds: Math.floor(new Date('2025-01-18').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Inactive', timestamp: { seconds: Math.floor(new Date('2025-01-19').getTime() / 1000), nanoseconds: 0 } },
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
        startDate: { seconds: Math.floor(new Date('2025-01-10').getTime() / 1000), nanoseconds: 0 },
        status: 'Completed',
        history: [
          { field: 'adSpend', value: 500, timestamp: { seconds: Math.floor(new Date('2025-01-10').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadsGenerated', value: 1, timestamp: { seconds: Math.floor(new Date('2025-01-11').getTime() / 1000), nanoseconds: 0 } },
          { field: 'adSpend', value: 1000, timestamp: { seconds: Math.floor(new Date('2025-01-12').getTime() / 1000), nanoseconds: 0 } },
          { field: 'leadsGenerated', value: 2, timestamp: { seconds: Math.floor(new Date('2025-01-13').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Completed', timestamp: { seconds: Math.floor(new Date('2025-01-14').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
      // Business Partner Cards
      {
        id: '300001',
        typeOfCards: 'Business Partners',
        businessName: 'FitGym Inc.',
        contact: 'contact@fitgym.com',
        negotiatedRate: 2000,
        status: 'Active',
        history: [
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-01-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Active', timestamp: { seconds: Math.floor(new Date('2025-01-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'negotiatedRate', value: 2000, timestamp: { seconds: Math.floor(new Date('2025-01-02').getTime() / 1000), nanoseconds: 0 } },
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
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-01-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Active', timestamp: { seconds: Math.floor(new Date('2025-01-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'negotiatedRate', value: 2500, timestamp: { seconds: Math.floor(new Date('2025-01-02').getTime() / 1000), nanoseconds: 0 } },
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
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-02-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'negotiatedRate', value: 3000, timestamp: { seconds: Math.floor(new Date('2025-02-02').getTime() / 1000), nanoseconds: 0 } },
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
          { field: 'status', value: 'Active', timestamp: { seconds: Math.floor(new Date('2025-01-01').getTime() / 1000), nanoseconds: 0 } },
          { field: 'negotiatedRate', value: 1500, timestamp: { seconds: Math.floor(new Date('2025-01-02').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Inactive', timestamp: { seconds: Math.floor(new Date('2025-02-04').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
      // Payment Cards
      {
        id: '400001',
        typeOfCards: 'Payments',
        leadId: '100001',
        clientPayment: 5000,
        partnerPayment: 2000,
        paymentDate: { seconds: Math.floor(new Date('2025-04-10').getTime() / 1000), nanoseconds: 0 },
        status: 'Completed',
        history: [
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-04-08').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Completed', timestamp: { seconds: Math.floor(new Date('2025-04-09').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
      {
        id: '400002',
        typeOfCards: 'Payments',
        leadId: '100004',
        clientPayment: 7500,
        partnerPayment: 2500,
        paymentDate: { seconds: Math.floor(new Date('2025-04-08').getTime() / 1000), nanoseconds: 0 },
        status: 'Completed',
        history: [
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-04-05').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Completed', timestamp: { seconds: Math.floor(new Date('2025-04-06').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
      {
        id: '400003',
        typeOfCards: 'Payments',
        leadId: '100006',
        clientPayment: 6000,
        partnerPayment: 2000,
        paymentDate: { seconds: Math.floor(new Date('2025-04-11').getTime() / 1000), nanoseconds: 0 },
        status: 'Completed',
        history: [
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-04-07').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Completed', timestamp: { seconds: Math.floor(new Date('2025-04-08').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
      {
        id: '400004',
        typeOfCards: 'Payments',
        leadId: '100009',
        clientPayment: 8000,
        partnerPayment: 2500,
        paymentDate: { seconds: Math.floor(new Date('2025-04-09').getTime() / 1000), nanoseconds: 0 },
        status: 'Completed',
        history: [
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-04-06').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Completed', timestamp: { seconds: Math.floor(new Date('2025-04-07').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
      {
        id: '400005',
        typeOfCards: 'Payments',
        leadId: '100011',
        clientPayment: 9000,
        partnerPayment: 3000,
        paymentDate: { seconds: Math.floor(new Date('2025-04-12').getTime() / 1000), nanoseconds: 0 },
        status: 'Completed',
        history: [
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-04-10').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Completed', timestamp: { seconds: Math.floor(new Date('2025-04-11').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
      {
        id: '400006',
        typeOfCards: 'Payments',
        leadId: '100013',
        clientPayment: 6500,
        partnerPayment: 2000,
        paymentDate: { seconds: Math.floor(new Date('2025-04-10').getTime() / 1000), nanoseconds: 0 },
        status: 'Completed',
        history: [
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-04-09').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Completed', timestamp: { seconds: Math.floor(new Date('2025-04-10').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
      {
        id: '400007',
        typeOfCards: 'Payments',
        leadId: '100015',
        clientPayment: 7000,
        partnerPayment: 2500,
        paymentDate: { seconds: Math.floor(new Date('2025-04-13').getTime() / 1000), nanoseconds: 0 },
        status: 'Completed',
        history: [
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-04-11').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Completed', timestamp: { seconds: Math.floor(new Date('2025-04-12').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
      {
        id: '400008',
        typeOfCards: 'Payments',
        leadId: '100017',
        clientPayment: 8500,
        partnerPayment: 3000,
        paymentDate: { seconds: Math.floor(new Date('2025-04-14').getTime() / 1000), nanoseconds: 0 },
        status: 'Completed',
        history: [
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-04-12').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Completed', timestamp: { seconds: Math.floor(new Date('2025-04-13').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
      {
        id: '400009',
        typeOfCards: 'Payments',
        leadId: '100019',
        clientPayment: 4000,
        partnerPayment: 1500,
        paymentDate: { seconds: Math.floor(new Date('2025-04-15').getTime() / 1000), nanoseconds: 0 },
        status: 'Completed',
        history: [
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-04-14').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Completed', timestamp: { seconds: Math.floor(new Date('2025-04-15').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
      {
        id: '400010',
        typeOfCards: 'Payments',
        leadId: '100020',
        clientPayment: 6000,
        partnerPayment: 2000,
        paymentDate: { seconds: Math.floor(new Date('2025-04-16').getTime() / 1000), nanoseconds: 0 },
        status: 'Completed',
        history: [
          { field: 'status', value: 'Pending', timestamp: { seconds: Math.floor(new Date('2025-04-15').getTime() / 1000), nanoseconds: 0 } },
          { field: 'status', value: 'Completed', timestamp: { seconds: Math.floor(new Date('2025-04-16').getTime() / 1000), nanoseconds: 0 } },
        ],
      },
    ];

    functions.logger.info('Writing cards');
    cards.forEach((card) => {
      const cardRef = db.collection('businesses').doc(businessId).collection('cards').doc(card.id);
      batch.set(cardRef, card);
    });

    // Card Templates
    const cardTemplates = [
      {
        name: 'Leads',
        typeOfCards: 'Leads',
        headers: [
          { key: 'typeOfCards', name: 'Type of Card', type: 'text', section: 'Contact Information', isUsed: true },
          { key: 'id', name: 'ID', type: 'number', section: 'Contact Information', isUsed: true },
          { key: 'name', name: 'Name', type: 'text', section: 'Contact Information', isUsed: true },
          { key: 'phone', name: 'Phone', type: 'text', section: 'Contact Information', isUsed: true },
          { key: 'email', name: 'Email', type: 'text', section: 'Contact Information', isUsed: true },
          {
            key: 'leadStatus',
            name: 'Lead Status',
            type: 'dropdown',
            options: ['New', 'Contacted', 'Converted', 'Lost'],
            section: 'Lead Details',
            isUsed: true,
          },
          { key: 'leadSource', name: 'Lead Source', type: 'text', section: 'Lead Details', isUsed: true },
          { key: 'followUpDate', name: 'Follow Up Date', type: 'date', section: 'Lead Details', isUsed: true },
          { key: 'conversionValue', name: 'Conversion Value', type: 'currency', section: 'Lead Details', isUsed: true },
        ],
        sections: [
          { name: 'Contact Information', keys: ['typeOfCards', 'id', 'name', 'phone', 'email'] },
          { name: 'Lead Details', keys: ['leadStatus', 'leadSource', 'followUpDate', 'conversionValue'] },
        ],
      },
      {
        name: 'Ad Campaigns',
        typeOfCards: 'Ad Campaigns',
        headers: [
          { key: 'typeOfCards', name: 'Type of Card', type: 'text', section: 'Campaign Information', isUsed: true },
          { key: 'id', name: 'ID', type: 'number', section: 'Campaign Information', isUsed: true },
          { key: 'campaignName', name: 'Campaign Name', type: 'text', section: 'Campaign Information', isUsed: true },
          { key: 'platform', name: 'Platform', type: 'text', section: 'Campaign Information', isUsed: true },
          { key: 'adSpend', name: 'Ad Spend', type: 'currency', section: 'Campaign Information', isUsed: true },
          { key: 'leadsGenerated', name: 'Leads Generated', type: 'number', section: 'Campaign Information', isUsed: true },
          { key: 'costPerLead', name: 'Cost Per Lead', type: 'currency', section: 'Campaign Information', isUsed: true },
          { key: 'startDate', name: 'Start Date', type: 'date', section: 'Campaign Information', isUsed: true },
          {
            key: 'status',
            name: 'Status',
            type: 'dropdown',
            options: ['Active', 'Paused', 'Completed'],
            section: 'Campaign Information',
            isUsed: true,
          },
        ],
        sections: [
          {
            name: 'Campaign Information',
            keys: ['typeOfCards', 'id', 'campaignName', 'platform', 'adSpend', 'leadsGenerated', 'costPerLead', 'startDate', 'status'],
          },
        ],
      },
      {
        name: 'Business Partners',
        typeOfCards: 'Business Partners',
        headers: [
          { key: 'typeOfCards', name: 'Type Of Card', type: 'text', section: 'Partner Information', isUsed: true },
          { key: 'id', name: 'ID', type: 'number', section: 'Partner Information', isUsed: true },
          { key: 'businessName', name: 'Business Name', type: 'text', section: 'Partner Information', isUsed: true },
          { key: 'contact', name: 'Contact', type: 'text', section: 'Partner Information', isUsed: true },
          { key: 'negotiatedRate', name: 'Negotiated Rate', type: 'currency', section: 'Partner Information', isUsed: true },
          {
            key: 'status',
            name: 'Status',
            type: 'dropdown',
            options: ['Active', 'Inactive'],
            section: 'Partner Information',
            isUsed: true,
          },
        ],
        sections: [
          { name: 'Partner Information', keys: ['typeOfCards', 'id', 'businessName', 'contact', 'negotiatedRate', 'status'] },
        ],
      },
      {
        name: 'Payments',
        typeOfCards: 'Payments',
        headers: [
          { key: 'typeOfCards', name: 'Type of Card', type: 'text', section: 'Payment Information', isUsed: true },
          { key: 'id', name: 'ID', type: 'number', section: 'Payment Information', isUsed: true },
          { key: 'leadId', name: 'Lead ID', type: 'text', section: 'Payment Information', isUsed: true },
          { key: 'clientPayment', name: 'Client Payment', type: 'currency', section: 'Payment Information', isUsed: true },
          { key: 'partnerPayment', name: 'Partner Payment', type: 'currency', section: 'Payment Information', isUsed: true },
          { key: 'paymentDate', name: 'Payment Date', type: 'date', section: 'Payment Information', isUsed: true },
          {
            key: 'status',
            name: 'Status',
            type: 'dropdown',
            options: ['Pending', 'Completed', 'Failed'],
            section: 'Payment Information',
            isUsed: true,
          },
        ],
        sections: [
          { name: 'Payment Information', keys: ['typeOfCards', 'id', 'leadId', 'clientPayment', 'partnerPayment', 'paymentDate', 'status'] },
        ],
      },
    ];

    functions.logger.info('Writing card templates');
    cardTemplates.forEach((template) => {
      const templateRef = db.collection('businesses').doc(businessId).collection('cardTemplates').doc(template.name);
      batch.set(templateRef, template);
    });

    // Metrics
    const metrics = [
      {
        category: 'Financials',
        metrics: [
          { id: 'metric-revenue', name: 'Total Revenue', type: 'currency', value: '$81,500' },
          { id: 'metric-net-profit', name: 'Net Profit', type: 'currency', value: '$37,500' },
          {
            id: 'metric-revenue-trend',
            name: 'Revenue Trend',
            type: 'line',
            data: { labels: ['Jan', 'Feb', 'Mar', 'Apr'], values: [0, 15000, 30000, 81500] },
          },
          { id: 'metric-avg-client-payment', name: 'Avg Client Payment', type: 'currency', value: '$8,150' },
        ],
      },
      {
        category: 'Actions',
        metrics: [
          { id: 'metric-campaign-roi', name: 'Campaign ROI', type: 'multiplier', value: '6.79x' },
          { id: 'metric-fb-leads', name: 'FB Ad Leads', type: 'text', value: '10 leads, $600/lead' },
          { id: 'metric-google-leads', name: 'Google Ad Leads', type: 'text', value: '7 leads, $571.43/lead' },
          { id: 'metric-linkedin-leads', name: 'LinkedIn Ad Leads', type: 'text', value: '3 leads, $666.67/lead' },
          {
            id: 'metric-ad-spend',
            name: 'Ad Spend Distribution',
            type: 'pie',
            data: { labels: ['Facebook', 'Google', 'LinkedIn'], values: [6000, 4000, 2000] },
          },
          {
            id: 'metric-campaign-performance',
            name: 'Campaign Performance',
            type: 'bar',
            data: { labels: ['FB Q1', 'Google Q1', 'FB Q2', 'Google Q2', 'LinkedIn Q1', 'FB Jan'], values: [8, 6, 4, 3, 2, 2] },
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
            data: { labels: ['Q1', 'Q2'], values: [15, 5] },
          },
          { id: 'metric-fb-conversion', name: 'FB Conversion Rate', type: 'percentage', value: '60%' },
          { id: 'metric-google-conversion', name: 'Google Conversion Rate', type: 'percentage', value: '42.86%' },
          { id: 'metric-linkedin-conversion', name: 'LinkedIn Conversion Rate', type: 'percentage', value: '66.67%' },
        ],
      },
    ];

    functions.logger.info('Writing metrics');
    metrics.forEach((category) => {
      const metricRef = db.collection('businesses').doc(businessId).collection('metrics').doc(category.category);
      batch.set(metricRef, category);
    });

    // Dashboards
    const dashboards = [
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
            title: 'Actions',
            metricId: 'metric-ad-spend',
            position: { row: 0, col: 0 },
            dashboardId: 'dashboard-2',
          },
          {
            id: 'widget-campaign-performance',
            size: 'medium',
            title: 'Actions',
            metricId: 'metric-campaign-performance',
            position: { row: 1, col: 0 },
            dashboardId: 'dashboard-2',
          },
          {
            id: 'widget-roi',
            size: 'small',
            title: 'Actions',
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
    ];

    functions.logger.info('Writing dashboards');
    dashboards.forEach((dashboard) => {
      const dashboardRef = db.collection('businesses').doc(businessId).collection('dashboards').doc(dashboard.id);
      batch.set(dashboardRef, dashboard);
    });

    functions.logger.info('Committing batch');
    await batch.commit();

    functions.logger.info('businessSignUp completed', { uid: user.uid });
    return { status: 'success', userData };
  } catch (error) {
    functions.logger.error('businessSignUp failed', {
      error: error.message,
      stack: error.stack,
      code: error.code,
    });

    // Ensure proper error code and message
    let errorCode = error.code || 'internal';
    let errorMessage = error.message || 'Internal server error';

    if (errorCode === 'invalid-argument') {
      // Pass through invalid-argument errors
    } else if (error.code === 'auth/email-already-in-use') {
      errorCode = 'already-exists';
      errorMessage = 'Email is already in use';
    } else if (error.code === 'auth/invalid-email') {
      errorCode = 'invalid-argument';
      errorMessage = 'Invalid email address';
    } else if (error.code === 'auth/weak-password') {
      errorCode = 'invalid-argument';
      errorMessage = 'Password is too weak';
    }

    throw new functions.https.HttpsError(errorCode, errorMessage);
  }
});

exports.sendInvitationEmail = functions.https.onRequest((req, res) => {
  cors(corsOptions)(req, res, async () => {
    try {
      functions.logger.info('sendInvitationEmail called', {
        headers: req.headers,
        rawBody: req.body,
      });

      let body;
      if (req.get('Content-Type') === 'application/json') {
        try {
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (error) {
          functions.logger.error('Failed to parse JSON body', { error: error.message });
          return res.status(400).json({ error: 'Invalid JSON payload' });
        }
      } else {
        functions.logger.error('Invalid Content-Type', { contentType: req.get('Content-Type') });
        return res.status(400).json({ error: 'Content-Type must be application/json' });
      }

      const { email, businessId, invitedBy, businessEmail, permissions } = body || {};

      functions.logger.info('Parsed body', { email, businessId, invitedBy, businessEmail, permissions });

      if (!email || !businessId || !invitedBy || !permissions) {
        functions.logger.error('Missing required fields', { email, businessId, invitedBy, permissions });
        return res.status(400).json({
          error: `Missing required fields: ${!email ? 'email ' : ''}${!businessId ? 'businessId ' : ''}${!invitedBy ? 'invitedBy ' : ''}${!permissions ? 'permissions' : ''}`,
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        functions.logger.error('Invalid email format', { email });
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Validate permissions structure
      const validRoles = ['viewer', 'editor', 'none', false];
      const validationErrors = [];

      if (!permissions.dashboard || typeof permissions.dashboard !== 'object' || !('role' in permissions.dashboard)) {
        validationErrors.push('dashboard: missing or invalid role');
      } else if (!validRoles.includes(permissions.dashboard.role)) {
        validationErrors.push(`dashboard: invalid role "${permissions.dashboard.role}"`);
      }

      if (!permissions.metrics || typeof permissions.metrics !== 'object' || !('role' in permissions.metrics)) {
        validationErrors.push('metrics: missing or invalid role');
      } else if (!validRoles.includes(permissions.metrics.role)) {
        validationErrors.push(`metrics: invalid role "${permissions.metrics.role}"`);
      }

      if (!permissions.sheets || typeof permissions.sheets !== 'object' || !('role' in permissions.sheets)) {
        validationErrors.push('sheets: missing or invalid role');
      } else if (!validRoles.includes(permissions.sheets.role)) {
        validationErrors.push(`sheets: invalid role "${permissions.sheets.role}"`);
      }

      if (!permissions.actions || typeof permissions.actions !== 'object' || !('role' in permissions.actions)) {
        validationErrors.push('actions: missing or invalid role');
      } else if (!validRoles.includes(permissions.actions.role)) {
        validationErrors.push(`actions: invalid role "${permissions.actions.role}"`);
      }

      if (!permissions.financials || typeof permissions.financials !== 'object' || !('role' in permissions.financials)) {
        validationErrors.push('financials: missing or invalid role');
      } else if (!validRoles.includes(permissions.financials.role)) {
        validationErrors.push(`financials: invalid role "${permissions.financials.role}"`);
      }

      if (!permissions.sheets || !Array.isArray(permissions.sheets.allowedSheetIds)) {
        validationErrors.push('sheets.allowedSheetIds: must be an array');
      }

      if (validationErrors.length > 0) {
        functions.logger.error('Invalid permissions structure', { permissions, validationErrors });
        return res.status(400).json({
          error: `Invalid permissions structure: ${validationErrors.join('; ')}`,
        });
      }

      // Convert 'none' to false for storage
      const normalizedPermissions = {
        dashboard: { role: permissions.dashboard.role === 'none' ? false : permissions.dashboard.role },
        metrics: { role: permissions.metrics.role === 'none' ? false : permissions.metrics.role },
        sheets: {
          role: permissions.sheets.role === 'none' ? false : permissions.sheets.role,
          allowedSheetIds: permissions.sheets.allowedSheetIds || [],
        },
        actions: { role: permissions.actions.role === 'none' ? false : permissions.actions.role },
        financials: { role: permissions.financials.role === 'none' ? false : permissions.financials.role },
      };

      const businessDoc = await db.collection('businesses').doc(businessId).get();
      if (!businessDoc.exists) {
        functions.logger.error('Business not found', { businessId });
        return res.status(404).json({ error: 'Business not found' });
      }
      const businessData = businessDoc.data();
      const businessName = businessData.businessInfo.name;

      const invitationCode = Math.random().toString(36).substring(2, 10).toUpperCase();

      await db.collection('invitations').add({
        email,
        businessId,
        businessName,
        invitationCode,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        invitedBy,
        permissions: normalizedPermissions,
      });

      // Enforce verified sender email (temporary fix)
      const defaultSenderEmail = 'invitations@apx.gr';
      let senderEmail = defaultSenderEmail;

      // Only allow businessEmail if it’s from apx.gr
      if (businessEmail && emailRegex.test(businessEmail)) {
        if (businessEmail.endsWith('@apx.gr')) {
          senderEmail = businessEmail;
        } else {
          functions.logger.warn('Invalid sender domain, using default', {
            attemptedSender: businessEmail,
            defaultSender: defaultSenderEmail,
          });
        }
      }

      functions.logger.info('Preparing to send email', {
        from: `${businessName} Team <${senderEmail}>`,
        to: email,
      });

      // Send email via Resend
      let emailResponse;
      try {
        emailResponse = await resend.emails.send({
          from: `${businessName} Team <${senderEmail}>`,
          to: email,
          subject: `You're Invited to Join ${businessName} Team!`,
          html: `
            <h1>Team Invitation</h1>
            <p>You've been invited to join the ${businessName} team!</p>
            <p>Click <a href="https://www.apx.gr/signup/${encodeURIComponent(businessName)}/teammember/${invitationCode}">here</a> to accept your invitation.</p>
            <p>If you have any questions, contact ${senderEmail}</p>
          `,
        });
      } catch (emailError) {
        functions.logger.error('Resend API request failed', {
          error: emailError.message,
          stack: emailError.stack,
          senderEmail,
          recipientEmail: email,
        });
        return res.status(500).json({ error: `Failed to send email: ${emailError.message}` });
      }

      // Check Resend response
      if (emailResponse.error || !emailResponse.data?.id) {
        functions.logger.error('Resend API returned an error or invalid response', {
          emailResponse,
          senderEmail,
          recipientEmail: email,
        });
        return res.status(500).json({
          error: `Failed to send email: ${emailResponse.error?.message || 'Invalid Resend API response'}`,
        });
      }

      functions.logger.info('Invitation email sent', {
        email,
        invitationCode,
        emailResponse: emailResponse.data,
      });
      return res.status(200).json({ status: 'success', message: 'Invitation email sent successfully' });
    } catch (error) {
      functions.logger.error('sendInvitationEmail failed', {
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      return res.status(500).json({ error: `Failed to send invitation email: ${error.message}` });
    }
  });
});

exports.teamMemberSignUp = functions.https.onCall(async (data, context) => {
  try {
    functions.logger.info('teamMemberSignUp started', { rawData: data });

    const { email, password, phone, invitationCode, name, surname } = data.data || data || {};

    functions.logger.info('Destructured data', {
      email,
      password: password ? '[REDACTED]' : undefined,
      phone,
      invitationCode,
      name,
      surname,
    });

    // Validate required fields
    if (!email || !password || !phone || !invitationCode || !name || !surname) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Missing required fields: ${!email ? 'email ' : ''}${!password ? 'password ' : ''}${!phone ? 'phone ' : ''}${!invitationCode ? 'invitationCode ' : ''}${!name ? 'name ' : ''}${!surname ? 'surname' : ''}`
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid email format');
    }

    // Validate phone format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid phone number format');
    }

    // Validate name and surname
    const nameRegex = /^[a-zA-Z\s-]+$/;
    if (!nameRegex.test(name) || name.trim().length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid name format');
    }
    if (!nameRegex.test(surname) || surname.trim().length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid surname format');
    }

    // Check invitation
    const invitationQuery = await db
      .collection('invitations')
      .where('invitationCode', '==', invitationCode)
      .where('status', '==', 'pending')
      .get();

    if (invitationQuery.empty) {
      throw new functions.https.HttpsError('not-found', 'Invalid or expired invitation code');
    }

    const invitationDoc = invitationQuery.docs[0];
    const invitationData = invitationDoc.data();
    const { businessId, businessName, invitedBy, permissions } = invitationData;

    functions.logger.info('Invitation data retrieved', {
      businessId,
      businessName,
      invitedBy,
      permissions,
    });

    if (invitationData.email.toLowerCase() !== email.toLowerCase()) {
      throw new functions.https.HttpsError('invalid-argument', 'Email does not match invitation');
    }

    const createdAt = invitationData.createdAt.toDate();
    if (new Date() - createdAt > 7 * 24 * 60 * 60 * 1000) {
      throw new functions.https.HttpsError('failed-precondition', 'Invitation has expired');
    }

    functions.logger.info('Creating user', { email });
    const userRecord = await auth.createUser({ email, password });
    const user = userRecord;

    const batch = db.batch();

    functions.logger.info('Writing user data', { uid: user.uid });
    const userData = {
      uid: user.uid,
      email: user.email,
      phone,
      name: name.trim(),
      surname: surname.trim(),
      userType: 'team_member',
      businessId,
      businessName,
      createdAt: new Date().toISOString(),
    };
    const userDocRef = db.collection('users').doc(user.uid);
    batch.set(userDocRef, userData);

    functions.logger.info('Adding team member to business', { businessId });
    const teamMemberDocRef = db.collection('businesses').doc(businessId).collection('teamMembers').doc(user.uid);
    batch.set(teamMemberDocRef, {
      uid: user.uid,
      email: user.email,
      phone,
      name: name.trim(),
      surname: surname.trim(),
      userType: 'team_member',
      joinedAt: new Date().toISOString(),
      permissions: {
        dashboard: { role: permissions.dashboard.role || false },
        metrics: { role: permissions.metrics.role || false },
        sheets: {
          role: permissions.sheets.role || false,
          allowedSheetIds: permissions.sheets.allowedSheetIds || [],
        },
        actions: { role: permissions.actions.role || false },
        financials: { role: permissions.financials.role || false },
      },
      displayJoinedMessage: true,
    });

    functions.logger.info('Deleting invitation', { invitationId: invitationDoc.id });
    batch.delete(invitationDoc.ref);

    functions.logger.info('Committing batch');
    await batch.commit();

    functions.logger.info('teamMemberSignUp completed', { uid: user.uid });
    return { status: 'success', userData };
  } catch (error) {
    functions.logger.error('teamMemberSignUp failed', {
      error: error.message,
      stack: error.stack,
      code: error.code,
    });

    let errorCode = error.code || 'internal';
    let errorMessage = error.message || 'Internal server error';

    if (errorCode === 'invalid-argument' || errorCode === 'not-found' || errorCode === 'failed-precondition') {
      // Pass through specific errors
    } else if (error.code === 'auth/email-already-in-use') {
      errorCode = 'already-exists';
      errorMessage = 'Email is already in use';
    } else if (error.code === 'auth/invalid-email') {
      errorCode = 'invalid-argument';
      errorMessage = 'Invalid email address';
    } else if (error.code === 'auth/weak-password') {
      errorCode = 'invalid-argument';
      errorMessage = 'Password is too weak';
    }

    throw new functions.https.HttpsError(errorCode, errorMessage);
  }
});

exports.updateCardTemplatesAndCards = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, async () => {
    if (req.method === 'OPTIONS') {
      functions.logger.info('Handling OPTIONS request for CORS preflight');
      return res.status(204).send('');
    }

    try {
      functions.logger.info('updateCardTemplatesAndCards called', {
        method: req.method,
        headers: req.headers,
        rawBody: req.body,
      });

      if (req.method !== 'POST') {
        functions.logger.error('Invalid method:', { method: req.method });
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const authHeader = req.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        functions.logger.error('Missing or invalid Authorization header');
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
        functions.logger.info('Authenticated user:', { uid: decodedToken.uid });
      } catch (error) {
        functions.logger.error('Token verification failed:', { error: error.message });
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }

      let body;
      if (req.get('Content-Type') === 'application/json') {
        try {
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (error) {
          functions.logger.error('Failed to parse JSON body', { error: error.message });
          return res.status(400).json({ error: 'Invalid JSON payload' });
        }
      } else {
        functions.logger.error('Invalid Content-Type', { contentType: req.get('Content-Type') });
        return res.status(400).json({ error: 'Content-Type must be application/json' });
      }

      const { businessId, updates } = body || {};

      functions.logger.info('Parsed body', { businessId, updates });

      if (!businessId || !updates || !Array.isArray(updates)) {
        functions.logger.error('Missing required fields', { businessId, updates });
        return res.status(400).json({
          error: `Missing required fields: ${!businessId ? 'businessId ' : ''}${!updates ? 'updates ' : ''}${
            updates && !Array.isArray(updates) ? 'updates must be an array' : ''
          }`,
        });
      }

      const businessDoc = await admin.firestore().collection('businesses').doc(businessId).get();
      if (!businessDoc.exists) {
        functions.logger.error('Business not found:', { businessId });
        return res.status(404).json({ error: 'Business not found' });
      }

      const batch = admin.firestore().batch();
      let totalUpdatedCards = 0;
      let totalUpdatedTemplates = 0;
      const messages = [];

      for (const update of updates) {
        const { docId, typeOfCards, newTypeOfCards, deletedKeys, newTemplate, action } = update;

        if (!docId || !typeOfCards) {
          functions.logger.warn('Skipping update: Missing docId or typeOfCards', { docId, typeOfCards });
          messages.push(`Skipping update: Missing docId or typeOfCards for ${docId || 'unknown'}`);
          continue;
        }

        const templateRef = admin
          .firestore()
          .collection('businesses')
          .doc(businessId)
          .collection('cardTemplates')
          .doc(docId);

        if (action === 'remove') {
          functions.logger.info('Deleting cardTemplate:', { docId });
          batch.delete(templateRef);
          totalUpdatedTemplates += 1;
          messages.push(`Deleted cardTemplate: ${docId}`);
          continue;
        }

        const cardsRef = admin
          .firestore()
          .collection('businesses')
          .doc(businessId)
          .collection('cards')
          .where('typeOfCards', '==', typeOfCards);
        const snapshot = await cardsRef.get();

        if (snapshot.empty) {
          functions.logger.info('No cards found:', { typeOfCards });
          messages.push(`No cards found for typeOfCards: ${typeOfCards}`);
        } else {
          snapshot.forEach((doc) => {
            const cardData = doc.data();
            const updateData = {};

            if (deletedKeys && Array.isArray(deletedKeys)) {
              deletedKeys.forEach((key) => {
                if (key in cardData) {
                  updateData[key] = admin.firestore.FieldValue.delete();
                }
              });

              if (cardData.history && Array.isArray(cardData.history)) {
                const updatedHistory = cardData.history.filter(
                  (entry) => !deletedKeys.includes(entry.field)
                );
                if (updatedHistory.length !== cardData.history.length) {
                  updateData.history = updatedHistory;
                }
              }
            }

            if (newTypeOfCards && newTypeOfCards !== typeOfCards) {
              updateData.typeOfCards = newTypeOfCards;
            }

            if (Object.keys(updateData).length > 0) {
              functions.logger.info('Updating card:', { cardId: doc.id, updateData });
              batch.update(doc.ref, updateData);
            }
          });

          totalUpdatedCards += snapshot.size;
          messages.push(
            `Processed ${snapshot.size} cards for typeOfCards: ${typeOfCards}${
              deletedKeys && deletedKeys.length > 0 ? `, deleted keys: ${deletedKeys.join(', ')}` : ''
            }${newTypeOfCards ? `, updated to newTypeOfCards: ${newTypeOfCards}` : ''}`
          );
        }

        if (newTemplate) {
          functions.logger.info('Updating cardTemplate:', { docId, newTemplate });
          batch.set(templateRef, newTemplate);
          totalUpdatedTemplates += 1;
          messages.push(`Updated cardTemplate: ${docId}, typeOfCards: ${newTemplate.typeOfCards}`);
        } else if (newTypeOfCards) {
          const updateData = {
            typeOfCards: newTypeOfCards,
            name: newTypeOfCards,
          };
          functions.logger.info('Partially updating cardTemplate:', { docId, updateData });
          batch.update(templateRef, updateData);
          totalUpdatedTemplates += 1;
          messages.push(`Partially updated cardTemplate: ${docId}`);
        }
      }

      functions.logger.info('Committing batch with updates:', { totalUpdatedCards, totalUpdatedTemplates });
      await batch.commit();

      functions.logger.info('Batch committed successfully:', { totalUpdatedCards, totalUpdatedTemplates });
      return res.status(200).json({
        success: true,
        message: messages.length > 0 ? messages.join('; ') : 'No updates performed',
        updatedCardsCount: totalUpdatedCards,
        updatedTemplatesCount: totalUpdatedTemplates,
      });
    } catch (error) {
      functions.logger.error('updateCardTemplatesAndCards failed', {
        error: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ error: `Failed to update templates and cards: ${error.message}` });
    }
  });
});

exports.deleteTeamMember = functions.https.onCall(async (data, context) => {
  try {
    // Accept data in the same structure as teamMemberSignUp
    const {
      teamMemberUid,
      businessId,
      callerUid, // still needed for permission check
      // Accept but ignore these for deletion
      email,
      phone,
      invitationCode,
      name,
      surname,
    } = data.data || data || {};

    if (!callerUid || !businessId || !teamMemberUid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Missing required fields: ${!callerUid ? 'callerUid ' : ''}${!businessId ? 'businessId ' : ''}${!teamMemberUid ? 'teamMemberUid' : ''}`
      );
    }

    if (teamMemberUid === callerUid) {
      throw new functions.https.HttpsError('invalid-argument', 'Cannot delete yourself');
    }

    // Verify caller exists in Firebase Authentication
    try {
      await admin.auth().getUser(callerUid);
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        throw new functions.https.HttpsError('not-found', 'Caller does not exist');
      }
      throw new functions.https.HttpsError('internal', 'Failed to verify caller');
    }

    // Verify business exists and caller is the owner
    const businessDocRef = admin.firestore().collection('businesses').doc(businessId);
    const businessDoc = await businessDocRef.get();
    if (!businessDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Business not found');
    }
    const businessData = businessDoc.data();
    if (businessData.businessInfo.ownerUid !== callerUid) {
      throw new functions.https.HttpsError('permission-denied', 'Only the business owner can delete team members');
    }

    // Verify team member exists
    const teamMemberDocRef = businessDocRef.collection('teamMembers').doc(teamMemberUid);
    const teamMemberDoc = await teamMemberDocRef.get();
    if (!teamMemberDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Team member not found');
    }

    // Perform deletion using a batch
    const batch = admin.firestore().batch();
    batch.delete(teamMemberDocRef);

    // Delete user document if it exists
    const userDocRef = admin.firestore().collection('users').doc(teamMemberUid);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      batch.delete(userDocRef);
    }

    // Commit Firestore batch
    await batch.commit();

    // Delete Firebase Authentication user
    try {
      await admin.auth().deleteUser(teamMemberUid);
    } catch (authError) {
      if (authError.code !== 'auth/user-not-found') {
        throw authError;
      }
    }

    return {
      success: true,
      message: 'Team member deleted successfully',
    };
  } catch (error) {
    let statusCode = error.code || 'internal';
    let errorMessage = error.message || 'Failed to delete team member';
    throw new functions.https.HttpsError(statusCode, errorMessage);
  }
});

// Cloud Function: Add docId as id and create history array on new document creation
exports.addIdAndHistoryOnCreate = onDocumentCreated('businesses/{businessId}/cards/{cardId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const docId = event.params.cardId;
  const cardRef = snap.ref;

  // Only add id if not present
  if (!data.id) {
    // Build history array from all fields (except id, history)
    const history = Object.keys(data)
      .filter((key) => key !== 'id' && key !== 'history')
      .map((key) => ({
        field: key,
        value: data[key],
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      }));

    await cardRef.update({
      id: docId,
      history: history,
    });
  }
});
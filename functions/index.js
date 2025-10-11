const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const cors = require('cors');
const { Timestamp } = require('firebase-admin/firestore');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const resend = new Resend('re_C1GAhxiY_KvM6xMG96EHQwAZnC6Cp2k5s');
// CORS configuration
const corsOptions = {
  origin: [
    'https://www.apx.gr', 
    'http://localhost:5173',
    'https://avacrm-6900e.web.app',
    'https://avacrm-6900e.firebaseapp.com'
  ], // default for most functions
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};
const corsMiddleware = cors(corsOptions);

// CORS for createNewRecord: allow all origins
const corsAllOrigins = cors({
  origin: true,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
});

// Backend-safe helper to get headers for a given record template key
function _getHeaders(templateKey, recordTemplatesArr) {
  if (!Array.isArray(recordTemplatesArr)) return [];
  const template = recordTemplatesArr.find(
    t => (t.name || t.typeOfRecords) === templateKey
  );
  return template && Array.isArray(template.headers) ? template.headers : [];
}

exports.businessSignUp = functions.https.onCall(async (data, _context) => {
  try {
    // Log raw data to inspect its structure
    functions.logger.info('businessSignUp started', { rawData: data });

    // Destructure from data.data (Firebase wraps payload) or fallback to data or empty object
    const { email, password, businessName, invitationCode, userType, name, surname } = data.data || data || {};

    // Log destructured fields
    functions.logger.info('Destructured data', {
      email,
      password: password ? '[REDACTED]' : undefined,
      businessName,
      invitationCode,
      userType,
      name,
      surname,
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
      name: name || '',
      surname: surname || '',
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
        ownerName: name || '',
        surname: surname || '',
      },
    });

    // Sheets: create only one empty sheet named 'Sheet 1'
    functions.logger.info('Creating single empty sheet named Sheet 1');
    const sheet1 = {
      id: 'sheet1',
      sheetName: 'Sheet 1',
      headers: [],
      pinnedHeaders: [],
      typeOfRecordsToDisplay: [],
      recordTypeFilters: {},
    };
    const sheetRef = db.collection('businesses').doc(businessId).collection('sheets').doc(sheet1.id);
    batch.set(sheetRef, sheet1);
    const structureRef = db.collection('businesses').doc(businessId).collection('sheetsStructure').doc('structure');
    batch.set(structureRef, { structure: [{ sheetName: 'Sheet 1' }] });

    // Records: do not add any initial records
    // Record Templates: do not add any initial templates

    // Commit batch
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

exports.teamMemberSignUp = functions.https.onCall(async (data, _context) => {
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

exports.updateRecordTemplatesAndRecords = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, async () => {
    if (req.method === 'OPTIONS') {
      functions.logger.info('Handling OPTIONS request for CORS preflight');
      return res.status(204).send('');
    }

    try {
      functions.logger.info('updateRecordTemplatesAndRecords called', {
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

      const { businessId, objects, updates } = body || {};

      functions.logger.info('Parsed body with detailed types', { 
        businessId, 
        objects, 
        updates,
        objectsType: typeof objects,
        objectsIsArray: Array.isArray(objects),
        updatesType: typeof updates,
        updatesIsArray: Array.isArray(updates),
        bodyKeys: Object.keys(body || {}),
        fullBody: JSON.stringify(body)
      });

      if (!businessId) {
        functions.logger.error('Missing required fields', { businessId });
        return res.status(400).json({
          error: 'Missing required field: businessId',
        });
      }

      // Validate that at least objects or updates are provided
      const hasObjects = objects && Array.isArray(objects);
      const hasUpdates = updates && Array.isArray(updates);
      
      functions.logger.info('Validation check', { 
        hasObjects, 
        hasUpdates,
        objectsLength: hasObjects ? objects.length : 'N/A',
        updatesLength: hasUpdates ? updates.length : 'N/A'
      });
      
      if (!hasObjects && !hasUpdates) {
        functions.logger.error('Neither objects nor updates provided', { 
          objects, 
          updates, 
          hasObjects, 
          hasUpdates,
          objectsType: typeof objects,
          updatesType: typeof updates
        });
        return res.status(400).json({
          error: 'Missing required fields: updates',
        });
      }

      functions.logger.info('Validation passed:', { 
        hasObjects, 
        objectsLength: hasObjects ? objects.length : 0,
        hasUpdates, 
        updatesLength: hasUpdates ? updates.length : 0 
      });

      const businessDoc = await admin.firestore().collection('businesses').doc(businessId).get();
      if (!businessDoc.exists) {
        functions.logger.error('Business not found:', { businessId });
        return res.status(404).json({ error: 'Business not found' });
      }

      const batch = admin.firestore().batch();
      let totalUpdatedRecords = 0;
      let totalUpdatedTemplates = 0;
      let totalUpdatedObjects = 0;
      const messages = [];

      // Handle object updates if objects are provided
      if (objects && Array.isArray(objects)) {
        for (const object of objects) {
          const { id, name, basicFields, templates, pipelines, action } = object;

          if (!id || !name) {
            functions.logger.warn('Skipping object: Missing id or name', { id, name });
            continue;
          }

          const objectRef = admin
            .firestore()
            .collection('businesses')
            .doc(businessId)
            .collection('templateObjects')
            .doc(id);

          if (action === 'remove') {
            functions.logger.info('Deleting templateProfile:', { id });
            batch.delete(objectRef);
            messages.push(`Deleted object: ${name}`);
          } else {
            // Check if object name has changed by comparing with existing object
            let objectNameChanged = false;
            let previousName = null;
            
            try {
              const existingProfileDoc = await objectRef.get();
              if (existingProfileDoc.exists) {
                const existingData = existingProfileDoc.data();
                previousName = existingData.name;
                objectNameChanged = previousName && previousName !== name;
              }
            } catch (error) {
              functions.logger.warn('Error checking existing object:', { error: error.message });
            }

            functions.logger.info('Upserting templateProfile:', { 
              id, 
              name, 
              previousName,
              objectNameChanged,
              templateCount: templates?.length || 0, 
              pipelineCount: pipelines?.length || 0 
            });

            // Debug: Log the comparison details
            functions.logger.info('Profile name change detection:', {
              objectId: id,
              incomingName: name,
              existingName: previousName,
              namesAreDifferent: previousName !== name,
              hasTemplates: templates && Array.isArray(templates) && templates.length > 0,
              objectNameChanged
            });

            // If object name changed, update typeOfProfile in all records that use templates from this object
            if (objectNameChanged && templates && Array.isArray(templates)) {
              functions.logger.info('Profile name changed, updating typeOfProfile in records:', { 
                objectId: id, 
                previousName, 
                newName: name,
                templateCount: templates.length
              });

              for (const template of templates) {
                if (template.typeOfRecords) {
                  const recordsRef = admin
                    .firestore()
                    .collection('businesses')
                    .doc(businessId)
                    .collection('records')
                    .where('typeOfRecords', '==', template.typeOfRecords);
                  
                  try {
                    const recordsSnapshot = await recordsRef.get();
                    if (!recordsSnapshot.empty) {
                      functions.logger.info('Updating typeOfProfile in records:', {
                        typeOfRecords: template.typeOfRecords,
                        recordCount: recordsSnapshot.size,
                        from: previousName,
                        to: name
                      });

                      recordsSnapshot.forEach((recordDoc) => {
                        const recordData = recordDoc.data();
                        // Only update if the record's typeOfProfile matches the previous object name
                        if (recordData.typeOfProfile === previousName) {
                          batch.update(recordDoc.ref, {
                            typeOfProfile: name
                          });
                          totalUpdatedRecords += 1;
                        }
                      });

                      messages.push(`Updated typeOfProfile from "${previousName}" to "${name}" in ${recordsSnapshot.size} records for template "${template.typeOfRecords}"`);
                    }
                  } catch (error) {
                    functions.logger.error('Error updating records for template:', { 
                      typeOfRecords: template.typeOfRecords, 
                      error: error.message 
                    });
                  }
                }
              }
            }

            batch.set(objectRef, {
              id,
              name,
              basicFields: basicFields || [],
              templates: templates || [],
              pipelines: pipelines || [],
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            messages.push(`Updated object: ${name} with ${templates?.length || 0} templates and ${pipelines?.length || 0} pipelines`);
          }
          totalUpdatedObjects += 1;
        }
      }

      // Handle legacy template updates if updates are provided (for backward compatibility)
      if (updates && Array.isArray(updates)) {
        for (const update of updates) {
          const { docId, typeOfRecords, newTypeOfRecords, deletedKeys, newTemplate, action } = update;

          if (!docId || !typeOfRecords) {
            functions.logger.warn('Skipping update: Missing docId or typeOfRecords', { docId, typeOfRecords });
            messages.push(`Skipping update: Missing docId or typeOfRecords for ${docId || 'unknown'}`);
            continue;
          }

          const templateRef = admin
            .firestore()
            .collection('businesses')
            .doc(businessId)
            .collection('recordTemplates')
            .doc(docId);

          if (action === 'remove') {
            functions.logger.info('Deleting recordTemplate:', { docId });
            batch.delete(templateRef);
            totalUpdatedTemplates += 1;
            messages.push(`Deleted recordTemplate: ${docId}`);
            continue;
          }

          const recordsRef = admin
            .firestore()
            .collection('businesses')
            .doc(businessId)
            .collection('records')
            .where('typeOfRecords', '==', typeOfRecords);
          const snapshot = await recordsRef.get();

          if (snapshot.empty) {
            functions.logger.info('No records found:', { typeOfRecords });
            messages.push(`No records found for typeOfRecords: ${typeOfRecords}`);
          } else {
            snapshot.forEach((doc) => {
              const recordData = doc.data();
              const updateData = {};

              if (deletedKeys && Array.isArray(deletedKeys)) {
                deletedKeys.forEach((key) => {
                  if (key in recordData) {
                    updateData[key] = admin.firestore.FieldValue.delete();
                  }
                });

                if (recordData.history && Array.isArray(recordData.history)) {
                  const updatedHistory = recordData.history.filter(
                    (entry) => !deletedKeys.includes(entry.field)
                  );
                  if (updatedHistory.length !== recordData.history.length) {
                    updateData.history = updatedHistory;
                  }
                }
              }

              if (newTypeOfRecords && newTypeOfRecords !== typeOfRecords) {
                updateData.typeOfRecords = newTypeOfRecords;
              }

              if (Object.keys(updateData).length > 0) {
                functions.logger.info('Updating record:', { recordId: doc.id, updateData });
                batch.update(doc.ref, updateData);
              }
            });

            totalUpdatedRecords += snapshot.size;
            messages.push(
              `Processed ${snapshot.size} records for typeOfRecords: ${typeOfRecords}${
                deletedKeys && deletedKeys.length > 0 ? `, deleted keys: ${deletedKeys.join(', ')}` : ''
              }${newTypeOfRecords ? `, updated to newTypeOfRecords: ${newTypeOfRecords}` : ''}`
            );
          }

          if (newTemplate) {
            functions.logger.info('Updating recordTemplate:', { docId, newTemplate });
            batch.set(templateRef, newTemplate);
            totalUpdatedTemplates += 1;
            messages.push(`Updated recordTemplate: ${docId}, typeOfRecords: ${newTemplate.typeOfRecords}`);
          } else if (newTypeOfRecords) {
            const updateData = {
              typeOfRecords: newTypeOfRecords,
              name: newTypeOfRecords,
            };
            functions.logger.info('Partially updating recordTemplate:', { docId, updateData });
            batch.update(templateRef, updateData);
            totalUpdatedTemplates += 1;
            messages.push(`Partially updated recordTemplate: ${docId}`);
          }
        }
      }

      if (totalUpdatedObjects > 0 || totalUpdatedTemplates > 0) {
        functions.logger.info('Committing batch with updates:', { 
          totalUpdatedRecords, 
          totalUpdatedTemplates, 
          totalUpdatedObjects 
        });
        await batch.commit();
        functions.logger.info('Batch committed successfully:', { 
          totalUpdatedRecords, 
          totalUpdatedTemplates, 
          totalUpdatedObjects 
        });
      } else {
        functions.logger.info('No batch operations to commit - this is normal for empty object arrays');
      }
      return res.status(200).json({
        success: true,
        message: messages.length > 0 ? messages.join('; ') : 'No updates performed',
        updatedRecordsCount: totalUpdatedRecords,
        updatedTemplatesCount: totalUpdatedTemplates,
        updatedObjectsCount: totalUpdatedObjects,
      });
    } catch (error) {
      functions.logger.error('updateRecordTemplatesAndRecords failed', {
        error: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ error: `Failed to update templates and records: ${error.message}` });
    }
  });
});

exports.deleteTeamMember = functions.https.onCall(async (data, _context) => {
  try {
    // Accept data in the same structure as teamMemberSignUp
    const {
      teamMemberUid,
      businessId,
      callerUid, // still needed for permission check
      // Accept but ignore these for deletion
    _email,
    _phone,
    _invitationCode,
    _name,
    _surname,
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

exports.createNewRecord = functions.https.onRequest((req, res) => {
  corsAllOrigins(req, res, async () => {
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      let body;
      if (req.get('Content-Type') === 'application/json') {
        try {
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        // eslint-disable-next-line no-unused-vars
        } catch (__error) {
          return res.status(400).json({ error: 'Invalid JSON payload' });
        }
      } else {
        return res.status(400).json({ error: 'Content-Type must be application/json' });
      }
      const { businessId, recordData, fieldsToConvertToTimeStamps } = body || {};
      if (!businessId || !recordData || typeof recordData !== 'object') {
        return res.status(400).json({
          error: `Missing or invalid required fields: ${!businessId ? 'businessId ' : ''}${!recordData ? 'recordData' : ''}`
        });
      }

      // Check for required fields in recordData
      if (!recordData.typeOfRecords) {
        return res.status(400).json({
          error: 'Missing required recordData fields: typeOfRecords is required.'
        });
      }

      // Convert specified fields to Firestore Timestamp if fieldsToConvertToTimeStamps is provided
      if (Array.isArray(fieldsToConvertToTimeStamps)) {
        fieldsToConvertToTimeStamps.forEach(key => {
          if (recordData[key]) {
            // Accept ISO string, JS timestamp, or {seconds, nanoseconds}
            if (typeof recordData[key] === 'string' && !isNaN(Date.parse(recordData[key]))) {
              recordData[key] = Timestamp.fromDate(new Date(recordData[key]));
            } else if (
              typeof recordData[key] === 'object' &&
              typeof recordData[key].seconds === 'number' &&
              typeof recordData[key].nanoseconds === 'number'
            ) {
              recordData[key] = new Timestamp(recordData[key].seconds, recordData[key].nanoseconds);
            } else if (typeof recordData[key] === 'number') {
              // If it's a JS timestamp (ms since epoch)
              recordData[key] = Timestamp.fromDate(new Date(recordData[key]));
            }
          }
        });
      }

      // Create history from recordData fields (excluding 'id' and 'history')
      const now = Timestamp.now();
      const history = Object.keys(recordData)
        .filter((key) => key !== 'id' && key !== 'history')
        .map((key) => ({
          field: key,
          value: recordData[key],
          timestamp: now,
        }));
      recordData.history = history;

      functions.logger.info('createNewRecord payload', { recordData, fullBody: body });

      const recordsCollectionRef = admin.firestore().collection('businesses').doc(businessId).collection('records');
      const newRecordRef = await recordsCollectionRef.add(recordData);

      // Support both top-level and nested emailsToNotify
      const emailsToNotify = Array.isArray(body.emailsToNotify)
        ? body.emailsToNotify
        : (Array.isArray(body.data?.emailsToNotify) ? body.data.emailsToNotify : []);

      if (emailsToNotify.length > 0) {
        const sheetName = recordData.sheetName || 'unknown';
        const docId = newRecordRef.id;
        const leadUrl = `https://www.apx.gr/sheets/${encodeURIComponent(sheetName)}/${docId}`;
        for (const notifyEmail of emailsToNotify) {
          try {
            await resend.emails.send({
              from: 'Booking Notifications <invitations@apx.gr>',
              to: notifyEmail,
              subject: 'New Lead!',
              html: `<h1>New Lead!</h1><p>A new lead has been created.</p><p>View it here: <a href="${leadUrl}">${leadUrl}</a></p>`
            });
            functions.logger.info('Notification email sent', { notifyEmail });
          } catch (emailError) {
            functions.logger.error('Failed to send notification email', {
              notifyEmail,
              error: emailError.message,
              stack: emailError.stack,
            });
          }
        }
      } else {
        functions.logger.info('No emailsToNotify array or empty, skipping email logic', { emailsToNotify });
      }

      return res.status(200).json({
        success: true,
        message: 'Record created successfully',
        recordId: newRecordRef.id,
      });
    } catch (error) {
      functions.logger.error('createNewRecord failed', {
        error: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ error: `Failed to create new record: ${error.message}` });
    }
  });
});

exports.submitFormData = functions.https.onRequest((req, res) => {
  corsAllOrigins(req, res, async () => {
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    try {
      // Initialize variables at function scope
      const createdObjects = [];
      
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // Get workflowId from query parameters
      const workflowId = req.query.workflowId;
      if (!workflowId) {
        return res.status(400).json({ error: 'Missing workflowId query parameter' });
      }

      let body;
      if (req.get('Content-Type') === 'application/json') {
        try {
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (error) {
          return res.status(400).json({ error: 'Invalid JSON payload' });
        }
      } else {
        return res.status(400).json({ error: 'Content-Type must be application/json' });
      }

      const formData = body || {};
      functions.logger.info('submitFormData called', {
        workflowId,
        formDataKeys: Object.keys(formData),
        method: req.method,
        headers: req.headers
      });

      // Load workflow configuration
      // First, find the business that contains this workflow
      const businessesRef = db.collection('businesses');
      const businessesSnapshot = await businessesRef.get();
      
      let workflowDoc = null;
      let businessId = null;
      
      // Search through all businesses to find the workflow
      for (const businessDoc of businessesSnapshot.docs) {
        const workflowRef = businessDoc.ref.collection('workflows').doc(workflowId);
        const doc = await workflowRef.get();
        if (doc.exists) {
          workflowDoc = doc;
          businessId = businessDoc.id;
          break;
        }
      }
      
      if (!workflowDoc) {
        functions.logger.error('Workflow not found in any business', { workflowId });
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Load the config from the subcollection
      const configRef = workflowDoc.ref.collection('config').doc('main');
      const configDoc = await configRef.get();
      
      let workflowConfig = workflowDoc.data();
      if (configDoc.exists) {
        workflowConfig = { ...workflowConfig, ...configDoc.data() };
      }

      functions.logger.info('Loaded workflow config', {
        workflowId,
        businessId,
        hasMapping: !!workflowConfig.mapping,
        hasNotifications: !!workflowConfig.notifications,
        hasAutoActions: !!workflowConfig.autoActions
      });

      // Process the workflow configuration
      const createdRecords = [];
      const batch = db.batch();

      // Check if we have mapping configuration
      if (!workflowConfig.mapping || !workflowConfig.mapping.objectType || !workflowConfig.mapping.fieldMappings) {
        functions.logger.error('Invalid workflow configuration: missing mapping', { 
          workflowId,
          hasMapping: !!workflowConfig.mapping,
          hasObjectType: !!(workflowConfig.mapping?.objectType),
          hasFieldMappings: !!(workflowConfig.mapping?.fieldMappings),
          fieldMappingsLength: workflowConfig.mapping?.fieldMappings?.length || 0
        });
        return res.status(400).json({ 
          error: 'Workflow configuration is incomplete. Please save your workflow configuration in the Workflow Builder before testing.' 
        });
      }

      const { objectType, fieldMappings } = workflowConfig.mapping;

      functions.logger.info('Processing workflow mapping', {
        objectType,
        fieldMappingsCount: fieldMappings.length
      });

      // Separate basicFields (for object) and all fields (for record)
      const objectFields = {}; // UUID keys for object
      const recordFields = {}; // UUID keys for record
      const objectHistory = [];
      const recordHistory = [];
      const now = admin.firestore.Timestamp.now();

      // Process field mappings
      for (const mapping of fieldMappings) {
        const { formField, crmField, required } = mapping;

        let value = formData[formField];

        // Check required fields
        if (required && (value === undefined || value === null || value === '')) {
          functions.logger.error('Missing required field', { formField, crmField });
          return res.status(400).json({
            error: `Missing required field: ${formField}`
          });
        }

        // Basic type conversion
        if (value !== undefined && value !== null && value !== '') {
          // Try to convert numbers
          if (!isNaN(value) && value !== '') {
            value = Number(value);
          }
          // Convert boolean strings
          else if (value === 'true') value = true;
          else if (value === 'false') value = false;
        }

        // Skip if crmField is empty or invalid
        if (!crmField || crmField.trim() === '') {
          functions.logger.warn('Skipping mapping with empty crmField', { formField, crmField });
          continue;
        }

        // Extract UUID from crmField (remove basicFields. or templateFields. prefix)
        let fieldUuid = '';
        
        if (crmField.startsWith('basicFields.')) {
          fieldUuid = crmField.replace('basicFields.', '');
          
          // Validate UUID is not empty
          if (!fieldUuid || fieldUuid.trim() === '') {
            functions.logger.warn('Skipping basicField with empty UUID', { formField, crmField });
            continue;
          }
          
          // BasicFields go in BOTH object and record (UUID only)
          objectFields[fieldUuid] = value;
          recordFields[fieldUuid] = value;
          
          // Add to histories (UUID only, no prefix)
          objectHistory.push({
            field: fieldUuid,
            value: value,
            timestamp: now,
            modifiedBy: businessId,
            isObject: true
          });
          
          recordHistory.push({
            field: fieldUuid,
            value: value,
            timestamp: now,
            modifiedBy: businessId
          });
        } else if (crmField.startsWith('templateFields.')) {
          fieldUuid = crmField.replace('templateFields.', '');
          
          // Validate UUID is not empty
          if (!fieldUuid || fieldUuid.trim() === '') {
            functions.logger.warn('Skipping templateField with empty UUID', { formField, crmField });
            continue;
          }
          
          // Template fields only go in records (UUID only)
          recordFields[fieldUuid] = value;
          
          recordHistory.push({
            field: fieldUuid,
            value: value,
            timestamp: now,
            modifiedBy: businessId
          });
        } else {
          // Invalid format - skip this field
          functions.logger.warn('Skipping field with invalid format (missing prefix)', { 
            formField, 
            crmField 
          });
          continue;
        }
      }

      // Determine object name from first basicField value or fallback
      const firstBasicFieldValue = Object.values(objectFields)[0];
      const objectName = firstBasicFieldValue || `${objectType} Record`;
      
      // Check if an object instance already exists for this entity
      const objectsRef = db.collection('businesses').doc(businessId).collection('objects');
      let existingObjectQuery;
      
      // Try to find existing object by email (best) or name
      const emailFieldUuid = Object.keys(objectFields).find(uuid => 
        formData[fieldMappings.find(m => m.crmField === `basicFields.${uuid}`)?.formField]?.includes('@')
      );
      
      if (emailFieldUuid && objectFields[emailFieldUuid]) {
        existingObjectQuery = await objectsRef
          .where('typeOfObject', '==', objectType)
          .where(emailFieldUuid, '==', objectFields[emailFieldUuid])
          .get();
      } else {
        // Try to match by first field value
        const firstFieldUuid = Object.keys(objectFields)[0];
        if (firstFieldUuid) {
          existingObjectQuery = await objectsRef
            .where('typeOfObject', '==', objectType)
            .where(firstFieldUuid, '==', objectFields[firstFieldUuid])
            .get();
        }
      }
      
      let objectId;
      let linkId;
      
      if (existingObjectQuery && !existingObjectQuery.empty) {
        // Use existing object instance
        const existingObject = existingObjectQuery.docs[0];
        objectId = existingObject.id;
        linkId = existingObject.data().linkId;
        
        functions.logger.info('Using existing object instance', {
          objectId,
          linkId
        });
      } else {
        // Create new object instance with proper structure
        objectId = `object_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        linkId = objectId; // For objects, linkId is the same as docId
        
        const objectData = {
          docId: objectId,
          linkId: linkId,
          typeOfObject: objectType,
          isObject: true,
          records: [], // Will be populated with record references
          history: objectHistory,
          lastModifiedBy: businessId,
          assignedTo: formData.assignedTo || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          // Add lastModified as ISO string (app uses this)
          lastModified: new Date().toISOString(),
          // Spread object fields with UUID keys
          ...objectFields
        };
        
        await objectsRef.doc(objectId).set(objectData);
        
        createdObjects.push({
          objectId,
          objectType,
          linkId
        });
        
        functions.logger.info('Created new object instance', {
          objectId,
          linkId,
          objectType,
          objectFields: Object.keys(objectFields)
        });
      }
      
      // Get the selected template to determine typeOfRecord
      let typeOfRecord = objectType; // Default to objectType
      
      if (workflowConfig.mapping.templateId) {
        // Load the templateObject to get the template
        const templateObjectsRef = db.collection('businesses').doc(businessId).collection('templateObjects');
        const templateObjectQuery = await templateObjectsRef.where('name', '==', objectType).get();
        
        if (!templateObjectQuery.empty) {
          const templateObject = templateObjectQuery.docs[0].data();
          const selectedTemplate = templateObject.templates?.find(t => t.docId === workflowConfig.mapping.templateId);
          
          if (selectedTemplate && selectedTemplate.name) {
            typeOfRecord = selectedTemplate.name;
            
            functions.logger.info('Found template', {
              templateId: workflowConfig.mapping.templateId,
              templateName: selectedTemplate.name,
              typeOfRecord: typeOfRecord
            });
          } else {
            functions.logger.warn('Template not found in templateObject', {
              templateId: workflowConfig.mapping.templateId,
              availableTemplates: templateObject.templates?.map(t => ({ docId: t.docId, name: t.name }))
            });
          }
        } else {
          functions.logger.warn('TemplateObject not found', { objectType });
        }
      } else {
        functions.logger.warn('No templateId in workflow config', { 
          mapping: workflowConfig.mapping 
        });
      }
      
      // Now create the record linked to this object
      const recordId = `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const recordData = {
        docId: recordId,
        linkId: linkId, // Links record to its parent object
        typeOfRecord: typeOfRecord,
        typeOfObject: objectType,
        assignedTo: formData.assignedTo || '',
        lastModifiedBy: businessId,
        isObject: false,
        history: recordHistory,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Spread record fields with UUID keys
        ...recordFields
      };

      // Create the record in the appropriate sheet collection
      const recordRef = db.collection('businesses')
        .doc(businessId)
        .collection('records')
        .doc(recordId);

      batch.set(recordRef, recordData);

      createdRecords.push({
        recordId: recordId,
        objectType,
        typeOfRecord: typeOfRecord,
        data: recordData,
        linkId: linkId
      });

      functions.logger.info('Prepared record for creation', {
        recordId: recordRef.id,
        objectType,
        typeOfRecord: typeOfRecord,
        fieldCount: Object.keys(recordData).length
      });

      // Commit all record creations
      if (createdRecords.length > 0) {
        await batch.commit();
        functions.logger.info('Records created successfully', {
          count: createdRecords.length,
          recordIds: createdRecords.map(r => r.recordId)
        });

        // Check if templateObjects exist for each objectType and create them if they don't
        const uniqueObjectTypes = [...new Set(createdRecords.map(r => r.objectType))];
        
        for (const objectType of uniqueObjectTypes) {
          if (!objectType) continue;
          
          try {
            // Check if templateObject already exists
            const templateObjectsRef = db.collection('businesses').doc(businessId).collection('templateObjects');
            const existingObjectQuery = await templateObjectsRef.where('name', '==', objectType).get();
            
            if (existingObjectQuery.empty) {
              // Create new templateObject with comprehensive basic fields
              const newObjectData = {
                name: objectType,
                basicFields: [
                  {
                    key: 'name',
                    name: 'Name',
                    type: 'text',
                    required: true,
                    section: 'Basic Information'
                  },
                  {
                    key: 'description',
                    name: 'Description',
                    type: 'textarea',
                    required: false,
                    section: 'Basic Information'
                  },
                  {
                    key: 'email',
                    name: 'Email',
                    type: 'email',
                    required: false,
                    section: 'Contact Information'
                  },
                  {
                    key: 'phone',
                    name: 'Phone',
                    type: 'text',
                    required: false,
                    section: 'Contact Information'
                  },
                  {
                    key: 'status',
                    name: 'Status',
                    type: 'select',
                    required: false,
                    section: 'Status & Priority',
                    options: ['New', 'In Progress', 'Completed', 'On Hold']
                  },
                  {
                    key: 'priority',
                    name: 'Priority',
                    type: 'select',
                    required: false,
                    section: 'Status & Priority',
                    options: ['Low', 'Medium', 'High', 'Urgent']
                  },
                  {
                    key: 'assignedTo',
                    name: 'Assigned To',
                    type: 'text',
                    required: false,
                    section: 'Assignment'
                  },
                  {
                    key: 'createdAt',
                    name: 'Created Date',
                    type: 'date',
                    required: false,
                    section: 'System Fields'
                  },
                  {
                    key: 'updatedAt',
                    name: 'Last Updated',
                    type: 'date',
                    required: false,
                    section: 'System Fields'
                  }
                ],
                templates: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              };
              
              const newObjectRef = templateObjectsRef.doc();
              await newObjectRef.set(newObjectData);
              
              functions.logger.info('Created new templateObject', {
                objectType,
                objectId: newObjectRef.id,
                businessId,
                basicFieldsCount: newObjectData.basicFields.length
              });
            } else {
              functions.logger.info('TemplateObject already exists', {
                objectType,
                existingCount: existingObjectQuery.size
              });
            }
          } catch (objectError) {
            functions.logger.error('Failed to check/create templateObject', {
              objectType,
              businessId,
              error: objectError.message
            });
            // Don't fail the entire request for this
          }
        }

        // Update the object's records array to include the new record
        for (const recordInfo of createdRecords) {
          try {
            const { recordId, linkId, objectType, typeOfRecord } = recordInfo;
            
            // Find the object by linkId
            const objectRef = db.collection('businesses').doc(businessId).collection('objects').doc(linkId);
            const objectDoc = await objectRef.get();
            
            if (objectDoc.exists) {
              const currentRecords = objectDoc.data().records || [];
              const recordExists = currentRecords.some(r => r.docId === recordId);
              
              if (!recordExists) {
                await objectRef.update({
                  records: [...currentRecords, {
                    docId: recordId,
                    typeOfRecord: typeOfRecord
                  }],
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                functions.logger.info('Added record reference to object', {
                  objectId: linkId,
                  recordId,
                  recordType: typeOfRecord
                });
              }
            }
          } catch (linkError) {
            functions.logger.error('Failed to link record to object', {
              recordId: recordInfo.recordId,
              linkId: recordInfo.linkId,
              error: linkError.message
            });
            // Don't fail the entire request for this
          }
        }

        // Log summary of created objects
        if (createdObjects.length > 0) {
          functions.logger.info('Objects created successfully', {
            count: createdObjects.length,
            objects: createdObjects
          });
        }
      }

      // Handle notifications
      if (workflowConfig.notifications && workflowConfig.notifications.emailOnSubmission && workflowConfig.notifications.emailsToNotify && workflowConfig.notifications.emailsToNotify.length > 0) {
        const notificationPromises = workflowConfig.notifications.emailsToNotify.map(async (email) => {
          try {
            const subject = 'New Form Submission';
            const message = `A new form has been submitted with ${createdRecords.length} record(s) created.`;

            await resend.emails.send({
              from: 'Form Submissions <invitations@apx.gr>',
              to: email,
              subject: subject,
              html: `<h1>${subject}</h1><p>${message}</p><p>Records created: ${createdRecords.length}</p>`
            });

            functions.logger.info('Notification sent', { email });
          } catch (emailError) {
            functions.logger.error('Failed to send notification', {
              email,
              error: emailError.message
            });
          }
        });

        await Promise.all(notificationPromises);
      }

      // Handle auto-actions (basic implementation - can be extended)
      if (workflowConfig.autoActions && workflowConfig.autoActions.assignToUser) {
        functions.logger.info('Processing auto-actions', {
          assignToUser: workflowConfig.autoActions.assignToUser
        });

        // This is a placeholder for auto-action processing
        // Could include things like:
        // - Creating follow-up tasks
        // - Triggering other workflows
        // - Updating related records
        // - Sending automated responses

        functions.logger.info('Auto-action: assign to user', { 
          userId: workflowConfig.autoActions.assignToUser 
        });
        // Implement specific auto-action logic here
      }

      return res.status(200).json({
        success: true,
        message: `Form submitted successfully. Created ${createdRecords.length} record(s) and ${createdObjects.length} object(s).`,
        recordsCreated: createdRecords.length,
        objectsCreated: createdObjects.length,
        recordIds: createdRecords.map(r => r.recordId),
        objectIds: createdObjects.map(o => o.objectId)
      });

    } catch (error) {
      functions.logger.error('submitFormData failed', {
        error: error.message,
        stack: error.stack,
        workflowId: req.query.workflowId
      });
      return res.status(500).json({
        error: `Failed to submit form: ${error.message}`
      });
    }
  });
});
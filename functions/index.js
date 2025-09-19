const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const cors = require('cors');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { Timestamp } = require('firebase-admin/firestore');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const resend = new Resend('re_C1GAhxiY_KvM6xMG96EHQwAZnC6Cp2k5s');
// CORS configuration
const corsOptions = {
  origin: ['https://www.apx.gr', 'http://localhost:5173'], // default for most functions
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};
const corsMiddleware = cors(corsOptions);

// CORS for createNewCard: allow all origins
const corsAllOrigins = cors({
  origin: true,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
});

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
        name: name || '',
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
      typeOfCardsToDisplay: [],
      cardTypeFilters: {},
    };
    const sheetRef = db.collection('businesses').doc(businessId).collection('sheets').doc(sheet1.id);
    batch.set(sheetRef, sheet1);
    const structureRef = db.collection('businesses').doc(businessId).collection('sheetsStructure').doc('structure');
    batch.set(structureRef, { structure: [{ sheetName: 'Sheet 1' }] });

    // Cards: do not add any initial cards
    // Card Templates: do not add any initial templates

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

      const { businessId, profiles, updates } = body || {};

      functions.logger.info('Parsed body with detailed types', { 
        businessId, 
        profiles, 
        updates,
        profilesType: typeof profiles,
        profilesIsArray: Array.isArray(profiles),
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

      // Validate that at least profiles or updates are provided
      const hasProfiles = profiles && Array.isArray(profiles);
      const hasUpdates = updates && Array.isArray(updates);
      
      functions.logger.info('Validation check', { 
        hasProfiles, 
        hasUpdates,
        profilesLength: hasProfiles ? profiles.length : 'N/A',
        updatesLength: hasUpdates ? updates.length : 'N/A'
      });
      
      if (!hasProfiles && !hasUpdates) {
        functions.logger.error('Neither profiles nor updates provided', { 
          profiles, 
          updates, 
          hasProfiles, 
          hasUpdates,
          profilesType: typeof profiles,
          updatesType: typeof updates
        });
        return res.status(400).json({
          error: 'Missing required fields: updates',
        });
      }

      functions.logger.info('Validation passed:', { 
        hasProfiles, 
        profilesLength: hasProfiles ? profiles.length : 0,
        hasUpdates, 
        updatesLength: hasUpdates ? updates.length : 0 
      });

      const businessDoc = await admin.firestore().collection('businesses').doc(businessId).get();
      if (!businessDoc.exists) {
        functions.logger.error('Business not found:', { businessId });
        return res.status(404).json({ error: 'Business not found' });
      }

      const batch = admin.firestore().batch();
      let totalUpdatedCards = 0;
      let totalUpdatedTemplates = 0;
      let totalUpdatedProfiles = 0;
      const messages = [];

      // Handle profile updates if profiles are provided
      if (profiles && Array.isArray(profiles)) {
        for (const profile of profiles) {
          const { id, name, templates, pipelines, action } = profile;

          if (!id || !name) {
            functions.logger.warn('Skipping profile: Missing id or name', { id, name });
            continue;
          }

          const profileRef = admin
            .firestore()
            .collection('businesses')
            .doc(businessId)
            .collection('templateProfiles')
            .doc(id);

          if (action === 'remove') {
            functions.logger.info('Deleting templateProfile:', { id });
            batch.delete(profileRef);
            messages.push(`Deleted profile: ${name}`);
          } else {
            // Check if profile name has changed by comparing with existing profile
            let profileNameChanged = false;
            let previousName = null;
            
            try {
              const existingProfileDoc = await profileRef.get();
              if (existingProfileDoc.exists) {
                const existingData = existingProfileDoc.data();
                previousName = existingData.name;
                profileNameChanged = previousName && previousName !== name;
              }
            } catch (error) {
              functions.logger.warn('Error checking existing profile:', { error: error.message });
            }

            functions.logger.info('Upserting templateProfile:', { 
              id, 
              name, 
              previousName,
              profileNameChanged,
              templateCount: templates?.length || 0, 
              pipelineCount: pipelines?.length || 0 
            });

            // Debug: Log the comparison details
            functions.logger.info('Profile name change detection:', {
              profileId: id,
              incomingName: name,
              existingName: previousName,
              namesAreDifferent: previousName !== name,
              hasTemplates: templates && Array.isArray(templates) && templates.length > 0,
              profileNameChanged
            });

            // If profile name changed, update typeOfProfile in all cards that use templates from this profile
            if (profileNameChanged && templates && Array.isArray(templates)) {
              functions.logger.info('Profile name changed, updating typeOfProfile in cards:', { 
                profileId: id, 
                previousName, 
                newName: name,
                templateCount: templates.length
              });

              for (const template of templates) {
                if (template.typeOfCards) {
                  const cardsRef = admin
                    .firestore()
                    .collection('businesses')
                    .doc(businessId)
                    .collection('cards')
                    .where('typeOfCards', '==', template.typeOfCards);
                  
                  try {
                    const cardsSnapshot = await cardsRef.get();
                    if (!cardsSnapshot.empty) {
                      functions.logger.info('Updating typeOfProfile in cards:', {
                        typeOfCards: template.typeOfCards,
                        cardCount: cardsSnapshot.size,
                        from: previousName,
                        to: name
                      });

                      cardsSnapshot.forEach((cardDoc) => {
                        const cardData = cardDoc.data();
                        // Only update if the card's typeOfProfile matches the previous profile name
                        if (cardData.typeOfProfile === previousName) {
                          batch.update(cardDoc.ref, {
                            typeOfProfile: name
                          });
                          totalUpdatedCards += 1;
                        }
                      });

                      messages.push(`Updated typeOfProfile from "${previousName}" to "${name}" in ${cardsSnapshot.size} cards for template "${template.typeOfCards}"`);
                    }
                  } catch (error) {
                    functions.logger.error('Error updating cards for template:', { 
                      typeOfCards: template.typeOfCards, 
                      error: error.message 
                    });
                  }
                }
              }
            }

            batch.set(profileRef, {
              id,
              name,
              templates: templates || [],
              pipelines: pipelines || [],
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            messages.push(`Updated profile: ${name} with ${templates?.length || 0} templates and ${pipelines?.length || 0} pipelines`);
          }
          totalUpdatedProfiles += 1;
        }
      }

      // Handle legacy template updates if updates are provided (for backward compatibility)
      if (updates && Array.isArray(updates)) {
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
      }

      if (totalUpdatedProfiles > 0 || totalUpdatedTemplates > 0) {
        functions.logger.info('Committing batch with updates:', { 
          totalUpdatedCards, 
          totalUpdatedTemplates, 
          totalUpdatedProfiles 
        });
        await batch.commit();
        functions.logger.info('Batch committed successfully:', { 
          totalUpdatedCards, 
          totalUpdatedTemplates, 
          totalUpdatedProfiles 
        });
      } else {
        functions.logger.info('No batch operations to commit - this is normal for empty profile arrays');
      }
      return res.status(200).json({
        success: true,
        message: messages.length > 0 ? messages.join('; ') : 'No updates performed',
        updatedCardsCount: totalUpdatedCards,
        updatedTemplatesCount: totalUpdatedTemplates,
        updatedProfilesCount: totalUpdatedProfiles,
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

exports.createNewCard = functions.https.onRequest((req, res) => {
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
        } catch (error) {
          return res.status(400).json({ error: 'Invalid JSON payload' });
        }
      } else {
        return res.status(400).json({ error: 'Content-Type must be application/json' });
      }
      const { businessId, cardData, fieldsToConvertToTimeStamps } = body || {};
      if (!businessId || !cardData || typeof cardData !== 'object') {
        return res.status(400).json({
          error: `Missing or invalid required fields: ${!businessId ? 'businessId ' : ''}${!cardData ? 'cardData' : ''}`
        });
      }

      // Check for required fields in cardData
      if (!cardData.typeOfCards) {
        return res.status(400).json({
          error: 'Missing required cardData fields: typeOfCards is required.'
        });
      }

      // Convert specified fields to Firestore Timestamp if fieldsToConvertToTimeStamps is provided
      if (Array.isArray(fieldsToConvertToTimeStamps)) {
        fieldsToConvertToTimeStamps.forEach(key => {
          if (cardData[key]) {
            // Accept ISO string, JS timestamp, or {seconds, nanoseconds}
            if (typeof cardData[key] === 'string' && !isNaN(Date.parse(cardData[key]))) {
              cardData[key] = Timestamp.fromDate(new Date(cardData[key]));
            } else if (
              typeof cardData[key] === 'object' &&
              typeof cardData[key].seconds === 'number' &&
              typeof cardData[key].nanoseconds === 'number'
            ) {
              cardData[key] = new Timestamp(cardData[key].seconds, cardData[key].nanoseconds);
            } else if (typeof cardData[key] === 'number') {
              // If it's a JS timestamp (ms since epoch)
              cardData[key] = Timestamp.fromDate(new Date(cardData[key]));
            }
          }
        });
      }

      // Create history from cardData fields (excluding 'id' and 'history')
      const now = Timestamp.now();
      const history = Object.keys(cardData)
        .filter((key) => key !== 'id' && key !== 'history')
        .map((key) => ({
          field: key,
          value: cardData[key],
          timestamp: now,
        }));
      cardData.history = history;

      functions.logger.info('createNewCard payload', { cardData, fullBody: body });

      const cardsCollectionRef = admin.firestore().collection('businesses').doc(businessId).collection('cards');
      const newCardRef = await cardsCollectionRef.add(cardData);

      // Support both top-level and nested emailsToNotify
      const emailsToNotify = Array.isArray(body.emailsToNotify)
        ? body.emailsToNotify
        : (Array.isArray(body.data?.emailsToNotify) ? body.data.emailsToNotify : []);

      if (emailsToNotify.length > 0) {
        const sheetName = cardData.sheetName || 'unknown';
        const docId = newCardRef.id;
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
        message: 'Card created successfully',
        cardId: newCardRef.id,
      });
    } catch (error) {
      functions.logger.error('createNewCard failed', {
        error: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ error: `Failed to create new card: ${error.message}` });
    }
  });
});
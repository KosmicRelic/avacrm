import React, { useContext, useEffect, useState } from 'react';
import { MainContext } from '../Contexts/MainContext';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { doc, setDoc ,getDoc, collection, query, getDocs, updateDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import styles from './Settings.module.css';
import { Navigate } from 'react-router-dom';

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useContext(MainContext);
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // State for managing team member access
  const [teamMembers, setTeamMembers] = useState([]);
  const [availableSheets, setAvailableSheets] = useState([]);
  const [availableDashboards, setAvailableDashboards] = useState([]);
  const [availableCardTemplates, setAvailableCardTemplates] = useState([]);
  const [editingTeamMemberUid, setEditingTeamMemberUid] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [selectedDashboards, setSelectedDashboards] = useState([]);
  const [selectedCardTemplates, setSelectedCardTemplates] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState('viewer');

  // Restrict to business owners
  // if (!user || user.userType !== 'business') {
  //   return <Navigate to="/dashboard" />;
  // }

  // Fetch team members and available resources on component mount
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch team members from businesses/{businessId}/teamMembers
        const teamMembersRef = collection(db, 'businesses', user.uid, 'teamMembers');
        const teamMembersSnap = await getDocs(teamMembersRef);
        const teamMembersData = teamMembersSnap.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
        }));
        setTeamMembers(teamMembersData);

        // Fetch available sheets
        const sheetsRef = collection(db, 'businesses', user.uid, 'sheets');
        const sheetsSnap = await getDocs(sheetsRef);
        const sheetsData = sheetsSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().sheetName || `Sheet ${doc.id}`,
        }));
        setAvailableSheets(sheetsData);

        // Fetch available dashboards
        const dashboardsRef = collection(db, 'businesses', user.uid, 'dashboards');
        const dashboardsSnap = await getDocs(dashboardsRef);
        const dashboardsData = dashboardsSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || `Dashboard ${doc.id}`,
        }));
        setAvailableDashboards(dashboardsData);

        // Fetch available card templates
        const cardTemplatesRef = collection(db, 'businesses', user.uid, 'cardTemplates');
        const cardTemplatesSnap = await getDocs(cardTemplatesRef);
        const cardTemplatesData = cardTemplatesSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || `Template ${doc.id}`,
        }));
        setAvailableCardTemplates(cardTemplatesData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load team members or resources: ' + err.message);
      }
    };

    fetchData();
  }, [user]);

  // Start editing a team member's access
  const startEditing = async (uid) => {
    try {
      const teamMemberDoc = await getDoc(doc(db, 'businesses', user.uid, 'teamMembers', uid));
      if (teamMemberDoc.exists()) {
        const teamMemberData = teamMemberDoc.data();
        setSelectedSheets(teamMemberData.allowedSheetIds || []);
        setSelectedDashboards(teamMemberData.allowedDashboardIds || []);
        setSelectedCardTemplates(teamMemberData.allowedCardTemplateIds || []);
        setSelectedPermissions(teamMemberData.permissions || 'viewer');
        setEditingTeamMemberUid(uid);
      } else {
        setError('Team member data not found');
      }
    } catch (err) {
      console.error('Error fetching team member data:', err);
      setError('Failed to load team member data: ' + err.message);
    }
  };

// Save updated access permissions to teamMembers
const saveAccess = async () => {
  try {
    // Fetch the current team member document to preserve existing fields
    const teamMemberRef = doc(db, 'businesses', user.uid, 'teamMembers', editingTeamMemberUid);
    const teamMemberDoc = await getDoc(teamMemberRef);
    if (!teamMemberDoc.exists()) {
      throw new Error('Team member data not found');
    }
    const currentData = teamMemberDoc.data();

    // Construct new document data
    const newData = {
      ...currentData, // Preserve fields like email, phone, joinedAt, etc.
      allowedSheetIds: selectedSheets.includes('all') ? availableSheets.map(s => s.id) : selectedSheets,
      allowedDashboardIds: selectedDashboards.includes('all') ? availableDashboards.map(d => d.id) : selectedDashboards,
      allowedCardTemplateIds: selectedCardTemplates.includes('all') ? availableCardTemplates.map(t => t.id) : selectedCardTemplates,
      permissions: selectedPermissions,
    };

    // Replace the entire document
    await setDoc(teamMemberRef, newData, { merge: false });

    // Update local state
    setTeamMembers(
      teamMembers.map(tm =>
        tm.uid === editingTeamMemberUid
          ? {
              ...tm,
              allowedSheetIds: newData.allowedSheetIds,
              allowedDashboardIds: newData.allowedDashboardIds,
              allowedCardTemplateIds: newData.allowedCardTemplateIds,
              permissions: newData.permissions,
            }
          : tm
      )
    );
    setEditingTeamMemberUid(null);
    setSuccessMessage('Access updated successfully');

    // Force refresh for the team member if they are the current user
    if (editingTeamMemberUid === user.uid) {
      window.location.reload(); // Reload to apply new permissions
    }
  } catch (err) {
    console.error('Error updating access:', err);
    setError('Failed to update access: ' + err.message);
  }
};

  // Invitation handler
  const handleGenerateInvitation = async () => {
    if (!user) {
      setError(t('settings.pleaseLogin'));
      return;
    }

    if (!email) {
      setError(t('settings.enterValidEmail'));
      return;
    }

    setIsGenerating(true);
    setError('');
    setSuccessMessage('');

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      if (currentUser.uid !== user.uid) {
        console.warn('UID mismatch between MainContext and Firebase Auth');
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        throw new Error('User data not found');
      }
      const businessId = userDoc.data().uid;

      const response = await fetch(
        'https://us-central1-avacrm-6900e.cloudfunctions.net/sendInvitationEmail',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            businessId,
            invitedBy: user.uid,
            businessEmail: user.email,
            permissions: {
              role: 'editor',
              allowedSheetIds: [],
              allowedDashboardIds: [],
              allowedCardTemplateIds: [],
            },
          }),
        }
      );

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setSuccessMessage(result.message);
      } else {
        throw new Error(result.error || 'Failed to send invitation');
      }
    } catch (err) {
      console.error('Error calling sendInvitationEmail:', err);
      setError(t('settings.errorSendingInvitation', { message: err.message || 'Unknown error' }));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1>{t('settings.title')}</h1>

      {/* Invitation Section */}
      <div className={styles.section}>
        <h2>{t('settings.teamInvitations')}</h2>
        <div className={styles.inputGroup}>
          <label htmlFor="email">{t('settings.recipientEmail')}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('settings.enterEmail')}
            className={styles.input}
          />
        </div>
        <button
          onClick={handleGenerateInvitation}
          disabled={isGenerating}
          className={styles.button}
        >
          {isGenerating ? t('settings.sending') : t('settings.sendInvitation')}
        </button>
        {successMessage && <p className={styles.success}>{successMessage}</p>}
        {error && <p className={styles.error}>{error}</p>}
      </div>

      {/* Manage Team Member Access Section */}
      <div className={styles.section}>
        <h2>Manage Team Member Access</h2>
        {teamMembers.map(tm => (
          <div key={tm.uid} className={styles.teamMember}>
            <span>{tm.email}</span>
            <button onClick={() => startEditing(tm.uid)}>Edit Access</button>
          </div>
        ))}

        {editingTeamMemberUid && (
          <div className={styles.editAccess}>
            <h3>
              Edit Access for{' '}
              {teamMembers.find(tm => tm.uid === editingTeamMemberUid)?.email}
            </h3>

            {/* Permissions Selection */}
            <div>
              <label>Role</label>
              <select
                value={selectedPermissions}
                onChange={e => setSelectedPermissions(e.target.value)}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </div>

            {/* Sheets Selection */}
            <div>
              <label>Sheets</label>
              <select
                multiple
                value={selectedSheets}
                onChange={e =>
                  setSelectedSheets(
                    Array.from(e.target.selectedOptions, option => option.value)
                  )
                }
              >
                <option value="all">All Sheets</option>
                {availableSheets.map(sheet => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Dashboards Selection */}
            <div>
              <label>Dashboards</label>
              <select
                multiple
                value={selectedDashboards}
                onChange={e =>
                  setSelectedDashboards(
                    Array.from(e.target.selectedOptions, option => option.value)
                  )
                }
              >
                <option value="all">All Dashboards</option>
                {availableDashboards.map(dashboard => (
                  <option key={dashboard.id} value={dashboard.id}>
                    {dashboard.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Card Templates Selection */}
            <div>
              <label>Card Templates</label>
              <select
                multiple
                value={selectedCardTemplates}
                onChange={e =>
                  setSelectedCardTemplates(
                    Array.from(e.target.selectedOptions, option => option.value)
                  )
                }
              >
                <option value="all">All Card Templates</option>
                {availableCardTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            <button onClick={saveAccess}>Save</button>
            <button onClick={() => setEditingTeamMemberUid(null)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
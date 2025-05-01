import React, { useContext, useEffect, useState } from 'react';
import { MainContext } from '../Contexts/MainContext';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import styles from './Settings.module.css';
import { Navigate } from 'react-router-dom';
import { FaRegCircle, FaRegCheckCircle } from 'react-icons/fa';

export default function Settings() {
  const { t } = useTranslation();
  const { user, isDarkTheme } = useContext(MainContext);
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [availableSheets, setAvailableSheets] = useState([]);
  const [availableDashboards, setAvailableDashboards] = useState([]);
  const [availableCardTemplates, setAvailableCardTemplates] = useState([]);
  const [selectedTeamMemberUids, setSelectedTeamMemberUids] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [selectedDashboards, setSelectedDashboards] = useState([]);
  const [selectedCardTemplates, setSelectedCardTemplates] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState('viewer');

  // if (!user || user.userType !== 'business') {
  //   return <Navigate to="/dashboard" />;
  // }

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const teamMembersRef = collection(db, 'businesses', user.uid, 'teamMembers');
        const teamMembersSnap = await getDocs(teamMembersRef);
        setTeamMembers(teamMembersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));

        const sheetsRef = collection(db, 'businesses', user.uid, 'sheets');
        const sheetsSnap = await getDocs(sheetsRef);
        setAvailableSheets(sheetsSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().sheetName || `Sheet ${doc.id}`,
        })));

        const dashboardsRef = collection(db, 'businesses', user.uid, 'dashboards');
        const dashboardsSnap = await getDocs(dashboardsRef);
        setAvailableDashboards(dashboardsSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || `Dashboard ${doc.id}`,
        })));

        const cardTemplatesRef = collection(db, 'businesses', user.uid, 'cardTemplates');
        const cardTemplatesSnap = await getDocs(cardTemplatesRef);
        setAvailableCardTemplates(cardTemplatesSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || `Template ${doc.id}`,
        })));
      } catch (err) {
        setErrorMessage(t('settings.errorFetchingData', { message: err.message }));
      }
    };
    fetchData();
  }, [user, t]);

  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  const toggleTeamMemberSelection = (uid) => {
    setSelectedTeamMemberUids(prev => {
      if (prev.includes(uid)) {
        return prev.filter(id => id !== uid);
      } else {
        return [...prev, uid];
      }
    });

    if (!selectedTeamMemberUids.includes(uid)) {
      const teamMember = teamMembers.find(tm => tm.uid === uid);
      if (teamMember) {
        setSelectedSheets(teamMember.allowedSheetIds || []);
        setSelectedDashboards(teamMember.allowedDashboardIds || []);
        setSelectedCardTemplates(teamMember.allowedCardTemplateIds || []);
        setSelectedPermissions(teamMember.permissions || 'viewer');
      }
    }
  };

  const toggleOption = (type, value) => {
    const setters = {
      sheets: setSelectedSheets,
      dashboards: setSelectedDashboards,
      cardTemplates: setSelectedCardTemplates,
    };
    const selected = {
      sheets: selectedSheets,
      dashboards: selectedDashboards,
      cardTemplates: selectedCardTemplates,
    }[type];
    const items = {
      sheets: availableSheets,
      dashboards: availableDashboards,
      cardTemplates: availableCardTemplates,
    }[type];

    if (value === 'all') {
      setters[type](prev => {
        if (prev.includes('all') || prev.length === items.length) {
          return [];
        } else {
          return ['all', ...items.map(item => item.id)];
        }
      });
    } else {
      setters[type](prev => {
        if (prev.includes(value)) {
          return prev.filter(v => v !== value && v !== 'all');
        } else {
          const newSelected = [...prev.filter(v => v !== 'all'), value];
          if (newSelected.length === items.length) {
            return ['all', ...newSelected];
          }
          return newSelected;
        }
      });
    }
  };

  const saveAccess = async () => {
    if (selectedTeamMemberUids.length === 0) {
      setErrorMessage(t('settings.noTeamMembersSelected', { defaultValue: 'Please select at least one team member' }));
      return;
    }
    try {
      for (const uid of selectedTeamMemberUids) {
        const teamMemberRef = doc(db, 'businesses', user.uid, 'teamMembers', uid);
        const teamMemberDoc = await getDoc(teamMemberRef);
        if (!teamMemberDoc.exists()) {
          throw new Error(t('settings.teamMemberNotFound'));
        }
        const currentData = teamMemberDoc.data();

        const newData = {
          ...currentData,
          allowedSheetIds: selectedSheets.includes('all') ? availableSheets.map(s => s.id) : selectedSheets.filter(id => id !== 'all'),
          allowedDashboardIds: selectedDashboards.includes('all') ? availableDashboards.map(d => d.id) : selectedDashboards.filter(id => id !== 'all'),
          allowedCardTemplateIds: selectedCardTemplates.includes('all') ? availableCardTemplates.map(t => t.id) : selectedCardTemplates.filter(id => id !== 'all'),
          permissions: selectedPermissions,
        };

        await setDoc(teamMemberRef, newData, { merge: false });

        setTeamMembers(prev =>
          prev.map(tm => (tm.uid === uid ? { ...tm, ...newData } : tm))
        );
      }
      setSuccessMessage(t('settings.accessUpdated'));
      setSelectedTeamMemberUids([]); // Clear selections after successful save
      setSelectedSheets([]);
      setSelectedDashboards([]);
      setSelectedCardTemplates([]);
      setSelectedPermissions('viewer');
      if (selectedTeamMemberUids.includes(user.uid)) {
        window.location.reload();
      }
    } catch (err) {
      setErrorMessage(t('settings.errorUpdatingAccess', { message: err.message }));
    }
  };

  const cancelEditing = () => {
    setSelectedTeamMemberUids([]);
    setSelectedSheets([]);
    setSelectedDashboards([]);
    setSelectedCardTemplates([]);
    setSelectedPermissions('viewer');
  };

  const handleGenerateInvitation = async () => {
    if (!user) {
      setErrorMessage(t('settings.pleaseLogin'));
      return;
    }
    if (!email) {
      setErrorMessage(t('settings.enterValidEmail'));
      return;
    }
    setIsGenerating(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error(t('settings.noAuthenticatedUser'));
      }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        throw new Error(t('settings.userDataNotFound'));
      }
      const businessId = userDoc.data().uid;
      const response = await fetch(
        'https://us-central1-avacrm-6900e.cloudfunctions.net/sendInvitationEmail',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        throw new Error(result.error || t('settings.failedToSendInvitation'));
      }
    } catch (err) {
      setErrorMessage(t('settings.errorSendingInvitation', { message: err.message }));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {/* Banner for success/error messages */}
      {(successMessage || errorMessage) && (
        <div
          className={`${styles.banner} ${
            successMessage ? styles.success : styles.error
          } ${isDarkTheme ? styles.darkTheme : ''}`}
        >
          {successMessage || errorMessage}
        </div>
      )}

      {/* Title */}
      <div className={`${styles.navBar} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <h1 className={`${styles.navTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
          {t('settings.title')}
        </h1>
      </div>

      {/* Invitation Section */}
      <div className={`${styles.section} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <h2>{t('settings.teamInvitations')}</h2>
        <div className={styles.inputGroup}>
          <label htmlFor="email">{t('settings.recipientEmail')}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('settings.enterEmail')}
            className={`${styles.input} ${isDarkTheme ? styles.darkTheme : ''}`}
            aria-label={t('settings.recipientEmail')}
          />
        </div>
        <button
          onClick={handleGenerateInvitation}
          disabled={isGenerating}
          className={`${styles.button} ${isDarkTheme ? styles.darkTheme : ''}`}
          aria-label={isGenerating ? t('settings.sending') : t('settings.sendInvitation')}
        >
          {isGenerating ? t('settings.sending') : t('settings.sendInvitation')}
        </button>
      </div>

      {/* Manage Team Access Section */}
      <div className={`${styles.manageTeamsSection} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <h2>{t('settings.manageTeamAccess')}</h2>
        <div className={styles.teamAccessContainer}>
          <div className={`${styles.leftPane} ${isDarkTheme ? styles.darkTheme : ''}`}>
            {teamMembers.map(tm => (
              <button
                key={tm.uid}
                onClick={() => toggleTeamMemberSelection(tm.uid)}
                className={`${styles.teamMemberButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                  selectedTeamMemberUids.includes(tm.uid) ? styles.selected : ''
                }`}
                aria-label={t('settings.editAccessFor', { email: tm.email })}
              >
                <span>{tm.email}</span>
                {selectedTeamMemberUids.includes(tm.uid) ? (
                  <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                ) : (
                  <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                )}
              </button>
            ))}
          </div>
          <div className={`${styles.rightPane} ${isDarkTheme ? styles.darkTheme : ''}`}>
            {selectedTeamMemberUids.length > 0 ? (
              <div className={`${styles.editAccess} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <h3>
                  {selectedTeamMemberUids.length === 1
                    ? t('settings.editAccessFor', {
                        email: teamMembers.find(tm => tm.uid === selectedTeamMemberUids[0])?.email,
                      })
                    : t('settings.editAccessForMultiple', {
                        count: selectedTeamMemberUids.length,
                        defaultValue: 'Editing Access for {count} Team Members',
                      })}
                </h3>
                <div className={styles.inputGroup}>
                  <label>{t('settings.role')}</label>
                  {['viewer', 'editor'].map(role => (
                    <button
                      key={role}
                      onClick={() => setSelectedPermissions(role)}
                      className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                        selectedPermissions === role ? styles.selected : ''
                      }`}
                      aria-label={t(`settings.${role}`)}
                    >
                      <span>{t(`settings.${role}`)}</span>
                      {selectedPermissions === role ? (
                        <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                      ) : (
                        <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                      )}
                    </button>
                  ))}
                </div>
                <div className={styles.inputGroup}>
                  <label>{t('settings.sheets')}</label>
                  <button
                    onClick={() => toggleOption('sheets', 'all')}
                    className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                      selectedSheets.includes('all') ? styles.selected : ''
                    }`}
                    aria-label={t('settings.allSheets')}
                  >
                    <span>{t('settings.allSheets')}</span>
                    {selectedSheets.includes('all') ? (
                      <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                    ) : (
                      <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                    )}
                  </button>
                  {availableSheets.map(sheet => (
                    <button
                      key={sheet.id}
                      onClick={() => toggleOption('sheets', sheet.id)}
                      className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                        selectedSheets.includes(sheet.id) ? styles.selected : ''
                      }`}
                      aria-label={sheet.name}
                    >
                      <span>{sheet.name}</span>
                      {selectedSheets.includes(sheet.id) ? (
                        <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                      ) : (
                        <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                      )}
                    </button>
                  ))}
                </div>
                <div className={styles.inputGroup}>
                  <label>{t('settings.dashboards')}</label>
                  <button
                    onClick={() => toggleOption('dashboards', 'all')}
                    className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                      selectedDashboards.includes('all') ? styles.selected : ''
                    }`}
                    aria-label={t('settings.allDashboards')}
                  >
                    <span>{t('settings.allDashboards')}</span>
                    {selectedDashboards.includes('all') ? (
                      <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                    ) : (
                      <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                    )}
                  </button>
                  {availableDashboards.map(dashboard => (
                    <button
                      key={dashboard.id}
                      onClick={() => toggleOption('dashboards', dashboard.id)}
                      className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                        selectedDashboards.includes(dashboard.id) ? styles.selected : ''
                      }`}
                      aria-label={dashboard.name}
                    >
                      <span>{dashboard.name}</span>
                      {selectedDashboards.includes(dashboard.id) ? (
                        <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                      ) : (
                        <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                      )}
                    </button>
                  ))}
                </div>
                <div className={styles.inputGroup}>
                  <label>{t('settings.cardTemplates')}</label>
                  <button
                    onClick={() => toggleOption('cardTemplates', 'all')}
                    className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                      selectedCardTemplates.includes('all') ? styles.selected : ''
                    }`}
                    aria-label={t('settings.allCardTemplates')}
                  >
                    <span>{t('settings.allCardTemplates')}</span>
                    {selectedCardTemplates.includes('all') ? (
                      <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                    ) : (
                      <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                    )}
                  </button>
                  {availableCardTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => toggleOption('cardTemplates', template.id)}
                      className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                        selectedCardTemplates.includes(template.id) ? styles.selected : ''
                      }`}
                      aria-label={template.name}
                    >
                      <span>{template.name}</span>
                      {selectedCardTemplates.includes(template.id) ? (
                        <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                      ) : (
                        <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                      )}
                    </button>
                  ))}
                </div>
                <div className={styles.buttonGroup}>
                  <button
                    onClick={saveAccess}
                    className={`${styles.button} ${isDarkTheme ? styles.darkTheme : ''}`}
                    aria-label={t('settings.save')}
                  >
                    {t('settings.save')}
                  </button>
                  <button
                    onClick={cancelEditing}
                    className={`${styles.button} ${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    aria-label={t('settings.cancel')}
                  >
                    {t('settings.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <p className={`${styles.noSelection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                {t('settings.selectTeamMember', { defaultValue: 'Select team members to edit access' })}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
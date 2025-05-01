import React, { useContext, useEffect, useState } from 'react';
import { MainContext } from '../Contexts/MainContext';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import styles from './Settings.module.css';
import { Navigate } from 'react-router-dom';
import { FaRegCircle, FaRegCheckCircle, FaChevronRight, FaArrowLeft } from 'react-icons/fa';

export default function Settings() {
  const { t } = useTranslation();
  const { user, isDarkTheme } = useContext(MainContext);
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessages, setErrorMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [availableSheets, setAvailableSheets] = useState([]);
  const [availableDashboards, setAvailableDashboards] = useState([]);
  const [availableCardTemplates, setAvailableCardTemplates] = useState([]);
  const [selectedTeamMemberUids, setSelectedTeamMemberUids] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [selectedDashboards, setSelectedDashboards] = useState([]);
  const [selectedCardTemplates, setSelectedCardTemplates] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState('viewer');
  const [currentStep, setCurrentStep] = useState('main');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [animationDirection, setAnimationDirection] = useState('enter');
  const [animationType, setAnimationType] = useState('slide'); // slide, none

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // if (!user || user.userType !== 'business') {
  //   return <Navigate to="/dashboard" />;
  // }

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !user.uid) {
        setErrorMessages([t('settings.noAuthenticatedUser', { defaultValue: 'No authenticated user found' })]);
        return;
      }

      const errors = [];

      // Fetch team members
      try {
        const teamMembersRef = collection(db, 'businesses', user.uid, 'teamMembers');
        const teamMembersSnap = await getDocs(teamMembersRef);
        const teamMembersData = teamMembersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        setTeamMembers(teamMembersData);
        console.log('Team Members Fetched:', teamMembersData.length);
      } catch (err) {
        console.error('Error fetching teamMembers:', err);
        errors.push(
          t('settings.errorFetchingData', {
            message: `teamMembers: ${err.message || 'Permission denied'}`,
            defaultValue: 'Failed to load team members or resources: {message}',
          })
        );
        setTeamMembers([]);
      }

      // Fetch pending invitations
      try {
        const invitationsRef = collection(db, 'businesses', user.uid, 'invitations');
        const invitationsSnap = await getDocs(invitationsRef);
        const invitationsData = invitationsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(inv => inv.status === 'pending');
        setPendingInvitations(invitationsData);
        console.log('Invitations Fetched:', invitationsData.length);
      } catch (err) {
        console.error('Error fetching invitations:', err);
        errors.push(
          t('settings.errorFetchingData', {
            message: `invitations: ${err.message || 'Permission denied'}`,
            defaultValue: 'Failed to load team members or resources: {message}',
          })
        );
        setPendingInvitations([]);
      }

      // Fetch sheets
      try {
        const sheetsRef = collection(db, 'businesses', user.uid, 'sheets');
        const sheetsSnap = await getDocs(sheetsRef);
        setAvailableSheets(
          sheetsSnap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().sheetName || `Sheet ${doc.id}`,
          }))
        );
      } catch (err) {
        console.error('Error fetching sheets:', err);
        errors.push(
          t('settings.errorFetchingData', {
            message: `sheets: ${err.message || 'Permission denied'}`,
            defaultValue: 'Failed to load team members or resources: {message}',
          })
        );
        setAvailableSheets([]);
      }

      // Fetch dashboards
      try {
        const dashboardsRef = collection(db, 'businesses', user.uid, 'dashboards');
        const dashboardsSnap = await getDocs(dashboardsRef);
        setAvailableDashboards(
          dashboardsSnap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || `Dashboard ${doc.id}`,
          }))
        );
      } catch (err) {
        console.error('Error fetching dashboards:', err);
        errors.push(
          t('settings.errorFetchingData', {
            message: `dashboards: ${err.message || 'Permission denied'}`,
            defaultValue: 'Failed to load team members or resources: {message}',
          })
        );
        setAvailableDashboards([]);
      }

      // Fetch card templates
      try {
        const cardTemplatesRef = collection(db, 'businesses', user.uid, 'cardTemplates');
        const cardTemplatesSnap = await getDocs(cardTemplatesRef);
        setAvailableCardTemplates(
          cardTemplatesSnap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || `Template ${doc.id}`,
          }))
        );
      } catch (err) {
        console.error('Error fetching cardTemplates:', err);
        errors.push(
          t('settings.errorFetchingData', {
            message: `cardTemplates: ${err.message || 'Permission denied'}`,
            defaultValue: 'Failed to load team members or resources: {message}',
          })
        );
        setAvailableCardTemplates([]);
      }

      if (errors.length > 0) {
        setErrorMessages(errors);
      }
    };
    fetchData();
  }, [user, t]);

  useEffect(() => {
    if (successMessage || errorMessages.length > 0) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrorMessages([]);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessages]);

  const toggleTeamMemberSelection = (uid) => {
    setSelectedTeamMemberUids([uid]);
    const teamMember = teamMembers.find(tm => tm.uid === uid);
    if (teamMember) {
      setSelectedSheets(teamMember.allowedSheetIds || []);
      setSelectedDashboards(teamMember.allowedDashboardIds || []);
      setSelectedCardTemplates(teamMember.allowedCardTemplateIds || []);
      setSelectedPermissions(teamMember.permissions || 'viewer');
    }
    setAnimationDirection('enter');
    setAnimationType('none'); // No animation for manageTeam to editAccess
    setCurrentStep('editAccess');
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
      setErrorMessages([t('settings.noTeamMembersSelected', { defaultValue: 'Please select at least one team member' })]);
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
      setSelectedTeamMemberUids([]);
      setSelectedSheets([]);
      setSelectedDashboards([]);
      setSelectedCardTemplates([]);
      setSelectedPermissions('viewer');
      setAnimationDirection('exit');
      setAnimationType('none'); // No animation for editAccess to manageTeam
      setCurrentStep('manageTeam');
      if (selectedTeamMemberUids.includes(user.uid)) {
        window.location.reload();
      }
    } catch (err) {
      setErrorMessages([t('settings.errorUpdatingAccess', { message: err.message || 'Unknown error' })]);
    }
  };

  const cancelEditing = () => {
    setSelectedTeamMemberUids([]);
    setSelectedSheets([]);
    setSelectedDashboards([]);
    setSelectedCardTemplates([]);
    setSelectedPermissions('viewer');
    setAnimationDirection('exit');
    setAnimationType('none');
    setCurrentStep('manageTeam');
  };

  const handleGenerateInvitation = async () => {
    if (!user) {
      setErrorMessages([t('settings.pleaseLogin')]);
      return;
    }
    if (!email) {
      setErrorMessages([t('settings.enterValidEmail')]);
      return;
    }
    setIsGenerating(true);
    setErrorMessages([]);
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
        setEmail('');
        const invitationsRef = collection(db, 'businesses', user.uid, 'invitations');
        const invitationsSnap = await getDocs(invitationsRef);
        setPendingInvitations(
          invitationsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(inv => inv.status === 'pending')
        );
      } else {
        throw new Error(result.error || t('settings.failedToSendInvitation'));
      }
    } catch (err) {
      setErrorMessages([t('settings.errorSendingInvitation', { message: err.message || 'Unknown error' })]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStepChange = (step) => {
    const isForward = (
      (currentStep === 'main' && (step === 'invitations' || step === 'manageTeam')) ||
      (currentStep === 'main' && (step === 'sendInvitation' || step === 'viewInvitations' || step === 'editAccess')) ||
      (currentStep === 'invitations' && (step === 'sendInvitation' || step === 'viewInvitations')) ||
      (currentStep === 'manageTeam' && step === 'editAccess')
    );

    setAnimationDirection(isForward ? 'enter' : 'exit');

    // Apply slide animation only for transitions involving 'main' or direct first-to-last
    const slideTransitions = [
      ['main', 'invitations'],
      ['invitations', 'main'],
      ['main', 'manageTeam'],
      ['manageTeam', 'main'],
      ['main', 'sendInvitation'],
      ['sendInvitation', 'main'],
      ['main', 'viewInvitations'],
      ['viewInvitations', 'main'],
      ['main', 'editAccess'],
      ['editAccess', 'main'],
    ];
    const shouldSlide = slideTransitions.some(
      ([from, to]) => (currentStep === from && step === to) || (currentStep === to && step === from)
    );
    setAnimationType(shouldSlide ? 'slide' : 'none');

    setCurrentStep(step);
    setSelectedTeamMemberUids([]);
    setSelectedSheets([]);
    setSelectedDashboards([]);
    setSelectedCardTemplates([]);
    setSelectedPermissions('viewer');
    setEmail('');
  };

  return (
    <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {(successMessage || errorMessages.length > 0) && (
        <div
          className={`${styles.banner} ${successMessage ? styles.success : styles.error} ${isDarkTheme ? styles.darkTheme : ''}`}
        >
          {successMessage || errorMessages.join('; ')}
        </div>
      )}

      <div className={`${styles.navBar} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <h1 className={`${styles.navTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
          {t('settings.title')}
        </h1>
      </div>

      <div className={`${styles.teamAccessContainer} ${isMobile ? styles.mobile : ''}`}>
        <div
          className={`${styles.leftPane} ${isDarkTheme ? styles.darkTheme : ''} ${
            isMobile && currentStep !== 'main' ? styles.hidden : ''
          } ${isMobile && currentStep === 'main' && animationDirection === 'exit' ? styles.animateEnter : ''} ${
            isMobile && currentStep !== 'main' && animationDirection === 'enter' ? styles.animateExit : ''
          }`}
        >
          <button
            onClick={() => handleStepChange('invitations')}
            className={`${styles.stepButton} ${isDarkTheme ? styles.darkTheme : ''} ${
              currentStep === 'invitations' || currentStep === 'sendInvitation' || currentStep === 'viewInvitations'
                ? styles.selected
                : ''
            }`}
            aria-label={t('settings.teamInvitations')}
          >
            <span>{t('settings.teamInvitations')}</span>
            <FaChevronRight className={styles.arrowIcon} />
          </button>
          <button
            onClick={() => handleStepChange('manageTeam')}
            className={`${styles.stepButton} ${isDarkTheme ? styles.darkTheme : ''} ${
              currentStep === 'manageTeam' || currentStep === 'editAccess' ? styles.selected : ''
            }`}
            aria-label={t('settings.manageTeamAccess')}
          >
            <span>{t('settings.manageTeamAccess')}</span>
            <FaChevronRight className={styles.arrowIcon} />
          </button>
        </div>

        <div
          className={`${styles.rightPane} ${isDarkTheme ? styles.darkTheme : ''} ${
            isMobile && currentStep !== 'main' ? styles.fullScreen : ''
          }`}
        >
          <div
            className={`${styles.contentWrapper} ${
              animationType === 'slide'
                ? isMobile
                  ? animationDirection === 'enter'
                    ? styles.animateEnterMobile
                    : styles.animateExitMobile
                  : animationDirection === 'enter'
                  ? styles.animateEnterDesktop
                  : styles.animateExitDesktop
                : styles.noAnimation
            }`}
          >
            {currentStep === 'main' && (
              <p className={`${styles.noSelection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                {t('settings.selectOption', { defaultValue: 'Select an option to proceed' })}
              </p>
            )}

            {currentStep === 'invitations' && (
              <div className={`${styles.section} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <button
                  onClick={() => handleStepChange('main')}
                  className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  aria-label={t('settings.back')}
                >
                  <FaArrowLeft className={styles.backIcon} />
                  <span>{t('settings.back')}</span>
                </button>
                <h2>{t('settings.teamInvitations')}</h2>
                <button
                  onClick={() => handleStepChange('sendInvitation')}
                  className={`${styles.stepButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  aria-label={t('settings.sendInvitation')}
                >
                  <span>{t('settings.sendInvitation')}</span>
                  <FaChevronRight className={styles.arrowIcon} />
                </button>
                <button
                  onClick={() => handleStepChange('viewInvitations')}
                  className={`${styles.stepButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  aria-label={t('settings.viewPendingInvitations')}
                >
                  <span>{t('settings.viewPendingInvitations')}</span>
                  <FaChevronRight className={styles.arrowIcon} />
                </button>
              </div>
            )}

            {currentStep === 'sendInvitation' && (
              <div className={`${styles.section} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <button
                  onClick={() => handleStepChange('invitations')}
                  className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  aria-label={t('settings.back')}
                >
                  <FaArrowLeft className={styles.backIcon} />
                  <span>{t('settings.back')}</span>
                </button>
                <h2>{t('settings.sendInvitation')}</h2>
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
            )}

            {currentStep === 'viewInvitations' && (
              <div className={`${styles.section} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <button
                  onClick={() => handleStepChange('invitations')}
                  className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  aria-label={t('settings.back')}
                >
                  <FaArrowLeft className={styles.backIcon} />
                  <span>{t('settings.back')}</span>
                </button>
                <h2>{t('settings.viewPendingInvitations')}</h2>
                {pendingInvitations.length > 0 ? (
                  <div className={styles.invitationList}>
                    {pendingInvitations.map(inv => (
                      <div key={inv.id} className={styles.invitationItem}>
                        <span>{inv.email}</span>
                        <span>
                          {t('settings.invitedOn', {
                            date: new Date(inv.createdAt?.seconds * 1000).toLocaleDateString(),
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`${styles.noSelection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    {t('settings.noPendingInvitations', { defaultValue: 'No pending invitations' })}
                  </p>
                )}
              </div>
            )}

            {currentStep === 'manageTeam' && (
              <div className={`${styles.section} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <button
                  onClick={() => handleStepChange('main')}
                  className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  aria-label={t('settings.back')}
                >
                  <FaArrowLeft className={styles.backIcon} />
                  <span>{t('settings.back')}</span>
                </button>
                <h2>{t('settings.manageTeamAccess')}</h2>
                {teamMembers.length > 0 ? (
                  <div className={styles.teamMemberList}>
                    {teamMembers.map(tm => (
                      <button
                        key={tm.uid}
                        onClick={() => toggleTeamMemberSelection(tm.uid)}
                        className={`${styles.teamMemberButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                        aria-label={t('settings.editAccessFor', { email: tm.email })}
                      >
                        <span>{tm.email}</span>
                        <FaChevronRight className={styles.arrowIcon} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={`${styles.noSelection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    {t('settings.noTeamMembers', { defaultValue: 'No team members found' })}
                  </p>
                )}
              </div>
            )}

            {currentStep === 'editAccess' && selectedTeamMemberUids.length > 0 && (
              <div className={`${styles.section} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <button
                  onClick={() => handleStepChange('manageTeam')}
                  className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  aria-label={t('settings.back')}
                >
                  <FaArrowLeft className={styles.backIcon} />
                  <span>{t('settings.back')}</span>
                </button>
                <h3>
                  {t('settings.editAccessFor', {
                    email:
                      teamMembers.find(tm => tm.uid === selectedTeamMemberUids[0])?.email ||
                      t('settings.unknownEmail', { defaultValue: 'Unknown Email' }),
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
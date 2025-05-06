import React, { useContext, useEffect, useState } from 'react';
import { MainContext } from '../Contexts/MainContext';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import styles from './Settings.module.css';
import { FaRegCircle, FaRegCheckCircle, FaChevronRight, FaArrowLeft, FaTrash } from 'react-icons/fa';
import { getAuth } from 'firebase/auth';
import { DeleteTeamMemberFunction } from '../Firebase/Firebase Functions/User Functions/DeleteTeamMemberFunction';

export default function Settings() {
  const { t } = useTranslation();
  const {
    user,
    isDarkTheme,
    addBannerMessage,
    businessId,
    teamMembers,
    sheets,
    dashboards,
    cardTemplates,
  } = useContext(MainContext);
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessages, setErrorMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [selectedTeamMemberUids, setSelectedTeamMemberUids] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [selectedDashboards, setSelectedDashboards] = useState([]);
  const [selectedCardTemplates, setSelectedCardTemplates] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState('viewer');
  const [currentStep, setCurrentStep] = useState('main');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [animationDirection, setAnimationDirection] = useState('enter');
  const [animationType, setAnimationType] = useState('slide');

  // Map MainContext data to expected format: { id, name }
  const sheetItems = sheets.allSheets.map(sheet => ({
    id: sheet.docId,
    name: sheet.sheetName,
  }));
  const dashboardItems = dashboards.map(dashboard => ({
    id: dashboard.docId,
    name: dashboard.name || `Dashboard ${dashboard.docId}`,
  }));
  const cardTemplateItems = cardTemplates.map(template => ({
    id: template.docId,
    name: template.name || `Template ${template.docId}`,
  }));

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch pending invitations only when viewing invitations
  useEffect(() => {
    console.log('Invitations useEffect: currentStep:', currentStep, 'user:', user ? { uid: user.uid, email: user.email } : 'No user');
    if (currentStep !== 'viewInvitations' || !user || !user.uid) {
      console.log('Skipping fetchInvitations: currentStep:', currentStep, 'user:', user ? user.uid : 'No user');
      return;
    }

    const fetchInvitations = async () => {
      try {
        console.log('fetchInvitations: Querying invitations for invitedBy:', user.uid);
        const invitationsQuery = query(
          collection(db, 'invitations'),
          where('status', '==', 'pending'),
          where('invitedBy', '==', user.uid)
        );
        const invitationsSnap = await getDocs(invitationsQuery);
        const invitationsData = invitationsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log('Invitations Fetched:', invitationsData.map(inv => ({
          id: inv.id,
          email: inv.email,
          invitedBy: inv.invitedBy,
          status: inv.status,
        })));
        setPendingInvitations(invitationsData);
      } catch (err) {
        console.error('Error fetching invitations:', err, 'Code:', err.code, 'Message:', err.message);
        setErrorMessages([
          t('settings.errorFetchingData', {
            message: `invitations: ${err.message || 'Permission denied'} (Code: ${err.code || 'unknown'})`,
            defaultValue: 'Failed to load resources: {message}',
          }),
        ]);
        setPendingInvitations([]);
      }
    };

    fetchInvitations();
  }, [currentStep, user, t]);

  // Queue success/error messages for banner
  useEffect(() => {
    if (successMessage) {
      addBannerMessage(successMessage, 'success');
      setSuccessMessage('');
    }
    if (errorMessages.length > 0) {
      addBannerMessage(errorMessages.join('; '), 'error');
      setErrorMessages([]);
    }
  }, [successMessage, errorMessages, addBannerMessage]);

  const handleDeleteInvitation = async (invitationId) => {
    try {
      console.log('handleDeleteInvitation: Deleting invitation:', invitationId);
      const invitationRef = doc(db, 'invitations', invitationId);
      await deleteDoc(invitationRef);
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      setSuccessMessage(t('settings.invitationDeleted', { defaultValue: 'Invitation deleted successfully' }));
      console.log('handleDeleteInvitation: Invitation deleted successfully:', invitationId);
    } catch (err) {
      console.error('Error deleting invitation:', err);
      setErrorMessages([
        t('settings.errorDeletingInvitation', {
          message: err.message || 'Unknown error',
          defaultValue: 'Failed to delete invitation: {message}',
        }),
      ]);
    }
  };

  const handleDeleteTeamMember = async (uid) => {
    if (!user || !user.uid || !businessId) {
      console.error('handleDeleteTeamMember: Missing user or businessId', { user, businessId });
      setErrorMessages([t('settings.noAuthenticatedUser', { defaultValue: 'No authenticated user found' })]);
      return;
    }
    if (uid === user.uid) {
      setErrorMessages([t('settings.cannotDeleteSelf', { defaultValue: 'You cannot delete yourself' })]);
      return;
    }
    const teamMember = teamMembers.find((tm) => tm.uid === uid);
    if (!teamMember) {
      setErrorMessages([t('settings.teamMemberNotFound', { defaultValue: 'Team member not found' })]);
      return;
    }
    if (!window.confirm(t('settings.confirmDeleteTeamMember', { email: teamMember.email || 'this user' }))) {
      return;
    }

    try {
      console.log('handleDeleteTeamMember: Deleting team member:', uid);
      const result = await DeleteTeamMemberFunction({
        callerUid: user.uid,
        businessId,
        teamMemberUid: uid,
        email: teamMember.email,
        phone: teamMember.phone,
        invitationCode: '', // Not used for deletion, but included for consistency
        name: teamMember.name,
        surname: teamMember.surname,
      });

      if (result.success) {
        setSuccessMessage(t('settings.teamMemberDeleted', { defaultValue: 'Team member deleted successfully' }));
        console.log('handleDeleteTeamMember: Team member deleted successfully:', uid);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error deleting team member:', err.message, err);
      setErrorMessages([
        t('settings.errorDeletingTeamMember', {
          message: err.message || 'Unknown error',
          defaultValue: 'Failed to delete team member: {message}',
        }),
      ]);
    }
  };

  const toggleTeamMemberSelection = (uid) => {
    console.log('toggleTeamMemberSelection: Selected UID:', uid);
    setSelectedTeamMemberUids([uid]);
    const teamMember = teamMembers.find(tm => tm.uid === uid);
    if (teamMember) {
      setSelectedSheets(teamMember.allowedSheetIds || []);
      setSelectedDashboards(teamMember.allowedDashboardIds || []);
      setSelectedCardTemplates(teamMember.allowedCardTemplateIds || []);
      setSelectedPermissions(teamMember.permissions || 'viewer');
    }
    setAnimationDirection('enter');
    setAnimationType('none');
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
      sheets: sheetItems,
      dashboards: dashboardItems,
      cardTemplates: cardTemplateItems,
    }[type];

    console.log(`toggleOption: Type: ${type}, Value: ${value}, Current:`, selected);

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
    if (!businessId) {
      setErrorMessages([t('settings.noBusinessId', { defaultValue: 'Business ID not found' })]);
      return;
    }
    try {
      console.log('saveAccess: Saving access for UIDs:', selectedTeamMemberUids);
      for (const uid of selectedTeamMemberUids) {
        const teamMemberRef = doc(db, 'businesses', businessId, 'teamMembers', uid);
        const teamMemberDoc = await getDoc(teamMemberRef);
        if (!teamMemberDoc.exists()) {
          throw new Error(t('settings.teamMemberNotFound'));
        }
        const currentData = teamMemberDoc.data();

        const newData = {
          ...currentData,
          allowedSheetIds: selectedSheets.includes('all') ? sheetItems.map(s => s.id) : selectedSheets.filter(id => id !== 'all'),
          allowedDashboardIds: selectedDashboards.includes('all') ? dashboardItems.map(d => d.id) : selectedDashboards.filter(id => id !== 'all'),
          allowedCardTemplateIds: selectedCardTemplates.includes('all') ? cardTemplateItems.map(t => t.id) : selectedCardTemplates.filter(id => id !== 'all'),
          permissions: selectedPermissions,
        };

        await setDoc(teamMemberRef, newData, { merge: false });

        // Note: teamMembers is updated via MainContext listener
      }
      setSuccessMessage(t('settings.accessUpdated'));
      setSelectedTeamMemberUids([]);
      setSelectedSheets([]);
      setSelectedDashboards([]);
      setSelectedCardTemplates([]);
      setSelectedPermissions('viewer');
      setAnimationDirection('exit');
      setAnimationType('none');
      setCurrentStep('manageTeam');
      if (selectedTeamMemberUids.includes(user.uid)) {
        window.location.reload();
      }
      console.log('saveAccess: Access updated successfully');
    } catch (err) {
      console.error('Error saving access:', err);
      setErrorMessages([t('settings.errorUpdatingAccess', { message: err.message || 'Unknown error' })]);
    }
  };

  const cancelEditing = () => {
    console.log('cancelEditing: Resetting selections');
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
    if (!businessId) {
      setErrorMessages([t('settings.noBusinessId', { defaultValue: 'Business ID not found' })]);
      return;
    }
    setIsGenerating(true);
    setErrorMessages([]);
    setSuccessMessage('');
    try {
      console.log('handleGenerateInvitation: Sending invitation to:', email);
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error(t('settings.noAuthenticatedUser'));
      }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        throw new Error(t('settings.userDataNotFound'));
      }
      const token = await currentUser.getIdToken(true);
      console.log('Generated token for invitation:', token.substring(0, 10) + '...');

      const maxRetries = 3;
      let attempt = 0;
      while (attempt < maxRetries) {
        try {
          const response = await fetch(
            'https://sendinvitationemail-lsdm7txq6q-uc.a.run.app', // Replace with your actual sendInvitationEmail function URL
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
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
            setEmail('');
            console.log('handleGenerateInvitation: Invitation sent successfully');
            if (currentStep === 'viewInvitations') {
              const invitationsQuery = query(
                collection(db, 'invitations'),
                where('status', '==', 'pending'),
                where('invitedBy', '==', user.uid)
              );
              const invitationsSnap = await getDocs(invitationsQuery);
              const invitationsData = invitationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              setPendingInvitations(invitationsData);
              console.log('handleGenerateInvitation: Refreshed invitations:', invitationsData);
            }
            return;
          } else {
            throw new Error(result.error || t('settings.failedToSendInvitation'));
          }
        } catch (error) {
          attempt++;
          if (attempt === maxRetries) throw error;
          console.warn(`Retry ${attempt}/${maxRetries} after error:`, error.message);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }
    } catch (err) {
      console.error('Error sending invitation:', err);
      setErrorMessages([t('settings.errorSendingInvitation', { message: err.message || 'Unknown error' })]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStepChange = (step) => {
    console.log('handleStepChange: From:', currentStep, 'To:', step);
    const isForward = (
      (currentStep === 'main' && (step === 'invitations' || step === 'manageTeam')) ||
      (currentStep === 'main' && (step === 'sendInvitation' || step === 'viewInvitations' || step === 'editAccess')) ||
      (currentStep === 'invitations' && (step === 'sendInvitation' || step === 'viewInvitations')) ||
      (currentStep === 'manageTeam' && step === 'editAccess')
    );

    setAnimationDirection(isForward ? 'enter' : 'exit');

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
      ['invitations', 'sendInvitation'],
      ['sendInvitation', 'invitations'],
      ['invitations', 'viewInvitations'],
      ['viewInvitations', 'invitations'],
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
                      <div key={inv.id} className={`${styles.invitationItem} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <div className={styles.invitationDetails}>
                          <span>{inv.email}</span>
                          <span>
                            {t('settings.invitedOn', {
                              date: inv.createdAt?.seconds
                                ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString()
                                : inv.createdAt
                                ? new Date(inv.createdAt).toLocaleDateString()
                                : 'Unknown date',
                            })}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteInvitation(inv.id)}
                          className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                          aria-label={t('settings.deleteInvitation', { email: inv.email })}
                        >
                          <FaTrash className={styles.deleteIcon} />
                        </button>
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
                      <div
                        key={tm.uid}
                        className={`${styles.teamMemberItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                      >
                        <button
                          onClick={() => toggleTeamMemberSelection(tm.uid)}
                          className={`${styles.teamMemberButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                          aria-label={t('settings.editAccessFor', { email: tm.email })}
                        >
                          <span>{tm.email}</span>
                          <FaChevronRight className={styles.arrowIcon} />
                        </button>
                        <button
                          onClick={() => handleDeleteTeamMember(tm.uid)}
                          className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                          aria-label={t('settings.deleteTeamMember', { email: tm.email })}
                          disabled={tm.uid === user.uid}
                        >
                          <FaTrash className={styles.deleteIcon} />
                        </button>
                      </div>
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
                  {sheetItems.map(sheet => (
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
                  {dashboardItems.map(dashboard => (
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
                  {cardTemplateItems.map(template => (
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
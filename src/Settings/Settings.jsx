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
  const { user, isDarkTheme, addBannerMessage, businessId } = useContext(MainContext);
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessages, setErrorMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [selectedTeamMemberUids, setSelectedTeamMemberUids] = useState([]);
  const [invitationPermissions, setInvitationPermissions] = useState({
    dashboard: 'none',
    metrics: 'none',
    sheets: { role: 'none', allowedSheetIds: [] },
    actions: 'none',
    financials: 'none',
  });
  const [selectedPermissions, setSelectedPermissions] = useState({
    dashboard: 'none',
    metrics: 'none',
    sheets: { role: 'none', allowedSheetIds: [] },
    actions: 'none',
    financials: 'none',
  });
  const [currentStep, setCurrentStep] = useState('main');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [animationDirection, setAnimationDirection] = useState('enter');
  const [animationType, setAnimationType] = useState('slide');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch team members and sheets when navigating to manageTeam or sendInvitation
  useEffect(() => {
    if (!['manageTeam', 'sendInvitation'].includes(currentStep) || !user || !user.uid || !businessId) {
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch team members for manageTeam
        if (currentStep === 'manageTeam') {
          const teamMembersQuery = query(collection(db, 'businesses', businessId, 'teamMembers'));
          const teamMembersSnap = await getDocs(teamMembersQuery);
          const teamMembersData = teamMembersSnap.docs.map(doc => ({
            uid: doc.id,
            ...doc.data(),
          }));
          setTeamMembers(teamMembersData);
        }

        // Fetch sheets
        const sheetsQuery = query(collection(db, 'businesses', businessId, 'sheets'));
        const sheetsSnap = await getDocs(sheetsQuery);
        const sheetsData = sheetsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSheets(sheetsData);
      } catch (err) {
        console.error('Error fetching data:', err, 'Code:', err.code, 'Message:', err.message);
        setErrorMessages([
          t('settings.errorFetchingData', {
            message: `data: ${err.message || 'Permission denied'} (Code: ${err.code || 'unknown'})`,
            defaultValue: 'Failed to load resources: {message}',
          }),
        ]);
        if (currentStep === 'manageTeam') setTeamMembers([]);
        setSheets([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentStep, user, businessId, t]);

  // Fetch pending invitations when navigating to viewInvitations
  useEffect(() => {
    if (currentStep !== 'viewInvitations' || !user || !user.uid) {
      return;
    }

    const fetchInvitations = async () => {
      setIsLoading(true);
      try {
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
      } finally {
        setIsLoading(false);
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
      const invitationRef = doc(db, 'invitations', invitationId);
      await deleteDoc(invitationRef);
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      setSuccessMessage(t('settings.invitationDeleted', { defaultValue: 'Invitation deleted successfully' }));
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
      setErrorMessages([t('settings.noAuthenticatedUser', { defaultValue: 'No authenticated user found' })]);
      return;
    }
    if (uid === user.uid) {
      setErrorMessages([t('settings.cannotDeleteSelf', { defaultValue: 'You cannot delete yourself' })]);
      return;
    }
    const teamMember = teamMembers.find(tm => tm.uid === uid);
    if (!teamMember) {
      setErrorMessages([t('settings.teamMemberNotFound', { defaultValue: 'Team member not found' })]);
      return;
    }
    if (!window.confirm(t('settings.confirmDeleteTeamMember', { email: teamMember.email || 'this user' }))) {
      return;
    }

    try {
      const result = await DeleteTeamMemberFunction({
        callerUid: user.uid,
        businessId,
        teamMemberUid: uid,
        email: teamMember.email,
        phone: teamMember.phone,
        invitationCode: '',
        name: teamMember.name,
        surname: teamMember.surname,
      });

      if (result.success) {
        setTeamMembers(prev => prev.filter(tm => tm.uid !== uid));
        setSuccessMessage(t('settings.teamMemberDeleted', { defaultValue: 'Team member deleted successfully' }));
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
    setSelectedTeamMemberUids([uid]);
    const teamMember = teamMembers.find(tm => tm.uid === uid);
    if (teamMember) {
      setSelectedPermissions({
        dashboard: teamMember.permissions?.dashboard?.role || 'none',
        metrics: teamMember.permissions?.metrics?.role || 'none',
        sheets: {
          role: teamMember.permissions?.sheets?.role || 'none',
          allowedSheetIds: teamMember.permissions?.sheets?.allowedSheetIds || [],
        },
        actions: teamMember.permissions?.actions?.role || 'none',
        financials: teamMember.permissions?.financials?.role || 'none',
      });
    }
    setAnimationDirection('enter');
    setAnimationType('none');
    setCurrentStep('editAccess');
  };

  const togglePermission = (type, role, isInvitation = false) => {
    const setter = isInvitation ? setInvitationPermissions : setSelectedPermissions;
    if (type === 'sheets') {
      setter(prev => ({
        ...prev,
        sheets: {
          ...prev.sheets,
          role,
          allowedSheetIds: role === 'none' ? [] : prev.sheets.allowedSheetIds,
        },
      }));
    } else {
      setter(prev => ({
        ...prev,
        [type]: role,
      }));
    }
  };

  const toggleSheetSelection = (sheetId, isInvitation = false) => {
    const setter = isInvitation ? setInvitationPermissions : setSelectedPermissions;
    setter(prev => {
      const currentIds = prev.sheets.allowedSheetIds || [];
      const newIds = currentIds.includes(sheetId)
        ? currentIds.filter(id => id !== sheetId)
        : [...currentIds, sheetId];
      return {
        ...prev,
        sheets: {
          ...prev.sheets,
          allowedSheetIds: newIds,
        },
      };
    });
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
    if (selectedPermissions.sheets.role !== 'none' && selectedPermissions.sheets.allowedSheetIds.length === 0) {
      setErrorMessages([t('settings.noSheetsSelected', { defaultValue: 'Please select at least one sheet' })]);
      return;
    }
    try {
      for (const uid of selectedTeamMemberUids) {
        const teamMemberRef = doc(db, 'businesses', businessId, 'teamMembers', uid);
        const teamMemberDoc = await getDoc(teamMemberRef);
        if (!teamMemberDoc.exists()) {
          throw new Error(t('settings.teamMemberNotFound'));
        }
        const currentData = teamMemberDoc.data();

        const newData = {
          ...currentData,
          permissions: {
            dashboard: { role: selectedPermissions.dashboard },
            metrics: { role: selectedPermissions.metrics },
            sheets: {
              role: selectedPermissions.sheets.role,
              allowedSheetIds: selectedPermissions.sheets.allowedSheetIds,
            },
            actions: { role: selectedPermissions.actions },
            financials: { role: selectedPermissions.financials },
          },
        };

        await setDoc(teamMemberRef, newData, { merge: false });

        // Update local teamMembers state
        setTeamMembers(prev =>
          prev.map(tm => (tm.uid === uid ? { ...tm, ...newData } : tm))
        );
      }
      setSuccessMessage(t('settings.accessUpdated'));
      setSelectedTeamMemberUids([]);
      setSelectedPermissions({
        dashboard: 'none',
        metrics: 'none',
        sheets: { role: 'none', allowedSheetIds: [] },
        actions: 'none',
        financials: 'none',
      });
      setAnimationDirection('exit');
      setAnimationType('none');
      setCurrentStep('manageTeam');
      if (selectedTeamMemberUids.includes(user.uid)) {
        window.location.reload();
      }
    } catch (err) {
      console.error('Error saving access:', err);
      setErrorMessages([t('settings.errorUpdatingAccess', { message: err.message || 'Unknown error' })]);
    }
  };

  const cancelEditing = () => {
    setSelectedTeamMemberUids([]);
    setSelectedPermissions({
      dashboard: 'none',
      metrics: 'none',
      sheets: { role: 'none', allowedSheetIds: [] },
      actions: 'none',
      financials: 'none',
    });
    setAnimationDirection('exit');
    setAnimationType('none');
    setCurrentStep('manageTeam');
  };

  const cancelInvitation = () => {
    setEmail('');
    setInvitationPermissions({
      dashboard: 'none',
      metrics: 'none',
      sheets: { role: 'none', allowedSheetIds: [] },
      actions: 'none',
      financials: 'none',
    });
    setAnimationDirection('exit');
    setAnimationType('none');
    setCurrentStep('invitations');
  };

  const hasPendingInvitationForEmail = (email) => {
    return pendingInvitations.some(inv => inv.email?.toLowerCase() === email.toLowerCase());
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
    if (hasPendingInvitationForEmail(email)) {
      setErrorMessages([t('settings.invitationAlreadyExists', { defaultValue: 'An invitation for this email already exists.' })]);
      return;
    }
    if (!businessId) {
      setErrorMessages([t('settings.noBusinessId', { defaultValue: 'Business ID not found' })]);
      return;
    }
    if (invitationPermissions.sheets.role !== 'none' && invitationPermissions.sheets.allowedSheetIds.length === 0) {
      setErrorMessages([t('settings.noSheetsSelected', { defaultValue: 'Please select at least one sheet' })]);
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
      const token = await currentUser.getIdToken(true);
  
      const maxRetries = 3;
      let attempt = 0;
      while (attempt < maxRetries) {
        try {
          const response = await fetch(
            'https://sendinvitationemail-lsdm7txq6q-uc.a.run.app',
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
                  dashboard: { role: invitationPermissions.dashboard },
                  metrics: { role: invitationPermissions.metrics },
                  sheets: {
                    role: invitationPermissions.sheets.role,
                    allowedSheetIds: invitationPermissions.sheets.allowedSheetIds, // Only nested here
                  },
                  actions: { role: invitationPermissions.actions },
                  financials: { role: invitationPermissions.financials },
                },
              }),
            }
          );
  
          const result = await response.json();
          if (response.ok && result.status === 'success') {
            setSuccessMessage(result.message);
            setEmail('');
            setInvitationPermissions({
              dashboard: 'none',
              metrics: 'none',
              sheets: { role: 'none', allowedSheetIds: [] },
              actions: 'none',
              financials: 'none',
            });
            if (currentStep === 'viewInvitations') {
              const invitationsQuery = query(
                collection(db, 'invitations'),
                where('status', '==', 'pending'),
                where('invitedBy', '==', user.uid)
              );
              const invitationsSnap = await getDocs(invitationsQuery);
              const invitationsData = invitationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              setPendingInvitations(invitationsData);
            }
            setAnimationDirection('exit');
            setAnimationType('none');
            setCurrentStep('invitations');
            return;
          } else {
            throw new Error(result.error || t('settings.failedToSendInvitation'));
          }
        } catch (error) {
          attempt++;
          if (attempt === maxRetries) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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
    const isForward =
      (currentStep === 'main' && (step === 'invitations' || step === 'manageTeam')) ||
      (currentStep === 'main' && (step === 'sendInvitation' || step === 'viewInvitations' || step === 'editAccess')) ||
      (currentStep === 'invitations' && (step === 'sendInvitation' || step === 'viewInvitations')) ||
      (currentStep === 'manageTeam' && step === 'editAccess');

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
    setSelectedPermissions({
      dashboard: 'none',
      metrics: 'none',
      sheets: { role: 'none', allowedSheetIds: [] },
      actions: 'none',
      financials: 'none',
    });
    setInvitationPermissions({
      dashboard: 'none',
      metrics: 'none',
      sheets: { role: 'none', allowedSheetIds: [] },
      actions: 'none',
      financials: 'none',
    });
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
                {['dashboard', 'metrics', 'sheets', 'actions', 'financials'].map(type => (
                  <div key={type} className={styles.inputGroup}>
                    <label>{t(`settings.${type}`)}</label>
                    {type === 'sheets' ? (
                      <>
                        {['none', 'viewer', 'editor'].map(role => (
                          <button
                            key={role}
                            onClick={() => togglePermission(type, role, true)}
                            className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                              invitationPermissions.sheets.role === role ? styles.selected : ''
                            }`}
                            aria-label={t(`settings.${role}`)}
                          >
                            <span>{t(`settings.${role}`)}</span>
                            {invitationPermissions.sheets.role === role ? (
                              <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                            ) : (
                              <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                            )}
                          </button>
                        ))}
                        {invitationPermissions.sheets.role !== 'none' && (
                          <div className={styles.sheetSelection}>
                            <h4>{t('settings.selectSheets')}</h4>
                            {isLoading ? (
                              <p>{t('settings.loading')}</p>
                            ) : sheets.length > 0 ? (
                              sheets.map(sheet => (
                                <div key={sheet.id} className={styles.sheetItem}>
                                  <button
                                    onClick={() => toggleSheetSelection(sheet.id, true)}
                                    className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                                      invitationPermissions.sheets.allowedSheetIds.includes(sheet.id) ? styles.selected : ''
                                    }`}
                                    aria-label={t('settings.selectSheet', { name: sheet.name || sheet.id })}
                                  >
                                    <span>{sheet.sheetName || sheet.id}</span>
                                    {invitationPermissions.sheets.allowedSheetIds.includes(sheet.id) ? (
                                      <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                                    ) : (
                                      <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                                    )}
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p>{t('settings.noSheetsAvailable', { defaultValue: 'No sheets available' })}</p>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      ['none', 'viewer', 'editor'].map(role => (
                        <button
                          key={role}
                          onClick={() => togglePermission(type, role, true)}
                          className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                            invitationPermissions[type] === role ? styles.selected : ''
                          }`}
                          aria-label={t(`settings.${role}`)}
                        >
                          <span>{t(`settings.${role}`)}</span>
                          {invitationPermissions[type] === role ? (
                            <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                          ) : (
                            <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                ))}
                <div className={styles.buttonGroup}>
                  <button
                    onClick={handleGenerateInvitation}
                    disabled={isGenerating}
                    className={`${styles.button} ${isDarkTheme ? styles.darkTheme : ''}`}
                    aria-label={isGenerating ? t('settings.sending') : t('settings.sendInvitation')}
                  >
                    {isGenerating ? t('settings.sending') : t('settings.sendInvitation')}
                  </button>
                  <button
                    onClick={cancelInvitation}
                    className={`${styles.button} ${styles.cancelButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    aria-label={t('settings.cancel')}
                  >
                    {t('settings.cancel')}
                  </button>
                </div>
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
                {isLoading ? (
                  <p className={`${styles.noSelection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    {t('settings.loading', { defaultValue: 'Loading...' })}
                  </p>
                ) : pendingInvitations.length > 0 ? (
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
                {isLoading ? (
                  <p className={`${styles.noSelection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    {t('settings.loading', { defaultValue: 'Loading...' })}
                  </p>
                ) : teamMembers.length > 0 ? (
                  <div className={styles.teamMemberList}>
                    {teamMembers.map(tm => (
                      <div key={tm.uid} className={`${styles.teamMemberItem} ${isDarkTheme ? styles.darkTheme : ''}`}>
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
                {['dashboard', 'metrics', 'sheets', 'actions', 'financials'].map(type => (
                  <div key={type} className={styles.inputGroup}>
                    <label>{t(`settings.${type}`)}</label>
                    {type === 'sheets' ? (
                      <>
                        {['none', 'viewer', 'editor'].map(role => (
                          <button
                            key={role}
                            onClick={() => togglePermission(type, role)}
                            className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                              selectedPermissions.sheets.role === role ? styles.selected : ''
                            }`}
                            aria-label={t(`settings.${role}`)}
                          >
                            <span>{t(`settings.${role}`)}</span>
                            {selectedPermissions.sheets.role === role ? (
                              <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                            ) : (
                              <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                            )}
                          </button>
                        ))}
                        {selectedPermissions.sheets.role !== 'none' && (
                          <div className={styles.sheetSelection}>
                            <h4>{t('settings.selectSheets')}</h4>
                            {isLoading ? (
                              <p>{t('settings.loading')}</p>
                            ) : sheets.length > 0 ? (
                              sheets.map(sheet => (
                                <div key={sheet.id} className={styles.sheetItem}>
                                  <button
                                    onClick={() => toggleSheetSelection(sheet.id)}
                                    className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                                      selectedPermissions.sheets.allowedSheetIds.includes(sheet.id) ? styles.selected : ''
                                    }`}
                                    aria-label={t('settings.selectSheet', { name: sheet.name || sheet.id })}
                                  >
                                    <span>{sheet.sheetName || sheet.id}</span>
                                    {selectedPermissions.sheets.allowedSheetIds.includes(sheet.id) ? (
                                      <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                                    ) : (
                                      <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                                    )}
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p>{t('settings.noSheetsAvailable', { defaultValue: 'No sheets available' })}</p>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      ['none', 'viewer', 'editor'].map(role => (
                        <button
                          key={role}
                          onClick={() => togglePermission(type, role)}
                          className={`${styles.optionButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                            selectedPermissions[type] === role ? styles.selected : ''
                          }`}
                          aria-label={t(`settings.${role}`)}
                        >
                          <span>{t(`settings.${role}`)}</span>
                          {selectedPermissions[type] === role ? (
                            <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                          ) : (
                            <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                ))}
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
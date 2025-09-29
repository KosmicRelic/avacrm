import { useContext, useEffect, useState } from 'react';
import { MainContext } from '../Contexts/MainContext';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import styles from './Settings.module.css';
import { FaRegCircle, FaRegCheckCircle, FaChevronRight, FaArrowLeft, FaTrash } from 'react-icons/fa';
import { getAuth } from 'firebase/auth';
import { DeleteTeamMemberFunction } from '../Firebase/Firebase Functions/User Functions/DeleteTeamMemberFunction';
import DataModels from './DataModels/DataModels';

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
  const [isLoading, setIsLoading] = useState(false);
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
  const [_selectedTheme, _setSelectedTheme] = useState('business');
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch team members and sheets
  useEffect(() => {
    if (!['manageTeam', 'sendInvitation'].includes(currentStep) || !user || !user.uid || !businessId) {
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (currentStep === 'manageTeam') {
          const teamMembersQuery = query(collection(db, 'businesses', businessId, 'teamMembers'));
          const teamMembersSnap = await getDocs(teamMembersQuery);
          const teamMembersData = teamMembersSnap.docs.map(doc => ({
            uid: doc.id,
            ...doc.data(),
          }));
          setTeamMembers(teamMembersData);
        }

        const sheetsQuery = query(collection(db, 'businesses', businessId, 'sheets'));
        const sheetsSnap = await getDocs(sheetsQuery);
        const sheetsData = sheetsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSheets(sheetsData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setErrorMessages([t('settings.errorFetchingData', { message: err.message || 'Permission denied' })]);
        if (currentStep === 'manageTeam') setTeamMembers([]);
        setSheets([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentStep, user, businessId, t]);

  // Fetch pending invitations
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
        console.error('Error fetching invitations:', err);
        setErrorMessages([t('settings.errorFetchingData', { message: err.message || 'Permission denied' })]);
        setPendingInvitations([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvitations();
  }, [currentStep, user, t]);

  // Handle success/error messages
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
      setSuccessMessage(t('settings.invitationDeleted'));
    } catch (err) {
      console.error('Error deleting invitation:', err);
      setErrorMessages([t('settings.errorDeletingInvitation', { message: err.message || 'Unknown error' })]);
    }
  };

  const handleDeleteTeamMember = async (uid) => {
    if (!user || !user.uid || !businessId) {
      setErrorMessages([t('settings.noAuthenticatedUser')]);
      return;
    }
    if (uid === user.uid) {
      setErrorMessages([t('settings.cannotDeleteSelf')]);
      return;
    }
    const teamMember = teamMembers.find(tm => tm.uid === uid);
    if (!teamMember) {
      setErrorMessages([t('settings.teamMemberNotFound')]);
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
        setSuccessMessage(t('settings.teamMemberDeleted'));
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error deleting team member:', err);
      setErrorMessages([t('settings.errorDeletingTeamMember', { message: err.message || 'Unknown error' })]);
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
    setCurrentStep('editAccess');
  };

  const togglePermission = (type, role, isInvitation = false) => {
    const validRoles = ['none', 'viewer', 'editor'];
    if (!validRoles.includes(role)) {
      console.error(`Invalid role for ${type}: ${role}`);
      return;
    }

    const setter = isInvitation ? setInvitationPermissions : setSelectedPermissions;
    if (type === 'sheets') {
      setter(prev => ({
        ...prev,
        sheets: {
          ...prev.sheets,
          role,
          allowedSheetIds: role === 'none' ? [] : prev.sheets.allowedSheetIds || [],
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
      // Prevent toggling if role is 'none'
      if ((isInvitation ? prev.sheets?.role : prev.sheets?.role) === 'none') {
        return prev;
      }
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
      setErrorMessages([t('settings.noTeamMembersSelected')]);
      return;
    }
    if (!businessId) {
      setErrorMessages([t('settings.noBusinessId')]);
      return;
    }
    if (selectedPermissions.sheets.role !== 'none' && selectedPermissions.sheets.allowedSheetIds.length === 0) {
      setErrorMessages([t('settings.noSheetsSelected')]);
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

        // Ensure permissions object is correctly structured
        const updatedPermissions = {
          dashboard: { role: selectedPermissions.dashboard },
          metrics: { role: selectedPermissions.metrics },
          sheets: {
            role: selectedPermissions.sheets.role,
            allowedSheetIds: selectedPermissions.sheets.allowedSheetIds || [],
          },
          actions: { role: selectedPermissions.actions },
          financials: { role: selectedPermissions.financials },
        };

        // Merge with existing data to preserve other fields
        const newData = {
          ...currentData,
          permissions: updatedPermissions,
        };

        // Update the document with the correct nested structure
        await setDoc(teamMemberRef, newData, { merge: true });

        // Update local state
        setTeamMembers(prev => prev.map(tm => (tm.uid === uid ? { ...tm, ...newData } : tm)));
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
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessages([t('settings.invalidEmailFormat')]);
      return;
    }
    if (hasPendingInvitationForEmail(email)) {
      setErrorMessages([t('settings.invitationAlreadyExists')]);
      return;
    }
    if (!businessId) {
      setErrorMessages([t('settings.noBusinessId')]);
      return;
    }
    if (invitationPermissions.sheets.role !== 'none' && invitationPermissions.sheets.allowedSheetIds.length === 0) {
      setErrorMessages([t('settings.noSheetsSelected')]);
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

      // Validate permissions
      const validRoles = ['none', 'viewer', 'editor'];
      const isValidPermissions =
        ['dashboard', 'metrics', 'actions', 'financials'].every(type => validRoles.includes(invitationPermissions[type])) &&
        validRoles.includes(invitationPermissions.sheets.role) &&
        Array.isArray(invitationPermissions.sheets.allowedSheetIds);

      if (!isValidPermissions) {
        console.error('Invalid invitationPermissions:', invitationPermissions);
        throw new Error('Invalid permissions structure in frontend state');
      }

      // Convert permissions for backend
      const backendPermissions = {
        dashboard: { role: invitationPermissions.dashboard === 'none' ? false : invitationPermissions.dashboard },
        metrics: { role: invitationPermissions.metrics === 'none' ? false : invitationPermissions.metrics },
        sheets: {
          role: invitationPermissions.sheets.role === 'none' ? false : invitationPermissions.sheets.role,
          allowedSheetIds: invitationPermissions.sheets.allowedSheetIds || [],
        },
        actions: { role: invitationPermissions.actions === 'none' ? false : invitationPermissions.actions },
        financials: { role: invitationPermissions.financials === 'none' ? false : invitationPermissions.financials },
      };

      const maxRetries = 3;
      let attempt = 0;
      while (attempt < maxRetries) {
        try {
          // Determine the correct URL based on environment
          const isLocalhost = window.location.hostname === 'localhost';
          const apiUrl = isLocalhost 
            ? '/api/invite' // Use proxy in development
            : 'https://sendinvitationemail-lsdm7txq6q-uc.a.run.app'; // Direct URL in production

          const response = await fetch(
            apiUrl,
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
                permissions: backendPermissions,
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
            setCurrentStep('invitations');
            return;
          } else {
            throw new Error(
              result.error || `HTTP ${response.status}: ${response.statusText || 'Failed to send invitation'}`
            );
          }
        } catch (error) {
          attempt++;
          console.warn(`Retry ${attempt}/${maxRetries} for sending invitation: ${error.message}`);
          if (attempt === maxRetries) {
            throw new Error(`Failed after ${maxRetries} retries: ${error.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    } catch (err) {
      console.error('Error sending invitation:', {
        message: err.message,
        stack: err.stack,
        email,
        businessId,
        permissions: invitationPermissions,
      });
      setErrorMessages([t('settings.errorSendingInvitation', { message: err.message || 'Unknown error' })]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStepChange = (step) => {
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

  // DataModels callbacks
  const handleDataModelsSave = () => {
    // This will be called when DataModels saves successfully
    // Any cleanup or notifications can go here
  };

  return (
    <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {/* <div className={`${styles.navBar} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <h1 className={`${styles.navTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
          {t('settings.title')}
        </h1>
      </div> */}

      <div className={`${styles.teamAccessContainer} ${isMobile ? styles.mobile : ''}`}>
        <div
          className={`${styles.leftPane} ${isDarkTheme ? styles.darkTheme : ''} ${
            isMobile && currentStep !== 'main' ? styles.hidden : ''
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
          <div className={styles.stepButtonContainer}>
            <button
              onClick={() => handleStepChange('dataModels')}
              className={`${styles.stepButton} ${isDarkTheme ? styles.darkTheme : ''} ${
                currentStep === 'dataModels' ? styles.selected : ''
              }`}
              aria-label="Data Models"
            >
              <span>Data Models</span>
              <FaChevronRight className={styles.arrowIcon} />
            </button>
          </div>
          {/* Pipeline Management moved to Actions → Record Templates */}
        </div>

        <div
          className={`${styles.rightPane} ${isDarkTheme ? styles.darkTheme : ''} ${
            isMobile && currentStep === 'main' ? '' : styles.visible
          }`}
        >
          <div className={styles.contentWrapper}>
            {currentStep === 'main' && (
              <div className={`${styles.section} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <p className={`${styles.noSelection} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {t('settings.selectOption')}
                </p>
              </div>
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
                    onChange={(e) => setEmail(e.target.value.trim())}
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
                              invitationPermissions.sheets?.role === role ? styles.selected : ''
                            }`}
                            aria-label={t(`settings.${role}`)}
                          >
                            <span>{t(`settings.${role}`)}</span>
                            {invitationPermissions.sheets?.role === role ? (
                              <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                            ) : (
                              <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                            )}
                          </button>
                        ))}
                        {invitationPermissions.sheets?.role !== 'none' && (
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
                                      invitationPermissions.sheets?.allowedSheetIds?.includes(sheet.id) ? styles.selected : ''
                                    }`}
                                    aria-label={t('settings.selectSheet', { name: sheet.sheetName || sheet.id })}
                                  >
                                    <span>{sheet.sheetName || sheet.id}</span>
                                    {invitationPermissions.sheets?.allowedSheetIds?.includes(sheet.id) ? (
                                      <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                                    ) : (
                                      <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                                    )}
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p>{t('settings.noSheetsAvailable')}</p>
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
                    {t('settings.loading')}
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
                    {t('settings.noPendingInvitations')}
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
                    {t('settings.loading')}
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
                    {t('settings.noTeamMembers')}
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
                      t('settings.unknownEmail'),
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
                              selectedPermissions.sheets?.role === role ? styles.selected : ''
                            }`}
                            aria-label={t(`settings.${role}`)}
                          >
                            <span>{t(`settings.${role}`)}</span>
                            {selectedPermissions.sheets?.role === role ? (
                              <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                            ) : (
                              <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                            )}
                          </button>
                        ))}
                        {selectedPermissions.sheets?.role !== 'none' && (
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
                                      selectedPermissions.sheets?.allowedSheetIds?.includes(sheet.id) ? styles.selected : ''
                                    }`}
                                    aria-label={t('settings.selectSheet', { name: sheet.sheetName || sheet.id })}
                                  >
                                    <span>{sheet.sheetName || sheet.id}</span>
                                    {selectedPermissions.sheets?.allowedSheetIds?.includes(sheet.id) ? (
                                      <FaRegCheckCircle className={`${styles.icon} ${styles.selected} ${isDarkTheme ? styles.darkTheme : ''}`} />
                                    ) : (
                                      <FaRegCircle className={`${styles.icon} ${isDarkTheme ? styles.darkTheme : ''}`} />
                                    )}
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p>{t('settings.noSheetsAvailable')}</p>
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

            {currentStep === 'dataModels' && (
              <DataModels
                onSave={handleDataModelsSave}
                onBack={() => handleStepChange('main')}
              />
            )}

            {/* Pipeline Management moved to Actions → Record Templates workflow */}
          </div>
        </div>
      </div>
    </div>
  );
}
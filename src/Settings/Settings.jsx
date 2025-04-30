import React, { useContext, useEffect, useState } from 'react';
import { MainContext } from '../Contexts/MainContext';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import styles from './Settings.module.css';

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useContext(MainContext);
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateInvitation = async () => {
    console.log('MainContext User:', user);
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
      console.log('Firebase Auth Current User:', currentUser);
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

      console.log('Calling sendInvitationEmail with:', { email, businessId, invitedBy: user.uid });

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
            invitedBy: user.uid, // Send the authenticated user's UID
            businessEmail: user.email
          }),
        }
      );

      const result = await response.json();
      console.log('Function call result:', result);

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
    </div>
  );
}
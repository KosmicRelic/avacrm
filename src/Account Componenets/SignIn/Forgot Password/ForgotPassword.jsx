// src/Account Componenets/SignIn/Forgot Password/ForgotPassword.jsx
import React, { useContext, useState } from 'react';
import styles from './ForgotPassword.module.css';
import { IoClose } from 'react-icons/io5';
import { ImSpinner2 } from 'react-icons/im';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../../firebase.jsx'; // Adjusted path based on folder structure
import { MainContext } from '../../../Contexts/MainContext';
import { useTranslation } from 'react-i18next';

export default function ForgotPassword({
  setForgotPasswordIsActive,
  setEditPasswordIsEnabled,
  settingsForgotPassword,
}) {
  const { user } = useContext(MainContext);
  const { t } = useTranslation();

  const [email, setEmail] = useState(user ? user.email : '');
  const [emailFocused, setEmailFocused] = useState(!!user?.email);
  const [emailError, setEmailError] = useState('');
  const [emailWasSent, setEmailWasSent] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);

  const handleForgotPasswordClose = () => {
    if (isProcessed) return;

    if (settingsForgotPassword && emailWasSent) {
      setEditPasswordIsEnabled(false);
    }
    setForgotPasswordIsActive(false);
  };

  const handleInputChange = (e) => {
    setEmail(e.target.value);
    setEmailError('');
  };

  const handleFocus = () => setEmailFocused(true);

  const handleBlur = () => {
    if (email === '') {
      setEmailFocused(false);
    }
  };

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleForgotPasswordSubmit = async () => {
    if (isProcessed) return;

    if (!validateEmail(email)) {
      setEmailError(t('forgotPassword.emailError'));
      return;
    }

    setIsProcessed(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setEmailWasSent(true);
    } catch (error) {
      console.error('Error sending password reset email:', error.code, error.message);
      let errorMessage = t('forgotPassword.genericError');
      if (error.code === 'auth/user-not-found') {
        errorMessage = t('forgotPassword.userNotFound');
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = t('forgotPassword.invalidEmail');
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = t('forgotPassword.tooManyRequests');
      }
      setEmailError(errorMessage);
    } finally {
      setIsProcessed(false);
    }
  };

  return (
    <>
      <div
        className={styles.background}
        onClick={handleForgotPasswordClose}
        role="button"
        aria-label={t('forgotPassword.closeModal')}
      />
      <div className={styles.forgotPasswordContainer}>
        <button
          className={styles.closeButton}
          onClick={handleForgotPasswordClose}
          aria-label={t('forgotPassword.closeButton')}
          disabled={isProcessed}
        >
          <IoClose size={24} />
        </button>
        <h2 className={styles.title}>
          {emailWasSent ? t('forgotPassword.emailSentTitle') : t('forgotPassword.title')}
        </h2>
        <p className={styles.emailSentText}>
          {emailWasSent
            ? t('forgotPassword.emailSentInstructions')
            : t('forgotPassword.instructions')}
        </p>

        {!emailWasSent && (
          <div className={`${styles.inputContainer} ${emailError ? styles.error : ''}`}>
            <label
              className={`${styles.label} ${emailFocused || email ? styles.focused : ''} ${
                emailError ? styles.errorText : ''
              }`}
            >
              {t('forgotPassword.label')}*
            </label>
            <input
              type="email"
              value={email}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className={styles.inputField}
              disabled={isProcessed}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
            />
          </div>
        )}

        {emailError && !emailWasSent && (
          <p id="email-error" className={styles.errorText}>
            {emailError}
          </p>
        )}

        <button
          className={styles.saveChanges}
          onClick={
            !isProcessed && !emailWasSent ? handleForgotPasswordSubmit : handleForgotPasswordClose
          }
          disabled={isProcessed}
        >
          {isProcessed ? (
            <ImSpinner2 className={styles.spinner} />
          ) : emailWasSent ? (
            t('forgotPassword.gotItButton')
          ) : (
            t('forgotPassword.sendEmailButton')
          )}
        </button>
      </div>
    </>
  );
}
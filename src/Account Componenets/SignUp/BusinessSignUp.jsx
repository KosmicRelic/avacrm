import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './BusinessSignUp.module.css';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { ImSpinner2 } from 'react-icons/im';
import { MainContext } from '../../Contexts/MainContext';
import { BusinessSignUp as FirebaseBusinessSignUp } from '../../Firebase/Firebase Functions/User Functions/BusinessSignUpFunction';
import { useTranslation } from 'react-i18next';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

export default function BusinessSignUp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setIsSignup, isDarkTheme } = React.useContext(MainContext); // Added isDarkTheme
  const auth = getAuth();

  const [businessName, setBusinessName] = useState('');
  const [businessNameFocused, setBusinessNameFocused] = useState(false);
  const [businessNameError, setBusinessNameError] = useState(false);

  const [email, setEmail] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [emailError, setEmailError] = useState(false);

  const [password, setPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState([]);

  const [invitationCode, setInvitationCode] = useState('');
  const [invitationCodeFocused, setInvitationCodeFocused] = useState(false);
  const [invitationCodeError, setInvitationCodeError] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupError, setSignupError] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/sheets');
    }
  }, [user, navigate]);

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkPasswordRequirements = (password) => {
    const requirements = [];
    if (password.length < 8) {
      requirements.push(t('businessSignUp.passwordRequirement.minLength'));
    }
    if (!/[A-Z]/.test(password)) {
      requirements.push(t('businessSignUp.passwordRequirement.uppercase'));
    }
    if (!/[a-z]/.test(password)) {
      requirements.push(t('businessSignUp.passwordRequirement.lowercase'));
    }
    if (!/\d/.test(password)) {
      requirements.push(t('businessSignUp.passwordRequirement.number'));
    }
    setPasswordRequirements(requirements);
    setPasswordError(requirements.length > 0);
  };

  const handleInputChange = (setter, setError) => (e) => {
    const value = e.target.value;
    setter(value);
    if (setError) {
      setError(false);
    }
    if (setter === setEmail) {
      setEmailError(!isValidEmail(value) && value !== '');
    }
    if (setter === setPassword) {
      checkPasswordRequirements(value);
    }
    if (setter === setInvitationCode) {
      setInvitationCodeError(value !== '0000' && value !== '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isBusinessNameValid = businessName.trim() !== '';
    const isEmailValid = isValidEmail(email);
    const isPasswordValid = password && passwordRequirements.length === 0;
    const isInvitationCodeValid = invitationCode === '0000';

    setBusinessNameError(!isBusinessNameValid);
    setEmailError(!isEmailValid);
    setPasswordError(!isPasswordValid);
    setInvitationCodeError(!isInvitationCodeValid);

    if (isBusinessNameValid && isEmailValid && isPasswordValid && isInvitationCodeValid) {
      try {
        setIsSubmitting(true);
        setSignupError('');
        setIsSignup(true);

        await FirebaseBusinessSignUp({
          email: email.trim(),
          password,
          businessName: businessName.trim(),
          invitationCode,
          userType: 'business',
        });

        await signInWithEmailAndPassword(auth, email.trim(), password);

        navigate('/sheets');
      } catch (error) {
        setIsSubmitting(false);
        setSignupSuccess(false);
        setIsSignup(false);
        setSignupError(error.message || t('businessSignUp.error.generic'));
      }
    }
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  return (
    <div className={`${styles.container} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {!signupSuccess && (
        <>
          <h1
            className={styles.logoText}
            onClick={() => (!isSubmitting ? navigate('/') : null)}
          >
            AVA
          </h1>
          <header className={styles.header}>
            <h2 className={styles.title}>{t('businessSignUp.signup')}</h2>
            <p className={styles.subText}>{t('businessSignUp.shortText')}</p>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div
              className={`${styles.inputContainer} ${
                businessNameError ? styles.error : ''
              }`}
            >
              <label
                className={`${styles.label} ${
                  businessNameFocused || businessName ? styles.focused : ''
                } ${businessNameError ? styles.errorText : ''}`}
              >
                {t('businessSignUp.businessName')}*
              </label>
              <input
                type="text"
                className={styles.inputField}
                onFocus={() => setBusinessNameFocused(true)}
                onBlur={() => setBusinessNameFocused(businessName !== '')}
                value={businessName}
                onChange={handleInputChange(setBusinessName, setBusinessNameError)}
                disabled={isSubmitting}
              />
              {businessNameError && (
                <p className={styles.errorText}>
                  {t('businessSignUp.error.businessNameRequired')}
                </p>
              )}
            </div>

            <div
              className={`${styles.inputContainer} ${
                emailError ? styles.error : ''
              }`}
            >
              <label
                className={`${styles.label} ${
                  emailFocused || email ? styles.focused : ''
                } ${emailError ? styles.errorText : ''}`}
              >
                {t('businessSignUp.email')}*
              </label>
              <input
                type="email"
                className={styles.inputField}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(email !== '')}
                value={email}
                onChange={handleInputChange(setEmail, setEmailError)}
                disabled={isSubmitting}
              />
              {emailError && (
                <p className={styles.errorText}>
                  {t('businessSignUp.error.invalidEmail')}
                </p>
              )}
            </div>

            <div
              className={`${styles.inputContainer} ${
                passwordError ? styles.error : ''
              }`}
            >
              <label
                className={`${styles.label} ${
                  passwordFocused || password ? styles.focused : ''
                } ${passwordError ? styles.errorText : ''}`}
              >
                {t('businessSignUp.password')}*
              </label>
              <input
                type={passwordVisible ? 'text' : 'password'}
                className={styles.inputField}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(password !== '')}
                value={password}
                onChange={handleInputChange(setPassword, setPasswordError)}
                disabled={isSubmitting}
              />
              <div className={styles.eyeIcons}>
                <FaEye
                  onClick={togglePasswordVisibility}
                  style={{
                    cursor: 'pointer',
                    display: passwordVisible ? 'none' : 'block',
                  }}
                />
                <FaEyeSlash
                  onClick={togglePasswordVisibility}
                  style={{
                    cursor: 'pointer',
                    display: passwordVisible ? 'block' : 'none',
                  }}
                />
              </div>
            </div>

            {passwordRequirements.length > 0 && (
              <ul className={styles.requirementsList}>
                {passwordRequirements.map((requirement, index) => (
                  <li key={index} className={styles.requirementsText}>
                    {requirement}
                  </li>
                ))}
              </ul>
            )}

            <div
              className={`${styles.inputContainer} ${
                invitationCodeError ? styles.error : ''
              }`}
            >
              <label
                className={`${styles.label} ${
                  invitationCodeFocused || invitationCode ? styles.focused : ''
                } ${invitationCodeError ? styles.errorText : ''}`}
              >
                {t('businessSignUp.invitationCode')}*
              </label>
              <input
                type="text"
                className={styles.inputField}
                onFocus={() => setInvitationCodeFocused(true)}
                onBlur={() => setInvitationCodeFocused(invitationCode !== '')}
                value={invitationCode}
                onChange={handleInputChange(
                  setInvitationCode,
                  setInvitationCodeError
                )}
                disabled={isSubmitting}
              />
            </div>

            {signupError && (
              <p className={styles.errorText} style={{ textAlign: 'center' }}>
                {signupError}
              </p>
            )}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={
                isSubmitting ||
                !businessName.trim() ||
                !isValidEmail(email) ||
                !password ||
                passwordRequirements.length > 0 ||
                invitationCode !== '0000'
              }
            >
              {isSubmitting ? (
                <ImSpinner2 className={styles.spinner} />
              ) : (
                t('businessSignUp.createAccount')
              )}
            </button>
          </form>

          <footer className={styles.footer}>
            {t('businessSignUp.alreadyHaveAccount')}{' '}
            <a
              onClick={() => (!isSubmitting ? navigate('/signin') : null)}
              style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            >
              {t('businessSignUp.signin')}
            </a>
          </footer>
        </>
      )}
    </div>
  );
}
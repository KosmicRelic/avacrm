import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './BusinessSignUp.module.css';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { ImSpinner2 } from 'react-icons/im';
import { MainContext } from '../../Contexts/MainContext';
import { TeamMemberSignUpFunction } from '../../Firebase/Firebase Functions/User Functions/TeamMemberSignUpFunction';
import { useTranslation } from 'react-i18next';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

export default function TeamMemberSignUp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { code } = useParams();
  const { user, setIsSignup, isDarkTheme } = React.useContext(MainContext);
  const auth = getAuth();

  const [email, setEmail] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [emailError, setEmailError] = useState(false);

  const [password, setPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState([]);

  const [phone, setPhone] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [phoneError, setPhoneError] = useState(false);

  const [invitationCode] = useState(code || '');
  const [invitationCodeError, setInvitationCodeError] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupError, setSignupError] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (invitationCode) {
      // Simulate fetching business name (replace with actual API call if available)
      // For example, call a Firebase function to validate the invitation code and get business name
      const validateInvitationCode = async () => {
        try {
          // Placeholder: Assume TeamMemberSignUpFunction or another function returns business name
          const response = await TeamMemberSignUpFunction({ invitationCode, validateOnly: true });
          setInvitationDetails({
            invitationCode,
            businessName: response?.businessName || 'the team', // Fallback to 'the team'
          });
        } catch (error) {
          setInvitationCodeError(true);
          setSignupError(t('teamMemberSignUp.error.invalidCode'));
          setInvitationDetails(null);
        }
      };
      validateInvitationCode();
    } else {
      setInvitationCodeError(true);
      setSignupError(t('teamMemberSignUp.error.invalidCode'));
      setInvitationDetails(null);
    }
  }, [invitationCode, t]);

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidPhone = (phone) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  };

  const checkPasswordRequirements = (password) => {
    const requirements = [];
    if (password.length < 8) {
      requirements.push(t('teamMemberSignUp.passwordRequirement.minLength'));
    }
    if (!/[A-Z]/.test(password)) {
      requirements.push(t('teamMemberSignUp.passwordRequirement.uppercase'));
    }
    if (!/[a-z]/.test(password)) {
      requirements.push(t('teamMemberSignUp.passwordRequirement.lowercase'));
    }
    if (!/\d/.test(password)) {
      requirements.push(t('teamMemberSignUp.passwordRequirement.number'));
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
    if (setter === setPhone) {
      setPhoneError(!isValidPhone(value) && value !== '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isEmailValid = isValidEmail(email);
    const isPasswordValid = password && passwordRequirements.length === 0;
    const isPhoneValid = isValidPhone(phone);
    const isInvitationCodeValid = invitationCode && !invitationCodeError;

    setEmailError(!isEmailValid);
    setPasswordError(!isPasswordValid);
    setPhoneError(!isPhoneValid);
    setInvitationCodeError(!isInvitationCodeValid);

    if (isEmailValid && isPasswordValid && isPhoneValid && isInvitationCodeValid) {
      try {
        setIsSubmitting(true);
        setSignupError('');
        setIsSignup(true);

        await TeamMemberSignUpFunction({
          email: email.trim(),
          password,
          phone: phone.trim(),
          invitationCode,
        });

        await signInWithEmailAndPassword(auth, email.trim(), password);

        setSignupSuccess(true);
      } catch (error) {
        setIsSubmitting(false);
        setSignupSuccess(false);
        setIsSignup(false);
        setSignupError(error.message || t('teamMemberSignUp.error.generic'));
        setInvitationCodeError(error.code === 'not-found' || error.code === 'failed-precondition');
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
            <h2 className={styles.title}>{t('teamMemberSignUp.signup')}</h2>
            <p className={styles.subText}>
              {invitationDetails
                ? t('teamMemberSignUp.shortText', { businessName: invitationDetails.businessName || 'the team' })
                : t('teamMemberSignUp.shortTextGeneric')}
            </p>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div
              className={`${styles.inputContainer} ${emailError ? styles.error : ''}`}
            >
              <label
                className={`${styles.label} ${
                  emailFocused || email ? styles.focused : ''
                } ${emailError ? styles.errorText : ''}`}
              >
                {t('teamMemberSignUp.email')}*
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
                  {t('teamMemberSignUp.error.invalidEmail')}
                </p>
              )}
            </div>

            <div
              className={`${styles.inputContainer} ${passwordError ? styles.error : ''}`}
            >
              <label
                className={`${styles.label} ${
                  passwordFocused || password ? styles.focused : ''
                } ${passwordError ? styles.errorText : ''}`}
              >
                {t('teamMemberSignUp.password')}*
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
              className={`${styles.inputContainer} ${phoneError ? styles.error : ''}`}
            >
              <label
                className={`${styles.label} ${
                  phoneFocused || phone ? styles.focused : ''
                } ${phoneError ? styles.errorText : ''}`}
              >
                {t('teamMemberSignUp.phone')}*
              </label>
              <input
                type="tel"
                className={styles.inputField}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(phone !== '')}
                value={phone}
                onChange={handleInputChange(setPhone, setPhoneError)}
                disabled={isSubmitting}
              />
              {phoneError && (
                <p className={styles.errorText}>
                  {t('teamMemberSignUp.error.invalidPhone')}
                </p>
              )}
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
                !isValidEmail(email) ||
                !password ||
                passwordRequirements.length > 0 ||
                !isValidPhone(phone) ||
                !invitationCode ||
                invitationCodeError
              }
            >
              {isSubmitting ? (
                <ImSpinner2 className={styles.spinner} />
              ) : (
                t('teamMemberSignUp.createAccount')
              )}
            </button>
          </form>

          <footer className={styles.footer}>
            {t('teamMemberSignUp.alreadyHaveAccount')}{' '}
            <a
              onClick={() => (!isSubmitting ? navigate('/signin') : null)}
              style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            >
              {t('teamMemberSignUp.signin')}
            </a>
          </footer>
        </>
      )}

      {signupSuccess && (
        <p className={styles.successMessage}>
          {t('teamMemberSignUp.successMessage')}
        </p>
      )}
    </div>
  );
}
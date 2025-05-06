import React, { useState, useEffect, useContext } from 'react';
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
  const { user, setIsSignup } = useContext(MainContext);
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

  const [name, setName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [nameError, setNameError] = useState(false);

  const [surname, setSurname] = useState('');
  const [surnameFocused, setSurnameFocused] = useState(false);
  const [surnameError, setSurnameError] = useState(false);

  const [invitationCode] = useState(code || '');
  const [invitationCodeError, setInvitationCodeError] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupError, setSignupError] = useState('');

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Validate invitation code
  useEffect(() => {
    if (invitationCode) {
      setInvitationDetails({ invitationCode, businessName: 'the team' });
    } else {
      setInvitationCodeError(true);
      setSignupError(t('teamMemberSignUp.error.invalidCode'));
    }
  }, [invitationCode, t]);

  const isValidEmail = (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(normalizedEmail);
  };

  const isValidPhone = (phone) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  };

  const isValidName = (value) => {
    const nameRegex = /^[a-zA-Z\s-]+$/;
    return nameRegex.test(value) && value.trim().length > 0;
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
    setSignupError(''); // Clear signup error on input change
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
    if (setter === setName) {
      setNameError(!isValidName(value) && value !== '');
    }
    if (setter === setSurname) {
      setSurnameError(!isValidName(value) && value !== '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const isEmailValid = isValidEmail(normalizedEmail);
    const isPasswordValid = password && passwordRequirements.length === 0;
    const isPhoneValid = isValidPhone(phone);
    const isNameValid = isValidName(name);
    const isSurnameValid = isValidName(surname);
    const isInvitationCodeValid = invitationCode && !invitationCodeError;

    setEmailError(!isEmailValid);
    setPasswordError(!isPasswordValid);
    setPhoneError(!isPhoneValid);
    setNameError(!isNameValid);
    setSurnameError(!isSurnameValid);
    setInvitationCodeError(!isInvitationCodeValid);

    if (isEmailValid && isPasswordValid && isPhoneValid && isNameValid && isSurnameValid && isInvitationCodeValid) {
      try {
        setIsSubmitting(true);
        setSignupError('');
        setIsSignup(true);

        // Call Cloud Function to create team member
        await TeamMemberSignUpFunction({
          email: normalizedEmail,
          password,
          phone: phone.trim(),
          name: name.trim(),
          surname: surname.trim(),
          invitationCode,
        });

        // Sign in the new user
        await signInWithEmailAndPassword(auth, normalizedEmail, password);

        // Delay success and navigation to allow Firestore listener to process
        setTimeout(() => {
          setSignupSuccess(true);
          setIsSubmitting(false);
          navigate('/dashboard');
        }, 1500); // Increased to 1.5s to ensure banner triggers
      } catch (error) {
        setIsSubmitting(false);
        setSignupSuccess(false);
        setIsSignup(false);
        let errorMessage = t('teamMemberSignUp.error.generic');
        switch (error.code) {
          case 'already-exists':
            errorMessage = t('teamMemberSignUp.error.emailInUse');
            setEmailError(true);
            break;
          case 'not-found':
            errorMessage = t('teamMemberSignUp.error.invalidCode');
            setInvitationCodeError(true);
            break;
          case 'failed-precondition':
            errorMessage = t('teamMemberSignUp.error.expiredCode');
            setInvitationCodeError(true);
            break;
          case 'auth/invalid-credential':
            errorMessage = t('teamMemberSignUp.error.signInFailed');
            break;
          case 'invalid-argument':
            if (error.message.includes('name')) {
              errorMessage = t('teamMemberSignUp.error.invalidName');
              setNameError(true);
            } else if (error.message.includes('surname')) {
              errorMessage = t('teamMemberSignUp.error.invalidSurname');
              setSurnameError(true);
            } else {
              errorMessage = error.message;
            }
            break;
          default:
            errorMessage = error.message || t('teamMemberSignUp.error.generic');
        }
        setSignupError(errorMessage);
      }
    }
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  return (
    <div className={styles.container}>
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
                ? t('teamMemberSignUp.shortText', { businessName: invitationDetails.businessName })
                : t('teamMemberSignUp.shortTextGeneric')}
            </p>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div
              className={`${styles.inputContainer} ${nameError ? styles.error : ''}`}
            >
              <label
                className={`${styles.label} ${
                  nameFocused || name ? styles.focused : ''
                } ${nameError ? styles.errorText : ''}`}
              >
                {t('teamMemberSignUp.name')}*
              </label>
              <input
                type="text"
                className={styles.inputField}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(name !== '')}
                value={name}
                onChange={handleInputChange(setName, setNameError)}
                disabled={isSubmitting}
              />
              {nameError && (
                <p className={styles.errorText}>
                  {t('teamMemberSignUp.error.invalidName')}
                </p>
              )}
            </div>

            <div
              className={`${styles.inputContainer} ${surnameError ? styles.error : ''}`}
            >
              <label
                className={`${styles.label} ${
                  surnameFocused || surname ? styles.focused : ''
                } ${surnameError ? styles.errorText : ''}`}
              >
                {t('teamMemberSignUp.surname')}*
              </label>
              <input
                type="text"
                className={styles.inputField}
                onFocus={() => setSurnameFocused(true)}
                onBlur={() => setSurnameFocused(surname !== '')}
                value={surname}
                onChange={handleInputChange(setSurname, setSurnameError)}
                disabled={isSubmitting}
              />
              {surnameError && (
                <p className={styles.errorText}>
                  {t('teamMemberSignUp.error.invalidSurname')}
                </p>
              )}
            </div>

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
                !isValidName(name) ||
                !isValidName(surname) ||
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
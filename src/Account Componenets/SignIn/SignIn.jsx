// src/Account Componenets/SignIn/SignIn.jsx
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import styles from "./SignIn.module.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { MainContext } from "../../Contexts/MainContext";
import { useTranslation } from "react-i18next";
import { UserSignIn } from "../../Firebase/Firebase Functions/UserSignIn";
import ForgotPassword from "./Forgot Password/ForgotPassword";

export default function SignIn() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { setUser } = useContext(MainContext); // Removed setUserExistenceChecked

    const [emailFocused, setEmailFocused] = useState(false);
    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState(false);

    const [passwordFocused, setPasswordFocused] = useState(false);
    const [password, setPassword] = useState("");
    const [passwordError, setPasswordError] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [forgotPasswordIsActive, setForgotPasswordIsActive] = useState(false);

    const [userIsSigningIn, setUserIsSigningIn] = useState(false);
    const [userSignInError, setUserSignInError] = useState("");

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const handleSubmit = async (e) => {
        if (!userIsSigningIn) {
            e.preventDefault();
            setEmailError(!email);
            setPasswordError(!password);
            
            if (email && password) {
                try {
                    setUserIsSigningIn(true);
                    setUserSignInError("");
                    const userData = await UserSignIn(email, password);
                    setUser(userData);
                    navigate('/dashboard'); // Replaced window.location.reload()
                } catch (error) {
                    setUserIsSigningIn(false);
                    console.error('Sign-in error:', error);
                    // Handle Firebase Authentication errors
                    if (error.code) {
                        if (error.code.includes("auth/user-not-found") || error.code.includes("auth/invalid-credential")) {
                            setUserSignInError(t("signIn.userNotFound"));
                        } else if (error.code.includes("auth/wrong-password")) {
                            setUserSignInError(t("signIn.wrongPassword"));
                        } else if (error.code.includes("auth/invalid-email")) {
                            setUserSignInError(t("signIn.invalidEmail"));
                        } else if (error.code.includes("auth/too-many-requests")) {
                            setUserSignInError(t("signIn.tooManyRequests"));
                        } else {
                            setUserSignInError(t("signIn.genericError"));
                        }
                    } else {
                        // Handle custom errors (e.g., 'User data not found')
                        setUserSignInError(error.message === 'User data not found' 
                            ? t("signIn.userNotFound") 
                            : t("signIn.genericError"));
                    }
                }
            }
        }
    };

    const handleInputChange = (setter, setError) => (e) => {
        setter(e.target.value);
        if (setError) {
            setError(false);
        }
    };

    const togglePasswordVisibility = () => {
        setPasswordVisible(!passwordVisible);
    };

    return (
        <div className={styles.container}>
            <h1 className={styles.logoText} onClick={() => !userIsSigningIn ? navigate(`/`) : ""}>AVA</h1>
            <header className={styles.header}>
                <h2 className={styles.title}>{t("signIn.signin")}</h2>
                <p className={styles.subText}>{t("signIn.shortText")}</p>
            </header>

            <form className={styles.form} onSubmit={handleSubmit}>
                <div className={`${styles.inputContainer} ${emailError ? styles.error : ""}`}>
                    <label className={`${styles.label} ${emailFocused || email ? styles.focused : ""} ${emailError ? styles.errorText : ""}`}>
                        {t("signIn.email")}*
                    </label>
                    <input
                        type="email"
                        className={styles.inputField}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(email !== "")}
                        value={email}
                        onChange={handleInputChange(setEmail, setEmailError)}
                        disabled={userIsSigningIn}
                    />
                </div>

                <div className={`${styles.inputContainer} ${passwordError ? styles.error : ""}`}>
                    <label className={`${styles.label} ${passwordFocused || password ? styles.focused : ""} ${passwordError ? styles.errorText : ""}`}>
                        {t("signIn.password")}*
                    </label>
                    <input
                        type={passwordVisible ? "text" : "password"}
                        className={styles.inputField}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(password !== "")}
                        value={password}
                        onChange={handleInputChange(setPassword, setPasswordError)}
                        disabled={userIsSigningIn}
                    />
                    <div className={styles.eyeIcons}>
                        <FaEye onClick={togglePasswordVisibility} style={{ cursor: 'pointer', display: passwordVisible ? 'none' : 'block' }} />
                        <FaEyeSlash onClick={togglePasswordVisibility} style={{ cursor: 'pointer', display: passwordVisible ? 'block' : 'none' }} />
                    </div>
                </div>
                <p className={styles.forgotPassword} onClick={() => !userIsSigningIn ? setForgotPasswordIsActive(true) : ""}>{t("signIn.forgotPassword")}</p>

                <button type="submit" className={styles.submitButton} disabled={userIsSigningIn}>
                    {userIsSigningIn ? <ImSpinner2 className={styles.spinner} /> : t("signIn.signin")}
                </button>
                {userSignInError && <p className={styles.errorText} style={{ textAlign: "center" }}>{userSignInError}</p>}
            </form>

            <footer className={styles.footer}>
                {t("signIn.dontHaveAccount")} <a onClick={() => !userIsSigningIn ? navigate(`/signup`) : ""}>{t("signIn.signup")}</a>
            </footer>

            {forgotPasswordIsActive && <ForgotPassword setForgotPasswordIsActive={setForgotPasswordIsActive} />}
        </div>
    );
}
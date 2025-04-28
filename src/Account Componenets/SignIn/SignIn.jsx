import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import styles from "./SignIn.module.css";
import logo from "../../assets/logo-black.png"; 
import { FaEye } from "react-icons/fa6";
import { FaEyeSlash } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { UserSignIn } from '../../../Firebase Functions/User Functions/UserSignIn.jsx'
import { MainContext } from "../../Contexts/MainContext";
import ForgotPassword from "./Forgot Password/ForgotPassword.jsx";
import { useTranslation } from "react-i18next";
export default function SignIn() {

    const {t} = useTranslation();

    const navigate = useNavigate();

    const {user, setUser, setUserExistenceChecked} = useContext(MainContext);

    const [emailFocused, setEmailFocused] = useState(false);
    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState(false);

    const [passwordFocused, setPasswordFocused] = useState(false);
    const [password, setPassword] = useState("");
    const [passwordError, setPasswordError] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);

    const [userIsSigningIn, setUserIsSigningIn] = useState(false);
    const [userSignInError, setUserSignInError] = useState(false);
    const [forgotPasswordIsActive, setForgotPasswordIsActive] = useState(false);

    // Calculate the maximum date (16 years ago from today)
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());


    useEffect(()=>{
        document.body.style.overflow = 'hidden';
    },[])

    const handleSubmit = async (e) => {
        if(!userIsSigningIn){
            e.preventDefault();
            setEmailError(email === "");
            setPasswordError(password === "");
            
            if (email && password !== "") {
                try {
                    // Indicate that sign-in process has started
                    setUserIsSigningIn(true);
                    setUserSignInError(false);
                    // Call the UserSignIn function
                    const result = await UserSignIn(email, password);
        
                    if (result) {
                        setUser(result);
                        // Navigate to the home page after successful sign-in
                        navigate(`/`);
                        window.location.reload();
                    }
                } catch (error) {
                    setUserIsSigningIn(false);
                    console.error(error.code);
                    // Handle different types of errors with specific messages
                    if (error.code.includes("auth/user-not-found")) {
                        setUserSignInError(t("signIn.userNotFound"));
                    } else if (error.code.includes("auth/wrong-password")) {
                        setUserSignInError(t("signIn.wrongPassword"));
                    } else if (error.code.includes("auth/invalid-email")) {
                        setUserSignInError(t("signIn.invalidEmail"));
                    } else if (error.code.includes("auth/too-many-requests")) {
                        setUserSignInError(t("signIn.tooManyRequests"));
                    }else if (error.code.includes("auth/invalid-credential")) {
                        setUserSignInError(t("signIn.userNotFound"));
                    } else {
                        setUserSignInError(t("signIn.genericError"));
                    }
                    
                }
            }
        }
    };
     
    // Function to handle input change and reset error state
    const handleInputChange = (setter, setError) => (e) => {
        setter(e.target.value);
        if (setError) {
            setError(false); // Reset error state on input change
        }
    };

    const togglePasswordVisibility = () => {
        setPasswordVisible(!passwordVisible);
    };

    return (
        <div className={styles.container}>
            <h1 className = {styles.logoText} onClick = {()=>!userIsSigningIn? navigate(`/`):""}>APX</h1>
            <header className={styles.header}>
                <h2 className = {styles.title}>{t("signIn.signin")}</h2>
                <p className={styles.subText}>{t("signIn.shortText")}</p>
            </header>

            <form className={styles.form} onSubmit={handleSubmit}>
                <div className={`${styles.inputContainer} ${emailError ? styles.error : ""}`}>
                    <label className={`${styles.label} ${emailFocused || email ? styles.focused : ""}  ${emailError ? styles.errorText : ""}`}>
                        {t("signIn.email")}*
                    </label>
                    <input
                        type="email"
                        className={styles.inputField}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(email !== "")}
                        value={email}
                        onChange={handleInputChange(setEmail, setEmailError)}
                        disabled = {userIsSigningIn}
                    />
                </div>

                <div className={`${styles.inputContainer} ${passwordError ? styles.error : ""}`}>
                    <label className={`${styles.label} ${passwordFocused || password ? styles.focused : ""} ${passwordError ? styles.errorText : ""}`}>
                        {t("signIn.password")}*
                    </label>
                    <input
                        type={passwordVisible ? "text" : "password"} // Toggle input type
                        className={styles.inputField}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(password !== "")}
                        value={password}
                        onChange={handleInputChange(setPassword, setPasswordError)}
                        disabled = {userIsSigningIn}
                    />
                    <div className={styles.eyeIcons}>
                        <FaEye onClick={togglePasswordVisibility} style={{ cursor: 'pointer', display: passwordVisible ? 'none' : 'block' }} />
                        <FaEyeSlash onClick={togglePasswordVisibility} style={{ cursor: 'pointer', display: passwordVisible ? 'block' : 'none' }} />
                    </div>
                </div>
                <p className = {styles.forgotPassword} onClick = {()=>!userIsSigningIn?setForgotPasswordIsActive(true):""}>{t("signIn.forgotPassword")}</p>

                <button type="submit" className={styles.submitButton} disabled={userIsSigningIn} >{userIsSigningIn?<ImSpinner2 className = {styles.spinner}/>:t("signIn.signin")}</button>
                {userSignInError && <p className={styles.errorText} style={{ textAlign: "center" }}>{userSignInError}</p>}
                </form>

            <footer className={styles.footer}>
            {t("signIn.dontHaveAccount")} <a onClick={() => !userIsSigningIn? navigate(`/signup`):""}>{t("signIn.signup")}</a>
            </footer>

            {forgotPasswordIsActive && <ForgotPassword setForgotPasswordIsActive = {setForgotPasswordIsActive}/>}
        </div>
    );
}
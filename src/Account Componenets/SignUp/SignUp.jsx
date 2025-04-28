import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import styles from "./SignUp.module.css";
import logo from "../../assets/logo-black.png"; 
import { FaChevronDown, FaEye } from "react-icons/fa6";
import { FaEyeSlash } from "react-icons/fa";
import { UserSignUp } from "../../../Firebase Functions/User Functions/UserSignUp.jsx";
import { ImSpinner2 } from "react-icons/im";
import { MainContext } from "../../Contexts/MainContext.jsx";
import DatePicker from "../../Reusable Componenets/Date Picker/DatePicker.jsx";
import { useTranslation } from "react-i18next";

export default function SignUp() {
    const {t} = useTranslation();

    const navigate = useNavigate();
    const { user, setUser} = useContext(MainContext);

    const [firstNameFocused, setFirstNameFocused] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [firstNameError, setFirstNameError] = useState(false);

    const [lastNameFocused, setLastNameFocused] = useState(false);
    const [lastName, setLastName] = useState("");
    const [lastNameError, setLastNameError] = useState(false);

    const [dobFocused, setDobFocused] = useState(false);
    const [dob, setDob] = useState(null); // Initialize as null for DatePicker
    const [dobError, setDobError] = useState(false);

    const [emailFocused, setEmailFocused] = useState(false);
    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState(false);

    const [passwordFocused, setPasswordFocused] = useState(false);
    const [password, setPassword] = useState("");
    const [passwordError, setPasswordError] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [passwordRequirements, setPasswordRequirements] = useState([]);

    const [userSuccessfullyGenerated, setUserSuccessfullyGenerated] = useState(false);
    const [userIsGenerating, setUserIsGenerating] = useState(false);
    const [userGenerationFailed, setUserGenerationFailed] = useState(false);

    const [referralCode, setReferralCode] = useState(null); // State to hold the referral code


    // Calculate the maximum date (16 years ago from today)
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());

    const datePickerContainerRef = useRef(null); // Create a ref for the DatePicker
    const datePickerRef = useRef(null); // Create a ref for the DatePicker

    useEffect(() => {
        // Extract referral code from URL on component load
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        setReferralCode(refCode); // Store the referral code in state
    }, []);

    useEffect(() => {
        document.body.style.overflow = 'hidden';

        // Function to handle clicks outside of the DatePicker
        const handleClickOutside = (event) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target) && datePickerContainerRef.current && !datePickerContainerRef.current.contains(event.target)) {
                setDobFocused(false); // Close DatePicker if clicked outside
            }
        };

        // Attach the event listener
        document.addEventListener("mousedown", handleClickOutside);

        // Cleanup the event listener on component unmount
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            // document.body.style.overflow = 'auto'; // Reset overflow when unmounting
        };
    }, []);

    // Utility function to validate email format
    const isValidEmail = (email) => {
        // Basic email format validation pattern
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Function to handle input change and reset error state
    const handleInputChange = (setter, setError) => (e) => {
        const value = e.target.value;
        setter(value);
        if (setError) {
            setError(false); // Reset error state on input change
        }

        if (setter === setEmail) {
            // Check email format on input change
            setEmailError(!isValidEmail(value)); 
        }

        if (setter === setPassword) {
            checkPasswordRequirements(value); // Check password requirements
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validate form fields
        setFirstNameError(firstName === "");
        setLastNameError(lastName === "");
        setDobError(dob === null); // Check if dob is valid
        setEmailError(!isValidEmail(email)); // Check if email is valid
        setPasswordError(password === "");

        if (firstName && lastName && dob && isValidEmail(email) && passwordRequirements.length === 0) {
            // Proceed with user creation if all validations pass
            try {
                setUserIsGenerating(true);
                setUserGenerationFailed(false);
                const result = await UserSignUp(email, password, firstName, lastName, dob, referralCode);
                setUserIsGenerating(false);
                if (result) {
                    setUserSuccessfullyGenerated(true);
                    setUser(result);
                    setTimeout(() => {
                        navigate(`/`);
                        window.location.reload();
                    }, 1500);

                }
            } catch (error) {
                // Handle errors as before
                setUserIsGenerating(false);
                setUserSuccessfullyGenerated(false);
                setUserGenerationFailed(true);
                // Handle specific error messages as shown previously
            }
        }
    };

const checkPasswordRequirements = (password) => {
    const requirements = [];

    if (password.length < 8) {
        requirements.push(t("signUp.passwordRequirement.minLength"));
    }
    if (!/[A-Z]/.test(password)) {
        requirements.push(t("signUp.passwordRequirement.uppercase"));
    }
    if (!/[a-z]/.test(password)) {
        requirements.push(t("signUp.passwordRequirement.lowercase"));
    }
    if (!/\d/.test(password)) {
        requirements.push(t("signUp.passwordRequirement.number"));
    }

    setPasswordRequirements(requirements);
    setPasswordError(requirements.length > 0);
};


    const togglePasswordVisibility = () => {
        setPasswordVisible(!passwordVisible);
    };

    const handleDateFocus = ()=>{
        if(!dobFocused && !userIsGenerating){
            setDobFocused(true);
        }
    }

    return (
        <div className={styles.container}>
            {!userSuccessfullyGenerated && <>
                <h1 className = {styles.logoText} onClick = {()=>!userIsGenerating?navigate(`/`):""}>APX</h1>
                <header className={styles.header}>
                    {/* <img src={logo} alt="Logo" className={styles.logo} /> */}
                    <h2 className = {styles.title}>{t("signUp.signup")}</h2>
                    <p className={styles.subText}>{t("signUp.shortText")}</p>
                </header>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={`${styles.inputContainer} ${firstNameError ? styles.error : ""}`}>
                        <label className={`${styles.label} ${firstNameFocused || firstName ? styles.focused : ""} ${firstNameError ? styles.errorText : ""}`}>
                        {t("signUp.firstName")}*
                        </label>
                        <input
                            type="text"
                            className={styles.inputField}
                            onFocus={() => setFirstNameFocused(true)}
                            onBlur={() => setFirstNameFocused(firstName !== "")}
                            value={firstName}
                            onChange={handleInputChange(setFirstName, setFirstNameError)}
                            disabled = {userIsGenerating}
                        />
                    </div>

                    <div className={`${styles.inputContainer} ${lastNameError ? styles.error : ""}`}>
                        <label className={`${styles.label} ${lastNameFocused || lastName ? styles.focused : ""} ${lastNameError ? styles.errorText : ""}`}>
                            {t("signUp.lastName")}*
                        </label>
                        <input
                            type="text"
                            className={styles.inputField}
                            onFocus={() => setLastNameFocused(true)}
                            onBlur={() => setLastNameFocused(lastName !== "")}
                            value={lastName}
                            onChange={handleInputChange(setLastName, setLastNameError)}
                            disabled = {userIsGenerating}
                        />
                    </div>

                    <div className={`${styles.inputContainer} ${dobError ? styles.error : ""}`} ref = {datePickerContainerRef}>
                        <label className={`${styles.label} ${dobFocused || dob ? styles.focused : ""} ${dobError ? styles.errorText : ""}`} style={{ zIndex: "1" }}>
                        {t("signUp.dob")}*
                        </label>
                        <div className={`${styles.inputField} ${styles.centerItems}`} onClick={handleDateFocus}>
                            <p className = {styles.dateText}>{dob ? dob.toLocaleDateString() : ""}</p>
                            {dobFocused && (
                                <div ref={datePickerRef}>
                                    <DatePicker maxDate={maxDate}
                                    setDob={setDob}
                                    setDobFocused={setDobFocused}
                                    setDobError = {setDobError}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`${styles.inputContainer} ${emailError ? styles.error : ""}`}>
                        <label className={`${styles.label} ${emailFocused || email ? styles.focused : ""} ${emailError ? styles.errorText : ""}`}>
                            {t("signUp.email")}
                        </label>
                        <input
                            type="email"
                            className={styles.inputField}
                            onFocus={() => setEmailFocused(true)}
                            onBlur={() => setEmailFocused(email !== "")}
                            value={email}
                            onChange={handleInputChange(setEmail, setEmailError)}
                            disabled = {userIsGenerating}
                        />
                    </div>

                    <div className={`${styles.inputContainer} ${passwordError ? styles.error : ""}`}>
                        <label className={`${styles.label} ${passwordFocused || password ? styles.focused : ""} ${passwordError ? styles.errorText : ""}`}>
                        {t("signUp.password")}
                        </label>
                        <input
                            type={passwordVisible ? "text" : "password"} // Toggle input type
                            className={styles.inputField}
                            onFocus={() => setPasswordFocused(true)}
                            onBlur={() => setPasswordFocused(password !== "")}
                            value={password}
                            onChange={handleInputChange(setPassword, setPasswordError)}
                            disabled = {userIsGenerating}
                        />
                        <div className={styles.eyeIcons}>
                            <FaEye onClick={togglePasswordVisibility} style={{ cursor: 'pointer', display: passwordVisible ? 'none' : 'block' }} />
                            <FaEyeSlash onClick={togglePasswordVisibility} style={{ cursor: 'pointer', display: passwordVisible ? 'block' : 'none' }} />
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
                    <button type="submit" className={styles.submitButton} disabled={userIsGenerating}>
                        {userIsGenerating ? <ImSpinner2 className={styles.spinner} /> : t("signUp.createAccount")}
                    </button>
                </form>

                {userGenerationFailed && <p className={styles.errorText} style={{ textAlign: "center" }}>{userGenerationFailed}</p>}

                <footer className={styles.footer}>
                {t("signUp.alreadyHaveAccount")} <a onClick={() => !userIsGenerating?navigate(`/signin`):""}>{t("signUp.signin")}</a>
                </footer>
            </>}

            {!userIsGenerating && userSuccessfullyGenerated &&
                <p className={styles.successMessage}>{t("signUp.successMessage")}</p>
            }
        </div>
    );
}
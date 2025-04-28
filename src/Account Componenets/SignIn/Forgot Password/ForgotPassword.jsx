import React, { useContext, useState } from "react";
import styles from './ForgotPassword.module.css';
import { IoClose } from "react-icons/io5";
import { ImSpinner2 } from "react-icons/im";

import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../../../firebase";
import { MainContext } from "../../../Contexts/MainContext";
import { useTranslation } from "react-i18next";

export default function ForgotPassword({ setForgotPasswordIsActive, setEditPasswordIsEnabled, settingsForgotPassword }) {

    const { user } = useContext(MainContext);

    const { t } = useTranslation();

    const [email, setEmail] = useState(user ? user.email : "");
    const [emailFocused, setEmailFocused] = useState(false);  // To handle label focus
    const [emailError, setEmailError] = useState("");  // To store email validation error
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
        setEmailError("");
    };

    const handleFocus = () => setEmailFocused(true);

    const handleBlur = () => {
        if (email === "") {
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
            setEmailError(t("forgotPassword.emailError"));
            return;
        }

        setIsProcessed(true);
        try {
            await sendPasswordResetEmail(auth, email);
            setEmailWasSent(true);
        } catch (error) {
            console.error("Error sending password reset email:", error);
        } finally {
            setIsProcessed(false);
        }
    };

    return (
        <>
            <div className={styles.background} onClick={handleForgotPasswordClose}></div>
            <div className={styles.forgotPasswordContainer}>
                <IoClose 
                    size={24} 
                    className={styles.closeButton} 
                    onClick={handleForgotPasswordClose}
                />
                <h2 className={styles.title}>
                    {!emailWasSent ? t("forgotPassword.title") : t("forgotPassword.emailSentTitle")}
                </h2>
                <p className={styles.emailSentText}>
                    {!emailWasSent
                        ? t("forgotPassword.instructions")
                        : t("forgotPassword.emailSentInstructions")
                    }
                </p>
                
                {!emailWasSent && (
                    <div className={styles.inputContainer}>
                        <label className={`${styles.label} ${emailFocused || email ? styles.focused : ""}`}>
                            {t("forgotPassword.label")}
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={handleInputChange}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            className={styles.inputField}
                            disabled={isProcessed}
                        />
                    </div>
                )}
                
                {emailError && !emailWasSent && <p className={styles.errorText}>{emailError}</p>}
                
                <button 
                    className={styles.saveChanges} 
                    onClick={!isProcessed && !emailWasSent ? handleForgotPasswordSubmit : emailWasSent ? handleForgotPasswordClose : null}
                >
                    {isProcessed ? <ImSpinner2 className={styles.spinner} /> : (!emailWasSent ? t("forgotPassword.sendEmailButton") : t("forgotPassword.gotItButton"))}
                </button>
            </div>
        </>
    );
}
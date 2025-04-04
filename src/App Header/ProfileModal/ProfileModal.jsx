import { useState, useEffect, useRef } from "react";
import styles from "./ProfileModal.module.css";

const ProfileModal = ({ onClose, onManageHeaders, onOptionChange, activeOption, isMobile, setIsSettingsModalOpen }) => {
    const [isClosing, setIsClosing] = useState(false);
    const modalRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                handleClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 300);
    };

    const handleOptionClick = (option) => {
        onOptionChange(option);
        handleClose();
    };

    return (
        <div className={`${styles.modalOverlay} ${isClosing ? styles.closing : ""}`}>
            <div className={styles.modalContent} ref={modalRef}>
                <button className={styles.closeButton} onClick={handleClose}>
                    ✕
                </button>
                <div className={styles.buttonContainer}>
                    <button
                        className={styles.modalButton}
                        onClick={() => {
                            setIsSettingsModalOpen(true);
                            handleClose();
                        }}
                    >
                        Settings
                    </button>
                    {isMobile && (
                        <>
                            <button
                                className={`${styles.modalButton} ${activeOption === "dashboard" ? styles.active : ""} ${styles.dashboard}`}
                                onClick={() => handleOptionClick("dashboard")}
                            >
                                Dashboard
                            </button>
                            <button
                                className={`${styles.modalButton} ${activeOption === "sheets" ? styles.active : ""} ${styles.sheets}`}
                                onClick={() => handleOptionClick("sheets")}
                            >
                                Sheets
                            </button>
                            <button
                                className={`${styles.modalButton} ${activeOption === "cards" ? styles.active : ""} ${styles.cards}`}
                                onClick={() => handleOptionClick("cards")}
                            >
                                Cards
                            </button>
                            <button
                                className={`${styles.modalButton} ${activeOption === "invoices" ? styles.active : ""} ${styles.invoices}`}
                                onClick={() => handleOptionClick("invoices")}
                            >
                                Invoices
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
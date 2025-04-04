import { useState, useEffect, useRef } from "react";
import styles from "./ProfileModal.module.css";

const ProfileModal = ({ onClose, onManageHeaders, activeOption, setIsSettingsModalOpen }) => {
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
        }, 200);
    };

    return (
        <div className={`${styles.modalOverlay} ${isClosing ? styles.closing : ""}`}>
            <div className={styles.modalContent} ref={modalRef}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>Profile</h2>
                    <button className={styles.closeButton} onClick={handleClose}>
                        ✕
                    </button>
                </div>
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
                    <button
                        className={styles.modalButton}
                        onClick={() => {
                            onManageHeaders();
                            handleClose();
                        }}
                    >
                        Manage Headers
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
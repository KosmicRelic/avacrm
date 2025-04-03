import { useState, useEffect, useRef } from "react";
import styles from "./ProfileModal.module.css";

const ProfileModal = ({ onClose, onManageHeaders }) => {
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
 // Wait for animation to complete (0.3s) before fully closing
 setTimeout(() => {
 setIsClosing(false);
 onClose();
 }, 300);
 };

 return (
    <div className={`${styles.modalOverlay} ${isClosing ? styles.closing : ""}`}>
      <div className={styles.modalContent} ref={modalRef}>
        <button className={styles.closeButton} onClick={handleClose}>
          ✕
        </button>
        <div className={styles.buttonContainer}>
          <button className={styles.modalButton} onClick={onManageHeaders}>
            Manage Headers
          </button>
          <button className={styles.modalButton} onClick={() => {}}>
            Invite Agents
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
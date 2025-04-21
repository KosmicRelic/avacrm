import React, { useContext, useEffect, useRef, useState } from 'react';
import styles from './WidgetView.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { FaChevronLeft } from 'react-icons/fa';

const WidgetView = ({ widget, onClose, onEdit }) => {
  const { isDarkTheme } = useContext(MainContext);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    const timeoutDuration = window.innerWidth <= 767 ? 300 : 200;
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, timeoutDuration);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div
      className={`${styles.widgetOverlay} ${isDarkTheme ? styles.darkTheme : ''} ${
        isClosing ? styles.closing : ''
      }`}
    >
      <div
        className={`${styles.widgetContent} ${isDarkTheme ? styles.darkTheme : ''} ${
          isClosing ? styles.closing : ''
        }`}
        ref={modalRef}
      >
        <div className={styles.widgetHeader}>
          <button
            className={`${styles.backButton} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={handleClose}
          >
            <span className={styles.chevron}>
              <FaChevronLeft />
            </span>
            Back
          </button>
          <h2 className={`${styles.widgetTitle} ${isDarkTheme ? styles.darkTheme : ''}`}>
            {widget.title}
          </h2>
          <button
            className={`${styles.editButton} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={onEdit}
          >
            Edit
          </button>
        </div>
        <div className={styles.widgetBody}>
          <p>{widget.data || 'Widget content will be displayed here'}</p>
        </div>
      </div>
    </div>
  );
};

export default WidgetView;
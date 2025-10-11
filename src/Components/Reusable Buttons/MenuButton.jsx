import { useState, useEffect, useRef } from 'react';
import { BsThreeDots } from 'react-icons/bs';
import { MdDelete } from 'react-icons/md';
import styles from './MenuButton.module.css';

const MenuButton = ({
  isDarkTheme = false,
  onDeleteObject,
  className = '',
  ariaLabel = 'Menu'
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const handleDeleteObject = () => {
    setIsDropdownOpen(false);
    if (onDeleteObject) onDeleteObject();
  };

  return (
    <div className={styles.menuButtonContainer} ref={dropdownRef}>
      <button
        className={`${styles.menuButton} ${isDarkTheme ? styles.darkTheme : ''} ${className}`}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        aria-label={ariaLabel}
      >
        <BsThreeDots size={26} />
      </button>
      {isDropdownOpen && (
        <div className={`${styles.dropdown} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <button
            className={`${styles.dropdownItem} ${isDarkTheme ? styles.darkTheme : ''}`}
            onClick={handleDeleteObject}
          >
            <div className={styles.iconContainer}>
              <MdDelete />
            </div>
            <div className={styles.labelContainer}>
              Delete Object
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default MenuButton;
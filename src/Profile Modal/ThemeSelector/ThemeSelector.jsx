// src/Profile Modal/ThemeSelector/ThemeSelector.jsx
import React, { useContext, useState } from 'react';
import { MainContext } from '../../Contexts/MainContext';
import styles from './ThemeSelector.module.css';
import { FiSun, FiMoon, FiSmartphone } from 'react-icons/fi';

const ThemeSelector = () => {
  const { themeMode, setTheme, isDarkTheme } = useContext(MainContext);
  const [justSwitched, setJustSwitched] = useState(null);



  const themeOptions = [
    {
      id: 'light',
      label: 'Light',
      icon: FiSun,
      description: 'Always use light theme'
    },
    {
      id: 'dark',
      label: 'Dark',
      icon: FiMoon,
      description: 'Always use dark theme'
    },
    {
      id: 'system',
      label: 'System',
      icon: FiSmartphone,
      description: 'Follow device settings'
    }
  ];

  const handleThemeSelect = (theme) => {
    setJustSwitched(theme);
    setTheme(theme);
    
    setTimeout(() => {
      setJustSwitched(null);
    }, 2000);
  };

  return (
    <div className={`${styles.themeSelector} ${isDarkTheme ? styles.dark : ''}`}>
      <div className={styles.optionsGrid}>
        {themeOptions.map((option) => {
          const IconComponent = option.icon;
          const isSelected = themeMode === option.id;
          
          return (
            <button
              key={option.id}
              className={`${styles.themeOption} ${isSelected ? styles.selected : ''}`}
              onClick={() => handleThemeSelect(option.id)}
            >
              <div className={styles.iconWrapper}>
                <IconComponent size={20} />
              </div>
              <div className={styles.optionContent}>
                <span className={styles.optionLabel}>{option.label}</span>
                <span className={styles.optionDescription}>{option.description}</span>
              </div>
              <div className={`${styles.selectionIndicator} ${isSelected ? styles.active : ''}`}>
                <div className={styles.dot} />
              </div>
            </button>
          );
        })}
      </div>
      
      {justSwitched && (
        <div className={`${styles.switchFeedback} ${styles.fadeIn}`}>
          <span className={styles.feedbackText}>
            Switched to {justSwitched === 'system' ? 'system' : justSwitched} theme
            {justSwitched === 'system' && ` (${isDarkTheme ? 'dark' : 'light'} mode)`}
          </span>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
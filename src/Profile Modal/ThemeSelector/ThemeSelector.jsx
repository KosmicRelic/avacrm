// src/Profile Modal/ThemeSelector/ThemeSelector.jsx
import { useContext } from 'react';
import { MainContext } from '../../Contexts/MainContext';
import styles from './ThemeSelector.module.css';
import { FiSun, FiMoon, FiSmartphone } from 'react-icons/fi';

const ThemeSelector = () => {
  const { themeMode, setTheme, isDarkTheme } = useContext(MainContext);

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
      label: 'Auto',
      icon: FiSmartphone,
      description: 'Follow device settings'
    }
  ];

  const handleThemeSelect = (theme) => {
    setTheme(theme);
  };

  return (
    <div className={`${styles.themeSelector} ${isDarkTheme ? styles.dark : ''}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>Appearance</h3>
        <p className={styles.subtitle}>Choose how the app looks to you</p>
      </div>

      <div className={styles.segmentedControl}>
        {themeOptions.map((option) => {
          const IconComponent = option.icon;
          const isSelected = themeMode === option.id;

          return (
            <button
              key={option.id}
              className={`${styles.segment} ${isSelected ? styles.selected : ''}`}
              onClick={() => handleThemeSelect(option.id)}
            >
              <div className={styles.segmentContent}>
                <IconComponent size={14} className={styles.segmentIcon} />
                <span className={styles.segmentLabel}>{option.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSelector;
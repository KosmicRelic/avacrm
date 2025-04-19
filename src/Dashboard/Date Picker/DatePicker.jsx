import React, { useState, useEffect, useRef, useContext } from 'react';
import styles from './DatePicker.module.css';
import { MainContext } from '../../Contexts/MainContext';

const DatePicker = () => {
  const { isDarkTheme } = useContext(MainContext);
  const options = ['D', 'W', 'M','6M', 'Y'];
  const [activeOption, setActiveOption] = useState(options[0]);
  const highlightRef = useRef(null);
  const buttonRefs = useRef({});

  const updateHighlight = (option) => {
    const button = buttonRefs.current[option];
    if (button && highlightRef.current) {
      const rect = button.getBoundingClientRect();
      const parentRect = button.parentElement.getBoundingClientRect();
      highlightRef.current.style.width = `${rect.width}px`;
      highlightRef.current.style.left = `${rect.left - parentRect.left}px`;
    }
  };

  const handleClick = (option) => {
    setActiveOption(option);
    updateHighlight(option);
  };

  useEffect(() => {
    updateHighlight(activeOption);
    const handleResize = () => updateHighlight(activeOption);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeOption]);

  return (
    <div
      className={`${styles.datePicker} ${isDarkTheme ? styles.darkTheme : ''}`}
    >
      {options.map((option) => (
        <button
          key={option}
          ref={(el) => (buttonRefs.current[option] = el)}
          className={`${styles.button} ${activeOption === option ? styles.active : ''}`}
          onClick={() => handleClick(option)}
        >
          {option}
        </button>
      ))}
      <div
        className={`${styles.highlight} ${isDarkTheme ? styles.darkTheme : ''}`}
        ref={highlightRef}
      ></div>
    </div>
  );
};

export default DatePicker;
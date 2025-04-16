import React, { useState, useEffect, useRef, useContext } from 'react';
import styles from './DatePicker.module.css';
import { MainContext } from '../../Contexts/MainContext';

const DatePicker = () => {
  const { isDarkTheme } = useContext(MainContext); // Access dark theme state
  const options = ['Today', 'Weekly', 'Monthly', 'Date'];
  const [activeOption, setActiveOption] = useState(options[0]);
  const highlightRef = useRef(null);
  const buttonRefs = useRef({});

  // Update highlight position and size
  const updateHighlight = (option) => {
    const button = buttonRefs.current[option];
    if (button && highlightRef.current) {
      const rect = button.getBoundingClientRect();
      const parentRect = button.parentElement.getBoundingClientRect();
      highlightRef.current.style.width = `${rect.width}px`;
      highlightRef.current.style.left = `${rect.left - parentRect.left}px`;
    }
  };

  // Handle button click
  const handleClick = (option) => {
    setActiveOption(option);
    updateHighlight(option);
  };

  // Initialize highlight and update on resize
  useEffect(() => {
    updateHighlight(activeOption);
    const handleResize = () => updateHighlight(activeOption);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeOption]);

  return (
    <div className={`${styles.datePicker} ${isDarkTheme ? styles.darkTheme : ''}`}>
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
      <div className={`${styles.highlight} ${isDarkTheme ? styles.darkTheme : ''}`} ref={highlightRef}></div>
    </div>
  );
};

export default DatePicker;
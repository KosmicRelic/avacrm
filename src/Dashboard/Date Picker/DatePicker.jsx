import React, { useState, useEffect, useRef, useContext } from 'react';
import styles from './DatePicker.module.css';
import { MainContext } from '../../Contexts/MainContext';

const DatePicker = () => {
  const { isDarkTheme } = useContext(MainContext);
  const options = ['D', 'W', 'M', '6M', 'Y'];
  const [activeOption, setActiveOption] = useState(options[0]);
  const [fadedSeparators, setFadedSeparators] = useState([]); // Track which separators are faded
  const highlightRef = useRef(null);
  const buttonRefs = useRef({});

  const updateHighlight = (option) => {
    const button = buttonRefs.current[option];
    if (button && highlightRef.current) {
      const rect = button.getBoundingClientRect();
      const parentRect = button.parentElement.getBoundingClientRect();
      highlightRef.current.style.width = `${rect.width}px`;
      highlightRef.current.style.left = `${rect.left - parentRect.left}px`;

      // Calculate which separators are overlapped by the highlight
      const highlightRect = highlightRef.current.getBoundingClientRect();
      const newFadedSeparators = [];

      options.forEach((opt, index) => {
        if (index === options.length - 1) return; // Skip last button (no separator)
        const btn = buttonRefs.current[opt];
        if (btn) {
          const btnRect = btn.getBoundingClientRect();
          const separatorX = btnRect.right; // Separator is at the right edge of the button
          // Check if the highlight overlaps the separator
          if (
            separatorX >= highlightRect.left &&
            separatorX <= highlightRect.right
          ) {
            newFadedSeparators.push(opt);
          }
        }
      });

      setFadedSeparators(newFadedSeparators);
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
      {options.map((option, index) => (
        <button
          key={option}
          ref={(el) => (buttonRefs.current[option] = el)}
          className={`${styles.button} ${
            activeOption === option ? styles.active : ''
          } ${fadedSeparators.includes(option) ? styles.fadedSeparator : ''}`}
          onClick={() => handleClick(option)}
          data-last={index === options.length - 1 ? 'true' : 'false'}
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
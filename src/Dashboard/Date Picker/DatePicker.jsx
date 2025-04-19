import React, { useState, useEffect, useRef, useContext } from 'react';
import styles from './DatePicker.module.css';
import { MainContext } from '../../Contexts/MainContext';

const DatePicker = () => {
  const { isDarkTheme } = useContext(MainContext);
  const options = ['Today', 'Weekly', 'Monthly', 'Date'];
  const [activeOption, setActiveOption] = useState(options[0]);
  const [collapsed, setCollapsed] = useState(true); // Collapse by default
  const highlightRef = useRef(null);
  const buttonRefs = useRef({});
  const datePickerRef = useRef(null); // Reference for the DatePicker container

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
    setCollapsed(true); // Auto-collapse after selecting
  };

  const handleClickOutside = (e) => {
    // Close DatePicker if click is outside of it
    if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
      setCollapsed(true);
    }
  };

  useEffect(() => {
    if (!collapsed) updateHighlight(activeOption);
    const handleResize = () => updateHighlight(activeOption);
    window.addEventListener('resize', handleResize);
    // Add event listener for clicks outside of the DatePicker
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeOption, collapsed]);

  // return (
  //   <div
  //     ref={datePickerRef}
  //     className={`${styles.datePicker} ${collapsed ? styles.collapsed : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
  //   >
  //     {collapsed ? (
  //       <button
  //         className={`${styles.button} ${styles.active}`}
  //         onClick={() => setCollapsed(false)} // Expanding the DatePicker
  //       >
  //         {activeOption}
  //       </button>
  //     ) : (
  //       <>
  //         {options.map((option) => (
  //           <button
  //             key={option}
  //             ref={(el) => (buttonRefs.current[option] = el)}
  //             className={`${styles.button} ${activeOption === option ? styles.active : ''}`}
  //             onClick={() => handleClick(option)}
  //           >
  //             {option}
  //           </button>
  //         ))}
  //         <div
  //           className={`${styles.highlight} ${isDarkTheme ? styles.darkTheme : ''}`}
  //           ref={highlightRef}
  //         ></div>
  //       </>
  //     )}
  //   </div>
  // );
};

export default DatePicker;
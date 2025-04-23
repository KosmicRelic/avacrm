import React, { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import styles from './Metrics.module.css';
import { MainContext } from '../Contexts/MainContext';
import MetricsContent from './MetricsContent/MetricsContent';

const Metrics = ({ selectedMetricData }) => {
  const { isDarkTheme, metricsCategories } = useContext(MainContext);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  const isMobile = windowWidth <= 1024;

  // Update window width on resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set selectedCategory from selectedMetricData or reset when metricsCategories changes
  useEffect(() => {
    if (selectedMetricData?.category) {
      setSelectedCategory(selectedMetricData.category);
      setIsClosing(false);
    } else {
      setSelectedCategory(null);
      setIsClosing(false);
    }
  }, [selectedMetricData, metricsCategories]);

  // Reset selected category on mobile when closing
  useEffect(() => {
    if (isMobile && isClosing) {
      setTimeout(() => {
        setSelectedCategory(null);
        setIsClosing(false); // Ensure isClosing is reset to allow reopening
      }, 300); // Match animation duration
    }
  }, [isMobile, isClosing]);

  // Handle category click
  const handleCategoryClick = (category) => {
    if (selectedCategory?.category === category.category && isMobile) {
      setIsClosing(true); // Trigger slide-out on mobile if same category
    } else {
      setSelectedCategory(category);
      setIsClosing(false); // Ensure slide-in for new category
    }
  };

  return (
    <div className={`${styles.sheetWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={`${styles.tableContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <div className={`${styles.categoryList} ${isDarkTheme ? styles.darkTheme : ''}`}>
          {metricsCategories.length > 0 ? (
            metricsCategories.map((category, index) => (
              <button
                key={`${category.category}-${index}`}
                className={`${styles.categoryItem} ${isDarkTheme ? styles.darkTheme : ''} ${
                  selectedCategory?.category === category.category ? styles.activeItem : ''
                }`}
                onClick={() => handleCategoryClick(category)}
              >
                <span>{category.category}</span>
              </button>
            ))
          ) : (
            <p className={`${styles.placeholder} ${isDarkTheme ? styles.darkTheme : ''}`}>
              No categories available
            </p>
          )}
        </div>
      </div>
      {!isMobile && (
        <div className={`${styles.cardDetailsContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <MetricsContent
            selectedCategory={selectedCategory}
            selectedMetric={null} // Ensure step 1 is shown
            previousTitle={selectedCategory?.category}
          />
        </div>
      )}
      {isMobile && (
        <div
          className={`${styles.cardDetailsMobile} ${isDarkTheme ? styles.darkTheme : ''} ${
            selectedCategory && !isClosing ? styles.cardOpen : styles.cardClosed
          }`}
        >
          <MetricsContent
            selectedCategory={selectedCategory}
            selectedMetric={null} // Ensure step 1 is shown
            previousTitle={selectedCategory?.category}
          />
        </div>
      )}
    </div>
  );
};

Metrics.propTypes = {
  selectedMetricData: PropTypes.shape({
    category: PropTypes.shape({
      category: PropTypes.string.isRequired,
      metrics: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          name: PropTypes.string.isRequired,
          type: PropTypes.string.isRequired,
          value: PropTypes.string,
          data: PropTypes.object,
        })
      ).isRequired,
    }),
    metric: PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      value: PropTypes.string,
      data: PropTypes.object,
    }),
  }),
};

export default Metrics;
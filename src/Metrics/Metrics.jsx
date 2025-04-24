import React, { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import styles from './Metrics.module.css';
import { MainContext } from '../Contexts/MainContext';
import MetricsContent from './MetricsContent/MetricsContent';

const Metrics = ({ selectedMetricData, onEditMetrics, onMetricDataChange }) => {
  const { isDarkTheme, metrics } = useContext(MainContext);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  const isMobile = windowWidth <= 767;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedMetricData?.category) {
      setSelectedCategory(selectedMetricData.category);
      setIsClosing(false);
    } else {
      setSelectedCategory(null);
      setIsClosing(false);
    }
  }, [selectedMetricData]);

  const handleCategoryClick = (category) => {
    if (selectedCategory?.category === category.category && isMobile) {
      setIsClosing(true);
    } else {
      setSelectedCategory(category);
      setIsClosing(false);
      // Clear the selected metric when changing categories
      if (selectedMetricData?.metric && onMetricDataChange) {
        onMetricDataChange({ category, metric: null });
      }
    }
  };

  const handleClose = () => {
    setSelectedCategory(null);
    setIsClosing(false);
  };

  const handleEditMetrics = () => {
    onEditMetrics();
  };

  return (
    <div className={`${styles.sheetWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={`${styles.tableContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <div className={`${styles.categoryList} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <div className={styles.titleContainer}>
            <h3 className={`${styles.titleMetrics} ${isDarkTheme ? styles.darkTheme : ''}`}>
              Metrics
            </h3>
            <button
              className={`${styles.editButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={handleEditMetrics}
            >
              Edit
            </button>
          </div>
          {metrics.length > 0 ? (
            metrics.map((category, index) => (
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
            selectedMetric={selectedMetricData?.metric || null}
            previousTitle={selectedCategory?.category}
            onClose={handleClose}
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
            selectedMetric={selectedMetricData?.metric || null}
            previousTitle={selectedCategory?.category}
            onClose={handleClose}
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
  onEditMetrics: PropTypes.func.isRequired,
  onMetricDataChange: PropTypes.func, // New prop for updating selectedMetricData
};

export default Metrics;
import React, { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import styles from './Metrics.module.css';
import { MainContext } from '../Contexts/MainContext';
import MetricsContent from './MetricsContent/MetricsContent';
import { GrUpdate } from "react-icons/gr";
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

// Logging utility for debugging
const logMetricsDebug = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[Metrics Debug]', ...args);
  }
};

const Metrics = ({ selectedMetricData, onEditMetrics, onMetricDataChange }) => {
  const { isDarkTheme, metrics, businessId, user } = useContext(MainContext);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

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

  // Handler for updating metrics via cloud function
  const handleUpdateMetrics = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    logMetricsDebug('handleUpdateMetrics called', { businessId });
    try {
      logMetricsDebug('Calling updateMetrics cloud function', { businessId });
      const updateMetrics = httpsCallable(functions, 'updateMetrics');
      const result = await updateMetrics({ businessId });
      // Add logs for returned data structure
      if (result && typeof result === 'object') {
        logMetricsDebug('updateMetrics result:', result);
        if (result.cards) {
          logMetricsDebug('updateMetrics cards:', Array.isArray(result.cards) ? result.cards : result.cards);
        }
        if (result.metricsCategories) {
          logMetricsDebug('updateMetrics metricsCategories:', Array.isArray(result.metricsCategories) ? result.metricsCategories : result.metricsCategories);
        }
        if (result.cardTemplates) {
          logMetricsDebug('updateMetrics cardTemplates:', Array.isArray(result.cardTemplates) ? result.cardTemplates : result.cardTemplates);
        }
      } else {
        logMetricsDebug('updateMetrics result (non-object):', result);
      }
      setSuccess(true);
      alert('Metrics updated successfully!');
    } catch (err) {
      // Log the error and as much context as possible
      console.error('[Metrics Debug] updateMetrics error', err);
      if (err && err.message) {
        console.error('[Metrics Debug] updateMetrics error message:', err.message);
      }
      if (err && err.stack) {
        console.error('[Metrics Debug] updateMetrics error stack:', err.stack);
      }
      if (err && err.code) {
        console.error('[Metrics Debug] updateMetrics error code:', err.code);
      }
      if (err && err.details) {
        console.error('[Metrics Debug] updateMetrics error details:', err.details);
      }
      if (typeof err === 'object') {
        try {
          console.error('[Metrics Debug] updateMetrics error (full object):', JSON.stringify(err));
        } catch (jsonErr) {
          console.error('[Metrics Debug] updateMetrics error (object, not stringifiable):', err);
        }
      }
      // Optionally, log the businessId and any other relevant state
      console.error('[Metrics Debug] updateMetrics businessId:', businessId);
      setError(err.message || 'Failed to update metrics');
      alert('Failed to update metrics: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${styles.sheetWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={`${styles.tableContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
        <div className={`${styles.categoryList} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <div className={styles.titleContainer}>
            <h3 className={`${styles.titleMetrics} ${isDarkTheme ? styles.darkTheme : ''}`}>
              Metrics
            </h3>
            <>
            <GrUpdate style={{color: "blue", cursor: "pointer"}} onClick={handleUpdateMetrics}/>
            <button
              className={`${styles.editButton} ${isDarkTheme ? styles.darkTheme : ''}`}
              onClick={handleEditMetrics}
            >
              Edit
            </button>
            </>
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
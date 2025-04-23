import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './MetricsContent.module.css';
import { useContext } from 'react';
import { MainContext } from '../../Contexts/MainContext';
import { FaChevronLeft } from 'react-icons/fa';

const MetricsContent = ({ selectedCategory, selectedMetric, previousTitle, onClose }) => {
  const { isDarkTheme } = useContext(MainContext);
  const [currentStep, setCurrentStep] = useState(1);
  const [localSelectedMetric, setLocalSelectedMetric] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldAnimateIn, setShouldAnimateIn] = useState(false);
  const containerRef = useRef(null);
  const isOpenRef = useRef(false); // Tracks if component is open

  // Handle selectedMetric for widget clicks (navigate to step 2)
  useEffect(() => {
    if (selectedMetric) {
      setCurrentStep(2);
      setLocalSelectedMetric(selectedMetric);
      setIsClosing(false);
      setShouldAnimateIn(false); // No slideIn for widget clicks
      isOpenRef.current = true; // Mark as open
    }
  }, [selectedMetric]);

  // Handle category change and initial open
  useEffect(() => {
    if (selectedMetric) {
      // Skip category logic if selectedMetric is set (widget click)
      return;
    }

    if (selectedCategory && !isOpenRef.current) {
      // Component is opening for the first time
      setShouldAnimateIn(true); // Trigger slideIn
      setCurrentStep(1); // Start at step 1
      setLocalSelectedMetric(null); // Clear selected metric
      setIsClosing(false);
      isOpenRef.current = true; // Mark as open
    } else if (selectedCategory && isOpenRef.current) {
      // Category changed while already open
      setCurrentStep(1); // Reset to step 1
      setLocalSelectedMetric(null); // Clear selected metric
      setIsClosing(false);
      setShouldAnimateIn(false); // No animation for category change
    } else if (!selectedCategory && isOpenRef.current) {
      // Component is closing
      setIsClosing(true); // Trigger slideOut
      isOpenRef.current = false; // Mark as closed
    }
  }, [selectedCategory, selectedMetric]);

  const handleMetricClick = useCallback((metric) => {
    setLocalSelectedMetric(metric);
    setCurrentStep(2);
    setShouldAnimateIn(false); // No animation when clicking a metric
  }, []);

  const handleBack = useCallback(() => {
    if (currentStep === 2) {
      // Go back to step 1 from step 2
      setCurrentStep(1);
      setLocalSelectedMetric(null);
      setShouldAnimateIn(false); // No animation when going back to step 1
    } else {
      // Trigger close animation from step 1
      setIsClosing(true);
    }
  }, [currentStep]);

  // Handle animation end to reset state and notify parent
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleAnimationEnd = () => {
      if (isClosing) {
        setCurrentStep(1);
        setLocalSelectedMetric(null);
        setIsClosing(false); // Reset isClosing to allow reopening
        setShouldAnimateIn(false); // Reset animation state
        isOpenRef.current = false; // Mark as closed
        if (onClose) onClose(); // Notify parent to clear selectedCategory
      } else if (shouldAnimateIn) {
        setShouldAnimateIn(false); // Reset after slideIn completes
      }
    };

    container.addEventListener('animationend', handleAnimationEnd);
    return () => container.removeEventListener('animationend', handleAnimationEnd);
  }, [isClosing, shouldAnimateIn, onClose]);

  return (
    <div
      ref={containerRef}
      className={`${styles.viewContainer} ${isDarkTheme ? styles.darkTheme : ''} ${
        isClosing ? styles.slideOut : shouldAnimateIn ? styles.slideIn : ''
      }`}
    >
      {[1, 2].map((step) => (
        <div
          key={step}
          className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ''} ${
            step !== currentStep ? styles.hidden : ''
          }`}
          style={{
            display: step !== currentStep ? 'none' : 'block',
          }}
        >
          {step === 1 && (
            <>
              {selectedCategory && (
                <button
                  className={`${styles.topBackButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  onClick={handleBack}
                >
                  <FaChevronLeft /> {previousTitle || 'Categories'}
                </button>
              )}
              <div className={`${styles.metricList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                {selectedCategory ? (
                  <>
                    {selectedCategory.metrics.length > 0 ? (
                      selectedCategory.metrics.map((metric, index) => (
                        <div
                          key={`${metric.id}-${index}`}
                          className={`${styles.metricItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                          onClick={() => handleMetricClick(metric)}
                        >
                          <div className={styles.metricRow}>
                            <div className={`${styles.metricNameType} ${isDarkTheme ? styles.darkTheme : ''}`}>
                              <span>{metric.name}</span>
                              <span className={`${styles.metricType} ${isDarkTheme ? styles.darkTheme : ''}`}>
                                ({metric.type})
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className={`${styles.noMetrics} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        No metrics in this category
                      </p>
                    )}
                  </>
                ) : (
                  <p className={`${styles.noMetrics} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    Select a category to view metrics
                  </p>
                )}
              </div>
            </>
          )}
          {step === 2 && localSelectedMetric && (
            <div className={`${styles.metricDetailsContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
              <button
                className={`${styles.topBackButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                onClick={handleBack}
              >
                <FaChevronLeft /> {localSelectedMetric.name || 'Metric'}
              </button>
              <div className={`${styles.metricDetails} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <h3>Metric Details</h3>
                <p>
                  <strong>Name:</strong> {localSelectedMetric.name}
                </p>
                <p>
                  <strong>Type:</strong> {localSelectedMetric.type}
                </p>
                <p>
                  <strong>Value:</strong> {localSelectedMetric.value}
                </p>
                {localSelectedMetric.type === 'speedometer' && localSelectedMetric.data && (
                  <p>
                    <strong>Data Value:</strong> {localSelectedMetric.data.value}%
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

MetricsContent.propTypes = {
  selectedCategory: PropTypes.shape({
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
  selectedMetric: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    value: PropTypes.string,
    data: PropTypes.object,
  }),
  previousTitle: PropTypes.string,
  onClose: PropTypes.func,
};

export default MetricsContent;
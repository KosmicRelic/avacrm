import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './MetricsContent.module.css';
import { useContext } from 'react';
import { MainContext } from '../../Contexts/MainContext';

const MetricsContent = ({ selectedCategory, selectedMetric, previousTitle }) => {
  const { isDarkTheme } = useContext(MainContext);
  const [currentStep, setCurrentStep] = useState(1);
  const [localSelectedMetric, setLocalSelectedMetric] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const containerRef = useRef(null);

  // Update step and metric based on selectedMetric prop
  useEffect(() => {
    if (selectedMetric) {
      setCurrentStep(2);
      setLocalSelectedMetric(selectedMetric);
      setIsClosing(false);
    } else {
      setCurrentStep(1);
      setLocalSelectedMetric(null);
      setIsClosing(false);
    }
  }, [selectedMetric]);

  const handleMetricClick = useCallback((metric) => {
    setLocalSelectedMetric(metric);
    setCurrentStep(2);
  }, []);

  const handleBack = useCallback(() => {
    if (currentStep === 2) {
      // Go back to step 1 from step 2
      setCurrentStep(1);
      setLocalSelectedMetric(null);
    } else {
      // Trigger close animation from step 1
      setIsClosing(true);
    }
  }, [currentStep]);

  // Handle animation end to reset state when closing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleAnimationEnd = () => {
      if (isClosing) {
        setCurrentStep(1);
        setLocalSelectedMetric(null);
        setIsClosing(false); // Reset isClosing to allow reopening
      }
    };

    container.addEventListener('animationend', handleAnimationEnd);
    return () => container.removeEventListener('animationend', handleAnimationEnd);
  }, [isClosing]);

  return (
    <div
      ref={containerRef}
      className={`${styles.viewContainer} ${isDarkTheme ? styles.darkTheme : ''} ${
        isClosing ? styles.slideOut : styles.slideIn
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
            <div className={`${styles.metricList} ${isDarkTheme ? styles.darkTheme : ''}`}>
              {selectedCategory ? (
                <>
                  <button
                    className={`${styles.topBackButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={handleBack}
                  >
                    {"<"} {previousTitle || 'Categories'}
                  </button>
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
          )}
          {step === 2 && localSelectedMetric && (
            <div className={`${styles.metricDetailsContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
              <button
                className={`${styles.topBackButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                onClick={handleBack}
              >
                {"<"} {localSelectedMetric.name || 'Metric'}
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
};

export default MetricsContent;
import React, { useContext, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './MetricsContent.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { FaChevronLeft } from 'react-icons/fa';

const MetricsContent = ({ selectedCategory, selectedMetric, previousTitle, onClose }) => {
  const { isDarkTheme } = useContext(MainContext);
  const [currentStep, setCurrentStep] = useState(1);
  const [localSelectedMetric, setLocalSelectedMetric] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (selectedMetric) {
      setCurrentStep(2);
      setLocalSelectedMetric(selectedMetric);
      setIsClosing(false);
    } else if (selectedCategory) {
      setCurrentStep(1);
      setLocalSelectedMetric(null);
      setIsClosing(false);
    } else {
      setIsClosing(true);
    }
  }, [selectedMetric, selectedCategory]);

  const handleMetricClick = (metric) => {
    setLocalSelectedMetric(metric);
    setCurrentStep(2);
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setLocalSelectedMetric(null);
    } else {
      setIsClosing(true);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleAnimationEnd = (event) => {
      if (isClosing && event.animationName.includes('slideOut')) {
        onClose();
      }
    };

    container.addEventListener('animationend', handleAnimationEnd);
    return () => container.removeEventListener('animationend', handleAnimationEnd);
  }, [isClosing, onClose]);

  return (
    <div
      ref={containerRef}
      className={`${styles.viewContainer} ${isDarkTheme ? styles.darkTheme : ''} ${
        selectedCategory && !isClosing ? styles.slideIn : styles.slideOut
      }`}
    >
      {[1, 2].map((step) => (
        <div
          key={step}
          className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ''} ${
            step !== currentStep ? styles.hidden : ''
          }`}
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
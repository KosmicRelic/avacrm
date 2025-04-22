import React, { useContext, useEffect, useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './MetricsCategories.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';

const MetricsCategories = ({ widget: initialWidget, tempData: initialTempData, setTempData, handleClose }) => {
  const { isDarkTheme, metricsCategories } = useContext(MainContext);
  const { registerModalSteps, goToStep, currentStep, setModalConfig } = useContext(ModalNavigatorContext);

  // Local state to preserve widget and tempData
  const [localWidget, setLocalWidget] = useState(initialWidget);
  const [localTempData, setLocalTempData] = useState(initialTempData || { step: 1 });

  const categoryMetrics = metricsCategories.find((cat) => cat.category === localWidget?.category)?.metrics || [];
  const hasInitialized = useRef(false);
  const lastModalConfig = useRef(null);

  // Sync local state with props if they change
  useEffect(() => {
    if (initialWidget && initialWidget !== localWidget) {
      setLocalWidget(initialWidget);
    }
    if (initialTempData && initialTempData !== localTempData) {
      setLocalTempData(initialTempData);
    }
  }, [initialWidget, initialTempData]);

  // Sync localTempData to parent tempData
  useEffect(() => {
    if (JSON.stringify(localTempData) !== JSON.stringify(initialTempData)) {
      setTempData(localTempData);
    }
  }, [localTempData, setTempData, initialTempData]);

  // Initialize modal steps
  useEffect(() => {
    if (!hasInitialized.current) {
      const steps = [
        {
          title: localWidget?.category || 'Unknown',
          leftButton: {
            label: 'Edit',
            isActive: true,
            isRemove: false,
            color: 'blue',
          },
        },
        {
          title: (args) => args?.selectedMetric?.name || localTempData?.selectedMetric?.name || 'Metric Details',
          leftButton: null,
        },
      ];

      registerModalSteps({ steps });
      const initialConfig = {
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: localWidget?.category || 'Unknown',
        backButtonTitle: '',
        leftButton: steps[0].leftButton,
        rightButton: null,
      };
      setModalConfig(initialConfig);
      lastModalConfig.current = initialConfig;
      hasInitialized.current = true;

      // Navigate to step 2 if specified in tempData
      if (localTempData?.step === 2 && localTempData?.selectedMetric) {
        goToStep(2, { selectedMetric: localTempData.selectedMetric });
      }
    }
  }, [registerModalSteps, setModalConfig, goToStep, localWidget?.category, localTempData?.step, localTempData?.selectedMetric]);

  const handleMetricClick = useCallback(
    (metric) => {
      setLocalTempData((prev) => {
        const newTempData = {
          ...prev,
          widget: prev.widget || localWidget,
          selectedMetric: { ...metric },
          step: 2,
        };
        return newTempData;
      });
      goToStep(2, { selectedMetric: metric });
    },
    [goToStep, localWidget]
  );

  return (
    <div className={`${styles.widgetWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={styles.viewContainer}>
        {[1, 2].map((step) => (
          <div
            key={step}
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ''} ${
              step !== currentStep ? styles.hidden : ''
            }`}
            style={{ display: step !== currentStep ? 'none' : 'block' }}
          >
            {step === 1 && (
              <div className={styles.widgetBody}>
                {categoryMetrics.length > 0 ? (
                  <ul className={styles.metricsList}>
                    {categoryMetrics.map((metric) => (
                      <li key={metric.id} className={`${styles.metricItem} ${isDarkTheme ? styles.darkTheme : ''}`} onClick={() => handleMetricClick(metric)}>
                        <button
                          className={`${styles.metricButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          <span className={`${styles.metricName} ${isDarkTheme?styles.darkTheme:""}`}>{metric.name}</span>{' '}
                        </button>
                        <span className={`${styles.metricValue} ${isDarkTheme?styles.darkTheme:""}`}>{metric.value}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No metrics in this category</p>
                )}
              </div>
            )}
            {step === 2 && (
              <div className={styles.widgetBody}>
                <div className={`${styles.metricDetails} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  <p>Average: {localTempData?.selectedMetric?.value || 'N/A'}</p>
                  {/* Add more metric details as needed */}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

MetricsCategories.propTypes = {
  widget: PropTypes.shape({
    category: PropTypes.string.isRequired,
  }),
  tempData: PropTypes.shape({
    widget: PropTypes.shape({
      category: PropTypes.string,
    }),
    selectedMetric: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
    step: PropTypes.number,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default MetricsCategories;
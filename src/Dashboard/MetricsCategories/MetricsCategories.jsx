import React, { useContext, useEffect, useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './MetricsCategories.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';

const MetricsCategories = ({ widget: initialWidget, tempData: initialTempData, setTempData, handleClose }) => {
  const { isDarkTheme, metricsCategories } = useContext(MainContext);
  const { registerModalSteps, goToStep, currentStep, setCurrentStep, setModalConfig } = useContext(ModalNavigatorContext);

  // Local state to preserve widget and tempData for view logic
  const [localWidget, setLocalWidget] = useState(initialWidget);
  const [localTempData, setLocalTempData] = useState(initialTempData || { step: 1 });

  const categoryMetrics = metricsCategories.find((cat) => cat.category === localWidget?.category)?.metrics || [];
  const hasInitialized = useRef(false);
  const lastModalConfig = useRef(null);

  // Sync local state with props if they change (with deep comparison)
  useEffect(() => {
    if (initialWidget && JSON.stringify(initialWidget) !== JSON.stringify(localWidget)) {
      setLocalWidget(initialWidget);
    }
    if (initialTempData && JSON.stringify(initialTempData) !== JSON.stringify(localTempData)) {
      setLocalTempData(initialTempData);
    }
  }, [initialWidget, initialTempData, localWidget, localTempData]);

  // Initialize modal steps and configuration
  useEffect(() => {
    if (!hasInitialized.current) {
      const steps = [
        {
          title: localWidget?.category || 'Unknown',
          leftButton: null, // No Edit button
          rightButton: {
            label: 'Done',
            isActive: true,
            isRemove: false,
            onClick: () => handleClose({ fromSave: true }), // No tempData
          },
        },
        {
          title: (args) => args?.selectedMetric?.name || localTempData?.selectedMetric?.name || 'Metric Details',
          leftButton: null,
          rightButton: null, // No Done button in step 2
        },
      ];

      // Register steps
      registerModalSteps({ steps });

      // Determine initial step from initialTempData
      const initialStep = initialTempData?.step === 2 && initialTempData?.selectedMetric ? 2 : 1;

      // Set initial modal configuration based on the step
      const initialConfig = {
        showTitle: true,
        showDoneButton: initialStep === 1,
        showBackButton: initialStep > 1,
        title: initialStep === 1
          ? localWidget?.category || 'Unknown'
          : initialTempData?.selectedMetric?.name || 'Metric Details',
        backButtonTitle: initialStep > 1 ? localWidget?.category || 'Unknown' : '',
        leftButton: null, // No Edit button
        rightButton: initialStep === 1 ? steps[0].rightButton : null, // Done button only in step 1
      };

      // Set modal config and current step directly
      setModalConfig(initialConfig);
      setCurrentStep(initialStep); // Directly set the step to avoid goToStep
      lastModalConfig.current = initialConfig;
      hasInitialized.current = true;
    }
  }, [registerModalSteps, setModalConfig, localWidget?.category, initialTempData, setCurrentStep, handleClose]);

  // Reset hasInitialized when modal closes
  useEffect(() => {
    return () => {
      hasInitialized.current = false; // Reset on unmount
    };
  }, []);

  const handleMetricClick = useCallback(
    (metric) => {
      setLocalTempData((prev) => ({
        ...prev,
        widget: prev.widget || localWidget,
        selectedMetric: { ...metric },
        step: 2,
      }));
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
                      <li
                        key={metric.id}
                        className={`${styles.metricItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                        onClick={() => handleMetricClick(metric)}
                      >
                        <button
                          className={`${styles.metricButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          <span className={`${styles.metricName} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            {metric.name}
                          </span>
                        </button>
                        <span className={`${styles.metricValue} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          {metric.value}
                        </span>
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
    category: PropTypes.string,
    metricId: PropTypes.string,
    dashboardId: PropTypes.string,
  }).isRequired,
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
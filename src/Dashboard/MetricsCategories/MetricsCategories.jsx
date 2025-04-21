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

  // Debug props and local state
  useEffect(() => {
    console.log('MetricsCategories: Props and state', {
      initialWidget,
      initialTempData,
      localWidget,
      localTempData,
    });
  }, [initialWidget, initialTempData, localWidget, localTempData]);

  // Initialize modal steps
  useEffect(() => {
    if (!hasInitialized.current) {
      console.log('MetricsCategories: Initializing modal steps', { category: localWidget?.category || 'Unknown' });
      const steps = [
        {
          title: localWidget?.category || 'Unknown',
          leftButton: {
            label: 'Edit',
            onClick: () => console.log('Edit widget:', localWidget),
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
      console.log('MetricsCategories: Set initial modal config', initialConfig);

      // Navigate to step 2 if specified in tempData
      if (localTempData?.step === 2 && localTempData?.selectedMetric) {
        console.log('MetricsCategories: Navigating to step 2 for metric', localTempData.selectedMetric);
        goToStep(2, { selectedMetric: localTempData.selectedMetric });
      }
    }
  }, [registerModalSteps, setModalConfig, goToStep, localWidget?.category, localTempData?.step, localTempData?.selectedMetric]);

  // Update modal config based on currentStep
  useEffect(() => {
    console.log('MetricsCategories: useEffect for currentStep', {
      currentStep,
      category: localWidget?.category,
      metricName: localTempData?.selectedMetric?.name,
      localTempData,
    });

    const newConfig = currentStep === 1
      ? {
          showTitle: true,
          showDoneButton: true,
          showBackButton: false,
          title: localWidget?.category || 'Unknown',
          backButtonTitle: '',
          leftButton: {
            label: 'Edit',
            onClick: () => console.log('Edit widget:', localWidget),
            isActive: true,
            isRemove: false,
            color: 'blue',
          },
          rightButton: null,
        }
      : {
          showTitle: true,
          showDoneButton: false,
          showBackButton: true,
          title: localTempData?.selectedMetric?.name || 'Metric Details',
          backButtonTitle: localWidget?.category || 'Unknown',
          leftButton: null,
          rightButton: null,
        };

    // Update config if it has changed
    if (JSON.stringify(newConfig) !== JSON.stringify(lastModalConfig.current)) {
      setModalConfig((prev) => {
        const updatedConfig = { ...prev, ...newConfig };
        console.log('MetricsCategories: Updating modal config', updatedConfig);
        return updatedConfig;
      });
      lastModalConfig.current = newConfig;
    } else {
      console.log('MetricsCategories: Skipping modal config update (no change)');
    }
  }, [currentStep, localWidget?.category, localTempData, setModalConfig]);

  const handleMetricClick = useCallback(
    (metric) => {
      console.log('MetricsCategories: Metric clicked', metric);
      setLocalTempData((prev) => {
        const newTempData = {
          ...prev,
          widget: prev.widget || localWidget,
          selectedMetric: { ...metric },
          step: 2,
        };
        console.log('MetricsCategories: Updated localTempData', newTempData);
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
                      <li key={metric.id} className={styles.metricItem}>
                        <button
                          className={`${styles.metricButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                          onClick={() => handleMetricClick(metric)}
                        >
                          <span className={styles.metricName}>{metric.name}:</span>{' '}
                          <span className={styles.metricValue}>{metric.value}</span>
                        </button>
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
                <div className={styles.metricDetails}>
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
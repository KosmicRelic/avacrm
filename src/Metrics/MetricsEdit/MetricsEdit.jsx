import React, { useContext, useEffect, useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './MetricsEdit.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';
import { FaRegCircle, FaRegCheckCircle } from 'react-icons/fa';

const MetricsCategories = ({ widget: initialWidget, tempData: initialTempData, setTempData, handleClose }) => {
  const { isDarkTheme, metricsCategories } = useContext(MainContext);
  const { registerModalSteps, goToStep, currentStep, setCurrentStep, setModalConfig } = useContext(ModalNavigatorContext);

  // Local state to preserve widget and tempData for view logic
  const [localWidget, setLocalWidget] = useState(initialWidget);
  const [localTempData, setLocalTempData] = useState(initialTempData || { step: 1 });
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const categoryMetrics = metricsCategories.find((cat) => cat.category === localWidget?.category)?.metrics || [];
  const hasInitialized = useRef(false);

  // Sync local state with props if they change
  useEffect(() => {
    if (initialWidget && JSON.stringify(initialWidget) !== JSON.stringify(localWidget)) {
      setLocalWidget(initialWidget);
    }
    if (initialTempData && JSON.stringify(initialTempData) !== JSON.stringify(localTempData)) {
      setLocalTempData(initialTempData);
    }
  }, [initialWidget, initialTempData, localWidget, localTempData]);

  // Handle category deletion
  const handleDeleteCategories = useCallback(() => {
    if (selectedCategories.length === 0) {
      setIsEditMode(false);
      setSelectedCategories([]);
      return;
    }

    const confirmMessage = `Are you sure you want to delete the following categor${selectedCategories.length > 1 ? 'ies' : 'y'}: ${selectedCategories.join(', ')}? This will also delete all metrics within ${selectedCategories.length > 1 ? 'these categories' : 'this category'}.`;
    if (window.confirm(confirmMessage)) {
      const newTempData = {
        ...localTempData,
        deletedCategories: selectedCategories,
        action: 'deleteCategories',
      };
      setTempData(newTempData);
      setLocalTempData(newTempData);
      setSelectedCategories([]);
      setIsEditMode(false);
      handleClose({ fromSave: true, tempData: newTempData });
    }
  }, [selectedCategories, setTempData, localTempData, handleClose]);

  // Toggle category selection in edit mode
  const toggleCategorySelection = useCallback((categoryName) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((name) => name !== categoryName)
        : [...prev, categoryName]
    );
  }, []);

  // Initialize modal steps and configuration
  useEffect(() => {
    if (!hasInitialized.current) {
      const steps = [
        {
          title: localWidget?.category || 'Unknown',
          leftButton: {
            label: 'Edit',
            onClick: () => setIsEditMode(true),
          },
          rightButton: {
            label: 'Done',
            isActive: true,
            isRemove: false,
            onClick: () => handleClose({ fromSave: true }),
          },
        },
        {
          title: (args) => args?.selectedMetric?.name || localTempData?.selectedMetric?.name || 'Metric Details',
          leftButton: null,
          rightButton: null,
        },
      ];

      // Register steps
      registerModalSteps({ steps });

      // Determine initial step
      const initialStep = initialTempData?.step === 2 && initialTempData?.selectedMetric ? 2 : 1;

      // Set initial modal configuration
      const initialConfig = {
        showTitle: true,
        showDoneButton: initialStep === 1,
        showBackButton: initialStep > 1,
        title: initialStep === 1
          ? localWidget?.category || 'Unknown'
          : initialTempData?.selectedMetric?.name || 'Metric Details',
        backButtonTitle: initialStep > 1 ? localWidget?.category || 'Unknown' : '',
        leftButton: initialStep === 1 ? { label: 'Edit', onClick: () => setIsEditMode(true) } : null,
        rightButton: initialStep === 1
          ? { label: 'Done', isActive: true, isRemove: false, onClick: () => handleClose({ fromSave: true }) }
          : null,
      };

      console.log('Initial Modal Config:', initialConfig); // Debug log
      setModalConfig(initialConfig);
      setCurrentStep(initialStep);
      hasInitialized.current = true;
    }
  }, [registerModalSteps, setModalConfig, localWidget?.category, initialTempData, setCurrentStep, handleClose]);

  // Update modal config based on edit mode and step
  useEffect(() => {
    const config = isEditMode
      ? {
          showDoneButton: false,
          allowClose: false,
          title: 'Delete Categories',
          leftButton: {
            label: 'Cancel',
            onClick: () => {
              setIsEditMode(false);
              setSelectedCategories([]);
            },
          },
          rightButton: {
            label: 'Remove',
            onClick: handleDeleteCategories,
            isActive: selectedCategories.length > 0,
            isRemove: true,
            color: 'red',
          },
        }
      : {
          showTitle: true,
          showDoneButton: currentStep === 1,
          showBackButton: currentStep > 1,
          title: currentStep === 1
            ? localWidget?.category || 'Unknown'
            : localTempData?.selectedMetric?.name || 'Metric Details',
          backButtonTitle: currentStep > 1 ? localWidget?.category || 'Unknown' : '',
          leftButton: currentStep === 1 ? { label: 'Edit', onClick: () => setIsEditMode(true) } : null,
          rightButton: currentStep === 1
            ? { label: 'Done', isActive: true, isRemove: false, onClick: () => handleClose({ fromSave: true }) }
            : null,
        };

    console.log('Updated Modal Config:', config); // Debug log
    setModalConfig(config);
  }, [isEditMode, selectedCategories, handleDeleteCategories, setModalConfig, localWidget?.category, handleClose, currentStep, localTempData]);

  // Reset hasInitialized when modal closes
  useEffect(() => {
    return () => {
      hasInitialized.current = false;
    };
  }, []);

  const handleMetricClick = useCallback(
    (metric) => {
      if (isEditMode) {
        toggleCategorySelection(localWidget?.category);
      } else {
        setLocalTempData((prev) => ({
          ...prev,
          widget: prev.widget || localWidget,
          selectedMetric: { ...metric },
          step: 2,
        }));
        goToStep(2, { selectedMetric: metric });
      }
    },
    [goToStep, localWidget, isEditMode, toggleCategorySelection]
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
                        <div className={styles.metricRow}>
                          {isEditMode && (
                            <span className={styles.selectionCircle}>
                              {selectedCategories.includes(localWidget?.category) ? (
                                <FaRegCheckCircle
                                  className={`${styles.customCheckbox} ${styles.checked} ${
                                    isDarkTheme ? styles.darkTheme : ''
                                  }`}
                                  size={18}
                                />
                              ) : (
                                <FaRegCircle
                                  className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ''}`}
                                  size={18}
                                />
                              )}
                            </span>
                          )}
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
                        </div>
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
    deletedCategories: PropTypes.arrayOf(PropTypes.string),
    action: PropTypes.string,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default MetricsCategories;
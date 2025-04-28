// src/Dashboard/WidgetSetupModal.jsx
import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import styles from './WidgetSetupModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';

const WidgetSetupModal = ({ tempData, setTempData, setActiveModalData, handleClose }) => {
  const { metrics, isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, setModalConfig, goToStep, currentStep } = useContext(ModalNavigatorContext);
  const [selectedCategory, setSelectedCategory] = useState(tempData.category || '');
  const [selectedMetric, setSelectedMetric] = useState(tempData.metric || '');
  const [activeFieldIndex, setActiveFieldIndex] = useState(null);
  const hasInitialized = useRef(false);
  const prevSelectionsRef = useRef({ category: tempData.category, metric: tempData.metric });
  const prevConfigRef = useRef(null);

  // Memoize the Done button handler
  const handleDoneClick = useCallback(() => {
    if (!selectedCategory || !selectedMetric) {
      alert('Please select both a category and a metric to proceed.');
      return;
    }
    console.log('Saving widget with tempData:', tempData);
    handleClose({ fromSave: true });
  }, [selectedCategory, selectedMetric, handleClose, tempData]);

  // Memoize the Save button handler
  const handleSave = useCallback(() => {
    setActiveFieldIndex(null);
    goToStep(1);
  }, [goToStep]);

  // Get the metric name for the title
  const getMetricName = useCallback(() => {
    if (!selectedCategory || !selectedMetric) return 'Select Metric';
    const categoryData = metrics.find((cat) => cat.category === selectedCategory);
    const metricData = categoryData?.metrics.find((m) => m.id === selectedMetric);
    return metricData?.name || 'Select Metric';
  }, [selectedCategory, selectedMetric, metrics]);

  // Memoize the title function
  const getStepTitle = useCallback(
    (args = {}) => {
      const index = args.activeFieldIndex ?? activeFieldIndex;
      if (currentStep === 1) {
        return selectedCategory || 'Setup Widget';
      }
      if (currentStep === 2) {
        return index === 0 ? 'Select Category' : getMetricName();
      }
      return 'Edit Field';
    },
    [activeFieldIndex, selectedCategory, getMetricName, currentStep]
  );

  // Initialize modal steps
  useEffect(() => {
    if (!hasInitialized.current) {
      registerModalSteps({
        steps: [
          {
            title: getStepTitle,
            rightButton: {
              label: 'Done',
              onClick: handleDoneClick,
              isActive: true,
              isRemove: false,
            },
          },
          {
            title: getStepTitle,
            rightButton: {
              label: 'Save',
              onClick: handleSave,
              isActive: true,
              isRemove: false,
            },
          },
        ],
      });
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: getStepTitle(),
        backButtonTitle: '',
        rightButton: {
          label: 'Done',
          onClick: handleDoneClick,
          isActive: true,
          isRemove: false,
        },
      });
      if (tempData.initialStep === 2) {
        goToStep(2);
      }
      hasInitialized.current = true;
    }
  }, [registerModalSteps, setModalConfig, handleDoneClick, handleSave, getStepTitle, goToStep, tempData.initialStep]);

  // Update modal config based on step
  useEffect(() => {
    let newConfig;
    if (currentStep === 1) {
      newConfig = {
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: getStepTitle(),
        backButtonTitle: '',
        rightButton: {
          label: 'Done',
          onClick: handleDoneClick,
          isActive: true,
          isRemove: false,
        },
      };
    } else if (currentStep === 2) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: getStepTitle({ activeFieldIndex }),
        backButtonTitle: selectedCategory || 'Setup Widget',
        rightButton: {
          label: 'Save',
          onClick: handleSave,
          isActive: true,
          isRemove: false,
        },
      };
    }

    if (
      !prevConfigRef.current ||
      JSON.stringify(newConfig) !== JSON.stringify(prevConfigRef.current)
    ) {
      setModalConfig(newConfig);
      prevConfigRef.current = newConfig;
    }
  }, [currentStep, activeFieldIndex, setModalConfig, handleDoneClick, handleSave, getStepTitle, selectedCategory]);

  // Sync selections to tempData
  useEffect(() => {
    const currentSelections = { category: selectedCategory, metric: selectedMetric };
    const selectionsChanged = JSON.stringify(currentSelections) !== JSON.stringify(prevSelectionsRef.current);
    if (!selectionsChanged) return;

    prevSelectionsRef.current = currentSelections;

    if (!selectedCategory || !selectedMetric) {
      const newTempData = {
        ...tempData,
        updatedWidget: null,
        category: selectedCategory,
        metric: selectedMetric,
        canClose: false,
      };
      setTempData(newTempData);
      setActiveModalData(newTempData);
      return;
    }

    const categoryData = metrics.find((cat) => cat.category === selectedCategory);
    const metricData = categoryData?.metrics.find((m) => m.id === selectedMetric);

    if (!metricData) {
      const newTempData = {
        ...tempData,
        updatedWidget: null,
        category: selectedCategory,
        metric: selectedMetric,
        canClose: false,
      };
      setTempData(newTempData);
      setActiveModalData(newTempData);
      return;
    }

    const updatedWidget = {
      ...tempData.widget,
      id: tempData.widget.id || `widget-${Date.now()}`,
      title: selectedCategory,
      metricId: metricData.id,
      dashboardId: tempData.dashboardId,
    };

    const newTempData = {
      ...tempData,
      updatedWidget,
      category: selectedCategory,
      metric: selectedMetric,
      dashboardId: tempData.dashboardId,
      canClose: true,
    };
    setTempData(newTempData);
    setActiveModalData(newTempData);
    console.log('Updated tempData:', newTempData);
  }, [selectedCategory, selectedMetric, metrics, setTempData, setActiveModalData, tempData]);

  const selectedMetrics = selectedCategory
    ? metrics.find((cat) => cat.category === selectedCategory)?.metrics || []
    : [];

  const toggleEdit = useCallback(
    (index) => {
      setActiveFieldIndex(index);
      goToStep(2);
    },
    [goToStep]
  );

  const clearSelection = useCallback(
    (index) => {
      if (index === 0) {
        setSelectedCategory('');
        setSelectedMetric('');
      } else if (index === 1) {
        setSelectedMetric('');
      }
      setActiveFieldIndex(null);
      goToStep(1);
    },
    [goToStep]
  );

  const getFieldValue = (index) => {
    if (index === 0) return selectedCategory || 'None';
    if (index === 1) {
      return selectedMetric ? selectedMetrics.find((m) => m.id === selectedMetric)?.name || 'None' : 'None';
    }
    return 'None';
  };

  return (
    <div className={`${styles.modalContent} ${isDarkTheme ? styles.darkTheme : ''}`}>
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
              <div className={`${styles.fieldList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                {[
                  { name: 'Category', key: 'category' },
                  { name: 'Metric', key: 'metric' },
                ].map((field, index) => (
                  <div
                    key={field.key}
                    className={`${styles.fieldItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => toggleEdit(index)}
                  >
                    <div className={styles.fieldRow}>
                      <div className={`${styles.fieldNameType} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <span>{field.name}</span>
                      </div>
                      <div className={styles.fieldValue}>
                        <span className={`${styles.fieldValueText} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          {getFieldValue(index)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {step === 2 && (
              <div className={`${styles.editActions} ${isDarkTheme ? styles.darkTheme : ''}`}>
                {activeFieldIndex === 0 ? (
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setSelectedMetric('');
                    }}
                    className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ''}`}
                  >
                    <option value="">Select a category</option>
                    {metrics.map((cat) => (
                      <option key={cat.category} value={cat.category}>
                        {cat.category}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value)}
                    disabled={!selectedCategory}
                    className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ''}`}
                  >
                    <option value="">Select a metric</option>
                    {selectedMetrics.map((metric) => (
                      <option key={metric.id} value={metric.id}>
                        {metric.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className={styles.editActionsButtons}>
                  <button
                    onClick={() => clearSelection(activeFieldIndex)}
                    className={`${styles.clearButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

WidgetSetupModal.propTypes = {
  tempData: PropTypes.shape({
    category: PropTypes.string,
    metric: PropTypes.string,
    widget: PropTypes.object,
    dashboardId: PropTypes.string,
    initialStep: PropTypes.number,
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  setActiveModalData: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default WidgetSetupModal;
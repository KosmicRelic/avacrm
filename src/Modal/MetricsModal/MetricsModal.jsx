import { useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './MetricsModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';
import { v4 as uuidv4 } from 'uuid';
import { computeMetricData, computeCorrelation } from '../../Metrics/metricsUtils';
import { FaRegCircle, FaRegCheckCircle, FaPlus } from 'react-icons/fa';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  PieController,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import CustomMetricChart from '../../Metrics/CustomMetricChart/CustomMetricChart';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  PieController,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const MetricsModal = ({ tempData, setTempData, handleClose }) => {
  const mainContext = useContext(MainContext);
  const { metrics = [], isDarkTheme, cards, cardTemplates, headers = [] } = mainContext;

  const { registerModalSteps, setModalConfig, goToStep, currentStep } = useContext(ModalNavigatorContext);
  const [currentCategories, setCurrentCategories] = useState(() =>
    (tempData.currentCategories || metrics).map((c) => ({ ...c, metrics: [...c.metrics] }))
  );
  const [newCategoryName, setNewCategoryName] = useState('');
  const [metricForm, setMetricForm] = useState({
    name: '',
    cardTemplates: [],
    fields: {},
    aggregation: 'average',
    visualizationType: 'line',
    dateRange: { start: '2023-01-01', end: '2025-04-24' },
    dateMode: 'range', // NEW: Added dateMode for single/range selection
    filterValues: {},
    groupBy: '',
    includeHistory: true,
    granularity: 'monthly',
    comparisonFields: [],
  });
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(null);
  const [activeMetricIndex, setActiveMetricIndex] = useState(-1);
  const [selectedCardTemplate, setSelectedCardTemplate] = useState(null);
  const [dateRangeMode, setDateRangeMode] = useState({});
  const [numberRangeMode, setNumberRangeMode] = useState({});
  const [activeFilterIndex, setActiveFilterIndex] = useState(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState(null);
  const [navigationDirection, setNavigationDirection] = useState(null);
  const filterActionsRef = useRef(null);
  const hasInitialized = useRef(false);
  const prevCategoriesRef = useRef(currentCategories);
  const prevConfigRef = useRef(null);
  const prevStepRef = useRef(currentStep);

  // Colors for Apple-inspired UI
  const appleBlue = '#007AFF';
  const backgroundColor = isDarkTheme ? '#1C2526' : '#FFFFFF';
  const textColor = isDarkTheme ? '#FFFFFF' : '#000000';

  // Validation functions
  const validateCategory = useCallback((name, existingCategories, isUpdate = false, index = null) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Category name cannot be empty.');
      return false;
    }
    const nameConflict = existingCategories.some(
      (c, i) => c.category.toLowerCase() === trimmedName.toLowerCase() && (!isUpdate || i !== index)
    );
    if (nameConflict) {
      alert(`A category named "${trimmedName}" already exists.`);
      return false;
    }
    return true;
  }, []);

  const validateMetric = useCallback(
    (form) => {
      const { name, cardTemplates, fields, comparisonFields, visualizationType, aggregation } = form;
      const trimmedName = name.trim();
      if (!trimmedName) {
        alert('Metric name cannot be empty.');
        return false;
      }
      if (cardTemplates.length === 0) {
        alert('Select at least one card template.');
        return false;
      }
      const hasFields = comparisonFields.length > 0 || cardTemplates.some((template) => fields[template]?.length > 0);
      if (!hasFields) {
        alert('Select at least one field or two comparison fields.');
        return false;
      }
      if (comparisonFields.length > 0 && comparisonFields.length !== 2) {
        alert('Select exactly two fields for comparison.');
        return false;
      }
      // Validate numeric fields for non-pie visualizations (except count)
      if (visualizationType !== 'pie' && aggregation !== 'count') {
        const allFields = comparisonFields.length > 0 ? comparisonFields : cardTemplates.flatMap((t) => fields[t] || []);
        const invalidFields = allFields.filter((field) => {
          const header = headers.find((h) => h.key === field);
          return !header || header.type !== 'number';
        });
        if (invalidFields.length > 0) {
          alert(`Non-numeric fields selected: ${invalidFields.join(', ')}. Please select numeric fields for ${aggregation} aggregation.`);
          return false;
        }
      }
      const nameConflict = currentCategories[activeCategoryIndex]?.metrics.some(
        (m, i) => m.name.toLowerCase() === trimmedName.toLowerCase() && i !== activeMetricIndex
      );
      if (nameConflict) {
        alert(`A metric named "${trimmedName}" already exists in this category.`);
        return false;
      }
      return true;
    },
    [activeCategoryIndex, currentCategories, activeMetricIndex, headers]
  );

  // Reset form
  const resetForm = useCallback(() => {
    setMetricForm({
      name: '',
      cardTemplates: [],
      fields: {},
      aggregation: 'average',
      visualizationType: 'line',
      dateRange: { start: '2023-01-01', end: '2025-04-24' },
      dateMode: 'range', // NEW: Reset dateMode to range
      filterValues: {},
      groupBy: '',
      includeHistory: true,
      granularity: 'monthly',
      comparisonFields: [],
    });
    setDateRangeMode({});
    setNumberRangeMode({});
    setActiveFilterIndex(null); 
    setSelectedCardTemplate(null);
  }, []);

  // Add metric
  const addMetric = useCallback(() => {
    if (!validateMetric(metricForm)) return;

    const { name, cardTemplates, fields, aggregation, visualizationType, dateRange, filterValues, groupBy, includeHistory, granularity, comparisonFields } = metricForm;
    const config = { cardTemplates, fields, aggregation, dateRange, filterValues, groupBy, visualizationType, includeHistory, granularity, comparisonFields };
    const data = computeMetricData(cards, config, headers);

    const newMetric = {
      id: `metric-${uuidv4()}`,
      name: name.trim(),
      type: visualizationType,
      config,
      data,
      value: visualizationType === 'number' ? data.datasets[0]?.data[data.datasets[0].data.length - 1] || 0 : undefined,
    };

    setCurrentCategories((prev) =>
      prev.map((c, i) =>
        i === activeCategoryIndex
          ? { ...c, metrics: [...c.metrics, newMetric] }
          : c
      )
    );
    setTempData({ currentCategories });
    resetForm();
    setNavigationDirection('forward');
    goToStep(3);
  }, [metricForm, activeCategoryIndex, validateMetric, cards, resetForm, goToStep, setTempData]);

  // Update metric
  const updateMetric = useCallback(
    (metricIndex) => {
      if (!validateMetric(metricForm)) return;

      const { name, cardTemplates, fields, aggregation, visualizationType, dateRange, filterValues, groupBy, includeHistory, granularity, comparisonFields } = metricForm;
      const config = { cardTemplates, fields, aggregation, dateRange, filterValues, groupBy, visualizationType, includeHistory, granularity, comparisonFields };
      const data = computeMetricData(cards, config, headers);

      const updatedMetric = {
        id: currentCategories[activeCategoryIndex].metrics[metricIndex].id,
        name: name.trim(),
        type: visualizationType,
        config,
        data,
        value: visualizationType === 'number' ? data.datasets[0]?.data[data.datasets[0].data.length - 1] || 0 : undefined,
      };

      setCurrentCategories((prev) =>
        prev.map((c, i) =>
          i === activeCategoryIndex
            ? {
                ...c,
                metrics: c.metrics.map((m, j) => (j === metricIndex ? updatedMetric : m)),
              }
            : c
        )
      );
      setTempData({ currentCategories });
      resetForm();
      setNavigationDirection('forward');
      goToStep(3);
    },
    [metricForm, activeCategoryIndex, validateMetric, cards, resetForm, goToStep, setTempData]
  );

  // Delete metric
  const deleteMetric = useCallback(
    (metricIndex) => {
      setCurrentCategories((prev) =>
        prev.map((c, i) =>
          i === activeCategoryIndex
            ? { ...c, metrics: c.metrics.filter((_, j) => j !== metricIndex) }
            : c
        )
      );
      setTempData({ currentCategories });
      setActiveMetricIndex(-1);
      setNavigationDirection('forward');
      goToStep(3);
    },
    [activeCategoryIndex, goToStep, setTempData]
  );

  // Save metric
  const saveMetric = useCallback(() => {
    if (activeMetricIndex === -1) {
      addMetric();
    } else {
      updateMetric(activeMetricIndex);
    }
  }, [activeMetricIndex, addMetric, updateMetric]);

  // Add category
  const addCategory = useCallback(() => {
    if (!validateCategory(newCategoryName, currentCategories)) return;

    const newCategory = {
      category: newCategoryName.trim(),
      metrics: [],
    };
    setCurrentCategories((prev) => [...prev, newCategory]);
    setTempData({ currentCategories: [...currentCategories, newCategory] });
    setNewCategoryName('');
    setActiveCategoryIndex(currentCategories.length);
    setActiveMetricIndex(-1);
    setNavigationDirection('forward');
    goToStep(3);
  }, [newCategoryName, currentCategories, validateCategory, goToStep, setTempData]);

  // Navigate to create category step
  const goToCreateCategory = useCallback(() => {
    setNewCategoryName('');
    setNavigationDirection('forward');
    goToStep(2);
  }, [goToStep]);

  // Select category
  const selectCategory = useCallback((categoryIndex) => {
    setActiveCategoryIndex(categoryIndex);
    setActiveMetricIndex(-1);
    setNavigationDirection('forward');
    goToStep(3);
  }, [goToStep]);

  // Initialize modal steps
  useEffect(() => {
    if (!hasInitialized.current) {
      registerModalSteps({
        steps: [
          {
            title: 'Metrics',
            rightButton: {
              label: 'Done',
              onClick: () => {
                setTempData({ currentCategories });
                handleClose({ fromSave: true });
              },
              isActive: true,
            },
          },
          {
            title: 'Create Category',
            leftButton: {
              label: 'Metrics',
              onClick: () => {
                setNavigationDirection('backward');
                goToStep(1);
              },
            },
            rightButton: {
              label: 'Create',
              onClick: addCategory,
              isActive: newCategoryName.trim() !== '',
            },
          },
          {
            title: () => currentCategories[activeCategoryIndex]?.category || 'Metrics',
            leftButton: {
              label: 'Metrics',
              onClick: () => {
                setNavigationDirection('backward');
                goToStep(1);
              },
            },
            rightButton: {
              label: 'New Metric',
              onClick: () => toggleEditMetric(activeCategoryIndex, -1),
              isActive: true,
            },
          },
          {
            title: () => (activeMetricIndex === -1 ? 'New Metric' : 'Edit Metric'),
            rightButton: {
              label: 'Save',
              onClick: saveMetric,
              isActive: metricForm.name && (metricForm.cardTemplates.some((t) => metricForm.fields[t]?.length > 0) || metricForm.comparisonFields.length === 2),
            },
          },
          {
            title: () => 'Metric Output',
            leftButton: {
              label: 'Back',
              onClick: () => {
                setNavigationDirection('backward');
                goToStep(4);
              },
            },
          },
          {
            title: () => 'Select Card Templates',
            leftButton: {
              label: 'Back',
              onClick: () => {
                setNavigationDirection('backward');
                goToStep(5);
              },
            },
          },
          {
            title: () => `Fields for ${selectedCardTemplate || metricForm.cardTemplates[0] || ''}`,
            leftButton: {
              label: 'Back',
              onClick: () => {
                setNavigationDirection('backward');
                goToStep(6);
              },
            },
          },
          {
            title: () => 'Configure Filters',
            leftButton: {
              label: 'Back',
              onClick: () => {
                setNavigationDirection('backward');
                goToStep(6);
              },
            },
          },
        ],
      });
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        title: 'Metrics',
        rightButton: {
          label: 'Done',
          onClick: () => {
            setTempData({ currentCategories });
            handleClose({ fromSave: true });
          },
          isActive: true,
        },
      });
      hasInitialized.current = true;
    }
  }, [registerModalSteps, setModalConfig, handleClose, setTempData, goToStep]);

  // Update modal config and set navigation direction
  useEffect(() => {
    let newConfig;

    if (currentStep === 1) {
      newConfig = {
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: 'Metrics',
        rightButton: {
          label: 'Done',
          onClick: () => {
            setTempData({ currentCategories });
            handleClose({ fromSave: true });
          },
          isActive: true,
        },
      };
    } else if (currentStep === 2) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: 'Create Category',
        backButtonTitle: 'Metrics',
        rightButton: {
          label: 'Create',
          onClick: addCategory,
          isActive: newCategoryName.trim() !== '',
        },
      };
    } else if (currentStep === 3) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: currentCategories[activeCategoryIndex]?.category || 'Metrics',
        backButtonTitle: 'Metrics',
        rightButton: {
          label: 'New Metric',
          onClick: () => toggleEditMetric(activeCategoryIndex, -1),
          isActive: true,
        },
      };
    } else if (currentStep === 4) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: activeMetricIndex === -1 ? 'New Metric' : 'Edit Metric',
        backButtonTitle: currentCategories[activeCategoryIndex]?.category || 'Metrics',
        rightButton: {
          label: 'Save',
          onClick: saveMetric,
          isActive: metricForm.name && (metricForm.cardTemplates.some((t) => metricForm.fields[t]?.length > 0) || metricForm.comparisonFields.length === 2),
        },
      };
    } else if (currentStep === 5) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: 'Metric Output',
        backButtonTitle: activeMetricIndex === -1 ? 'New Metric' : 'Edit Metric',
      };
    } else if (currentStep === 6) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: 'Select Card Templates',
        backButtonTitle: 'Metric Output',
      };
    } else if (currentStep === 7) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: `Fields for ${selectedCardTemplate || metricForm.cardTemplates[0] || ''}`,
        backButtonTitle: 'Data Visualization',
      };
    } else if (currentStep === 8) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: 'Configure Filters',
        backButtonTitle: 'Data Visualization',
      };
    }

    if (
      !prevConfigRef.current ||
      JSON.stringify(newConfig) !== JSON.stringify(prevConfigRef.current)
    ) {
      setModalConfig(newConfig);
      prevConfigRef.current = newConfig;
    }

    if (prevStepRef.current !== currentStep) {
      setNavigationDirection(currentStep > prevStepRef.current ? 'forward' : 'backward');
      prevStepRef.current = currentStep;
    }
  }, [currentStep, activeCategoryIndex, setModalConfig, saveMetric, handleClose, setTempData, currentCategories, goToStep, metricForm, selectedCardTemplate, newCategoryName, addCategory]);

  // Sync categories
  useEffect(() => {
    const categoriesChanged = JSON.stringify(currentCategories) !== JSON.stringify(prevCategoriesRef.current);
    if (categoriesChanged) {
      setTempData({ currentCategories });
      prevCategoriesRef.current = currentCategories;
    }
  }, [currentCategories, setTempData]);

  // Reset active section on step change
  useEffect(() => {
    setActiveSectionIndex(null);
  }, [currentStep]);

  // Handle key press
  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === 'Enter' && (currentStep === 4 || currentStep === 5)) {
        saveMetric();
      } else if (e.key === 'Enter' && currentStep === 2 && newCategoryName.trim()) {
        addCategory();
      }
    },
    [saveMetric, addCategory, newCategoryName, currentStep]
  );

  // Toggle edit metric
  const toggleEditMetric = useCallback(
    (categoryIndex, metricIndex = -1) => {
      setActiveCategoryIndex(categoryIndex);
      setActiveMetricIndex(metricIndex);
      if (metricIndex !== -1) {
        const metric = currentCategories[categoryIndex].metrics[metricIndex];
        const fields = Array.isArray(metric.config?.fields)
          ? metric.config.cardTemplates.reduce((acc, template) => {
              acc[template] = metric.config.fields;
              return acc;
            }, {})
          : metric.config?.fields || {};
        setMetricForm({
          name: metric.name,
          cardTemplates: metric.config?.cardTemplates || [],
          fields,
          aggregation: metric.config?.aggregation || 'average',
          visualizationType: metric.type || 'line',
          dateRange: metric.config?.dateRange || { start: '2023-01-01', end: '2025-04-24' },
          dateMode: metric.config?.dateRange?.end ? 'range' : 'single', // NEW: Set dateMode based on existing config
          filterValues: metric.config?.filterValues || {},
          groupBy: metric.config?.groupBy || '',
          includeHistory: metric.config?.includeHistory !== undefined ? metric.config.includeHistory : true,
          granularity: metric.config?.granularity || 'monthly',
          comparisonFields: metric.config?.comparisonFields || [],
        });
      } else {
        resetForm();
      }
      setNavigationDirection('forward');
      goToStep(4);
    },
    [currentCategories, resetForm, goToStep]
  );

  return (
    <div className={`${styles.metricsModal} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={styles.viewContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => (
          <div
            key={step}
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ''} ${
              step !== currentStep ? styles.hidden : ''
            } ${step === currentStep && navigationDirection === 'forward' ? styles.animateForward : ''} ${
              step === currentStep && navigationDirection === 'backward' ? styles.animateBackward : ''
            }`}
            style={{ display: step !== currentStep ? 'none' : 'block' }}
          >
            {step === 1 && (
              <>
                <div className={`${styles.addButton} ${isDarkTheme ? styles.darkTheme : ''}`} onClick={goToCreateCategory}>
                  <span>
                    <FaPlus /> Create a Category
                  </span>
                </div>
                <div className={`${styles.headerList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {currentCategories.map((category, index) => (
                    <div
                      key={`${category.category}-${index}`}
                      className={`${styles.headerItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => selectCategory(index)}
                    >
                      <div className={styles.headerRow}>
                        <div className={`${styles.headerNameType} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          <span>{category.category}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {step === 2 && (
              <div className={`${styles.metricForm} ${styles.createCategoryStep} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={`${styles.createHeader} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  <div className={styles.headerRow}>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Enter category name"
                      className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ''}`}
                      autoFocus
                    />
                  </div>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className={`${styles.metricsList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                {currentCategories[activeCategoryIndex]?.metrics.length > 0 ? (
                  currentCategories[activeCategoryIndex].metrics.map((metric, index) => (
                    <div
                      key={`${metric.id}-${index}`}
                      className={`${styles.headerItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => toggleEditMetric(activeCategoryIndex, index)}
                    >
                      <div className={styles.headerRow}>
                        <div className={`${styles.headerNameType} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          <span>{metric.name}</span>
                          <span className={`${styles.headerType} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            ({metric.type})
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={styles.noMetrics}>No metrics in this category.</p>
                )}
              </div>
            )}
            {step === 4 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {/* Metric Name */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 0 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => toggleSection(0)}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Metric Name</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>{metricForm.name || 'None'}</span>
                      </div>
                    </div>
                    {activeSectionIndex === 0 && (
                      <div className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <input
                          type="text"
                          value={metricForm.name}
                          onChange={(e) => setMetricForm((prev) => ({ ...prev, name: e.target.value }))}
                          onKeyPress={handleKeyPress}
                          placeholder="e.g., Lead Trends"
                          className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                        />
                      </div>
                    )}
                  </div>
                  {/* Metric Output Button */}
                  <div className={`${styles.filterItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => {
                      setNavigationDirection('forward');
                      goToStep(5);
                    }}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Metric Output</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>Select Output</span>
                      </div>
                    </div>
                  </div>
                  {/* Delete Metric */}
                  {activeMetricIndex !== -1 && (
                    <div
                      className={`${styles.filterItem} ${activeSectionIndex === 1 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => toggleSection(1)}
                    >
                      <div className={styles.filterRow}>
                        <div className={styles.filterNameType}>
                          <span>Delete Metric</span>
                        </div>
                        <div className={styles.primaryButtons}>
                          <span className={styles.filterSummary}>Remove this metric</span>
                        </div>
                      </div>
                      {activeSectionIndex === 1 && (
                        <div className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}>
                          <button
                            onClick={() => deleteMetric(activeMetricIndex)}
                            className={`${styles.clearButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                          >
                            Delete Metric
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Step 5: Metric Output */}
            {step === 5 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>  
                  {/* Output type selection */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 2 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => setActiveSectionIndex(activeSectionIndex === 2 ? null : 2)}
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Metric Output</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>
                          {(() => {
                            switch (metricForm.visualizationType) {
                              case 'line': return 'Line Chart';
                              case 'pie': return 'Pie Chart';
                              case 'bar': return 'Bar Chart';
                              case 'number': return 'Number Output';
                              default: return 'Select Output';
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                    {activeSectionIndex === 2 && (
                      <div className={styles.filterActions} style={{ marginTop: 8 }}>
                        {[
                          { type: 'line', label: 'Line Chart' },
                          { type: 'pie', label: 'Pie Chart' },
                          { type: 'bar', label: 'Bar Chart' },
                          { type: 'number', label: 'Number Output' },
                        ].map((option, idx) => (
                          <div
                            key={option.type}
                            className={`${styles.filterItem} ${metricForm.visualizationType === option.type ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                            style={{ marginBottom: 4, cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMetricForm((prev) => ({ ...prev, visualizationType: option.type }));
                              setActiveSectionIndex(null);
                            }}
                          >
                            <div className={styles.filterRow}>
                              <div className={styles.filterNameType}>
                                <span>{option.label}</span>
                              </div>
                              <div className={styles.primaryButtons}>
                                {metricForm.visualizationType === option.type ? (
                                  <FaRegCheckCircle style={{ color: appleBlue }} />
                                ) : (
                                  <FaRegCircle style={{ color: isDarkTheme ? '#888' : '#ccc' }} />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Select Card Template (moved here, same UI as filter item) */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 4 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => {
                      setNavigationDirection('forward');
                      goToStep(6);
                    }}
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Select Card Template</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>
                          {(() => {
                            const template = cardTemplates.find(
                              (t) => (t.typeOfCards || t.name) === metricForm.cardTemplates[0]
                            );
                            return template ? (template.name || template.typeOfCards) : 'Select Template';
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Y Axis selection for line chart (navigates to step 7) */}
                  {metricForm.visualizationType === 'line' && (
                    <div
                      className={`${styles.filterItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => {
                        if (!metricForm.cardTemplates[0]) {
                          alert('Please select a card template first.');
                          return;
                        }
                        setNavigationDirection('forward');
                        setSelectedCardTemplate(metricForm.cardTemplates[0]);
                        goToStep(7);
                      }}
                      tabIndex={0}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className={styles.filterRow}>
                        <div className={styles.filterNameType}>
                          <span>Y Axis</span>
                        </div>
                        <div className={styles.primaryButtons}>
                          <span className={styles.filterSummary}>
                            {(() => {
                              const yField = metricForm.fields[metricForm.cardTemplates[0]]?.[0];
                              const header = headers.find((h) => h.key === yField);
                              return header ? header.name : 'Select Header';
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className={styles.outputTypePreview}>
                  {metricForm.visualizationType === 'number' ? (
                    <div className={styles.simpleNumberPreview} style={{
                      fontSize: 48,
                      fontWeight: 600,
                      color: appleBlue,
                      textAlign: 'center',
                      padding: '32px 0',
                      background: isDarkTheme ? '#222' : '#f7f7f7',
                      borderRadius: 12,
                    }}>
                      12345
                    </div>
                  ) : (
                    <CustomMetricChart
                      metric={{ type: metricForm.visualizationType, ...metricForm }}
                      isDarkTheme={isDarkTheme}
                      chartType={metricForm.visualizationType}
                    />
                  )}
                </div>
              </div>
            )}
            {/* Step 6: Select Card Template */}
            {step === 6 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={styles.filterList}>
                  <div className={styles.filterItem} style={{ cursor: 'default', fontWeight: 600 }}>
                    Select a Card Template
                  </div>
                  {(cardTemplates && cardTemplates.length > 0) ? (
                    cardTemplates.map((template, idx) => (
                      <div
                        key={template.typeOfCards || template.name || idx}
                        className={`${styles.filterItem} ${metricForm.cardTemplates[0] === (template.typeOfCards || template.name) ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setMetricForm((prev) => ({ ...prev, cardTemplates: [(template.typeOfCards || template.name)] }))}
                      >
                        <div className={styles.filterRow}>
                          <div className={styles.filterNameType}>
                            <span>{template.name || template.typeOfCards}</span>
                          </div>
                          <div className={styles.primaryButtons}>
                            {metricForm.cardTemplates[0] === (template.typeOfCards || template.name) ? (
                              <FaRegCheckCircle style={{ color: appleBlue }} />
                            ) : (
                              <FaRegCircle style={{ color: isDarkTheme ? '#888' : '#ccc' }} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.filterItem} style={{ color: '#888' }}>No card templates available.</div>
                  )}
                </div>
              </div>
            )}
            {/* Step 7: Fields for selected card template */}
            {step === 7 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={styles.filterList}>
                  <div className={styles.filterItem} style={{ cursor: 'default', fontWeight: 600 }}>
                    {`Fields for ${selectedCardTemplate || metricForm.cardTemplates[0] || ''}`}
                  </div>
                  {(() => {
                    // Get the selected card template object
                    const templateKey = selectedCardTemplate || metricForm.cardTemplates[0];
                    const template = cardTemplates.find(
                      (t) => (t.typeOfCards || t.name) === templateKey
                    );
                    const templateHeaders = template?.headers?.filter(
                      (header) => header.key !== 'id' && header.key !== 'typeOfCards'
                    ) || [];
                    if (templateHeaders.length > 0) {
                      return templateHeaders.map((header) => (
                        <div
                          key={header.key}
                          className={`${styles.filterItem} ${metricForm.fields[templateKey]?.[0] === header.key ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            setMetricForm((prev) => ({
                              ...prev,
                              fields: {
                                ...prev.fields,
                                [templateKey]: [header.key],
                              },
                            }));
                            setNavigationDirection('backward');
                            goToStep(5);
                          }}
                        >
                          <div className={styles.filterRow}>
                            <div className={styles.filterNameType}>
                              <span>{header.name}</span>
                            </div>
                            <div className={styles.primaryButtons}>
                              {metricForm.fields[templateKey]?.[0] === header.key ? (
                                <FaRegCheckCircle style={{ color: appleBlue }} />
                              ) : (
                                <FaRegCircle style={{ color: isDarkTheme ? '#888' : '#ccc' }} />
                              )}
                            </div>
                          </div>
                        </div>
                      ));
                    } else {
                      return (
                        <div className={styles.filterItem} style={{ color: '#888' }}>No headers available.</div>
                      );
                    }
                  })()}
                </div>
                {/* Data preview for selected header */}
                {(() => {
                  const templateKey = selectedCardTemplate || metricForm.cardTemplates[0];
                  const selectedHeaderKey = metricForm.fields[templateKey]?.[0];
                  if (!selectedHeaderKey) return null;
                  const template = cardTemplates.find(
                    (t) => (t.typeOfCards || t.name) === templateKey
                  );
                  const header = template?.headers?.find(h => h.key === selectedHeaderKey);
                  const cardsForTemplate = cards.filter(
                    (card) => card.typeOfCards === templateKey
                  );
                  if (!cardsForTemplate.length) return (
                    <div className={styles.filterItem} style={{ color: '#888', marginTop: 16 }}>No cards found for this template.</div>
                  );
                  // Try to find a date field in the template
                  const dateHeader = template?.headers?.find(h => h.type === 'date');
                  // Prepare chart data based on header type
                  let chartData = null;
                  let chartOptions = null;
                  let chartType = 'line';
                  if (header?.type === 'number' || header?.type === 'currency') {
                    // Numeric: plot value over time (if date), else by index
                    let labels = [];
                    let values = [];
                    if (dateHeader) {
                      // Sort by date
                      const sorted = [...cardsForTemplate].filter(card => card[dateHeader.key]).sort((a, b) => new Date(a[dateHeader.key]) - new Date(b[dateHeader.key]));
                      labels = sorted.map(card => card[dateHeader.key]);
                      values = sorted.map(card => card[selectedHeaderKey]);
                    } else {
                      labels = cardsForTemplate.map((card, i) => card.name || card.id || `Card ${i + 1}`);
                      values = cardsForTemplate.map(card => card[selectedHeaderKey]);
                    }
                    chartData = {
                      labels,
                      datasets: [
                        {
                          label: header.name,
                          data: values,
                          fill: false,
                          borderColor: appleBlue,
                          backgroundColor: appleBlue,
                          tension: 0.2,
                          pointRadius: 3,
                          pointHoverRadius: 5,
                        },
                      ],
                    };
                    chartOptions = {
                      responsive: true,
                      plugins: {
                        legend: { display: false },
                        title: { display: false },
                      },
                      scales: {
                        x: { display: true, title: { display: false } },
                        y: { display: true, title: { display: false } },
                      },
                    };
                    chartType = 'line';
                  } else if (header?.type === 'date') {
                    // Date: count of cards per date
                    const dateCounts = {};
                    cardsForTemplate.forEach(card => {
                      const date = card[selectedHeaderKey];
                      if (date) dateCounts[date] = (dateCounts[date] || 0) + 1;
                    });
                    const labels = Object.keys(dateCounts).sort();
                    const values = labels.map(date => dateCounts[date]);
                    chartData = {
                      labels,
                      datasets: [
                        {
                          label: header.name,
                          data: values,
                          fill: false,
                          borderColor: appleBlue,
                          backgroundColor: appleBlue,
                          tension: 0.2,
                          pointRadius: 3,
                          pointHoverRadius: 5,
                        },
                      ],
                    };
                    chartOptions = {
                      responsive: true,
                      plugins: {
                        legend: { display: false },
                        title: { display: false },
                      },
                      scales: {
                        x: { display: true, title: { display: false } },
                        y: { display: true, title: { display: false } },
                      },
                    };
                    chartType = 'line';
                  } else {
                    // Categorical/text: count of each value over time (if date), else bar chart of value counts
                    const valueCountsByDate = {};
                    let uniqueValues = new Set();
                    if (dateHeader) {
                      // Group by date, then by value
                      cardsForTemplate.forEach(card => {
                        const date = card[dateHeader.key];
                        const value = card[selectedHeaderKey] || 'None';
                        uniqueValues.add(value);
                        if (!valueCountsByDate[date]) valueCountsByDate[date] = {};
                        valueCountsByDate[date][value] = (valueCountsByDate[date][value] || 0) + 1;
                      });
                      const sortedDates = Object.keys(valueCountsByDate).sort();
                      uniqueValues = Array.from(uniqueValues);
                      chartData = {
                        labels: sortedDates,
                        datasets: uniqueValues.map((val, idx) => ({
                          label: val,
                          data: sortedDates.map(date => valueCountsByDate[date][val] || 0),
                          fill: false,
                          borderColor: `hsl(${(idx * 60) % 360}, 70%, 50%)`,
                          backgroundColor: `hsl(${(idx * 60) % 360}, 70%, 50%)`,
                          tension: 0.2,
                          pointRadius: 3,
                          pointHoverRadius: 5,
                        })),
                      };
                      chartOptions = {
                        responsive: true,
                        plugins: {
                          legend: { display: true },
                          title: { display: false },
                        },
                        scales: {
                          x: { display: true, title: { display: false } },
                          y: { display: true, title: { display: false } },
                        },
                      };
                      chartType = 'line';
                    } else {
                      // No date: just count of each value
                      const valueCounts = {};
                      cardsForTemplate.forEach(card => {
                        const value = card[selectedHeaderKey] || 'None';
                        valueCounts[value] = (valueCounts[value] || 0) + 1;
                      });
                      const labels = Object.keys(valueCounts);
                      const values = labels.map(val => valueCounts[val]);
                      chartData = {
                        labels,
                        datasets: [
                          {
                            label: header.name,
                            data: values,
                            backgroundColor: labels.map((_, idx) => `hsl(${(idx * 60) % 360}, 70%, 50%)`),
                          },
                        ],
                      };
                      chartOptions = {
                        responsive: true,
                        plugins: {
                          legend: { display: false },
                          title: { display: false },
                        },
                        indexAxis: 'y',
                        scales: {
                          x: { display: true, title: { display: false } },
                          y: { display: true, title: { display: false } },
                        },
                      };
                      chartType = 'bar';
                    }
                  }
                  return (
                    <div style={{ marginTop: 24, background: isDarkTheme ? '#222' : '#f7f7f7', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Live Chart Preview</div>
                      <div style={{ width: '100%', minHeight: 220 }}>
                        {chartType === 'line' ? (
                          <Line data={chartData} options={chartOptions} />
                        ) : (
                          <Bar data={chartData} options={chartOptions} />
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

MetricsModal.propTypes = {
  tempData: PropTypes.shape({
    currentCategories: PropTypes.arrayOf(
      PropTypes.shape({
        category: PropTypes.string.isRequired,
        metrics: PropTypes.arrayOf(
          PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            type: PropTypes.string.isRequired,
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            config: PropTypes.shape({
              cardTemplates: PropTypes.arrayOf(PropTypes.string),
              fields: PropTypes.oneOfType([
                PropTypes.arrayOf(PropTypes.string),
                PropTypes.object,
              ]),
              aggregation: PropTypes.string,
              dateRange: PropTypes.object,
              filterValues: PropTypes.object,
              groupBy: PropTypes.string,
              visualizationType: PropTypes.string,
              includeHistory: PropTypes.bool,
              granularity: PropTypes.string,
              comparisonFields: PropTypes.arrayOf(PropTypes.string),
            }),
            data: PropTypes.object,
          })
        ),
      })
    ),
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default MetricsModal;
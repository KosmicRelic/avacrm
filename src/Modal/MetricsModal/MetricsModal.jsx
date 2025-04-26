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
  const { metrics = [], isDarkTheme, cards, cardTemplates, headers } = useContext(MainContext);
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

  // Toggle card template
  const toggleCardTemplate = useCallback((template) => {
    setMetricForm((prev) => {
      const isSelected = prev.cardTemplates.includes(template);
      const newCardTemplates = isSelected
        ? prev.cardTemplates.filter((t) => t !== template)
        : [...prev.cardTemplates, template];
      const newFields = { ...prev.fields };
      if (!isSelected) {
        newFields[template] = [];
      } else {
        delete newFields[template];
      }
      return {
        ...prev,
        cardTemplates: newCardTemplates,
        fields: newFields,
      };
    });
  }, []);

  // Toggle field
  const toggleField = useCallback(
    (field) => {
      setMetricForm((prev) => {
        const currentFields = prev.fields[selectedCardTemplate] || [];
        const newFields = currentFields.includes(field)
          ? currentFields.filter((f) => f !== field)
          : [...currentFields, field];
        const updatedFields = {
          ...prev.fields,
          [selectedCardTemplate]: newFields,
        };
        let newCardTemplates = prev.cardTemplates;
        if (!prev.cardTemplates.includes(selectedCardTemplate) && newFields.length > 0) {
          newCardTemplates = [...prev.cardTemplates, selectedCardTemplate];
        }
        return {
          ...prev,
          fields: updatedFields,
          cardTemplates: newCardTemplates,
        };
      });
    },
    [selectedCardTemplate]
  );

  // Field options for selected card template in Step 7
  const fieldOptions = useMemo(() => {
    if (!selectedCardTemplate) return [];
    const validKeys = cardTemplates
      .filter((t) => t.typeOfCards === selectedCardTemplate)
      .flatMap((t) => t.sections.flatMap((s) => s.keys));
    const isNumericRequired = metricForm.visualizationType !== 'pie' && metricForm.aggregation !== 'count';
    return headers
      .filter((header) => validKeys.includes(header.key) && (!isNumericRequired || header.type === 'number'))
      .map((header) => ({
        key: header.key,
        name: header.name,
      }));
  }, [selectedCardTemplate, cardTemplates, headers, metricForm.visualizationType, metricForm.aggregation]);

  // Get card template button summary
  const getCardTemplateButtonSummary = useCallback(() => {
    const selectedTemplates = metricForm.cardTemplates.sort();
    return selectedTemplates.length > 0 ? selectedTemplates.join(', ') : 'No card templates selected';
  }, [metricForm.cardTemplates]);

  // Get metric details button summary
  const getMetricDetailsButtonSummary = useCallback(() => {
    return metricForm.visualizationType
      ? metricForm.visualizationType.charAt(0).toUpperCase() + metricForm.visualizationType.slice(1)
      : 'No visualization selected';
  }, [metricForm.visualizationType]);

  // Filter key options
  const visibleHeaders = useMemo(
    () =>
      headers
        .filter((header) => !header.hidden)
        .map((header) => ({
          ...header,
          name: header.name || formatHeaderName(header.key),
          type: header.type || 'text',
          options: header.options || [],
        })),
    [headers]
  );

  const formatHeaderName = (key) => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  };

  // Get filter summary
  const getFilterButtonSummary = useCallback(() => {
    const selectedFilters = Object.keys(metricForm.filterValues).filter(
      (key) => !isFilterEmpty(metricForm.filterValues[key])
    );
    const filterNames = selectedFilters
      .map((key) => visibleHeaders.find((h) => h.key === key)?.name || key)
      .sort();
    return filterNames.length > 0 ? filterNames.join(', ') : 'No filters applied';
  }, [metricForm.filterValues, visibleHeaders]);

  const getDropdownOptions = useCallback(
    (headerKey) => {
      const header = headers.find((h) => h.key === headerKey);
      return header && header.type === 'dropdown' ? header.options || [] : [];
    },
    [headers]
  );

  const handleFilterChange = useCallback(
    (headerKey, value, type = 'default') => {
      const newFilter = { ...metricForm.filterValues[headerKey], [type]: value };
      if (type === 'start' || type === 'end' || type === 'value') {
        if (value === '') delete newFilter[type];
      }
      const updatedFilters = { ...metricForm.filterValues, [headerKey]: newFilter };
      setMetricForm((prev) => ({ ...prev, filterValues: updatedFilters }));
    },
    [metricForm.filterValues]
  );

  const handleDropdownChange = useCallback(
    (headerKey, e) => {
      const selectedValues = Array.from(e.target.selectedOptions, (option) => option.value);
      handleFilterChange(headerKey, selectedValues, 'values');
    },
    [handleFilterChange]
  );

  const toggleRangeMode = useCallback(
    (headerKey, isDate = false) => {
      const setRangeMode = isDate ? setDateRangeMode : setNumberRangeMode;
      setRangeMode((prev) => {
        const newMode = !prev[headerKey];
        const updatedFilters = {
          ...metricForm.filterValues,
          [headerKey]: newMode
            ? { start: metricForm.filterValues[headerKey]?.start || '', end: metricForm.filterValues[headerKey]?.end || '' }
            : { value: metricForm.filterValues[headerKey]?.value || '', order: isDate ? 'on' : 'equals' },
        };
        setMetricForm((prev) => ({ ...prev, filterValues: updatedFilters }));
        return { ...prev, [headerKey]: newMode };
      });
    },
    [metricForm.filterValues]
  );

  const toggleDateRangeMode = (headerKey) => toggleRangeMode(headerKey, true);
  const toggleNumberRangeMode = (headerKey) => toggleRangeMode(headerKey, false);

  const toggleFilter = useCallback((index) => {
    setActiveFilterIndex(index);
  }, []);

  const toggleSection = useCallback((index) => {
    setActiveSectionIndex(index);
  }, []);

  const clearFilter = useCallback(
    (headerKey) => {
      const updatedFilters = { ...metricForm.filterValues };
      delete updatedFilters[headerKey];
      setMetricForm((prev) => ({ ...prev, filterValues: updatedFilters }));
      setDateRangeMode((prev) => ({ ...prev, [headerKey]: false }));
      setNumberRangeMode((prev) => ({ ...prev, [headerKey]: false }));
    },
    [metricForm.filterValues]
  );

  const handleResetFilters = useCallback(() => {
    setMetricForm((prev) => ({ ...prev, filterValues: {} }));
    setDateRangeMode({});
    setNumberRangeMode({});
    setActiveFilterIndex(null);
  }, []);

  const isFilterEmpty = (filter) =>
    Object.keys(filter).length === 0 || (!filter.start && !filter.end && !filter.value && !filter.values?.length);

  const getFilterSummary = useCallback(
    (header) => {
      const filter = metricForm.filterValues[header.key] || {};
      if (isFilterEmpty(filter)) return 'None';

      switch (header.type) {
        case 'number':
          if (numberRangeMode[header.key]) {
            const start = filter.start || '';
            const end = filter.end || '';
            const sortOrder = filter.sortOrder || '';
            return `${start}${start && end ? ' – ' : ''}${end}${sortOrder ? ` (${sortOrder})` : ''}`.trim();
          } else {
            const order = filter.order || 'equals';
            const value = filter.value || '';
            const sortOrder = filter.sortOrder || '';
            const orderText = { equals: '=', greaterOrEqual: '≥', lessOrEqual: '≤', greater: '>', less: '<' }[order];
            return `${orderText}${value ? ` ${value}` : ''}${sortOrder ? ` (${sortOrder})` : ''}`.trim();
          }
        case 'date':
          if (dateRangeMode[header.key]) {
            const start = filter.start || '';
            const end = filter.end || '';
            return `${start}${start && end ? ' – ' : ''}${end}`.trim();
          } else {
            const order = filter.order || 'on';
            const value = filter.value || '';
            return value ? `${order} ${value}` : 'None';
          }
        case 'dropdown':
          const values = filter.values || [];
          return values.length > 0 ? values.join(', ') : 'None';
        case 'text':
          const condition = filter.condition || 'equals';
          const value = filter.value || '';
          return value ? `${condition} "${value}"` : 'None';
        default:
          return filter.value ? `"${filter.value}"` : 'None';
      }
    },
    [metricForm.filterValues, numberRangeMode, dateRangeMode]
  );

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
            title: () => (activeMetricIndex === -1 ? 'Metric Details' : 'Edit Metric Details'),
            rightButton: {
              label: 'Save',
              onClick: saveMetric,
              isActive: metricForm.name && (metricForm.cardTemplates.some((t) => metricForm.fields[t]?.length > 0) || metricForm.comparisonFields.length === 2),
            },
          },
          {
            title: () => 'Select Card Templates',
            leftButton: {
              label: 'Back',
              onClick: () => {
                setNavigationDirection('backward');
                goToStep(4);
              },
            },
          },
          {
            title: () => `Fields for ${selectedCardTemplate}`,
            leftButton: {
              label: 'Back',
              onClick: () => {
                setNavigationDirection('backward');
                goToStep(5);
              },
            },
          },
          {
            title: () => 'Configure Filters',
            leftButton: {
              label: 'Back',
              onClick: () => {
                setNavigationDirection('backward');
                goToStep(5);
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
        title: activeMetricIndex === -1 ? 'Metric Details' : 'Edit Metric Details',
        backButtonTitle: activeMetricIndex === -1 ? 'New Metric' : 'Edit Metric',
        rightButton: {
          label: 'Save',
          onClick: saveMetric,
          isActive: metricForm.name && (metricForm.cardTemplates.some((t) => metricForm.fields[t]?.length > 0) || metricForm.comparisonFields.length === 2),
        },
      };
    } else if (currentStep === 6) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: 'Select Card Templates',
        backButtonTitle: activeMetricIndex === -1 ? 'New Metric' : 'Edit Metric',
      };
    } else if (currentStep === 7) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: `Fields for ${selectedCardTemplate}`,
        backButtonTitle: 'Metric Details',
      };
    } else if (currentStep === 8) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: 'Configure Filters',
        backButtonTitle: 'Metric Details',
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

  // Select card template for fields
  const selectCardTemplateForFields = useCallback(
    (template) => {
      setSelectedCardTemplate(template);
      setNavigationDirection('forward');
      goToStep(7);
    },
    [goToStep]
  );

  // Render chart preview
  const renderChartPreview = () => {
    // Show preview only if there are selected templates with fields or comparison fields
    if (
      !metricForm.cardTemplates.some((template) => metricForm.fields[template]?.length > 0) &&
      metricForm.comparisonFields.length !== 2
    ) {
      return null;
    }

    const config = {
      fields: metricForm.fields,
      aggregation: metricForm.aggregation,
      dateRange: metricForm.dateRange,
      cardTemplates: metricForm.cardTemplates,
      filterValues: metricForm.filterValues,
      groupBy: metricForm.groupBy || 'cardType',
      visualizationType: metricForm.visualizationType,
      includeHistory: metricForm.includeHistory,
      granularity: metricForm.granularity,
      comparisonFields: metricForm.comparisonFields,
    };

    const data = computeMetricData(cards, config, headers);

    // Compute correlation if two fields are selected
    let correlation = null;
    if (metricForm.comparisonFields.length === 2 && data.datasets.length === 2 && metricForm.visualizationType !== 'scatter') {
      const data1 = data.datasets[0].data;
      const data2 = data.datasets[1].data;
      if (data1.length === data2.length && data1.length > 0) {
        correlation = computeCorrelation(data1, data2);
      }
    }

    // Format labels based on granularity
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: metricForm.granularity === 'monthly' ? 'short' : undefined,
      day: metricForm.granularity === 'daily' ? 'numeric' : undefined,
      year: 'numeric',
    });
    const formattedLabels = (data.labels || []).map((label) => {
      try {
        const date = new Date(label);
        return formatter.format(date);
      } catch {
        return label;
      }
    });

    const uniqueLabels = [...new Set(formattedLabels)];

    const aggregatedDatasets = (data.datasets || []).map((dataset, index) => ({
      ...dataset,
      label: dataset.label || metricForm.comparisonFields[index] || metricForm.name,
      data: dataset.data,
      borderColor: index === 0 ? appleBlue : '#FF2D55',
      backgroundColor:
        metricForm.visualizationType === 'pie'
          ? [`${appleBlue}FF`, `${appleBlue}CC`, `${appleBlue}99`, `${appleBlue}66`][index % 4]
          : metricForm.visualizationType === 'bar'
          ? index === 0 ? appleBlue : '#FF2D55'
          : index === 0 ? `${appleBlue}33` : 'rgba(255, 45, 85, 0.2)',
      fill: metricForm.visualizationType === 'line' && dataset.fill !== false,
      tension: metricForm.visualizationType === 'line' ? 0.4 : undefined,
      stack: dataset.stack,
      borderWidth: metricForm.visualizationType === 'pie' ? 1 : undefined,
      pointRadius: metricForm.visualizationType === 'scatter' ? 5 : undefined,
      showLine: metricForm.visualizationType === 'scatter' ? true : undefined,
    }));

    const chartData = {
      labels: uniqueLabels,
      datasets: aggregatedDatasets,
    };

    // Validate chart data
    if (!chartData.labels.length || !chartData.datasets.some((ds) => ds.data.length > 0)) {
      return (
        <div className={styles.chartContainer}>
          <p>No valid data available for preview.</p>
        </div>
      );
    }

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: '-apple-system', size: 14 },
            color: textColor,
          },
        },
        title: {
          display: true,
          text: metricForm.name || 'Preview',
          font: { family: '-apple-system', size: 16 },
          color: textColor,
        },
        tooltip: {
          backgroundColor: isDarkTheme ? '#333' : '#FFF',
          titleColor: textColor,
          bodyColor: textColor,
          callbacks: {
            label: (context) => {
              if (metricForm.visualizationType === 'scatter') {
                return `(${context.raw.x.toFixed(2)}, ${context.raw.y.toFixed(2)})`;
              }
              return `${context.dataset.label}: ${context.raw.toFixed(2)}`;
            },
          },
        },
      },
      scales: metricForm.visualizationType === 'scatter' ? {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: metricForm.comparisonFields[0] || 'X',
            color: textColor,
          },
          ticks: { color: textColor },
          grid: { color: isDarkTheme ? '#444' : '#DDD' },
        },
        y: {
          title: {
            display: true,
            text: metricForm.comparisonFields[1] || 'Y',
            color: textColor,
          },
          ticks: { color: textColor },
          grid: { color: isDarkTheme ? '#444' : '#DDD' },
        },
      } : {
        x: {
          stacked: metricForm.visualizationType === 'bar' && metricForm.groupBy !== 'field',
          ticks: { font: { family: '-apple-system' }, color: textColor },
          grid: { color: isDarkTheme ? '#444' : '#DDD' },
        },
        y: {
          stacked: metricForm.visualizationType === 'bar' && metricForm.groupBy !== 'field',
          ticks: { font: { family: '-apple-system' }, color: textColor },
          grid: { color: isDarkTheme ? '#444' : '#DDD' },
        },
      },
    };

    return (
      <div className={styles.chartContainer}>
        {metricForm.visualizationType === 'line' && <Line data={chartData} options={options} />}
        {metricForm.visualizationType === 'bar' && <Bar data={chartData} options={options} />}
        {metricForm.visualizationType === 'pie' && <Pie data={chartData} options={options} />}
        {metricForm.visualizationType === 'scatter' && <Line data={chartData} options={options} />}
        {metricForm.visualizationType === 'number' && (
          <div className={styles.numberMetric}>
            <h3>{metricForm.name || 'Preview'}</h3>
            <p>
              {chartData.datasets
                .map((ds) => `${ds.label}: ${ds.data[ds.data.length - 1]?.toFixed(2) || 0}`)
                .join(', ')}
            </p>
          </div>
        )}
        {correlation !== null && (
          <div className={styles.correlation}>
            <p>Correlation: {correlation.toFixed(2)}</p>
          </div>
        )}
      </div>
    );
  };

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
                  {/* Aggregation */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 1 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => toggleSection(1)}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Aggregation</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>
                          {metricForm.aggregation.charAt(0).toUpperCase() + metricForm.aggregation.slice(1)}
                        </span>
                      </div>
                    </div>
                    {activeSectionIndex === 1 && (
                      <div className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <select
                          value={metricForm.aggregation}
                          onChange={(e) => setMetricForm((prev) => ({ ...prev, aggregation: e.target.value }))}
                          className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                          disabled={metricForm.visualizationType === 'pie'}
                        >
                          <option value="count">Count</option>
                          <option value="average">Average</option>
                          <option value="sum">Sum</option>
                          <option value="min">Min</option>
                          <option value="max">Max</option>
                          <option value="median">Median</option>
                          <option value="stddev">Standard Deviation</option>
                        </select>
                      </div>
                    )}
                  </div>
                  {/* Card Templates */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 2 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => {
                      toggleSection(2);
                      if (activeSectionIndex !== 2) {
                        setNavigationDirection('forward');
                        goToStep(6);
                      }
                    }}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Card Templates</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>{getCardTemplateButtonSummary()}</span>
                      </div>
                    </div>
                  </div>
                  {/* Metric Details */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 3 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => {
                      toggleSection(3);
                      if (activeSectionIndex !== 3) {
                        setNavigationDirection('forward');
                        goToStep(5);
                      }
                    }}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Metric Details</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>{getMetricDetailsButtonSummary()}</span>
                      </div>
                    </div>
                  </div>
                  {/* Delete Metric */}
                  {activeMetricIndex !== -1 && (
                    <div
                      className={`${styles.filterItem} ${activeSectionIndex === 4 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                      onClick={() => toggleSection(4)}
                    >
                      <div className={styles.filterRow}>
                        <div className={styles.filterNameType}>
                          <span>Delete Metric</span>
                        </div>
                        <div className={styles.primaryButtons}>
                          <span className={styles.filterSummary}>Remove this metric</span>
                        </div>
                      </div>
                      {activeSectionIndex === 4 && (
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
            {step === 5 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {/* Include History */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 0 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => toggleSection(0)}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Include History</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>{metricForm.includeHistory ? 'Enabled' : 'Disabled'}</span>
                      </div>
                    </div>
                    {activeSectionIndex === 0 && (
                      <div className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <label className={styles.toggle}>
                          <input
                            type="checkbox"
                            checked={metricForm.includeHistory}
                            onChange={(e) => setMetricForm((prev) => ({ ...prev, includeHistory: e.target.checked }))}
                          />
                          <span className={styles.toggleSlider}></span>
                        </label>
                      </div>
                    )}
                  </div>
                  {/* Visualization */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 1 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => toggleSection(1)}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Visualization</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>
                          {metricForm.visualizationType.charAt(0).toUpperCase() + metricForm.visualizationType.slice(1)}
                        </span>
                      </div>
                    </div>
                    {activeSectionIndex === 1 && (
                      <div className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <div className={styles.segmentedControl}>
                          {['line', 'bar', 'pie', 'number', 'scatter'].map((type) => (
                            <button
                              key={type}
                              className={`${styles.segment} ${metricForm.visualizationType === type ? styles.active : ''}`}
                              onClick={() => setMetricForm((prev) => ({ ...prev, visualizationType: type }))}
                            >
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Granularity */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 2 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => toggleSection(2)}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Granularity</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>
                          {metricForm.granularity.charAt(0).toUpperCase() + metricForm.granularity.slice(1)}
                        </span>
                      </div>
                    </div>
                    {activeSectionIndex === 2 && (
                      <div className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <div className={styles.segmentedControl}>
                          {['daily', 'weekly', 'monthly'].map((granularity) => (
                            <button
                              key={granularity}
                              className={`${styles.segment} ${metricForm.granularity === granularity ? styles.active : ''}`}
                              onClick={() => setMetricForm((prev) => ({ ...prev, granularity }))}
                            >
                              {granularity.charAt(0).toUpperCase() + granularity.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Group By */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 3 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => toggleSection(3)}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Group By</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>{metricForm.groupBy || 'None'}</span>
                      </div>
                    </div>
                    {activeSectionIndex === 3 && (
                      <div className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <select
                          value={metricForm.groupBy}
                          onChange={(e) => setMetricForm((prev) => ({ ...prev, groupBy: e.target.value }))}
                          className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          <option value="">None</option>
                          <option value="cardType">Card Template</option>
                          <option value="field">Field</option>
                          {Object.keys(metricForm.filterValues).map((key) => (
                            <option key={key} value={key}>
                              {visibleHeaders.find((h) => h.key === key)?.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  {/* Date Range */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 4 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => toggleSection(4)}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Date Range</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>
                          {metricForm.dateRange.start && metricForm.dateRange.end
                            ? `${metricForm.dateRange.start} – ${metricForm.dateRange.end}`
                            : 'None'}
                        </span>
                      </div>
                    </div>
                    {activeSectionIndex === 4 && (
                      <div className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <input
                          type="date"
                          value={metricForm.dateRange.start}
                          onChange={(e) =>
                            setMetricForm((prev) => ({
                              ...prev,
                              dateRange: { ...prev.dateRange, start: e.target.value },
                            }))
                          }
                          className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                        />
                        <span className={styles.separator}>–</span>
                        <input
                          type="date"
                          value={metricForm.dateRange.end}
                          onChange={(e) =>
                            setMetricForm((prev) => ({
                              ...prev,
                              dateRange: { ...prev.dateRange, end: e.target.value },
                            }))
                          }
                          className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                        />
                      </div>
                    )}
                  </div>
                  {/* Filters */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 5 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => {
                      toggleSection(5);
                      if (activeSectionIndex !== 5) {
                        setNavigationDirection('forward');
                        goToStep(8);
                      }
                    }}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Filters</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>{getFilterButtonSummary()}</span>
                      </div>
                    </div>
                  </div>
                  {/* Comparison Fields */}
                  <div
                    className={`${styles.filterItem} ${activeSectionIndex === 6 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                    onClick={() => toggleSection(6)}
                  >
                    <div className={styles.filterRow}>
                      <div className={styles.filterNameType}>
                        <span>Comparison Fields</span>
                      </div>
                      <div className={styles.primaryButtons}>
                        <span className={styles.filterSummary}>
                          {metricForm.comparisonFields.length > 0 ? metricForm.comparisonFields.join(', ') : 'None'}
                        </span>
                      </div>
                    </div>
                    {activeSectionIndex === 6 && (
                      <div className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        <select
                          multiple
                          value={metricForm.comparisonFields}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                            if (selected.length <= 2) {
                              setMetricForm((prev) => ({ ...prev, comparisonFields: selected }));
                            } else {
                              alert('Please select up to two fields for comparison.');
                            }
                          }}
                          className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                        >
                          {fieldOptions.map((field) => (
                            <option key={field.key} value={field.key}>
                              {field.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
                {renderChartPreview()}
              </div>
            )}
            {step === 6 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {cardTemplates.length > 0 ? (
                    cardTemplates.map((template, index) => (
                      <div
                        key={template.typeOfCards}
                        className={`${styles.filterItem} ${activeSectionIndex === index ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                        onClick={() => {
                          toggleSection(index);
                          selectCardTemplateForFields(template.typeOfCards);
                        }}
                      >
                        <div className={styles.filterRow}>
                          <div className={styles.filterNameType}>
                            <span>{template.typeOfCards}</span>
                          </div>
                          <div className={styles.primaryButtons}>
                            <span className={styles.filterSummary}>
                              {metricForm.cardTemplates.includes(template.typeOfCards)
                                ? (metricForm.fields[template.typeOfCards] || [])
                                    .map((fieldKey) => {
                                      const header = headers.find((h) => h.key === fieldKey);
                                      return header ? header.name : fieldKey;
                                    })
                                    .join(', ') || 'None'
                                : 'None'}
                            </span>
                          </div>
                        </div>
                        {activeSectionIndex === index && (
                          <div className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}>
                            <button
                              onClick={() => toggleCardTemplate(template.typeOfCards)}
                              className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                            >
                              {metricForm.cardTemplates.includes(template.typeOfCards) ? 'Deselect' : 'Select'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className={styles.noFields}>No card templates available.</p>
                  )}
                </div>
              </div>
            )}
            {step === 7 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {fieldOptions.length > 0 ? (
                    fieldOptions.map((field) => (
                      <div
                        key={field.key}
                        className={`${styles.filterItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                        onClick={() => toggleField(field.key)}
                      >
                        <div className={styles.filterRow}>
                          <span className={styles.selectionCircle}>
                            {(metricForm.fields[selectedCardTemplate] || []).includes(field.key) ? (
                              <FaRegCheckCircle
                                className={`${styles.customCheckbox} ${styles.checked} ${isDarkTheme ? styles.darkTheme : ''}`}
                                size={18}
                              />
                            ) : (
                              <FaRegCircle
                                className={`${styles.customCheckbox} ${isDarkTheme ? styles.darkTheme : ''}`}
                                size={18}
                              />
                            )}
                          </span>
                          <div className={styles.filterNameType}>
                            <span>{field.name}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className={styles.noFields}>No fields available for this template.</p>
                  )}
                </div>
              </div>
            )}
            {step === 8 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {visibleHeaders.map((header, index) => (
                    <div
                      key={header.key}
                      className={`${styles.filterItem} ${activeFilterIndex === index ? styles.activeItem : ''} ${
                        isDarkTheme ? styles.darkTheme : ''
                      }`}
                      onClick={() => toggleFilter(index)}
                    >
                      <div className={styles.filterRow}>
                        <div className={styles.filterNameType}>
                          <span>{header.name}</span>
                        </div>
                        <div className={styles.primaryButtons}>
                          <span className={styles.filterSummary}>{getFilterSummary(header)}</span>
                        </div>
                      </div>
                      {activeFilterIndex === index && (
                        <div
                          className={`${styles.filterActions} ${isDarkTheme ? styles.darkTheme : ''}`}
                          ref={filterActionsRef}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {header.type === 'number' ? (
                            numberRangeMode[header.key] ? (
                              <>
                                <input
                                  type="number"
                                  value={metricForm.filterValues[header.key]?.start || ''}
                                  onChange={(e) => handleFilterChange(header.key, e.target.value, 'start')}
                                  placeholder="From"
                                  className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                                />
                                <span className={styles.separator}>–</span>
                                <input
                                  type="number"
                                  value={metricForm.filterValues[header.key]?.end || ''}
                                  onChange={(e) => handleFilterChange(header.key, e.target.value, 'end')}
                                  placeholder="To"
                                  className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                                />
                                <button
                                  onClick={() => toggleNumberRangeMode(header.key)}
                                  className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  Value
                                </button>
                                <select
                                  value={metricForm.filterValues[header.key]?.sortOrder || ''}
                                  onChange={(e) => handleFilterChange(header.key, e.target.value, 'sortOrder')}
                                  className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Sort...</option>
                                  <option value="ascending">Ascending</option>
                                  <option value="descending">Descending</option>
                                </select>
                              </>
                            ) : (
                              <>
                                <select
                                  value={metricForm.filterValues[header.key]?.order || 'equals'}
                                  onChange={(e) => handleFilterChange(header.key, e.target.value, 'order')}
                                  className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="equals">=</option>
                                  <option value="greater">{'>'}</option>
                                  <option value="less">{'<'}</option>
                                  <option value="greaterOrEqual">≥</option>
                                  <option value="lessOrEqual">≤</option>
                                </select>
                                <input
                                  type="number"
                                  value={metricForm.filterValues[header.key]?.value || ''}
                                  onChange={(e) => handleFilterChange(header.key, e.target.value, 'value')}
                                  placeholder="Value"
                                  className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                                />
                                <button
                                  onClick={() => toggleNumberRangeMode(header.key)}
                                  className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  Range
                                </button>
                                <select
                                  value={metricForm.filterValues[header.key]?.sortOrder || ''}
                                  onChange={(e) => handleFilterChange(header.key, e.target.value, 'sortOrder')}
                                  className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="">Sort...</option>
                                  <option value="ascending">Ascending</option>
                                  <option value="descending">Descending</option>
                                </select>
                              </>
                            )
                          ) : header.type === 'date' ? (
                            dateRangeMode[header.key] ? (
                              <>
                                <input
                                  type="date"
                                  value={metricForm.filterValues[header.key]?.start || ''}
                                  onChange={(e) => handleFilterChange(header.key, e.target.value, 'start')}
                                  className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                                />
                                <span className={styles.separator}>–</span>
                                <input
                                  type="date"
                                  value={metricForm.filterValues[header.key]?.end || ''}
                                  onChange={(e) => handleFilterChange(header.key, e.target.value, 'end')}
                                  className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                                />
                                <button
                                  onClick={() => toggleDateRangeMode(header.key)}
                                  className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  Exact
                                </button>
                              </>
                            ) : (
                              <>
                                <select
                                  value={metricForm.filterValues[header.key]?.order || 'on'}
                                  onChange={(e) => handleFilterChange(header.key, e.target.value, 'order')}
                                  className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  <option value="on">On</option>
                                  <option value="before">Before</option>
                                  <option value="after">After</option>
                                </select>
                                <input
                                  type="date"
                                  value={metricForm.filterValues[header.key]?.value || ''}
                                  onChange={(e) => handleFilterChange(header.key, e.target.value, 'value')}
                                  className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                                />
                                <button
                                  onClick={() => toggleDateRangeMode(header.key)}
                                  className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                                >
                                  Range
                                </button>
                              </>
                            )
                          ) : header.type === 'dropdown' ? (
                            <select
                              multiple
                              value={metricForm.filterValues[header.key]?.values || []}
                              onChange={(e) => handleDropdownChange(header.key, e)}
                              className={`${styles.filterSelect} ${isDarkTheme ? styles.darkTheme : ''}`}
                            >
                              {getDropdownOptions(header.key).map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <>
                              <select
                                value={metricForm.filterValues[header.key]?.condition || 'equals'}
                                onChange={(e) => handleFilterChange(header.key, e.target.value, 'condition')}
                                className={`${styles.filterSelectNoChevron} ${isDarkTheme ? styles.darkTheme : ''}`}
                              >
                                <option value="equals">Equals</option>
                                <option value="contains">Contains</option>
                                <option value="startsWith">Starts with</option>
                                <option value="endsWith">Ends with</option>
                              </select>
                              <input
                                type="text"
                                value={metricForm.filterValues[header.key]?.value || ''}
                                onChange={(e) => handleFilterChange(header.key, e.target.value, 'value')}
                                placeholder="Value"
                                className={`${styles.filterInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                              />
                            </>
                          )}
                          <button
                            onClick={() => clearFilter(header.key)}
                            className={`${styles.clearButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className={`${styles.footer} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  <button
                    onClick={handleResetFilters}
                    className={`${styles.resetButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  >
                    Reset All Filters
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
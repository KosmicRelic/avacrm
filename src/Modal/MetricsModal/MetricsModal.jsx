import { useContext, useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './MetricsModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';
import { v4 as uuidv4 } from 'uuid';
import { FaRegCircle, FaRegCheckCircle, FaPlus, FaChevronDown, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import CustomMetricChart from '../../Metrics/CustomMetricChart/CustomMetricChart';
import { computeMetricData } from '../../Metrics/metricsUtils';

// Helper to evaluate the formula for number output
const evaluateNumberFormula = (formula, cards, templateKey, headers) => {
  if (!Array.isArray(formula) || formula.length === 0) return '';
  // Build an array of values and operators
  const values = [];
  for (let i = 0; i < formula.length; i++) {
    const part = formula[i];
    if (part.header) {
      const header = headers.find(h => h.key === part.header);
      if (!header) return '';
      let val = 0;
      if (part.calc === 'count') {
        val = cards.filter(card => card[part.header] !== undefined && card[part.header] !== null && card[part.header] !== '').length;
      } else if (header.type === 'number') {
        const nums = cards.map(card => Number(card[part.header])).filter(v => !isNaN(v));
        if (part.calc === 'sum') val = nums.reduce((a, b) => a + b, 0);
        else if (part.calc === 'average') val = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      } else {
        val = 0;
      }
      values.push(val);
    } else if (part.op) {
      values.push(part.op);
    }
  }
  // Evaluate the expression left to right (no operator precedence)
  let result = values[0];
  for (let i = 1; i < values.length; i += 2) {
    const op = values[i];
    const next = values[i + 1];
    if (typeof next === 'undefined') break;
    if (op === '+') result += next;
    else if (op === '-') result -= next;
    else if (op === '*') result *= next;
    else if (op === '/') result = next === 0 ? 0 : result / next;
  }
  return Number.isFinite(result) ? result : '';
};

const MetricsLineChartControls = ({ granularity, setGranularity, currentMonth, setCurrentMonth, currentYear, setCurrentYear, isDarkTheme }) => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthLabel = `${monthNames[currentMonth]} ${currentYear}`;
  const handlePrev = () => {
    if (granularity === 'month') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear((y) => y - 1);
      } else {
        setCurrentMonth((m) => m - 1);
      }
    } else {
      setCurrentYear((y) => y - 1);
    }
  };
  const handleNext = () => {
    if (granularity === 'month') {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear((y) => y + 1);
      } else {
        setCurrentMonth((m) => m + 1);
      }
    } else {
      setCurrentYear((y) => y + 1);
    }
  };
  const handleGranularityToggle = () => {
    setGranularity((g) => (g === 'month' ? 'year' : 'month'));
  };
  return (
    <div className={styles.lineChartControls}>
      <button onClick={handlePrev} className={styles.chevronBtn}><FaChevronLeft /></button>
      <button onClick={handleGranularityToggle} className={styles.granularityBtn}>
        {granularity === 'month' ? monthLabel : currentYear}
      </button>
      <button onClick={handleNext} className={styles.chevronBtn}><FaChevronRight /></button>
    </div>
  );
};

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
    dateMode: 'range',
    filterValues: {},
    groupBy: '',
    includeHistory: true,
    comparisonFields: [],
    formula: [],
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
  const outputDropdownRef = useRef(null);
  const templateDropdownRef = useRef(null);
  const fieldDropdownRef = useRef(null);
  const [outputDropdownOpen, setOutputDropdownOpen] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [fieldDropdownOpen, setFieldDropdownOpen] = useState(false);

  const [granularity, setGranularity] = useState('month');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

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

      // Build a map of templateKey -> headers from mainContext.cardTemplates
      const templateHeaderMap = {};
      (mainContext.cardTemplates || []).forEach(tpl => {
        const key = (tpl.name || tpl.typeOfCards || '').toString().trim();
        templateHeaderMap[key] = tpl.headers || [];
      });

      if (!trimmedName) {
        return false;
      }
      if (cardTemplates.length === 0) {
        return false;
      }
      const hasFields = comparisonFields.length > 0 || cardTemplates.some((template) => fields[template]?.length > 0);
      if (!hasFields) {
        return false;
      }
      if (comparisonFields.length > 0 && comparisonFields.length !== 2) {
        return false;
      }
      if (visualizationType === 'pie' || visualizationType === 'bar') {
        // Validate that the selected field is text or dropdown
        const tKey = cardTemplates[0];
        const headers = templateHeaderMap[tKey] || [];
        const field = fields[tKey]?.[0];
        const header = headers.find((h) => h.key === field);
        if (!header || (header.type !== 'text' && header.type !== 'dropdown')) {
          return false;
        }
      } else if (visualizationType === 'number') {
        if (Array.isArray(form.formula) && form.formula.length > 0) {
          // Validate that all header parts have a header and calc
          for (const part of form.formula) {
            if (part.header && (!part.header || !part.calc)) return false;
          }
          return true;
        }
        // Validate that the selected field is number
        const tKey = cardTemplates[0];
        const headers = templateHeaderMap[tKey] || [];
        const field = fields[tKey]?.[0];
        const header = headers.find((h) => h.key === field);
        if (!header || header.type !== 'number') {
          return false;
        }
        if (aggregation !== 'average' && aggregation !== 'count') {
          return false;
        }
      } else if (visualizationType !== 'pie' && visualizationType !== 'bar' && visualizationType !== 'number' && aggregation !== 'count') {
        // Validate all fields against their template's headers for line chart
        const allFields = comparisonFields.length > 0 ? comparisonFields : cardTemplates.flatMap((t) => fields[t] || []);
        const invalidFields = allFields.filter((field) => {
          const tKey = cardTemplates.find(t => (fields[t] || []).includes(field)) || cardTemplates[0];
          const headers = templateHeaderMap[tKey] || [];
          const header = headers.find((h) => h.key === field);
          const valid = header && (header.type === 'number' || header.type === 'currency' || header.type === 'date' || header.type === 'text' || header.type === 'dropdown');
          return !valid;
        });
        if (invalidFields.length > 0) {
          return false;
        }
      }
      const nameConflict = currentCategories[activeCategoryIndex]?.metrics.some(
        (m, i) => m.name.toLowerCase() === trimmedName.toLowerCase() && i !== activeMetricIndex
      );
      if (nameConflict) {
        return false;
      }
      return true;
    },
    [activeCategoryIndex, currentCategories, activeMetricIndex, mainContext.cardTemplates]
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
      dateMode: 'range',
      filterValues: {},
      groupBy: '',
      includeHistory: true,
      comparisonFields: [],
      formula: [],
    });
    setDateRangeMode({});
    setNumberRangeMode({});
    setActiveFilterIndex(null);
    setSelectedCardTemplate(null);
  }, []);

  // Section toggling helper
  const toggleSection = useCallback((sectionIndex) => {
    setActiveSectionIndex((prev) => (prev === sectionIndex ? null : sectionIndex));
  }, []);

  // Add metric
  const addMetric = useCallback(() => {
    let formToSave = { ...metricForm };
    const cardTemplatesArr = Array.isArray(formToSave.cardTemplates) ? formToSave.cardTemplates : [];
    const templateKey = cardTemplatesArr[0];

    if (!templateKey || !mainContext.cardTemplates || !cards) {
      alert('Cannot add metric: Missing card templates or cards data.');
      return;
    }

    let yField, template, header;
    if (templateKey) {
      yField = formToSave.fields[templateKey]?.[0];
      template = mainContext.cardTemplates.find(
        (t) => (t.typeOfCards || t.name) === templateKey
      );
      if (template && yField) {
        header = template.headers?.find((h) => h.key === yField);
        if (header && (header.type === 'text' || header.type === 'dropdown')) {
          formToSave.aggregation = 'count';
        }
      }
    }

    if (!validateMetric(formToSave)) {
      alert('Metric validation failed. Please check your inputs.');
      return;
    }

    const { name, cardTemplates, fields, aggregation, visualizationType, dateRange, filterValues, groupBy, includeHistory, comparisonFields } = formToSave;
    const config = { cardTemplates, fields, aggregation, dateRange, filterValues, groupBy, visualizationType, includeHistory, comparisonFields };

    const templateObj = mainContext.cardTemplates.find(
      (t) => (t.name || t.typeOfCards) === cardTemplates[0]
    );
    if (!templateObj) {
      alert('Cannot add metric: Selected template not found.');
      return;
    }

    const selectedHeaderKey = fields[templateKey]?.[0];
    if (!selectedHeaderKey) {
      alert('Cannot add metric: No field selected.');
      return;
    }

    // Compute chart data for the metric using computeMetricData
    const chartData = computeMetricData(cards, config, templateObj.headers || []);
    let value;
    if (formToSave.visualizationType === 'number' && Array.isArray(formToSave.formula) && formToSave.formula.length > 0) {
      const cardsForTemplate = cards.filter(card => card.typeOfCards === templateKey);
      value = evaluateNumberFormula(formToSave.formula, cardsForTemplate, templateKey, templateObj.headers || []);
    } else if (visualizationType === 'number' && chartData && typeof chartData.value !== 'undefined') {
      value = chartData.value;
    }
    // Store only the fields used from relevant cards, and for date fields, also store the latest timestamp from history if available
    const relevantCards = cards.filter(card => {
      if (!cardTemplates.includes(card.typeOfCards)) return false;
      return Object.keys(filterValues || {}).every(key => {
        const filter = filterValues[key];
        if (!filter || Object.keys(filter).length === 0) return true;
        const cardValue = card[key];
        if (filter.values) {
          return filter.values.some(val => val.toLowerCase() === cardValue?.toString().toLowerCase());
        } else if (filter.start || filter.end) {
          const cardDate = new Date(cardValue);
          const startFilter = filter.start ? new Date(filter.start) : null;
          const endFilter = filter.end ? new Date(filter.end) : null;
          return (!startFilter || cardDate >= startFilter) && (!endFilter || cardDate <= endFilter);
        } else if (filter.value) {
          switch (filter.condition || filter.order || 'equals') {
            case 'equals':
              return cardValue?.toString().toLowerCase() === filter.value.toLowerCase();
            case 'contains':
              return cardValue && cardValue.toString().toLowerCase().includes(filter.value.toLowerCase());
            default:
              return true;
          }
        }
        return true;
      });
    });
    const selectedFields = fields[templateKey] || [];
    const records = relevantCards.map(card => {
      const obj = { id: card.id, typeOfCards: card.typeOfCards };
      selectedFields.forEach(field => {
        obj[field] = card[field];
        // For line charts, always store the latest timestamp from history for every field if available
        if (visualizationType === 'line' && Array.isArray(card.history)) {
          const fieldHistory = card.history.filter(h => h.field === field && h.timestamp);
          if (fieldHistory.length > 0) {
            // Use the latest timestamp
            const latest = fieldHistory.reduce((a, b) => (a.timestamp.seconds > b.timestamp.seconds ? a : b));
            obj[`${field}_timestamp`] = latest.timestamp;
          }
        } else {
          // For non-line charts, keep previous logic for date fields
          const header = templateObj.headers?.find(h => h.key === field);
          if (header && header.type === 'date' && Array.isArray(card.history)) {
            const dateHistory = card.history.filter(h => h.field === field && h.timestamp);
            if (dateHistory.length > 0) {
              const latest = dateHistory.reduce((a, b) => (a.timestamp.seconds > b.timestamp.seconds ? a : b));
              obj[`${field}_timestamp`] = latest.timestamp;
            }
          }
        }
      });
      return obj;
    });
    const newMetric = {
      id: `metric-${uuidv4()}`,
      name: name.trim(), // Ensure full name is used
      type: visualizationType,
      config: { ...config, formula: formToSave.formula },
      data: chartData,
      value,
      records,
    };

    setCurrentCategories((prev) => {
      const updated = prev.map((c, i) =>
        i === activeCategoryIndex
          ? { ...c, metrics: [...c.metrics, newMetric] }
          : c
      );
      setTempData({ currentCategories: updated });
      return updated;
    });
    resetForm();
    setNavigationDirection('backward');
    goToStep(3);
  }, [metricForm, activeCategoryIndex, validateMetric, cards, resetForm, setTempData, mainContext.cardTemplates]);

  // Update metric
  const updateMetric = useCallback(
    (metricIndex) => {
      let formToSave = { ...metricForm };
      const cardTemplatesArr = Array.isArray(formToSave.cardTemplates) ? formToSave.cardTemplates : [];
      const templateKey = cardTemplatesArr[0];

      if (!templateKey || !mainContext.cardTemplates || !cards) {
        alert('Cannot update metric: Missing card templates or cards data.');
        return;
      }

      let yField, template, header;
      if (templateKey) {
        yField = formToSave.fields[templateKey]?.[0];
        template = mainContext.cardTemplates.find(
          (t) => (t.typeOfCards || t.name) === templateKey
        );
        if (template && yField) {
          header = template.headers?.find((h) => h.key === yField);
          if (header && (header.type === 'text' || header.type === 'dropdown')) {
            formToSave.aggregation = 'count';
          }
        }
      }

      if (!validateMetric(formToSave)) {
        alert('Metric validation failed. Please check your inputs.');
        return;
      }

      const { name, cardTemplates, fields, aggregation, visualizationType, dateRange, filterValues, groupBy, includeHistory, comparisonFields } = formToSave;
      const config = { cardTemplates, fields, aggregation, dateRange, filterValues, groupBy, visualizationType, includeHistory, comparisonFields };

      const templateObj = mainContext.cardTemplates.find(
        (t) => (t.name || t.typeOfCards) === cardTemplates[0]
      );
      if (!templateObj) {
        alert('Cannot update metric: Selected template not found.');
        return;
      }

      const selectedHeaderKey = fields[templateKey]?.[0];
      if (!selectedHeaderKey) {
        alert('Cannot update metric: No field selected.');
        return;
      }

      // Compute chart data for the metric using computeMetricData
      const chartData = computeMetricData(cards, config, templateObj.headers || []);
      let value;
      if (formToSave.visualizationType === 'number' && Array.isArray(formToSave.formula) && formToSave.formula.length > 0) {
        const cardsForTemplate = cards.filter(card => card.typeOfCards === templateKey);
        value = evaluateNumberFormula(formToSave.formula, cardsForTemplate, templateKey, templateObj.headers || []);
      } else if (visualizationType === 'number' && chartData && typeof chartData.value !== 'undefined') {
        value = chartData.value;
      }
      // Store only the fields used from relevant cards, and for date fields, also store the latest timestamp from history if available
      const relevantCards = cards.filter(card => {
        if (!cardTemplates.includes(card.typeOfCards)) return false;
        return Object.keys(filterValues || {}).every(key => {
          const filter = filterValues[key];
          if (!filter || Object.keys(filter).length === 0) return true;
          const cardValue = card[key];
          if (filter.values) {
            return filter.values.some(val => val.toLowerCase() === cardValue?.toString().toLowerCase());
          } else if (filter.start || filter.end) {
            const cardDate = new Date(cardValue);
            const startFilter = filter.start ? new Date(filter.start) : null;
            const endFilter = filter.end ? new Date(filter.end) : null;
            return (!startFilter || cardDate >= startFilter) && (!endFilter || cardDate <= endFilter);
          } else if (filter.value) {
            switch (filter.condition || filter.order || 'equals') {
              case 'equals':
                return cardValue?.toString().toLowerCase() === filter.value.toLowerCase();
              case 'contains':
                return cardValue && cardValue.toString().toLowerCase().includes(filter.value.toLowerCase());
              default:
                return true;
            }
          }
          return true;
        });
      });
      const selectedFields = fields[templateKey] || [];
      const records = relevantCards.map(card => {
        const obj = { id: card.id, typeOfCards: card.typeOfCards };
        selectedFields.forEach(field => {
          obj[field] = card[field];
          // For line charts, always store the latest timestamp from history for every field if available
          if (visualizationType === 'line' && Array.isArray(card.history)) {
            const fieldHistory = card.history.filter(h => h.field === field && h.timestamp);
            if (fieldHistory.length > 0) {
              // Use the latest timestamp
              const latest = fieldHistory.reduce((a, b) => (a.timestamp.seconds > b.timestamp.seconds ? a : b));
              obj[`${field}_timestamp`] = latest.timestamp;
            }
          } else {
            // For non-line charts, keep previous logic for date fields
            const header = templateObj.headers?.find(h => h.key === field);
            if (header && header.type === 'date' && Array.isArray(card.history)) {
              const dateHistory = card.history.filter(h => h.field === field && h.timestamp);
              if (dateHistory.length > 0) {
                const latest = dateHistory.reduce((a, b) => (a.timestamp.seconds > b.timestamp.seconds ? a : b));
                obj[`${field}_timestamp`] = latest.timestamp;
              }
            }
          }
        });
        return obj;
      });
      const updatedMetric = {
        id: currentCategories[activeCategoryIndex].metrics[metricIndex].id,
        name: name.trim(), // Ensure full name is used
        type: visualizationType,
        config: { ...config, formula: formToSave.formula },
        data: chartData,
        value,
        records,
      };

      setCurrentCategories((prev) => {
        const updated = prev.map((c, i) =>
          i === activeCategoryIndex
            ? {
                ...c,
                metrics: c.metrics.map((m, j) => (j === metricIndex ? updatedMetric : m)),
              }
            : c
        );
        setTempData({ currentCategories: updated });
        return updated;
      });
      resetForm();
      setNavigationDirection('backward');
      goToStep(3);
    },
    [metricForm, activeCategoryIndex, validateMetric, cards, resetForm, setTempData, currentCategories, mainContext.cardTemplates]
  );

  // Delete metric
  const deleteMetric = useCallback(
    (metricIndex) => {
      setCurrentCategories((prev) => {
        const updated = prev.map((c, i) =>
          i === activeCategoryIndex
            ? { ...c, metrics: c.metrics.filter((_, j) => j !== metricIndex) }
            : c
        );
        setTempData({ currentCategories: updated });  
        return updated;
      });
      setActiveMetricIndex(-1);
      setNavigationDirection('backward');
      goToStep(3);
    },
    [activeCategoryIndex, setTempData]
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
    setNavigationDirection('backward');
    goToStep(3);
  }, [newCategoryName, currentCategories, validateCategory, setTempData]);

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
              onClick: () => {
                saveMetric();
              },
              isActive: metricForm.name && (metricForm.cardTemplates.some((t) => metricForm.fields[t]?.length > 0) || metricForm.comparisonFields.length === 2),
            },
          },
          {
            title: () => 'Select Metric Output',
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
                goToStep(4);
              },
            },
          },
          {
            title: () => `Fields for ${selectedCardTemplate || metricForm.cardTemplates[0] || ''}`,
            leftButton: {
              label: 'Back',
              onClick: () => {
                setNavigationDirection('backward');
                goToStep(4);
              },
            },
          },
          {
            title: () => 'Configure Filters',
            leftButton: {
              label: 'Back',
              onClick: () => {
                setNavigationDirection('backward');
                goToStep(4);
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
          onClick: () => {
            saveMetric();
          },
          isActive: metricForm.name && (metricForm.cardTemplates.some((t) => metricForm.fields[t]?.length > 0) || metricForm.comparisonFields.length === 2),
        },
      };
    } else if (currentStep === 5) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: 'Select Metric Output',
        backButtonTitle: activeMetricIndex === -1 ? 'New Metric' : 'Edit Metric',
      };
    } else if (currentStep === 6) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: 'Select Card Templates',
        backButtonTitle: 'New Metric',
      };
    } else if (currentStep === 7) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: `Fields for ${selectedCardTemplate || metricForm.cardTemplates[0] || ''}`,
        backButtonTitle: 'New Metric',
      };
    } else if (currentStep === 8) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: 'Configure Filters',
        backButtonTitle: 'New Metric',
      };
    }

    if (
      !prevConfigRef.current ||
      JSON.stringify(newConfig) !== JSON.stringify(prevConfigRef.current)
    ) {
      setModalConfig(newConfig);
      prevConfigRef.current = newConfig;
    }

    // Only set navigationDirection automatically if it is null
    if (prevStepRef.current !== currentStep) {
      if (navigationDirection === null) {
        setNavigationDirection(currentStep > prevStepRef.current ? 'forward' : 'backward');
      }
      prevStepRef.current = currentStep;
      setTimeout(() => setNavigationDirection(null), 300); // Reset after animation
    }
  }, [currentStep, activeCategoryIndex, setModalConfig, saveMetric, handleClose, setTempData, currentCategories, goToStep, metricForm, selectedCardTemplate, newCategoryName, addCategory, navigationDirection]);

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
          dateMode: metric.config?.dateRange?.end ? 'range' : 'single',
          filterValues: metric.config?.filterValues || {},
          groupBy: metric.config?.groupBy || '',
          includeHistory: metric.config?.includeHistory !== undefined ? metric.config.includeHistory : true,
          comparisonFields: metric.config?.comparisonFields || [],
          formula: metric.config?.formula || [],
        });
      } else {
        resetForm();
      }
      setNavigationDirection('forward');
      goToStep(4);
    },
    [currentCategories, resetForm, goToStep]
  );

  // Ensure cardTemplates and cards are loaded
  useEffect(() => {
    if ((!cardTemplates || cardTemplates.length === 0) && mainContext.loadCardTemplates) {
      mainContext.loadCardTemplates();
    }
    if ((!cards || cards.length === 0) && mainContext.loadCards) {
      mainContext.loadCards();
    }
  }, [cardTemplates, cards, mainContext]);

  // Add click-outside handler for field dropdown
  useEffect(() => {
    if (!fieldDropdownOpen) return;
    function handleClickOutside(event) {
      if (fieldDropdownRef.current && !fieldDropdownRef.current.contains(event.target)) {
        setFieldDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [fieldDropdownOpen]);

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
                        <span className={styles.chevronIcon}>
                          <FaChevronRight />
                        </span>
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
                          <span className={styles.metricTypeLabel + (isDarkTheme ? ' ' + styles.darkTheme : '')}>
                            {metric.type === 'line' ? 'Line' : metric.type === 'bar' ? 'Bar' : metric.type === 'pie' ? 'Pie' : metric.type === 'number' ? 'Number' : metric.type}
                          </span>
                        </div>
                        <span className={styles.chevronIcon}>
                          <FaChevronRight />
                        </span>
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
                {/* Metric name input styled as a selector button for perfect match */}
                <div className={styles.metricNameInputContainer}>
                  <div
                    className={`${styles.filterItem} ${styles.metricNameInputWrapper} ${isDarkTheme ? styles.darkTheme : ''}`}
                    tabIndex={0}
                    onClick={e => {
                      e.currentTarget.querySelector('input')?.focus();
                    }}
                  >
                    <input
                      type="text"
                      value={metricForm.name}
                      onChange={e => setMetricForm(prev => ({ ...prev, name: e.target.value }))}
                      onKeyPress={handleKeyPress}
                      placeholder="Metric name"
                      className={`${styles.metricNameInput} ${isDarkTheme ? styles.darkTheme : ''}`}
                      autoFocus
                    />
                  </div>
                </div>
                <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>  
                  <button
                    className={`${styles.metricOutputButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    type="button"
                    onClick={() => {
                      setNavigationDirection('forward');
                      goToStep(5);
                    }}
                  >
                    Metric Output
                    <span className={styles.chevronIcon}>
                      <FaChevronRight />
                    </span>
                  </button>
                </div>
                {/* Centered Delete Metric button below filterList */}
                {activeMetricIndex !== -1 && (
                  <div className={styles.deleteMetricButtonContainer}>
                    <button
                      className={styles.deleteButton}
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this metric? This action cannot be undone.')) {
                          deleteMetric(activeMetricIndex);
                        }
                      }}
                    >
                      Delete Metric
                    </button>
                  </div>
                )}
              </div>
            )}
            {step === 5 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={`${styles.filterList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  {/* Metric Output selector dropdown */}
                  <div className={`${styles.filterItem} ${isDarkTheme ? styles.darkTheme : ''}`} style={{ cursor: 'pointer', position: 'relative' }} ref={outputDropdownRef} onClick={() => setOutputDropdownOpen((open) => !open)}>
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
                        <span className={styles.chevronIcon + (outputDropdownOpen ? ' ' + styles.chevronOpen : '')}>
                          <FaChevronDown />
                        </span>
                      </div>
                    </div>
                    {outputDropdownOpen && (
                      <div style={{
                        position: 'absolute',
                        zIndex: 10,
                        top: '100%',
                        left: 0,
                        background: isDarkTheme ? '#222' : '#fff',
                        border: '1px solid #ccc',
                        borderRadius: 8,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        minWidth: 180,
                        marginTop: 4,
                        padding: 4,
                      }}>
                        {[
                          { type: 'line', label: 'Line Chart' },
                          { type: 'pie', label: 'Pie Chart' },
                          { type: 'bar', label: 'Bar Chart' },
                          { type: 'number', label: 'Number Output' },
                        ].map((option) => (
                          <div
                            key={option.type}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              background: metricForm.visualizationType === option.type ? (isDarkTheme ? '#333' : '#f0f8ff') : 'transparent',
                              borderRadius: 6,
                              fontWeight: metricForm.visualizationType === option.type ? 600 : 400,
                              color: isDarkTheme ? '#fff' : '#222',
                            }}
                            onClick={() => {
                              setMetricForm((prev) => ({ ...prev, visualizationType: option.type, aggregation: option.type === 'number' ? 'average' : prev.aggregation }));
                              setOutputDropdownOpen(false);
                            }}
                          >
                            {option.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Card Template selector dropdown */}
                  <div
                    className={`${styles.filterItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                    style={{ cursor: 'pointer', position: 'relative' }}
                    ref={templateDropdownRef}
                    onClick={() => setTemplateDropdownOpen((open) => !open)}
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
                        <span className={styles.chevronIcon + (templateDropdownOpen ? ' ' + styles.chevronOpen : '')}>
                          <FaChevronDown />
                        </span>
                      </div>
                    </div>
                    {templateDropdownOpen && (
                      <div style={{
                        position: 'absolute',
                        zIndex: 10,
                        top: '100%',
                        left: 0,
                        background: isDarkTheme ? '#222' : '#fff',
                        border: '1px solid #ccc',
                        borderRadius: 8,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        minWidth: 180,
                        marginTop: 4,
                        padding: 4,
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}>
                        {(cardTemplates && cardTemplates.length > 0) ? (
                          cardTemplates.map((template, idx) => {
                            const templateKey = template.name || template.typeOfCards || idx;
                            return (
                              <div
                                key={templateKey}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  background: metricForm.cardTemplates[0] === templateKey ? (isDarkTheme ? '#333' : '#f0f8ff') : 'transparent',
                                  borderRadius: 6,
                                  fontWeight: metricForm.cardTemplates[0] === templateKey ? 600 : 400,
                                  color: isDarkTheme ? '#fff' : '#222',
                                }}
                                onClick={() => {
                                  setMetricForm((prev) => ({ ...prev, cardTemplates: [templateKey], fields: {} }));
                                  setTemplateDropdownOpen(false);
                                }}
                              >
                                {template.name || template.typeOfCards}
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ color: '#888', padding: '8px 12px' }}>No card templates available.</div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Field selector (Y Axis/Data Field) */}
                  {(metricForm.visualizationType === 'line' || metricForm.visualizationType === 'pie' || metricForm.visualizationType === 'bar') && (
                    <div
                      className={`${styles.filterItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                      style={{ cursor: 'pointer', position: 'relative' }}
                      ref={fieldDropdownRef}
                      onClick={() => setFieldDropdownOpen((open) => !open)}
                    >
                      <div className={styles.filterRow}>
                        <div className={styles.filterNameType}>
                          <span>{metricForm.visualizationType === 'line' ? 'Y Axis' : 'Data Field'}</span>
                        </div>
                        <div className={styles.primaryButtons}>
                          <span className={styles.filterSummary}>
                            {(() => {
                              const yField = metricForm.fields[metricForm.cardTemplates[0]]?.[0];
                              const template = cardTemplates.find(
                                (t) => (t.typeOfCards || t.name) === metricForm.cardTemplates[0]
                              );
                              const header = template?.headers?.find((h) => h.key === yField);
                              return header ? header.name : 'Select Header';
                            })()}
                          </span>
                          <span className={styles.chevronIcon + (fieldDropdownOpen ? ' ' + styles.chevronOpen : '')}>
                            <FaChevronDown />
                          </span>
                        </div>
                      </div>
                      {fieldDropdownOpen && (
                        <div style={{
                          position: 'absolute',
                          zIndex: 10,
                          top: '100%',
                          left: 0,
                          background: isDarkTheme ? '#222' : '#fff',
                          border: '1px solid #ccc',
                          borderRadius: 8,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          minWidth: 180,
                          marginTop: 4,
                          padding: 4,
                          maxHeight: 220,
                          overflowY: 'auto',
                        }}>
                          {(() => {
                            const templateKey = metricForm.cardTemplates[0];
                            const template = cardTemplates.find(
                              (t) => (t.name || t.typeOfCards) === templateKey
                            );
                            if (!template) {
                              return <div style={{ color: '#888', padding: '8px 12px' }}>No template selected.</div>;
                            }
                            const templateHeaders = template.headers || [];
                            if (templateHeaders.length === 0) {
                              return <div style={{ color: '#888', padding: '8px 12px' }}>No fields available for this template.</div>;
                            }
                            return templateHeaders.map((header) => (
                              <div
                                key={header.key}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  background:
                                    metricForm.fields[templateKey]?.[0] === header.key
                                      ? (isDarkTheme ? '#333' : '#f0f8ff')
                                      : 'transparent',
                                  borderRadius: 6,
                                  fontWeight:
                                    metricForm.fields[templateKey]?.[0] === header.key ? 600 : 400,
                                  color: isDarkTheme ? '#fff' : '#222',
                                }}
                                onClick={() => {
                                  setMetricForm((prev) => ({
                                    ...prev,
                                    fields: { ...prev.fields, [templateKey]: [header.key] },
                                  }));
                                  setFieldDropdownOpen(false);
                                }}
                              >
                                {header.name} <span style={{ color: '#888', fontSize: 12 }}>({header.type})</span>
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Formula builder for number output */}
                  {metricForm.visualizationType === 'number' && (
                    <div
                      className={`${styles.filterItem} ${activeSectionIndex === 5 ? styles.activeItem : ''} ${isDarkTheme ? styles.darkTheme : ''}`}
                      tabIndex={0}
                      style={{ cursor: 'default', flexDirection: 'column', alignItems: 'flex-start' }}
                    >
                      <div className={styles.filterRow}>
                        <div className={styles.filterNameType}>
                          <span>Formula</span>
                        </div>
                        <div className={styles.primaryButtons}>
                          <span className={styles.filterSummary}>Build a custom calculation</span>
                        </div>
                      </div>
                      <div className={styles.filterActions} style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                        {/* Formula builder UI */}
                        {(metricForm.formula || []).map((part, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            {('header' in part) ? (
                              <>
                                {/* Header selector always visible */}
                                <select
                                  value={part.header || ''}
                                  onChange={e => {
                                    const newFormula = [...(metricForm.formula || [])];
                                    newFormula[idx].header = e.target.value;
                                    setMetricForm(prev => ({ ...prev, formula: newFormula }));
                                  }}
                                  style={{ minWidth: 120 }}
                                  autoFocus={part.header === ''}
                                >
                                  <option value="">Select Header</option>
                                  {(cardTemplates.find(t => (t.name || t.typeOfCards) === metricForm.cardTemplates[0])?.headers || []).map(h => (
                                    <option key={h.key} value={h.key}>{h.name}</option>
                                  ))}
                                </select>
                                {/* Calculation type selector always visible */}
                                <select
                                  value={part.calc || 'sum'}
                                  onChange={e => {
                                    const newFormula = [...(metricForm.formula || [])];
                                    newFormula[idx].calc = e.target.value;
                                    setMetricForm(prev => ({ ...prev, formula: newFormula }));
                                  }}
                                  style={{ minWidth: 90 }}
                                >
                                  <option value="count">Count</option>
                                  <option value="sum">Sum</option>
                                  <option value="average">Average</option>
                                </select>
                              </>
                            ) : part.op ? (
                              <select
                                value={part.op}
                                onChange={e => {
                                  const newFormula = [...(metricForm.formula || [])];
                                  newFormula[idx].op = e.target.value;
                                  setMetricForm(prev => ({ ...prev, formula: newFormula }));
                                }}
                                style={{ minWidth: 50 }}
                              >
                                <option value="+">+</option>
                                <option value="-">-</option>
                                <option value="*">*</option>
                                <option value="/">/</option>
                              </select>
                            ) : null}
                            {/* Remove part button */}
                            <button
                              style={{ marginLeft: 4, color: '#c00', background: 'none', border: 'none', cursor: 'pointer' }}
                              onClick={() => {
                                const newFormula = [...(metricForm.formula || [])];
                                newFormula.splice(idx, 1);
                                setMetricForm(prev => ({ ...prev, formula: newFormula }));
                              }}
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {/* Add new part buttons, enforcing logic: header first, then operator, then header, etc. */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            style={{ minWidth: 120, borderRadius: 6, border: '1px solid #ccc', background: isDarkTheme ? '#222' : '#f8f8f8', color: isDarkTheme ? '#fff' : '#222', cursor: 'pointer' }}
                            disabled={metricForm.formula && metricForm.formula.length > 0 && !metricForm.formula[metricForm.formula.length - 1].op}
                            onClick={() => {
                              setMetricForm(prev => ({ ...prev, formula: [...(prev.formula || []), { header: '', calc: 'sum' }] }));
                            }}
                          >
                            + Add Header
                          </button>
                          <button
                            style={{ minWidth: 50, borderRadius: 6, border: '1px solid #ccc', background: isDarkTheme ? '#222' : '#f8f8f8', color: isDarkTheme ? '#fff' : '#222', cursor: 'pointer' }}
                            disabled={!(metricForm.formula && metricForm.formula.length > 0 && metricForm.formula[metricForm.formula.length - 1].header)}
                            onClick={() => {
                              setMetricForm(prev => ({ ...prev, formula: [...(prev.formula || []), { op: '+' }] }));
                            }}
                          >
                            + Add Operator
                          </button>
                        </div>
                        {/* Formula preview */}
                        <div style={{ marginTop: 8, color: isDarkTheme ? '#fff' : '#222', fontWeight: 500 }}>
                          Formula: {Array.isArray(metricForm.formula) && metricForm.formula.length > 0 ? metricForm.formula.map((part, idx) => ('header' in part) ? `${cardTemplates.find(t => (t.name || t.typeOfCards) === metricForm.cardTemplates[0])?.headers?.find(h => h.key === part.header)?.name || 'Select Header'} (${part.calc})` : part.op).join(' ') : '—'}
                        </div>
                        {/* Result preview */}
                        <div style={{ marginTop: 4, color: '#888', fontSize: 13 }}>
                          {(() => {
                            const templateKey = metricForm.cardTemplates[0];
                            const template = cardTemplates.find(t => (t.name || t.typeOfCards) === templateKey);
                            if (!template || !Array.isArray(metricForm.formula) || metricForm.formula.length === 0) return 'Result preview will appear here';
                            const cardsForTemplate = cards.filter(card => card.typeOfCards === templateKey);
                            const result = evaluateNumberFormula(metricForm.formula, cardsForTemplate, templateKey, template.headers || []);
                            return result === '' ? 'Result preview will appear here' : `Result: ${result}`;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {/* Live Chart Preview using CustomMetricChart */}
                {(() => {
                  const templateKey = metricForm.cardTemplates[0];
                  const selectedHeaderKey = metricForm.fields[templateKey]?.[0];
                  if (!selectedHeaderKey || !templateKey) return null;
                  const template = cardTemplates.find(
                    (t) => (t.name || t.typeOfCards) === templateKey
                  );
                  const header = template?.headers?.find(h => h.key === selectedHeaderKey);
                  const cardsForTemplate = cards.filter(
                    (card) => card.typeOfCards === templateKey
                  );
                  if (!cardsForTemplate.length) return (
                    <div className={styles.filterItem} style={{ color: '#888', marginTop: 16 }}>No cards found for this template.</div>
                  );

                  return (
                    <>
                      {metricForm.visualizationType === 'line' && (
                        <MetricsLineChartControls
                          granularity={granularity}
                          setGranularity={setGranularity}
                          currentMonth={currentMonth}
                          setCurrentMonth={setCurrentMonth}
                          currentYear={currentYear}
                          setCurrentYear={setCurrentYear}
                          isDarkTheme={isDarkTheme}
                        />
                      )}
                      <CustomMetricChart
                        visualizationType={metricForm.visualizationType}
                        cards={cards}
                        templateKey={templateKey}
                        selectedHeaderKey={selectedHeaderKey}
                        header={header}
                        isDarkTheme={isDarkTheme}
                        aggregation={metricForm.aggregation}
                      />
                    </>
                  );
                })()}
              </div>
            )}
            {step === 6 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={styles.filterList}>
                  <div className={styles.filterItem} style={{ cursor: 'default', fontWeight: 600 }}>
                    Select a Card Template
                  </div>
                  <div className={styles.filterItem} style={{ color: '#888' }}>Use the selector above to choose a template.</div>
                </div>
              </div>
            )}
            {step === 7 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={styles.filterList}>
                  <div className={styles.filterItem} style={{ cursor: 'default', fontWeight: 600 }}>
                    {`Fields for ${selectedCardTemplate || metricForm.cardTemplates[0] || ''}`}
                  </div>
                  {(() => {
                    const templateKey = selectedCardTemplate || metricForm.cardTemplates[0];
                    const template = cardTemplates.find(
                      (t) => (t.name || t.typeOfCards) === templateKey
                    );
                    const templateHeaders = template?.headers?.filter(
                      (header) => {
                        if (header.key === 'id' || header.key === 'typeOfCards') return false;
                        if (metricForm.visualizationType === 'pie' || metricForm.visualizationType === 'bar') {
                          return header.type === 'text' || header.type === 'dropdown';
                        }
                        if (metricForm.visualizationType === 'number' || metricForm.visualizationType === 'line') {
                          // Allow both number and date fields for number/line outputs
                          return header.type === 'number' || header.type === 'date';
                        }
                        return true;
                      }
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
                            goToStep(4);
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
                        <div className={styles.filterItem} style={{ color: '#888' }}>
                          {metricForm.visualizationType === 'number' ? 'No number headers available.' :
                           (metricForm.visualizationType === 'pie' || metricForm.visualizationType === 'bar') ? 'No text or dropdown headers available.' : 'No headers available.'}
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            )}
            {step === 8 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={styles.filterList}>
                  <div className={styles.filterItem} style={{ cursor: 'default', fontWeight: 600 }}>
                    Configure Filters
                  </div>
                  <div className={styles.filterItem} style={{ color: '#888' }}>
                    Filter configuration not implemented.
                  </div>
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
              comparisonFields: PropTypes.arrayOf(PropTypes.string),
              formula: PropTypes.arrayOf(
                PropTypes.oneOfType([
                  PropTypes.shape({
                    header: PropTypes.string,
                    calc: PropTypes.string,
                  }),
                  PropTypes.shape({
                    op: PropTypes.string,
                  }),
                ])
              ),
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
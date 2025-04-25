import { useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './MetricsModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';
import { v4 as uuidv4 } from 'uuid';
import { computeMetricData } from '../../Metrics/metricsUtils';
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
    fields: [],
    aggregation: 'average',
    visualizationType: 'line',
    dateRange: { start: '2023-01-01', end: '2025-04-24' },
    filter: { key: '', value: '' },
    groupBy: '',
    includeHistory: true,
    granularity: 'monthly',
  });
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(null);
  const [activeMetricIndex, setActiveMetricIndex] = useState(-1);
  const hasInitialized = useRef(false);
  const prevCategoriesRef = useRef(currentCategories);
  const prevConfigRef = useRef(null);

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
      const { name, cardTemplates, fields } = form;
      const trimmedName = name.trim();
      if (!trimmedName) {
        alert('Metric name cannot be empty.');
        return false;
      }
      if (cardTemplates.length === 0) {
        alert('Select at least one card template.');
        return false;
      }
      if (fields.length === 0) {
        alert('Select at least one field.');
        return false;
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
    [activeCategoryIndex, currentCategories, activeMetricIndex]
  );

  // Reset form
  const resetForm = useCallback(() => {
    setMetricForm({
      name: '',
      cardTemplates: [],
      fields: [],
      aggregation: 'average',
      visualizationType: 'line',
      dateRange: { start: '2023-01-01', end: '2025-04-24' },
      filter: { key: '', value: '' },
      groupBy: '',
      includeHistory: true,
      granularity: 'monthly',
    });
  }, []);

  // Toggle card template
  const toggleCardTemplate = useCallback((template) => {
    setMetricForm((prev) => ({
      ...prev,
      cardTemplates: prev.cardTemplates.includes(template)
        ? prev.cardTemplates.filter((t) => t !== template)
        : [...prev.cardTemplates, template],
      fields: [], // Reset fields when templates change
    }));
  }, []);

  // Toggle field
  const toggleField = useCallback((field) => {
    setMetricForm((prev) => ({
      ...prev,
      fields: prev.fields.includes(field)
        ? prev.fields.filter((f) => f !== field)
        : [...prev.fields, field],
    }));
  }, []);

  // Field options
  const fieldOptions = useMemo(() => {
    if (metricForm.cardTemplates.length === 0) return [];
    const validKeys = metricForm.cardTemplates
      .flatMap((type) =>
        cardTemplates
          .filter((t) => t.typeOfCards === type)
          .flatMap((t) => t.sections.flatMap((s) => s.keys))
      )
      .filter((key, index, self) => self.indexOf(key) === index);
    return headers
      .filter((header) => validKeys.includes(header.key))
      .map((header) => ({
        key: header.key,
        name: header.name,
      }));
  }, [metricForm.cardTemplates, cardTemplates, headers]);

  // Filter key options
  const filterKeyOptions = useMemo(() => {
    return headers.map((header) => ({
      key: header.key,
      name: header.name,
    }));
  }, [headers]);

  // Add metric
  const addMetric = useCallback(() => {
    if (!validateMetric(metricForm)) return;

    const { name, cardTemplates, fields, aggregation, visualizationType, dateRange, filter, groupBy, includeHistory, granularity } = metricForm;
    const config = { cardTemplates, fields, aggregation, dateRange, filter, groupBy, visualizationType, includeHistory, granularity };
    const data = computeMetricData(cards, config);

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
    goToStep(2);
  }, [metricForm, activeCategoryIndex, validateMetric, cards, resetForm, goToStep, setTempData]);

  // Update metric
  const updateMetric = useCallback(
    (metricIndex) => {
      if (!validateMetric(metricForm)) return;

      const { name, cardTemplates, fields, aggregation, visualizationType, dateRange, filter, groupBy, includeHistory, granularity } = metricForm;
      const config = { cardTemplates, fields, aggregation, dateRange, filter, groupBy, visualizationType, includeHistory, granularity };
      const data = computeMetricData(cards, config);

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
      goToStep(2);
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
      goToStep(2);
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
    goToStep(2);
  }, [newCategoryName, currentCategories, validateCategory, goToStep, setTempData]);

  // Select category
  const selectCategory = useCallback((categoryIndex) => {
    setActiveCategoryIndex(categoryIndex);
    setActiveMetricIndex(-1);
    goToStep(2);
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
            title: () => currentCategories[activeCategoryIndex]?.category || 'Metrics',
            leftButton: {
              label: 'Metrics',
              onClick: () => goToStep(1),
            },
          },
          {
            title: () => (activeMetricIndex === -1 ? 'New Metric' : 'Edit Metric'),
            rightButton: {
              label: 'Save',
              onClick: saveMetric,
              isActive: metricForm.name && metricForm.fields.length > 0 && metricForm.cardTemplates.length > 0,
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

  // Update modal config
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
        title: currentCategories[activeCategoryIndex]?.category || 'Metrics',
        backButtonTitle: 'Metrics',
        rightButton: {
          label: 'New Metric',
          onClick: () => toggleEditMetric(activeCategoryIndex, -1),
          isActive: true,
        },
      };
    } else if (currentStep === 3) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: activeMetricIndex === -1 ? 'New Metric' : 'Edit Metric',
        backButtonTitle: currentCategories[activeCategoryIndex]?.category || 'Metrics',
        rightButton: {
          label: 'Save',
          onClick: saveMetric,
          isActive: metricForm.name && metricForm.fields.length > 0 && metricForm.cardTemplates.length > 0,
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
  }, [currentStep, activeCategoryIndex, setModalConfig, saveMetric, handleClose, setTempData, currentCategories, goToStep, metricForm]);

  // Sync categories
  useEffect(() => {
    const categoriesChanged = JSON.stringify(currentCategories) !== JSON.stringify(prevCategoriesRef.current);
    if (categoriesChanged) {
      setTempData({ currentCategories });
      prevCategoriesRef.current = currentCategories;
    }
  }, [currentCategories, setTempData]);

  // Handle key press
  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === 'Enter' && currentStep === 3) {
        saveMetric();
      } else if (e.key === 'Enter' && currentStep === 1 && newCategoryName.trim()) {
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
        setMetricForm({
          name: metric.name,
          cardTemplates: metric.config?.cardTemplates || [],
          fields: metric.config?.fields || [],
          aggregation: metric.config?.aggregation || 'average',
          visualizationType: metric.type || 'line',
          dateRange: metric.config?.dateRange || { start: '2023-01-01', end: '2025-04-24' },
          filter: metric.config?.filter || { key: '', value: '' },
          groupBy: metric.config?.groupBy || '',
          includeHistory: metric.config?.includeHistory !== undefined ? metric.config.includeHistory : true,
          granularity: metric.config?.granularity || 'monthly',
        });
      } else {
        resetForm();
      }
      goToStep(3);
    },
    [currentCategories, resetForm, goToStep]
  );

  // Render chart preview
  const renderChartPreview = () => {
    if (!metricForm.fields.length || metricForm.cardTemplates.length === 0) return null;

    const config = {
      fields: metricForm.fields,
      aggregation: metricForm.aggregation,
      dateRange: metricForm.dateRange,
      cardTemplates: metricForm.cardTemplates,
      filter: metricForm.filter.key && metricForm.filter.value ? metricForm.filter : null,
      groupBy: metricForm.groupBy || 'cardType',
      visualizationType: metricForm.visualizationType,
      includeHistory: metricForm.includeHistory,
      granularity: 'monthly',
    };

    const data = computeMetricData(cards, config);

    // Format labels as three-letter month abbreviations
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
    const formattedLabels = (data.labels || []).map((label) => {
      try {
        const date = new Date(label);
        return monthFormatter.format(date);
      } catch {
        return label.slice(0, 3); // Fallback for invalid dates
      }
    });

    // Ensure unique labels to avoid duplication
    const uniqueLabels = [];
    const labelSet = new Set();
    formattedLabels.forEach((label) => {
      if (!labelSet.has(label)) {
        labelSet.add(label);
        uniqueLabels.push(label);
      }
    });

    // Aggregate datasets by month
    const aggregatedDatasets = (data.datasets || []).map((dataset) => {
      const aggregatedData = [];
      const dataMap = new Map();

      dataset.data.forEach((value, index) => {
        const label = formattedLabels[index];
        if (dataMap.has(label)) {
          const existing = dataMap.get(label);
          dataMap.set(label, existing + (value || 0));
        } else {
          dataMap.set(label, value || 0);
        }
      });

      uniqueLabels.forEach((label) => {
        aggregatedData.push(dataMap.get(label) || 0);
      });

      return {
        ...dataset,
        data: aggregatedData,
        borderColor: '#007AFF', // Apple's blue
        backgroundColor:
          metricForm.visualizationType === 'pie'
            ? ['#007AFF', '#007AFFCC', '#007AFF99', '#007AFF66'] // Fading effect for pie
            : metricForm.visualizationType === 'bar'
            ? '#007AFF' // Solid for bar
            : '#007AFF33', // Transparent for line
        fill: metricForm.visualizationType === 'line',
        tension: metricForm.visualizationType === 'line' ? 0.4 : undefined, // Smooth lines
      };
    });

    const chartData = {
      labels: uniqueLabels,
      datasets: aggregatedDatasets,
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { family: '-apple-system', size: 14 }, color: isDarkTheme ? '#FFF' : '#000' },
        },
        title: {
          display: true,
          text: metricForm.name || 'Preview',
          font: { family: '-apple-system', size: 16 },
          color: isDarkTheme ? '#FFF' : '#000',
        },
        tooltip: {
          backgroundColor: isDarkTheme ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
          titleFont: { family: '-apple-system' },
          bodyFont: { family: '-apple-system' },
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.raw.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: {
          stacked: metricForm.visualizationType === 'bar',
          ticks: { font: { family: '-apple-system' }, color: isDarkTheme ? '#FFF' : '#000' },
          grid: { color: isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
        },
        y: {
          stacked: metricForm.visualizationType === 'bar',
          ticks: { font: { family: '-apple-system' }, color: isDarkTheme ? '#FFF' : '#000' },
          grid: { color: isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
        },
      },
    };

    return (
      <div className={styles.chartPreview}>
        {metricForm.visualizationType === 'line' && <Line data={chartData} options={options} />}
        {metricForm.visualizationType === 'bar' && <Bar data={chartData} options={options} />}
        {metricForm.visualizationType === 'pie' && <Pie data={chartData} options={options} />}
        {metricForm.visualizationType === 'number' && (
          <div className={styles.numberMetric}>
            <h3>{metricForm.name || 'Preview'}</h3>
            <p>{chartData.datasets[0]?.data[chartData.datasets[0].data.length - 1]?.toFixed(2) || 0}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`${styles.metricsModal} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={styles.viewContainer}>
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ''} ${
              step !== currentStep ? styles.hidden : ''
            }`}
            style={{ display: step !== currentStep ? 'none' : 'block' }}
          >
            {step === 1 && (
              <>
                <div className={`${styles.createHeader} ${isDarkTheme ? styles.darkTheme : ''}`}>
                  <div className={styles.headerRow}>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="New Category"
                      className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ''}`}
                    />
                    <button
                      onClick={addCategory}
                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      Add
                    </button>
                  </div>
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
            {step === 3 && (
              <div className={`${styles.metricForm} ${isDarkTheme ? styles.darkTheme : ''}`}>
                <div className={styles.section}>
                  <label className={styles.label}>Metric Name</label>
                  <input
                    type="text"
                    value={metricForm.name}
                    onChange={(e) => setMetricForm((prev) => ({ ...prev, name: e.target.value }))}
                    onKeyPress={handleKeyPress}
                    placeholder="e.g., Lead Trends"
                    className={styles.textField}
                  />
                </div>
                <div className={styles.section}>
                  <label className={styles.label}>Card Templates</label>
                  <div className={styles.cardList}>
                    {cardTemplates.map((template) => (
                      <div key={template.typeOfCards} className={styles.cardItem}>
                        <input
                          type="checkbox"
                          checked={metricForm.cardTemplates.includes(template.typeOfCards)}
                          onChange={() => toggleCardTemplate(template.typeOfCards)}
                        />
                        <span>{template.typeOfCards}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.section}>
                  <label className={styles.label}>Fields</label>
                  <div className={styles.cardList}>
                    {fieldOptions.length > 0 ? (
                      fieldOptions.map((field) => (
                        <div key={field.key} className={styles.cardItem}>
                          <input
                            type="checkbox"
                            checked={metricForm.fields.includes(field.key)}
                            onChange={() => toggleField(field.key)}
                          />
                          <span>{field.name}</span>
                        </div>
                      ))
                    ) : (
                      <p className={styles.noFields}>Select a card template to see fields.</p>
                    )}
                  </div>
                </div>
                <div className={styles.section}>
                  <label className={styles.label}>Include History</label>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={metricForm.includeHistory}
                      onChange={(e) => setMetricForm((prev) => ({ ...prev, includeHistory: e.target.checked }))}
                    />
                    <span className={styles.toggleSlider}></span>
                  </label>
                </div>
                <div className={styles.section}>
                  <label className={styles.label}>Aggregation</label>
                  <select
                    value={metricForm.aggregation}
                    onChange={(e) => setMetricForm((prev) => ({ ...prev, aggregation: e.target.value }))}
                    className={styles.select}
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
                <div className={styles.section}>
                  <label className={styles.label}>Visualization</label>
                  <div className={styles.segmentedControl}>
                    {['line', 'bar', 'pie', 'number'].map((type) => (
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
                <div className={styles.section}>
                  <label className={styles.label}>Granularity</label>
                  <div className={styles.segmentedControl}>
                    {['daily', 'monthly'].map((granularity) => (
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
                <div className={styles.section}>
                  <label className={styles.label}>Filter (Optional)</label>
                  <select
                    value={metricForm.filter.key}
                    onChange={(e) =>
                      setMetricForm((prev) => ({
                        ...prev,
                        filter: { ...prev.filter, key: e.target.value },
                      }))
                    }
                    className={styles.select}
                  >
                    <option value="">None</option>
                    {filterKeyOptions.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                  {metricForm.filter.key && (
                    <input
                      type="text"
                      value={metricForm.filter.value}
                      onChange={(e) =>
                        setMetricForm((prev) => ({
                          ...prev,
                          filter: { ...prev.filter, value: e.target.value },
                        }))
                      }
                      placeholder="Filter value"
                      className={styles.textField}
                    />
                  )}
                </div>
                <div className={styles.section}>
                  <label className={styles.label}>Group By (Optional)</label>
                  <select
                    value={metricForm.groupBy}
                    onChange={(e) => setMetricForm((prev) => ({ ...prev, groupBy: e.target.value }))}
                    className={styles.select}
                  >
                    <option value="">None</option>
                    <option value="cardType">Card Template</option>
                    <option value="field">Field</option>
                    {metricForm.filter.key && (
                      <option value={metricForm.filter.key}>
                        {filterKeyOptions.find((f) => f.key === metricForm.filter.key)?.name}
                      </option>
                    )}
                  </select>
                </div>
                <div className={styles.section}>
                  <label className={styles.label}>Date Range</label>
                  <div className={styles.dateRange}>
                    <input
                      type="date"
                      value={metricForm.dateRange.start}
                      onChange={(e) =>
                        setMetricForm((prev) => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, start: e.target.value },
                        }))
                      }
                      className={styles.textField}
                    />
                    <input
                      type="date"
                      value={metricForm.dateRange.end}
                      onChange={(e) =>
                        setMetricForm((prev) => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, end: e.target.value },
                        }))
                      }
                      className={styles.textField}
                    />
                  </div>
                </div>
                {renderChartPreview()}
                {activeMetricIndex !== -1 && (
                  <div className={styles.deleteSection}>
                    <button
                      onClick={() => deleteMetric(activeMetricIndex)}
                      className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                    >
                      Delete Metric
                    </button>
                  </div>
                )}
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
            config: PropTypes.object,
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
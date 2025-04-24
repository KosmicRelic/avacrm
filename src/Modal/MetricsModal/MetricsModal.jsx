import { useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
import PropTypes from "prop-types";
import styles from "./MetricsModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";
import { v4 as uuidv4 } from "uuid";
import { computeMetricData } from "../../Metrics/metricsUtils";
import { Line, Bar, Pie } from "react-chartjs-2";
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
} from "chart.js";

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
  Legend
);

const MetricsModal = ({ tempData, setTempData, handleClose }) => {
  const { metrics = [], isDarkTheme, cards, cardTemplates, headers } = useContext(MainContext);
  const { registerModalSteps, setModalConfig, goToStep, currentStep } = useContext(ModalNavigatorContext);
  const [currentCategories, setCurrentCategories] = useState(() =>
    (tempData.currentCategories || metrics).map((c) => ({ ...c, metrics: [...c.metrics] }))
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [metricForm, setMetricForm] = useState({
    name: "",
    cardTemplates: [],
    fields: [], // Changed from field to fields (array)
    aggregation: "average",
    visualizationType: "line",
    dateRange: { start: "2023-01-01", end: "2025-04-24" },
    filter: { key: "", value: "" },
    groupBy: "",
    includeHistory: true, // New: Toggle for including history
    granularity: "monthly", // New: Default to monthly
  });
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(null);
  const [activeMetricIndex, setActiveMetricIndex] = useState(-1);
  const hasInitialized = useRef(false);
  const prevCategoriesRef = useRef(currentCategories);
  const prevConfigRef = useRef(null);

  // Validation function for category
  const validateCategory = useCallback(
    (name, existingCategories, isUpdate = false, index = null) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        alert("Category name must be non-empty.");
        return false;
      }
      const nameConflict = existingCategories.some(
        (c, i) => c.category.toLowerCase() === trimmedName.toLowerCase() && (!isUpdate || i !== index)
      );
      if (nameConflict) {
        alert(`A category with the name "${trimmedName}" already exists.`);
        return false;
      }
      return true;
    },
    []
  );

  // Validation function for metric
  const validateMetric = useCallback(
    (form) => {
      const { name, cardTemplates, fields } = form;
      const trimmedName = name.trim();
      if (!trimmedName) {
        alert("Metric name must be non-empty.");
        return false;
      }
      if (cardTemplates.length === 0) {
        alert("Please select at least one card template.");
        return false;
      }
      if (fields.length === 0) {
        alert("Please select at least one field.");
        return false;
      }
      const nameConflict = currentCategories[activeCategoryIndex]?.metrics.some(
        (m, i) => m.name.toLowerCase() === trimmedName.toLowerCase() && i !== activeMetricIndex
      );
      if (nameConflict) {
        alert(`A metric with the name "${trimmedName}" already exists in this category.`);
        return false;
      }
      return true;
    },
    [activeCategoryIndex, currentCategories, activeMetricIndex]
  );

  // Reset form fields
  const resetForm = useCallback(() => {
    setMetricForm({
      name: "",
      cardTemplates: [],
      fields: [],
      aggregation: "average",
      visualizationType: "line",
      dateRange: { start: "2023-01-01", end: "2025-04-24" },
      filter: { key: "", value: "" },
      groupBy: "",
      includeHistory: true,
      granularity: "monthly",
    });
  }, []);

  // Toggle card template selection
  const toggleCardTemplate = useCallback((template) => {
    setMetricForm((prev) => ({
      ...prev,
      cardTemplates: prev.cardTemplates.includes(template)
        ? prev.cardTemplates.filter((t) => t !== template)
        : [...prev.cardTemplates, template],
      fields: [], // Reset fields when templates change
    }));
  }, []);

  // Toggle field selection
  const toggleField = useCallback((field) => {
    setMetricForm((prev) => ({
      ...prev,
      fields: prev.fields.includes(field)
        ? prev.fields.filter((f) => f !== field)
        : [...prev.fields, field],
    }));
  }, []);

  // Get fields for selected cardTemplates
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

  // Get filter key options
  const filterKeyOptions = useMemo(() => {
    return headers.map((header) => ({
      key: header.key,
      name: header.name,
    }));
  }, [headers]);

  // Add new dynamic metric
  const addMetric = useCallback(() => {
    if (!validateMetric(metricForm)) return;

    const { name, cardTemplates, fields, aggregation, visualizationType, dateRange, filter, groupBy, includeHistory, granularity } = metricForm;
    const config = { cardTemplates, fields, aggregation, dateRange, filter, groupBy, visualizationType, includeHistory, granularity };
    const data = computeMetricData(cards, config);

    const newMetric = {
      id: `metric-${uuidv4()}`,
      name: name.trim(), // Ensure full name is saved
      type: visualizationType,
      config,
      data,
      value: visualizationType === "number" ? data.datasets[0]?.data[data.datasets[0].data.length - 1] || 0 : undefined,
    };

    console.log('Adding metric:', newMetric);

    setCurrentCategories((prev) =>
      prev.map((c, i) =>
        i === activeCategoryIndex
          ? { ...c, metrics: [...c.metrics, newMetric] }
          : { ...c }
      )
    );
    setTempData({ currentCategories });
    resetForm();
    goToStep(2);
  }, [metricForm, activeCategoryIndex, validateMetric, cards, resetForm, goToStep, setTempData]);

  // Update existing metric
  const updateMetric = useCallback(
    (metricIndex) => {
      if (!validateMetric(metricForm)) return;

      const { name, cardTemplates, fields, aggregation, visualizationType, dateRange, filter, groupBy, includeHistory, granularity } = metricForm;
      const config = { cardTemplates, fields, aggregation, dateRange, filter, groupBy, visualizationType, includeHistory, granularity };
      const data = computeMetricData(cards, config);

      const updatedMetric = {
        id: currentCategories[activeCategoryIndex].metrics[metricIndex].id,
        name: name.trim(), // Ensure full name is saved
        type: visualizationType,
        config,
        data,
        value: visualizationType === "number" ? data.datasets[0]?.data[data.datasets[0].data.length - 1] || 0 : undefined,
      };

      console.log('Updating metric:', updatedMetric);

      setCurrentCategories((prev) =>
        prev.map((c, i) =>
          i === activeCategoryIndex
            ? {
                ...c,
                metrics: c.metrics.map((m, j) => (j === metricIndex ? updatedMetric : m)),
              }
            : { ...c }
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
            : { ...c }
        )
      );
      setTempData({ currentCategories });
      setActiveMetricIndex(-1);
      if (currentCategories[activeCategoryIndex].metrics.length === 1) {
        goToStep(1);
      }
    },
    [activeCategoryIndex, goToStep, setTempData]
  );

  // Save metric (add or update)
  const saveMetric = useCallback(() => {
    if (activeMetricIndex === -1) {
      addMetric();
    } else if (activeMetricIndex !== null) {
      updateMetric(activeMetricIndex);
    }
    setActiveMetricIndex(-1);
  }, [activeMetricIndex, addMetric, updateMetric]);

  // Add new category
  const addCategory = useCallback(() => {
    if (!validateCategory(newCategoryName, currentCategories)) return;

    const newCategory = {
      category: newCategoryName.trim(),
      metrics: [],
    };
    setCurrentCategories((prev) => [...prev, newCategory]);
    setTempData({ currentCategories: [...currentCategories, newCategory] });
    setNewCategoryName("");
    setActiveCategoryIndex(currentCategories.length);
    setActiveMetricIndex(-1);
    goToStep(2);
  }, [newCategoryName, currentCategories, validateCategory, goToStep, setTempData]);

  // Initialize modal steps
  useEffect(() => {
    if (!hasInitialized.current) {
      registerModalSteps({
        steps: [
          {
            title: "Metrics",
            rightButton: {
              label: "Done",
              onClick: () => {
                setTempData({ currentCategories });
                handleClose({ fromSave: true });
              },
              isActive: true,
              isRemove: false,
            },
          },
          {
            title: () =>
              activeCategoryIndex !== null
                ? currentCategories[activeCategoryIndex]?.category || "Manage Metrics"
                : "Manage Metrics",
            rightButton: {
              label: "Create Dynamic Metric",
              onClick: () => goToStep(3),
              isActive: true,
              isRemove: false,
            },
          },
          {
            title: "Create New Metric",
            rightButton: {
              label: "Save",
              onClick: saveMetric,
              isActive: metricForm.name && metricForm.fields.length > 0 && metricForm.cardTemplates.length > 0,
            },
            leftButton: {
              label: "Cancel",
              onClick: () => goToStep(2),
            },
          },
        ],
      });
      setModalConfig({
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Metrics",
        backButtonTitle: "",
        rightButton: {
          label: "Done",
          onClick: () => {
            setTempData({ currentCategories });
            handleClose({ fromSave: true });
          },
          isActive: true,
          isRemove: false,
        },
      });
      hasInitialized.current = true;
    }
  }, [registerModalSteps, setModalConfig, activeCategoryIndex, currentCategories, saveMetric, handleClose, setTempData, goToStep]);

  // Update modal config based on step
  useEffect(() => {
    let newConfig;
    if (currentStep === 1) {
      newConfig = {
        showTitle: true,
        showDoneButton: true,
        showBackButton: false,
        title: "Metrics",
        backButtonTitle: "",
        rightButton: {
          label: "Done",
          onClick: () => {
            setTempData({ currentCategories });
            handleClose({ fromSave: true });
          },
          isActive: true,
          isRemove: false,
        },
      };
    } else if (currentStep === 2) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title:
          activeCategoryIndex !== null
            ? currentCategories[activeCategoryIndex]?.category || "Manage Metrics"
            : "Manage Metrics",
        backButtonTitle: "Metrics",
        rightButton: {
          label: "Create Dynamic Metric",
          onClick: () => goToStep(3),
          isActive: true,
          isRemove: false,
        },
      };
    } else if (currentStep === 3) {
      newConfig = {
        showTitle: true,
        showDoneButton: false,
        showBackButton: true,
        title: "Create New Metric",
        backButtonTitle: currentCategories[activeCategoryIndex]?.category || "Manage Metrics",
        rightButton: {
          label: "Save",
          onClick: saveMetric,
          isActive: metricForm.name && metricForm.fields.length > 0 && metricForm.cardTemplates.length > 0,
        },
        leftButton: {
          label: "Cancel",
          onClick: () => goToStep(2),
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

  // Sync currentCategories to tempData
  useEffect(() => {
    const categoriesChanged = JSON.stringify(currentCategories) !== JSON.stringify(prevCategoriesRef.current);
    if (categoriesChanged) {
      setTempData({ currentCategories });
      prevCategoriesRef.current = currentCategories;
    }
  }, [currentCategories, setTempData]);

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter" && currentStep === 3) {
        saveMetric();
      } else if (e.key === "Enter" && currentStep === 1 && newCategoryName.trim()) {
        addCategory();
      }
    },
    [saveMetric, addCategory, newCategoryName, currentStep]
  );

  const toggleEditMetric = useCallback(
    (categoryIndex, metricIndex = -1) => {
      setActiveCategoryIndex(categoryIndex);
      setActiveMetricIndex(metricIndex);
      if (metricIndex !== -1 && metricIndex !== null) {
        const metric = currentCategories[categoryIndex].metrics[metricIndex];
        setMetricForm({
          name: metric.name,
          cardTemplates: metric.config?.cardTemplates || [],
          fields: metric.config?.fields || [], // Changed from field
          aggregation: metric.config?.aggregation || "average",
          visualizationType: metric.type || "line",
          dateRange: metric.config?.dateRange || { start: "2023-01-01", end: "2025-04-24" },
          filter: metric.config?.filter || { key: "", value: "" },
          groupBy: metric.config?.groupBy || "",
          includeHistory: metric.config?.includeHistory !== undefined ? metric.config.includeHistory : true,
          granularity: metric.config?.granularity || "monthly",
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
      groupBy: metricForm.groupBy || "cardType",
      visualizationType: metricForm.visualizationType,
      includeHistory: metricForm.includeHistory,
      granularity: metricForm.granularity,
    };

    const data = computeMetricData(cards, config);

    const chartData = {
      labels: data.labels || [],
      datasets: data.datasets || [],
    };

    const options = {
      responsive: true,
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: metricForm.name || "Metric Preview" },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.raw.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: { stacked: metricForm.visualizationType === "bar" },
        y: { stacked: metricForm.visualizationType === "bar" },
      },
    };

    return (
      <div className={styles.chartPreview}>
        {metricForm.visualizationType === "line" && <Line data={chartData} options={options} />}
        {metricForm.visualizationType === "bar" && <Bar data={chartData} options={options} />}
        {metricForm.visualizationType === "pie" && <Pie data={chartData} options={options} />}
        {metricForm.visualizationType === "number" && (
          <div className={styles.numberMetric}>
            <h3>{metricForm.name || "Preview"}</h3>
            <p>{chartData.datasets[0]?.data[chartData.datasets[0].data.length - 1]?.toFixed(2) || 0}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`${styles.metricsModal} ${isDarkTheme ? styles.darkTheme : ""}`}>
      <div className={styles.viewContainer}>
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ""} ${
              step !== currentStep ? styles.hidden : ""
            }`}
            style={{
              display: step !== currentStep ? "none" : "block",
            }}
          >
            {step === 1 && (
              <>
                <div className={`${styles.createHeader} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  <div className={styles.headerRow}>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Create a Metric Category"
                      className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                    />
                    <button
                      onClick={addCategory}
                      className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className={`${styles.headerList} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  {currentCategories.map((category, index) => (
                    <div
                      key={`${category.category}-${index}`}
                      className={`${styles.headerItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => toggleEditMetric(index, -1)}
                    >
                      <div className={styles.headerRow}>
                        <div className={`${styles.headerNameType} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <span>{category.category}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {step === 2 && (
              <div
                className={`${styles.editActions} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => toggleEditMetric(activeCategoryIndex, -1)}
                  className={`${styles.actionButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                >
                  Add Dynamic Metric
                </button>
                <div className={`${styles.headerList} ${isDarkTheme ? styles.darkTheme : ""}`}>
                  {currentCategories[activeCategoryIndex]?.metrics.map((metric, index) => (
                    <div
                      key={`${metric.id}-${index}`}
                      className={`${styles.headerItem} ${isDarkTheme ? styles.darkTheme : ""}`}
                      onClick={() => toggleEditMetric(activeCategoryIndex, index)}
                    >
                      <div className={styles.headerRow}>
                        <div className={`${styles.headerNameType} ${isDarkTheme ? styles.darkTheme : ""}`}>
                          <span>{metric.name}</span>
                          <span className={`${styles.headerType} ${isDarkTheme ? styles.darkTheme : ""}`}>
                            ({metric.type})
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {activeMetricIndex !== -1 && activeMetricIndex !== null && (
                  <div className={styles.editActionsButtons}>
                    <button
                      onClick={() => deleteMetric(activeMetricIndex)}
                      className={`${styles.deleteButton} ${isDarkTheme ? styles.darkTheme : ""}`}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}
            {step === 3 && (
              <div
                className={`${styles.editActions} ${isDarkTheme ? styles.darkTheme : ""}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.formGroup}>
                  <label>Metric Name</label>
                  <input
                    type="text"
                    value={metricForm.name}
                    onChange={(e) => setMetricForm((prev) => ({ ...prev, name: e.target.value }))}
                    onKeyPress={handleKeyPress}
                    placeholder="e.g., Leads per Business"
                    className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Card Templates</label>
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
                <div className={styles.formGroup}>
                  <label>Select Fields</label>
                  <div className={styles.cardList}>
                    {fieldOptions.map((field) => (
                      <div key={field.key} className={styles.cardItem}>
                        <input
                          type="checkbox"
                          checked={metricForm.fields.includes(field.key)}
                          onChange={() => toggleField(field.key)}
                          disabled={metricForm.cardTemplates.length === 0}
                        />
                        <span>{field.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Include Field History</label>
                  <input
                    type="checkbox"
                    checked={metricForm.includeHistory}
                    onChange={(e) => setMetricForm((prev) => ({ ...prev, includeHistory: e.target.checked }))}
                  />
                  <span>{metricForm.includeHistory ? "Include history" : "Use latest value only"}</span>
                </div>
                <div className={styles.formGroup}>
                  <label>Filter (Optional)</label>
                  <div className={styles.filterGroup}>
                    <select
                      value={metricForm.filter.key}
                      onChange={(e) =>
                        setMetricForm((prev) => ({
                          ...prev,
                          filter: { ...prev.filter, key: e.target.value },
                        }))
                      }
                      className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                    >
                      <option value="">Select filter key</option>
                      {filterKeyOptions.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={metricForm.filter.value}
                      onChange={(e) =>
                        setMetricForm((prev) => ({
                          ...prev,
                          filter: { ...prev.filter, value: e.target.value },
                        }))
                      }
                      placeholder="Filter value (e.g., Example Business)"
                      className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                      disabled={!metricForm.filter.key}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Group By (Optional)</label>
                  <select
                    value={metricForm.groupBy}
                    onChange={(e) => setMetricForm((prev) => ({ ...prev, groupBy: e.target.value }))}
                    className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
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
                <div className={styles.formGroup}>
                  <label>Aggregation</label>
                  <select
                    value={metricForm.aggregation}
                    onChange={(e) => setMetricForm((prev) => ({ ...prev, aggregation: e.target.value }))}
                    className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                    disabled={metricForm.visualizationType === "pie"}
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
                <div className={styles.formGroup}>
                  <label>Visualization Type</label>
                  <select
                    value={metricForm.visualizationType}
                    onChange={(e) => setMetricForm((prev) => ({ ...prev, visualizationType: e.target.value }))}
                    className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  >
                    <option value="line">Line Graph</option>
                    <option value="bar">Bar Chart (Stacked)</option>
                    <option value="pie">Pie Chart</option>
                    <option value="number">Number</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Granularity</label>
                  <select
                    value={metricForm.granularity}
                    onChange={(e) => setMetricForm((prev) => ({ ...prev, granularity: e.target.value }))}
                    className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                  >
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Date Range</label>
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
                      className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
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
                      className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                    />
                  </div>
                </div>
                {renderChartPreview()}
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
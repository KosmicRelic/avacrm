import { useContext, useState, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styles from "./MetricsModal.module.css";
import { MainContext } from "../../Contexts/MainContext";
import { ModalNavigatorContext } from "../../Contexts/ModalNavigator";

const MetricsModal = ({ tempData, setTempData, handleClose }) => {
  const { metricsCategories = [], isDarkTheme } = useContext(MainContext);
  const { registerModalSteps, setModalConfig, goToStep, currentStep } = useContext(ModalNavigatorContext);
  const [currentCategories, setCurrentCategories] = useState(() =>
    (tempData.currentCategories || metricsCategories).map((c) => ({ ...c, metrics: [...c.metrics] }))
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newMetricName, setNewMetricName] = useState("");
  const [newMetricType, setNewMetricType] = useState("text");
  const [newMetricValue, setNewMetricValue] = useState("");
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(null);
  const [activeMetricIndex, setActiveMetricIndex] = useState(-1); // Default to -1 for adding
  const hasInitialized = useRef(false);
  const prevCategoriesRef = useRef(currentCategories);
  const prevConfigRef = useRef(null);

  // Validation function for category and metric
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

  const validateMetric = useCallback(
    (name, value, existingMetrics, isUpdate = false, index = null) => {
      const trimmedName = name.trim();
      const trimmedValue = value.trim();
      if (!trimmedName || !trimmedValue) {
        alert("Metric name and value must be non-empty.");
        return false;
      }
      const nameConflict = existingMetrics.some(
        (m, i) => m.name.toLowerCase() === trimmedName.toLowerCase() && (!isUpdate || i !== index)
      );
      if (nameConflict) {
        alert(`A metric with the name "${trimmedName}" already exists in this category.`);
        return false;
      }
      return true;
    },
    []
  );

  // Reset form fields
  const resetForm = useCallback(() => {
    setNewMetricName("");
    setNewMetricType("text");
    setNewMetricValue("");
  }, []);

  // Add new metric to a category
  const addMetric = useCallback(() => {
    if (
      !validateMetric(
        newMetricName,
        newMetricValue,
        currentCategories[activeCategoryIndex]?.metrics || [],
        false
      )
    )
      return;

    const newMetric = {
      id: `metric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newMetricName.trim(),
      type: newMetricType,
      value: newMetricValue.trim(),
    };

    setCurrentCategories((prev) =>
      prev.map((c, i) =>
        i === activeCategoryIndex
          ? { ...c, metrics: [...c.metrics, { ...newMetric }] }
          : { ...c }
      )
    );
    resetForm();
  }, [newMetricName, newMetricValue, newMetricType, activeCategoryIndex, validateMetric, resetForm]);

  // Update existing metric
  const updateMetric = useCallback(
    (metricIndex) => {
      if (
        !validateMetric(
          newMetricName,
          newMetricValue,
          currentCategories[activeCategoryIndex]?.metrics || [],
          true,
          metricIndex
        )
      )
        return;

      const updatedMetric = {
        id: currentCategories[activeCategoryIndex].metrics[metricIndex].id,
        name: newMetricName.trim(),
        type: newMetricType,
        value: newMetricValue.trim(),
      };

      setCurrentCategories((prev) =>
        prev.map((c, i) =>
          i === activeCategoryIndex
            ? {
                ...c,
                metrics: c.metrics.map((m, j) => (j === metricIndex ? { ...updatedMetric } : { ...m })),
              }
            : { ...c }
        )
      );
      resetForm();
    },
    [newMetricName, newMetricValue, newMetricType, activeCategoryIndex, validateMetric, resetForm]
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
      setActiveMetricIndex(-1); // Reset to add mode
      if (currentCategories[activeCategoryIndex].metrics.length === 1) {
        goToStep(1);
      }
    },
    [activeCategoryIndex, goToStep]
  );

  // Save metric (add or update)
  const saveMetric = useCallback(() => {
    if (activeMetricIndex === -1) {
      addMetric();
    } else if (activeMetricIndex !== null) {
      updateMetric(activeMetricIndex);
    }
    setActiveMetricIndex(-1); // Reset to add mode
    goToStep(1);
  }, [activeMetricIndex, addMetric, updateMetric, goToStep]);

  // Add new category
  const addCategory = useCallback(() => {
    if (!validateCategory(newCategoryName, currentCategories)) return;

    const newCategory = {
      category: newCategoryName.trim(),
      metrics: [],
    };
    setCurrentCategories((prev) => [...prev, { ...newCategory }]);
    setNewCategoryName("");
    setActiveCategoryIndex(currentCategories.length);
    setActiveMetricIndex(-1); // Set to add mode for new category
    goToStep(2);
  }, [newCategoryName, currentCategories, validateCategory, goToStep]);

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
              label: "Save",
              onClick: saveMetric,
              isActive: newMetricName.trim() && newMetricValue.trim(),
            },
          },
          {
            title: "Step 3",
            rightButton: null,
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
  }, [registerModalSteps, setModalConfig, activeCategoryIndex, currentCategories, saveMetric, handleClose, setTempData, newMetricName, newMetricValue]);

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
          label: "Save",
          onClick: saveMetric,
          isActive: newMetricName.trim() && newMetricValue.trim(),
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
  }, [currentStep, activeCategoryIndex, setModalConfig, saveMetric, handleClose, setTempData, newMetricName, newMetricValue]);

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
      if (e.key === "Enter" && currentStep === 2) {
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
        setNewMetricName(metric.name);
        setNewMetricType(metric.type);
        setNewMetricValue(metric.value);
      } else {
        resetForm();
      }
      goToStep(2);
    },
    [currentCategories, resetForm, goToStep]
  );

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
                <div
                  className={`${styles.createHeader} ${isDarkTheme ? styles.darkTheme : ""}`}
                >
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
                      onClick={() => toggleEditMetric(index)}
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
                <input
                  type="text"
                  value={newMetricName}
                  onChange={(e) => setNewMetricName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Metric Name"
                  className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                />
                <select
                  value={newMetricType}
                  onChange={(e) => setNewMetricType(e.target.value)}
                  className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ""}`}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="currency">Currency</option>
                  <option value="percentage">Percentage</option>
                  <option value="multiplier">Multiplier</option>
                </select>
                <input
                  type="text"
                  value={newMetricValue}
                  onChange={(e) => setNewMetricValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Metric Value"
                  className={`${styles.inputField} ${isDarkTheme ? styles.darkTheme : ""}`}
                />
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
              <div className={`${styles.editActions} ${isDarkTheme ? styles.darkTheme : ""}`}>
                <p>Step 3: To be implemented</p>
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
            value: PropTypes.string.isRequired,
          })
        ),
      })
    ),
  }).isRequired,
  setTempData: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default MetricsModal;
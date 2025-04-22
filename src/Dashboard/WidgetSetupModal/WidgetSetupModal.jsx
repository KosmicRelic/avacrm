import React, { useContext, useState, useEffect, useRef } from 'react';
import styles from './WidgetSetupModal.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { ModalNavigatorContext } from '../../Contexts/ModalNavigator';

const WidgetSetupModal = ({ tempData, setTempData, setActiveModalData, handleClose }) => {
  const { metricsCategories, isDarkTheme } = useContext(MainContext);
  const { setModalConfig } = useContext(ModalNavigatorContext);
  const [selectedCategory, setSelectedCategory] = useState(tempData.category || '');
  const [selectedMetric, setSelectedMetric] = useState(tempData.metric || '');
  const prevSelectionsRef = useRef({ category: tempData.category, metric: tempData.metric });

  useEffect(() => {
    const canCloseNow = selectedCategory !== "" && selectedMetric !== "";
  
    setModalConfig({
      showTitle: true,
      showDoneButton: true,
      title: "Setup Widget",
      allowClose: canCloseNow,
      rightButton: {
        label: "Done",
        onClick: () => {
          if (!selectedCategory || !selectedMetric) {
            alert('Please select both a category and a metric to proceed.');
            return;
          }
          handleClose({ fromSave: true });
        },
        isActive: true,
        isRemove: false,
      },
    });
  
    return () => {
      setModalConfig({});
    };
  }, [selectedCategory, selectedMetric, setModalConfig]);

  // Widget data update effect
  useEffect(() => {
    const currentSelections = { category: selectedCategory, metric: selectedMetric };
    if (
      currentSelections.category === prevSelectionsRef.current.category &&
      currentSelections.metric === prevSelectionsRef.current.metric
    ) {
      return;
    }

    if (!selectedCategory || !selectedMetric) {
      prevSelectionsRef.current = currentSelections;
      setTempData((prev) => ({
        ...prev,
        updatedWidget: null,
        canClose: false,
      }));
      setActiveModalData((prev) => ({
        ...prev,
        updatedWidget: null,
        canClose: false,
      }));
      return;
    }

    const categoryData = metricsCategories.find((cat) => cat.category === selectedCategory);
    const metricData = categoryData?.metrics.find((m) => m.id === selectedMetric);

    if (!metricData) {
      prevSelectionsRef.current = currentSelections;
      setTempData((prev) => ({
        ...prev,
        updatedWidget: null,
        canClose: false,
      }));
      setActiveModalData((prev) => ({
        ...prev,
        updatedWidget: null,
        canClose: false,
      }));
      return;
    }

    const updatedWidget = {
      ...tempData.widget,
      category: selectedCategory,
      title: selectedCategory,
      metrics: [{ id: metricData.id, name: metricData.name, value: metricData.value }],
    };

    const newTempData = {
      ...tempData,
      updatedWidget,
      dashboardId: tempData.dashboardId,
      canClose: true,
    };
    setTempData(newTempData);
    setActiveModalData(newTempData);

    prevSelectionsRef.current = currentSelections;
  }, [selectedCategory, selectedMetric, metricsCategories, setTempData, setActiveModalData, tempData]);

  const metrics = selectedCategory
    ? metricsCategories.find((cat) => cat.category === selectedCategory)?.metrics || []
    : [];

  return (
    <div className={`${styles.modalContent} ${isDarkTheme ? styles.darkTheme : ''}`}>
      <div className={styles.formContainer}>
        <div className={`${styles.formGroup} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedMetric('');
            }}
            className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ''}`}
          >
            <option value="">Select a category</option>
            {metricsCategories.map((cat) => (
              <option key={cat.category} value={cat.category}>
                {cat.category}
              </option>
            ))}
          </select>
        </div>
        <div className={`${styles.formGroup} ${isDarkTheme ? styles.darkTheme : ''}`}>
          <label htmlFor="metric">Metric</label>
          <select
            id="metric"
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            disabled={!selectedCategory}
            className={`${styles.selectField} ${isDarkTheme ? styles.darkTheme : ''}`}
          >
            <option value="">Select a metric</option>
            {metrics.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default WidgetSetupModal;
import React, { useContext, useState, useEffect, useRef } from 'react';
import styles from './WidgetSetupModal.module.css';
import { MainContext } from '../../Contexts/MainContext';

const WidgetSetupModal = ({ tempData, setTempData, setActiveModalData, handleClose }) => {
  const { metricsCategories, isDarkTheme } = useContext(MainContext);
  const [selectedCategory, setSelectedCategory] = useState(tempData.category || '');
  const [selectedMetric, setSelectedMetric] = useState(tempData.metric || '');
  const prevSelectionsRef = useRef({ category: tempData.category, metric: tempData.metric });

  useEffect(() => {
    console.log('WidgetSetupModal opened with widget ID:', tempData.widget?.id, 'dashboardId:', tempData.dashboardId);
    console.log('metricsCategories:', metricsCategories);
  }, [tempData.widget?.id, tempData.dashboardId, metricsCategories]);

  useEffect(() => {
    const currentSelections = { category: selectedCategory, metric: selectedMetric };
    if (
      currentSelections.category === prevSelectionsRef.current.category &&
      currentSelections.metric === prevSelectionsRef.current.metric
    ) {
      return;
    }

    if (!selectedCategory || !selectedMetric) {
      console.log('Incomplete selections:', currentSelections);
      prevSelectionsRef.current = currentSelections;
      return;
    }

    const categoryData = metricsCategories.find((cat) => cat.category === selectedCategory);
    const metricData = categoryData?.metrics.find((m) => m.id === selectedMetric);

    if (!metricData) {
      console.log('Invalid metric selected:', selectedMetric);
      prevSelectionsRef.current = currentSelections;
      return;
    }

    const updatedWidget = {
      ...tempData.widget,
      category: selectedCategory,
      title: selectedCategory,
      metrics: [{ id: metricData.id, name: metricData.name, value: metricData.value }],
    };

    console.log('Updating tempData with updatedWidget:', updatedWidget);
    const newTempData = {
      ...tempData,
      updatedWidget,
      dashboardId: tempData.dashboardId,
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
      <h2>Setup Widget</h2>
      <div className={styles.formGroup}>
        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setSelectedMetric('');
          }}
        >
          <option value="">Select a category</option>
          {metricsCategories.map((cat) => (
            <option key={cat.category} value={cat.category}>
              {cat.category}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="metric">Metric</label>
        <select
          id="metric"
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value)}
          disabled={!selectedCategory}
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
  );
};

export default WidgetSetupModal;
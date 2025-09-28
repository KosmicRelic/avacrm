import { useContext, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './MetricsContent.module.css';
import { MainContext } from '../../Contexts/MainContext';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import CustomMetricChart from '../CustomMetricChart/CustomMetricChart';

const MetricsLineChartControls = ({ granularity, setGranularity, currentMonth, setCurrentMonth, currentYear, setCurrentYear, _isDarkTheme }) => {
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

const MetricsContent = ({ selectedCategory, selectedMetric, previousTitle, onClose }) => {
  const { isDarkTheme } = useContext(MainContext);
  const [currentStep, setCurrentStep] = useState(1);
  const [localSelectedMetric, setLocalSelectedMetric] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [granularity, setGranularity] = useState('month');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const containerRef = useRef(null);

  useEffect(() => {
    if (selectedMetric) {
      setCurrentStep(2);
      setLocalSelectedMetric(selectedMetric);
      setIsClosing(false);
    } else if (selectedCategory) {
      setCurrentStep(1);
      setLocalSelectedMetric(null);
      setIsClosing(false);
    } else {
      setCurrentStep(1);
      setLocalSelectedMetric(null);
      setIsClosing(true);
    }
  }, [selectedMetric, selectedCategory]);

  const handleMetricClick = (metric) => {
    setLocalSelectedMetric(metric);
    setCurrentStep(2);
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setLocalSelectedMetric(null);
    } else {
      setIsClosing(true);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleAnimationEnd = (event) => {
      if (isClosing && event.animationName.includes('slideOut')) {
        onClose();
      }
    };

    container.addEventListener('animationend', handleAnimationEnd);
    return () => container.removeEventListener('animationend', handleAnimationEnd);
  }, [isClosing, onClose]);

  return (
    <div
      ref={containerRef}
      className={`${styles.viewContainer} ${isDarkTheme ? styles.darkTheme : ''} ${
        selectedCategory && !isClosing ? styles.slideIn : styles.slideOut
      }`}
    >
      {[1, 2].map((step) => (
        <div
          key={step}
          className={`${styles.view} ${isDarkTheme ? styles.darkTheme : ''} ${
            step !== currentStep ? styles.hidden : ''
          }`}
        >
          {step === 1 && (
            <>
              {selectedCategory && (
                <button
                  className={`${styles.topBackButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                  onClick={handleBack}
                >
                  <FaChevronLeft /> {previousTitle || 'Categories'}
                </button>
              )}
              <div className={`${styles.metricList} ${isDarkTheme ? styles.darkTheme : ''}`}>
                {selectedCategory ? (
                  <>
                    {selectedCategory.metrics.length > 0 ? (
                      selectedCategory.metrics.map((metric, index) => (
                        <div
                          key={`${metric.id}-${index}`}
                          className={`${styles.metricItem} ${isDarkTheme ? styles.darkTheme : ''}`}
                          onClick={() => handleMetricClick(metric)}
                        >
                          <div className={styles.metricNameType}>
                            <span>{metric.name}</span>
                            <span className={styles.metricType}>({metric.type})</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className={`${styles.noMetrics} ${isDarkTheme ? styles.darkTheme : ''}`}>
                        No metrics in this category
                      </p>
                    )}
                  </>
                ) : (
                  <p className={`${styles.noMetrics} ${isDarkTheme ? styles.darkTheme : ''}`}>
                    Select a category to view metrics
                  </p>
                )}
              </div>
            </>
          )}
          {step === 2 && localSelectedMetric && (
            <div className={`${styles.metricDetailsContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
              <button
                className={`${styles.topBackButton} ${isDarkTheme ? styles.darkTheme : ''}`}
                onClick={handleBack}
              >
                <FaChevronLeft /> {localSelectedMetric.name || 'Metric'}
              </button>
              {localSelectedMetric.type === 'line' && (
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
              <div className={styles.metricChartWidgetWrapper}>
                <CustomMetricChart
                  visualizationType={localSelectedMetric.type === 'speedometer' ? 'number' : localSelectedMetric.type}
                  records={(() => {
                    if (localSelectedMetric.type === 'line') {
                      // Filter records by selected month/year or year
                      const records = localSelectedMetric.records || [];
                      const templateKey = localSelectedMetric.config?.recordTemplates?.[0] || '';
                      const selectedHeaderKey = localSelectedMetric.config?.fields?.[templateKey]?.[0] || '';
                      if (granularity === 'month') {
                        return records.filter(record => {
                          const ts = record[`${selectedHeaderKey}_timestamp`];
                          if (!ts || !(ts.seconds || ts._seconds)) return false;
                          const d = new Date((ts.seconds || ts._seconds) * 1000);
                          return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
                        });
                      } else if (granularity === 'year') {
                        return records.filter(record => {
                          const ts = record[`${selectedHeaderKey}_timestamp`];
                          if (!ts || !(ts.seconds || ts._seconds)) return false;
                          const d = new Date((ts.seconds || ts._seconds) * 1000);
                          return d.getFullYear() === currentYear;
                        });
                      }
                      return records;
                    }
                    return localSelectedMetric.records || [];
                  })()}
                  templateKey={localSelectedMetric.config?.recordTemplates?.[0] || ''}
                  selectedHeaderKey={localSelectedMetric.config?.fields?.[localSelectedMetric.config?.recordTemplates?.[0]]?.[0] || ''}
                  header={null}
                  isDarkTheme={isDarkTheme}
                  aggregation={localSelectedMetric.config?.aggregation || 'average'}
                  granularity={localSelectedMetric.type === 'line' ? (granularity === 'month' ? 'daily' : 'monthly') : 'none'}
                  size="large"
                />
                {/* Data/legend at the bottom for /metrics */}
                {localSelectedMetric.type === 'pie' && localSelectedMetric.records && localSelectedMetric.records.length > 0 && (
                  <div className={styles.metricsLegendBottom}>
                    <h4 className={styles.metricsLegendTitle}>Data</h4>
                    <ul className={styles.metricsLegendList}>
                      {(() => {
                        // Get chart data for legend
                        const chartData = localSelectedMetric.records.reduce((acc, rec) => {
                          const val = rec[localSelectedMetric.config?.fields?.[localSelectedMetric.config?.recordTemplates?.[0]]?.[0]];
                          if (val !== undefined && val !== null) {
                            acc[val] = (acc[val] || 0) + 1;
                          }
                          return acc;
                        }, {});
                        return Object.entries(chartData).map(([label, value], idx) => (
                          <li key={label} className={styles.metricsLegendItem}>
                            <span className={styles.metricsLegendColor} style={{ background: ['#007AFF','#339AFF','#66B7FF','#99D3FF'][idx%4] }} />
                            <span className={styles.metricsLegendLabel}>{label.length > 12 ? label.slice(0,12)+'...' : label}</span>
                            <span className={styles.metricsLegendValue}>{value}</span>
                          </li>
                        ));
                      })()}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

MetricsContent.propTypes = {
  selectedCategory: PropTypes.shape({
    category: PropTypes.string.isRequired,
    metrics: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired,
        value: PropTypes.string,
        data: PropTypes.object,
      })
    ).isRequired,
  }),
  selectedMetric: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    value: PropTypes.string,
    data: PropTypes.object,
  }),
  previousTitle: PropTypes.string,
  onClose: PropTypes.func,
};

export default MetricsContent;
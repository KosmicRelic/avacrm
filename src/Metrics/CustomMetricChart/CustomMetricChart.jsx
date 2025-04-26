import React, { Component, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Line, Pie, Bar } from 'react-chartjs-2';
import GaugeComponent from 'react-gauge-component';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
  Title,
} from 'chart.js';
import styles from './CustomMetricChart.module.css';
import dashboardStyles from '../../Dashboard/Dashboard Plane/DashboardPlane'; // Adjust path if needed
import { debounce } from 'lodash';
import { computeCorrelation } from '../../Metrics/metricsUtils';

// Register Chart.js components
ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
  Title
);

// Error Boundary Component
class ChartErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <p className={styles.errorMessage}>Error rendering chart</p>;
    }
    return this.props.children;
  }
}

const CustomMetricChart = ({ metric, isDarkTheme, chartType }) => {
  const appleBlue = '#007AFF';
  const backgroundColor = isDarkTheme ? '#1C2526' : '#FFFFFF';
  const textColor = isDarkTheme ? '#FFFFFF' : '#000000';
  const chartContainerRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Debounce resize handler
  const debouncedResize = debounce(() => {
    if (chartContainerRef.current) {
      chartContainerRef.current.style.width = '100%';
      chartContainerRef.current.style.height = '100%';
    }
  }, 100);

  useEffect(() => {
    if (chartContainerRef.current) {
      resizeObserverRef.current = new ResizeObserver(debouncedResize);
      resizeObserverRef.current.observe(chartContainerRef.current);
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      debouncedResize.cancel();
    };
  }, []);

  const getDefaultMetric = (type) => {
    switch (type) {
      case 'line':
        return {
          id: 'example-line',
          name: 'Example Sales',
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [
              {
                label: 'Example Sales',
                data: [12000, 19000, 15000, 22000, 18000, 25000],
                borderColor: appleBlue,
                backgroundColor: `${appleBlue}33`,
                fill: true,
                tension: 0.4,
              },
            ],
          },
        };
      case 'pie':
        return {
          id: 'example-pie',
          name: 'Example Revenue',
          type: 'pie',
          data: {
            labels: ['Product A', 'Product B', 'Product C', 'Product D'],
            datasets: [
              {
                label: 'Example Revenue',
                data: [30000, 20000, 15000, 10000],
                backgroundColor: [appleBlue, `${appleBlue}CC`, `${appleBlue}99`, `${appleBlue}66`],
                borderColor: backgroundColor,
                borderWidth: 1,
              },
            ],
          },
        };
      case 'speedometer':
        return {
          id: 'example-speedometer',
          name: 'Example Close Rate',
          type: 'speedometer',
          data: { value: 75 },
        };
      case 'bar':
        return {
          id: 'example-bar',
          name: 'Example Growth',
          type: 'bar',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr'],
            datasets: [
              {
                label: 'Example Growth',
                data: [50, 75, 60, 90],
                backgroundColor: appleBlue,
                borderColor: appleBlue,
                borderWidth: 1,
              },
            ],
          },
        };
      case 'scatter':
        return {
          id: 'example-scatter',
          name: 'Example Comparison',
          type: 'scatter',
          data: {
            labels: [],
            datasets: [
              {
                label: 'Field1 vs Field2',
                data: [{ x: 10, y: 20 }, { x: 15, y: 25 }, { x: 20, y: 30 }],
                borderColor: appleBlue,
                backgroundColor: `${appleBlue}66`,
                pointRadius: 5,
                showLine: true,
              },
            ],
          },
          config: { comparisonFields: ['Field1', 'Field2'] },
        };
      default:
        return {
          id: 'example-fallback',
          name: 'Example Fallback',
          type: 'speedometer',
          data: { value: 50 },
        };
    }
  };

  // Generate fading colors for pie charts
  const getPieColors = (baseColor, numSegments) => {
    const opacities = ['FF', 'CC', '99', '66'];
    return Array.from({ length: numSegments }, (_, i) => `${baseColor}${opacities[i % opacities.length]}`);
  };

  // Normalize metric data to Chart.js format
  const normalizeMetricData = (metric) => {
    if (!metric || !metric.id || !metric.name || !metric.type || !metric.data) {
      return getDefaultMetric(chartType || 'speedometer');
    }

    const { data, type, name, config = {} } = metric;
    const { comparisonFields = [] } = config;

    if (type === 'speedometer') {
      return metric;
    }

    // Format labels as three-letter month abbreviations
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
    const formattedLabels = (data.labels || []).map((label) => {
      try {
        const date = new Date(label);
        return monthFormatter.format(date);
      } catch {
        return label.slice(0, 3); // Fallback for invalid labels
      }
    });

    // Ensure unique labels and aggregate data
    const uniqueLabels = [];
    const labelSet = new Set();
    formattedLabels.forEach((label) => {
      if (!labelSet.has(label)) {
        labelSet.add(label);
        uniqueLabels.push(label);
      }
    });

    const datasets = (data.datasets || (data.values ? [{ data: data.values, label: name }] : [])).map(
      (dataset, i) => {
        // Aggregate data by label
        const aggregatedData = [];
        const dataMap = new Map();

        dataset.data.forEach((value, index) => {
          if (type === 'scatter') {
            aggregatedData.push(value); // Scatter data is already in {x, y} format
            return;
          }
          const label = formattedLabels[index];
          if (dataMap.has(label)) {
            const existing = dataMap.get(label);
            dataMap.set(label, existing + (value || 0));
          } else {
            dataMap.set(label, value || 0);
          }
        });

        if (type !== 'scatter') {
          uniqueLabels.forEach((label) => {
            aggregatedData.push(dataMap.get(label) || 0);
          });
        }

        const baseColor = i === 0 ? appleBlue : '#FF2D55'; // Blue for first line, red for second
        return {
          ...dataset,
          label: dataset.label || (comparisonFields[i] || name),
          data: type === 'scatter' ? dataset.data : aggregatedData,
          borderColor: baseColor,
          backgroundColor:
            type === 'bar'
              ? baseColor
              : type === 'pie'
              ? getPieColors(baseColor, uniqueLabels.length)
              : type === 'scatter'
              ? `${baseColor}66`
              : `${baseColor}33`,
          fill: dataset.fill !== undefined ? dataset.fill : type === 'line' && !comparisonFields.length,
          borderWidth: dataset.borderWidth || (type === 'pie' ? 1 : undefined),
          stack: dataset.stack || (type === 'bar' ? 'stack' : undefined),
          tension: type === 'line' || type === 'scatter' ? 0.4 : undefined,
          pointRadius: type === 'scatter' ? 5 : undefined,
          showLine: type === 'scatter' ? true : undefined,
        };
      }
    );

    return {
      ...metric,
      data: {
        labels: type === 'scatter' ? [] : uniqueLabels,
        datasets,
      },
    };
  };

  const effectiveMetric = normalizeMetricData(metric);

  // Compute correlation for two-line chart
  let correlation = null;
  if (
    effectiveMetric.config?.comparisonFields?.length === 2 &&
    effectiveMetric.data.datasets.length === 2 &&
    effectiveMetric.type !== 'scatter'
  ) {
    const data1 = effectiveMetric.data.datasets[0].data;
    const data2 = effectiveMetric.data.datasets[1].data;
    correlation = computeCorrelation(data1, data2);
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: effectiveMetric.type === 'pie' ? 'bottom' : 'top',
        labels: { color: textColor, font: { family: '-apple-system', size: 14 } },
      },
      tooltip: {
        backgroundColor: isDarkTheme ? '#333' : '#FFF',
        titleColor: textColor,
        bodyColor: textColor,
        callbacks: {
          label: (context) => {
            if (effectiveMetric.type === 'scatter') {
              return `(${context.raw.x.toFixed(2)}, ${context.raw.y.toFixed(2)})`;
            }
            return `${context.dataset.label}: ${context.raw.toFixed(2)}`;
          },
        },
      },
      title: {
        display: false,
        text: effectiveMetric.name || 'Chart',
        font: { family: '-apple-system', size: 16 },
        color: textColor,
      },
    },
    scales: effectiveMetric.type === 'scatter' ? {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: effectiveMetric.config?.comparisonFields[0] || 'X',
          color: textColor,
        },
        ticks: { color: textColor },
        grid: { color: isDarkTheme ? '#444' : '#DDD' },
      },
      y: {
        title: {
          display: true,
          text: effectiveMetric.config?.comparisonFields[1] || 'Y',
          color: textColor,
        },
        ticks: { color: textColor },
        grid: { color: isDarkTheme ? '#444' : '#DDD' },
      },
    } : {
      x: {
        stacked: effectiveMetric.type === 'bar',
        ticks: { color: textColor, font: { family: '-apple-system' } },
        grid: { color: isDarkTheme ? '#444' : '#DDD' },
      },
      y: {
        stacked: effectiveMetric.type === 'bar',
        ticks: { color: textColor, font: { family: '-apple-system' } },
        grid: { color: isDarkTheme ? '#444' : '#DDD' },
      },
    },
  };

  return (
    <ChartErrorBoundary>
      <div
        ref={chartContainerRef}
        className={`${styles.chartContainer} ${isDarkTheme ? styles.darkTheme : ''}`}
        style={{ contain: 'layout' }}
      >
        {(() => {
          switch (effectiveMetric.type) {
            case 'line':
            case 'scatter':
              return <Line data={effectiveMetric.data} options={chartOptions} />;
            case 'pie':
              return <Pie data={effectiveMetric.data} options={chartOptions} />;
            case 'speedometer':
              return (
                <div className={dashboardStyles.speedometerWrapper}>
                  <GaugeComponent
                    id={`gauge-${effectiveMetric.id}`}
                    value={effectiveMetric.data.value}
                    type="semicircle"
                    arc={{
                      colorArray: [`${appleBlue}33`, appleBlue],
                      padding: 0.01,
                      width: 0.2,
                    }}
                    pointer={{
                      color: isDarkTheme ? '#666' : '#999',
                      length: 0.7,
                      width: 8,
                      elastic: true,
                    }}
                    labels={{
                      valueLabel: {
                        style: { fontSize: '12px', fill: textColor },
                        formatTextValue: (value) => `${value}%`,
                      },
                      tickLabels: {
                        defaultTickValueConfig: {
                          style: { fontSize: '6px', fill: textColor },
                        },
                      },
                    }}
                    style={{ width: '100%', height: '100%' }}
                    minValue={0}
                    maxValue={100}
                  />
                </div>
              );
            case 'bar':
              return <Bar data={effectiveMetric.data} options={chartOptions} />;
            default:
              return <p className={styles.errorMessage}>Unsupported chart type: {effectiveMetric.type}</p>;
          }
        })()}
        {correlation !== null && (
          <div className={styles.correlation}>
            <p>Correlation: {correlation.toFixed(2)}</p>
          </div>
        )}
      </div>
    </ChartErrorBoundary>
  );
};

CustomMetricChart.propTypes = {
  metric: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    type: PropTypes.oneOf(['line', 'pie', 'speedometer', 'bar', 'scatter']),
    data: PropTypes.oneOfType([
      PropTypes.shape({
        labels: PropTypes.arrayOf(PropTypes.string),
        values: PropTypes.arrayOf(PropTypes.number),
      }),
      PropTypes.shape({
        labels: PropTypes.arrayOf(PropTypes.string),
        datasets: PropTypes.arrayOf(
          PropTypes.shape({
            label: PropTypes.string,
            data: PropTypes.oneOfType([
              PropTypes.arrayOf(PropTypes.number),
              PropTypes.arrayOf(
                PropTypes.shape({
                  x: PropTypes.number,
                  y: PropTypes.number,
                })
              ),
            ]),
            borderColor: PropTypes.string,
            backgroundColor: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
            fill: PropTypes.bool,
            borderWidth: PropTypes.number,
            stack: PropTypes.string,
            pointRadius: PropTypes.number,
            showLine: PropTypes.bool,
          })
        ),
      }),
      PropTypes.shape({
        value: PropTypes.number,
      }),
    ]),
    config: PropTypes.shape({
      comparisonFields: PropTypes.arrayOf(PropTypes.string),
    }),
  }),
  isDarkTheme: PropTypes.bool.isRequired,
  chartType: PropTypes.oneOf(['line', 'pie', 'speedometer', 'bar', 'scatter']),
};

CustomMetricChart.defaultProps = {
  metric: null,
  chartType: 'speedometer',
};

export default CustomMetricChart;
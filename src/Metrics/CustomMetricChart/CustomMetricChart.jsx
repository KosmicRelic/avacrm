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
} from 'chart.js';
import styles from './CustomMetricChart.module.css';
import dashboardStyles from '../../Dashboard/Dashboard Plane/DashboardPlane'; // Adjust path if needed
import { debounce } from 'lodash';

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
  Filler
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
                tension: 0.4, // Smooth lines
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

    const { data, type, name } = metric;

    if (type === 'speedometer') {
      return metric;
    }

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

    // Ensure unique labels and aggregate data by month
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
        // Aggregate data by month
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

        const baseColor = appleBlue; // Use Apple's blue
        return {
          ...dataset,
          label: dataset.label || name,
          data: aggregatedData,
          borderColor: baseColor,
          backgroundColor:
            type === 'bar'
              ? baseColor // Solid color for bars
              : type === 'pie'
              ? getPieColors(baseColor, uniqueLabels.length) // Fading colors for pie
              : `${baseColor}33`, // Transparent for line
          fill: dataset.fill !== undefined ? dataset.fill : type === 'line',
          borderWidth: dataset.borderWidth || (type === 'pie' ? 1 : undefined),
          stack: dataset.stack || (type === 'bar' ? 'stack' : undefined),
          tension: type === 'line' ? 0.4 : undefined, // Smooth lines for line charts
        };
      }
    );

    return {
      ...metric,
      data: {
        labels: uniqueLabels,
        datasets,
      },
    };
  };

  const effectiveMetric = normalizeMetricData(metric);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: textColor },
      },
      tooltip: {
        backgroundColor: isDarkTheme ? '#333' : '#FFF',
        titleColor: textColor,
        bodyColor: textColor,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.raw.toFixed(2)}`,
        },
      },
    },
    scales: {
      x: {
        stacked: effectiveMetric.type === 'bar',
        ticks: { color: textColor },
        grid: { color: isDarkTheme ? '#444' : '#DDD' },
      },
      y: {
        stacked: effectiveMetric.type === 'bar',
        ticks: { color: textColor },
        grid: { color: isDarkTheme ? '#444' : '#DDD' },
      },
    },
  };

  return (
    <ChartErrorBoundary>
      <div
        ref={chartContainerRef}
        className={styles.chartContainer}
        style={{ contain: 'layout' }}
      >
        {(() => {
          switch (effectiveMetric.type) {
            case 'line':
              return (
                <Line
                  data={effectiveMetric.data}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      legend: { position: 'top', labels: { color: textColor } },
                    },
                  }}
                />
              );
            case 'pie':
              return (
                <Pie
                  data={effectiveMetric.data}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      legend: { position: 'bottom', labels: { color: textColor } },
                    },
                  }}
                />
              );
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
              return (
                <Bar
                  data={effectiveMetric.data}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      legend: { position: 'top', labels: { color: textColor } },
                    },
                  }}
                />
              );
            default:
              return <p className={styles.errorMessage}>Unsupported chart type: {effectiveMetric.type}</p>;
          }
        })()}
      </div>
    </ChartErrorBoundary>
  );
};

CustomMetricChart.propTypes = {
  metric: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    type: PropTypes.oneOf(['line', 'pie', 'speedometer', 'bar']),
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
            data: PropTypes.arrayOf(PropTypes.number),
            borderColor: PropTypes.string,
            backgroundColor: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
            fill: PropTypes.bool,
            borderWidth: PropTypes.number,
            stack: PropTypes.string,
          })
        ),
      }),
      PropTypes.shape({
        value: PropTypes.number,
      }),
    ]),
  }),
  isDarkTheme: PropTypes.bool.isRequired,
  chartType: PropTypes.oneOf(['line', 'pie', 'speedometer', 'bar']),
};

CustomMetricChart.defaultProps = {
  metric: null,
  chartType: 'speedometer',
};

export default CustomMetricChart;
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
  Filler, // Add Filler plugin import
} from 'chart.js';
import styles from './MetricChart.module.css';
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

const MetricChart = ({ metric, isDarkTheme, chartType }) => {
  const appleBlue = '#007AFF';
  const backgroundColor = isDarkTheme ? '#1C2526' : '#FFFFFF';
  const textColor = isDarkTheme ? '#FFFFFF' : '#000000';
  const chartContainerRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Debounce resize handler to prevent rapid resize events
  const debouncedResize = debounce(() => {
    if (chartContainerRef.current) {
      // Force a layout recalculation only when necessary
      chartContainerRef.current.style.width = '100%';
      chartContainerRef.current.style.height = '100%';
    }
  }, 100);

  useEffect(() => {
    // Set up ResizeObserver with debouncing
    if (chartContainerRef.current) {
      resizeObserverRef.current = new ResizeObserver(debouncedResize);
      resizeObserverRef.current.observe(chartContainerRef.current);
    }

    // Cleanup on unmount
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
            values: [12000, 19000, 15000, 22000, 18000, 25000],
          },
        };
      case 'pie':
        return {
          id: 'example-pie',
          name: 'Example Revenue',
          type: 'pie',
          data: {
            labels: ['Product A', 'Product B', 'Product C', 'Product D'],
            values: [30000, 20000, 15000, 10000],
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
            labels: ['Q1', 'Q2', 'Q3', 'Q4'],
            values: [50, 75, 60, 90],
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

  const effectiveMetric =
    metric && metric.id && metric.name && metric.type && metric.data
      ? metric
      : getDefaultMetric(chartType || 'speedometer');

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
      },
    },
    scales: {
      x: { ticks: { color: textColor }, grid: { color: isDarkTheme ? '#444' : '#DDD' } },
      y: { ticks: { color: textColor }, grid: { color: isDarkTheme ? '#444' : '#DDD' } },
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
                  data={{
                    labels: effectiveMetric.data.labels,
                    datasets: [
                      {
                        label: effectiveMetric.name,
                        data: effectiveMetric.data.values,
                        borderColor: appleBlue,
                        backgroundColor: `${appleBlue}33`,
                        fill: true,
                        tension: 0.4,
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              );
            case 'pie':
              return (
                <Pie
                  data={{
                    labels: effectiveMetric.data.labels,
                    datasets: [
                      {
                        data: effectiveMetric.data.values,
                        backgroundColor: [appleBlue, `${appleBlue}CC`, `${appleBlue}99`, `${appleBlue}66`],
                        borderColor: backgroundColor,
                        borderWidth: 1,
                      },
                    ],
                  }}
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
                  data={{
                    labels: effectiveMetric.data.labels,
                    datasets: [
                      {
                        label: effectiveMetric.name,
                        data: effectiveMetric.data.values,
                        backgroundColor: appleBlue,
                        borderColor: appleBlue,
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={chartOptions}
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

MetricChart.propTypes = {
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
        value: PropTypes.number,
      }),
    ]),
  }),
  isDarkTheme: PropTypes.bool.isRequired,
  chartType: PropTypes.oneOf(['line', 'pie', 'speedometer', 'bar']),
};

MetricChart.defaultProps = {
  metric: null,
  chartType: 'speedometer',
};

export default MetricChart;
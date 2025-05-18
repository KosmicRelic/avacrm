import React, { useRef, useEffect, Component } from 'react';
import PropTypes from 'prop-types';
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
import { debounce } from 'lodash';
import styles from './CustomMetricChart.module.css';

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

// Error Boundary Component
class ChartErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ChartErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <p className={styles.errorMessage}>Error rendering chart</p>;
    }
    return this.props.children;
  }
}

const CustomMetricChart = ({
  visualizationType,
  cards,
  templateKey,
  selectedHeaderKey,
  header,
  isDarkTheme,
  aggregation,
  granularity,
}) => {
  const appleBlue = '#007AFF';
  const backgroundColor = isDarkTheme ? '#222' : '#f7f7f7';
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

  // Set up ResizeObserver
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

  // Helper function to get latest field value and timestamp
  const getLatestFieldValueAndTimestamp = (card, fieldKey, dateHeaderKey) => {
    let value = card[fieldKey];
    let timestamp = null;
    if (value === undefined && Array.isArray(card.history)) {
      const entries = card.history.filter(h => h.field === fieldKey && h.timestamp);
      if (entries.length > 0) {
        const latest = entries.reduce((a, b) => (a.timestamp.seconds > b.timestamp.seconds ? a : b));
        value = latest.value;
        timestamp = latest.timestamp;
      }
    } else if (value !== undefined) {
      if (Array.isArray(card.history)) {
        const entries = card.history.filter(h => h.field === fieldKey && h.timestamp);
        if (entries.length > 0) {
          const latest = entries.reduce((a, b) => (a.timestamp.seconds > b.timestamp.seconds ? a : b));
          timestamp = latest.timestamp;
        }
      }
      if (!timestamp && dateHeaderKey && card[dateHeaderKey]) {
        timestamp = card[dateHeaderKey];
      }
    }
    if (!timestamp) timestamp = card.id || card.docId;
    return { value, timestamp };
  };

  // Helper function to format timestamp
  const formatTimestamp = (ts) => {
    if (!ts) return '';
    if (typeof ts === 'string' || typeof ts === 'number') return String(ts);
    if (ts.seconds) {
      const d = new Date(ts.seconds * 1000);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    if (ts._seconds) {
      const d = new Date(ts._seconds * 1000);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    return String(ts);
  };

  // Generate categorical chart data (for pie and bar charts)
  const generateCategoricalChartData = (cardsForTemplate, selectedHeaderKey, header) => {
    const valueCounts = {};
    cardsForTemplate.forEach(card => {
      const { value } = getLatestFieldValueAndTimestamp(card, selectedHeaderKey, null);
      if (value !== undefined && value !== null) {
        const stringValue = String(value).trim();
        valueCounts[stringValue] = (valueCounts[stringValue] || 0) + 1;
      }
    });
    const labels = Object.keys(valueCounts);
    const dataValues = Object.values(valueCounts);
    const backgroundColors = labels.map((_, idx) => [
      '#007AFF',
      '#339AFF',
      '#66B7FF',
      '#99D3FF',
    ][idx % 4]); // Use blue shades
    return {
      labels,
      datasets: [
        {
          label: header?.name || selectedHeaderKey,
          data: dataValues,
          backgroundColor: backgroundColors,
          borderColor: isDarkTheme ? '#333' : '#fff',
          borderWidth: 1,
        },
      ],
    };
  };

  // Generate chart data based on visualization type
  const generateChartData = () => {
    if (!cards || !templateKey || !selectedHeaderKey) return null;

    const cardsForTemplate = cards.filter(card => card.typeOfCards === templateKey);
    if (!cardsForTemplate.length) return null;

    const dateHeader = header?.type === 'date' ? header : cardsForTemplate[0]?.headers?.find(h => h.type === 'date');

    if (visualizationType === 'pie' || visualizationType === 'bar') {
      return generateCategoricalChartData(cardsForTemplate, selectedHeaderKey, header);
    }

    if (visualizationType === 'number') {
      const values = cardsForTemplate
        .map(card => {
          const { value } = getLatestFieldValueAndTimestamp(card, selectedHeaderKey, dateHeader?.key);
          return value;
        })
        .filter(v => v !== undefined && v !== null && !isNaN(Number(v)))
        .map(Number);
      const rawResult = aggregation === 'average'
        ? values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
        : values.length > 0 ? values.reduce((sum, v) => sum + v, 0) : 0;
      const result = Number.isInteger(rawResult) ? rawResult : Number(rawResult.toFixed(1));
      return {
        labels: ['Value'],
        datasets: [{
          label: header?.name || selectedHeaderKey,
          data: [result],
          backgroundColor: appleBlue,
        }],
      };
    }

    if (header?.type === 'text' || header?.type === 'dropdown') {
      const countsByValueAndDate = {};
      cardsForTemplate.forEach(card => {
        const { value, timestamp } = getLatestFieldValueAndTimestamp(card, selectedHeaderKey, dateHeader?.key);
        let xLabel = formatTimestamp(timestamp);
        if (!xLabel || value === undefined || value === null) return;
        if (!countsByValueAndDate[value]) countsByValueAndDate[value] = {};
        countsByValueAndDate[value][xLabel] = (countsByValueAndDate[value][xLabel] || 0) + 1;
      });
      const allDates = Array.from(new Set(Object.values(countsByValueAndDate).flatMap(obj => Object.keys(obj)))).sort();
      const datasets = Object.entries(countsByValueAndDate).map(([val], idx) => ({
        label: val,
        data: allDates.map(date => countsByValueAndDate[val][date] || 0),
        fill: false,
        borderColor: ['#007AFF', '#339AFF', '#66B7FF', '#99D3FF'][idx % 4], // Use blue shades
        backgroundColor: ['#007AFF', '#339AFF', '#66B7FF', '#99D3FF'][idx % 4],
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
      }));
      return { labels: allDates, datasets };
    }

    const points = cardsForTemplate.map(card => {
      const { value, timestamp } = getLatestFieldValueAndTimestamp(card, selectedHeaderKey, dateHeader?.key);
      let xLabel = formatTimestamp(timestamp);
      if (header?.type === 'date' && value) {
        let yValue = null;
        if (typeof value === 'object' && (value.seconds || value._seconds)) {
          yValue = (value.seconds || value._seconds) * 1000;
        } else if (typeof value === 'string' || typeof value === 'number') {
          const d = new Date(value);
          if (!isNaN(d)) yValue = d.getTime();
        }
        return { x: xLabel, y: yValue };
      }
      return { x: xLabel, y: value };
    }).filter(dp => dp.y !== undefined && dp.y !== null && dp.x);
    points.sort((a, b) => (a.x > b.x ? 1 : -1));
    return {
      labels: points.map(dp => dp.x),
      datasets: [
        {
          label: header?.name || selectedHeaderKey,
          data: points.map(dp => dp.y),
          fill: false,
          borderColor: appleBlue,
          backgroundColor: appleBlue,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    };
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: visualizationType !== 'number',
        position: visualizationType === 'pie' ? 'bottom' : 'top',
        labels: {
          color: textColor,
          font: { family: '-apple-system', size: 14 },
        },
      },
      tooltip: {
        backgroundColor: isDarkTheme ? '#333' : '#FFF',
        titleColor: textColor,
        bodyColor: textColor,
        callbacks: {
          label: function(context) {
            if (header?.type === 'date' && context.parsed.y) {
              const d = new Date(context.parsed.y);
              return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
            }
            if (visualizationType === 'pie' || visualizationType === 'bar') {
              const label = context.label || '';
              const value = context.parsed || 0;
              return `${label}: ${value}`;
            }
            return context.parsed.y;
          },
        },
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: { color: textColor, font: { family: '-apple-system' } },
        grid: { color: isDarkTheme ? '#444' : '#DDD' },
      },
      y: {
        ticks: {
          color: textColor,
          font: { family: '-apple-system' },
          callback: function(value) {
            if (typeof value === 'number' && value > 1000000000 && value < 9999999999999) {
              const d = new Date(value);
              if (!isNaN(d.getTime())) {
                return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
              }
            }
            return value;
          },
        },
        grid: { color: isDarkTheme ? '#444' : '#DDD' },
        ...(visualizationType === 'bar' && {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0,
            callback: function(value) {
              return Number.isInteger(value) ? value : '';
            },
          },
        }),
        ...(visualizationType === 'line' && (header?.type === 'text' || header?.type === 'dropdown') && {
          beginAtZero: true,
          suggestedMin: 0,
          ticks: {
            stepSize: 1,
            precision: 0,
            callback: function(value) {
              return Number.isInteger(value) ? value : '';
            },
          },
        }),
      },
    },
  };

  // Render chart or number output
  const renderChart = () => {
    const dataPoints = generateChartData();
    if (!dataPoints) {
      return <div className={styles.noData}>No data available for this metric.</div>;
    }

    if (visualizationType === 'number') {
      const value = dataPoints.datasets[0]?.data[0] || 0;
      return (
        <div className={styles.simpleNumberPreview}>
          {Number.isInteger(value) ? value.toString() : value.toFixed(1)}
        </div>
      );
    }

    return (
      <div className={styles.chartWrapper}>
        {visualizationType === 'pie' && <Pie data={dataPoints} options={chartOptions} />}
        {visualizationType === 'bar' && <Bar data={dataPoints} options={chartOptions} />}
        {visualizationType === 'line' && <Line data={dataPoints} options={chartOptions} />}
      </div>
    );
  };

  return (
    <ChartErrorBoundary>
      <div
        ref={chartContainerRef}
        className={`${styles.chartContainer} ${isDarkTheme ? styles.darkTheme : ''}`}
      >
        {renderChart()}
      </div>
    </ChartErrorBoundary>
  );
};

CustomMetricChart.propTypes = {
  visualizationType: PropTypes.oneOf(['line', 'pie', 'bar', 'number']).isRequired,
  cards: PropTypes.arrayOf(PropTypes.object).isRequired,
  templateKey: PropTypes.string.isRequired,
  selectedHeaderKey: PropTypes.string.isRequired,
  header: PropTypes.shape({
    key: PropTypes.string,
    name: PropTypes.string,
    type: PropTypes.string,
  }),
  isDarkTheme: PropTypes.bool.isRequired,
  aggregation: PropTypes.oneOf(['average', 'count']),
  granularity: PropTypes.oneOf(['daily', 'weekly', 'monthly', 'none']),
};

export default CustomMetricChart;
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
  size = 'large', // Add size prop with default 'large'
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
          // Use the timestamp from the history entry if the header is a date field
          if (dateHeaderKey && latest.field === dateHeaderKey && latest.timestamp) {
            timestamp = latest.timestamp;
          } else {
            timestamp = latest.timestamp;
          }
        }
      }
      if (!timestamp && dateHeaderKey && card[dateHeaderKey]) {
        timestamp = card[dateHeaderKey];
      }
    }
    // If the header is a date field and we have a history entry for it, use its timestamp
    if (!timestamp && dateHeaderKey && Array.isArray(card.history)) {
      const dateHistory = card.history.find(h => h.field === dateHeaderKey && h.timestamp);
      if (dateHistory) {
        timestamp = dateHistory.timestamp;
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
    // Use metric.records if present (passed as cards), fallback to cards
    const dataSource = Array.isArray(cards) && cards.length && cards[0]?.records ? cards[0].records : cards;
    if (!dataSource || !templateKey || !selectedHeaderKey) return null;

    const cardsForTemplate = dataSource.filter(card => card.typeOfCards === templateKey);
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

    // For line charts, use <field>_timestamp for x-axis if present, and format by granularity
    if (visualizationType === 'line') {
      const pointMap = {};
      let dateList = [];
      if (granularity === 'daily') {
        // Collect all unique dates (as Date objects) from the data
        const dateSet = new Set();
        cardsForTemplate.forEach(card => {
          const ts = card[`${selectedHeaderKey}_timestamp`];
          if (ts && typeof ts === 'object' && (ts.seconds || ts._seconds)) {
            const d = new Date((ts.seconds || ts._seconds) * 1000);
            // Use ISO string for uniqueness
            dateSet.add(d.toISOString().slice(0, 10));
          }
        });
        // Sort dates chronologically
        dateList = Array.from(dateSet).sort().map(str => new Date(str));
      }
      // Map from ISO date string to label
      const dateLabelMap = {};
      if (granularity === 'daily' && dateList.length > 0) {
        dateList.forEach((date, idx) => {
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          if (idx === 0 || date.getMonth() !== dateList[idx - 1].getMonth() || date.getFullYear() !== dateList[idx - 1].getFullYear()) {
            dateLabelMap[date.toISOString().slice(0, 10)] = `${day}/${month}`;
          } else {
            dateLabelMap[date.toISOString().slice(0, 10)] = day;
          }
        });
      }
      // Aggregate values by label
      cardsForTemplate.forEach(card => {
        const value = card[selectedHeaderKey];
        const ts = card[`${selectedHeaderKey}_timestamp`];
        let xLabel = '';
        if (ts && typeof ts === 'object' && (ts.seconds || ts._seconds)) {
          const date = new Date((ts.seconds || ts._seconds) * 1000);
          if (granularity === 'monthly') {
            xLabel = date.toLocaleString('default', { month: 'short' });
          } else if (granularity === 'weekly') {
            const day = date.getDay();
            const diffToMonday = (day === 0 ? -6 : 1) - day;
            const weekStart = new Date(date);
            weekStart.setHours(0,0,0,0);
            weekStart.setDate(date.getDate() + diffToMonday);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            xLabel = `${weekStart.getDate().toString().padStart(2, '0')}-${weekEnd.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`;
          } else if (granularity === 'daily') {
            const iso = date.toISOString().slice(0, 10);
            xLabel = dateLabelMap[iso] || date.getDate().toString().padStart(2, '0');
          } else {
            xLabel = date.toLocaleDateString();
          }
        } else {
          xLabel = formatTimestamp(ts);
        }
        const numValue = Number(value);
        if (!xLabel || isNaN(numValue)) return;
        if (!pointMap[xLabel]) pointMap[xLabel] = 0;
        pointMap[xLabel] += numValue;
      });
      // For daily, use dateList to preserve order and avoid duplicates
      let sortedLabels;
      if (granularity === 'daily' && dateList.length > 0) {
        let lastMonth = null;
        sortedLabels = [];
        dateList.forEach((date, idx) => {
          const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
          const day = date.getDate().toString().padStart(2, '0');
          if (lastMonth !== date.getMonth()) {
            sortedLabels.push(month);
            lastMonth = date.getMonth();
          }
          sortedLabels.push(day);
        });
      } else {
        sortedLabels = Object.keys(pointMap).sort((a, b) => {
          const parseDate = (label) => {
            if (granularity === 'monthly') {
              return new Date(`01 ${label} 2025`).getTime();
            } else if (granularity === 'weekly') {
              const [start, rest] = label.split('-');
              const [end, month] = rest.split('/');
              return new Date(`2025-${month}-${start}`).getTime();
            } else if (granularity === 'daily') {
              const parts = label.split(', ');
              const day = parts[0];
              const month = parts[1] || (new Date().getMonth() + 1).toString().padStart(2, '0');
              return new Date(`2025-${month}-${day}`).getTime();
            }
            return 0;
          };
          return parseDate(a) - parseDate(b);
        });
      }
      // For daily, map data to sortedLabels, skipping month labels
      let dataForLabels;
      if (granularity === 'daily' && dateList.length > 0) {
        let dateIdx = 0;
        dataForLabels = sortedLabels.map(label => {
          if (label.length === 3) return null; // Month label
          // label is day, get corresponding date
          const date = dateList[dateIdx++];
          const iso = date.toISOString().slice(0, 10);
          return pointMap[dateLabelMap[iso]] || 0;
        });
      } else {
        dataForLabels = sortedLabels.map(l => pointMap[l] || 0);
      }
      return {
        labels: sortedLabels,
        datasets: [
          {
            label: header?.name || selectedHeaderKey,
            data: dataForLabels,
            fill: false,
            borderColor: appleBlue,
            backgroundColor: appleBlue,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 0,
          },
        ],
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
        <div className={styles.simpleNumberPreview} style={{ fontSize: 28, padding: 12 }}>
          {Number.isInteger(value) ? value.toString() : value.toFixed(1)}
        </div>
      );
    }

    // PIE CHART LAYOUTS
    if (visualizationType === 'pie') {
      if (size === 'small' || size === 'verySmall') {
        // Only show the chart, no legend or data on top
        return (
          <div className={styles.chartWrapper}>
            <Pie data={dataPoints} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
          </div>
        );
      }
      if (size === 'medium') {
        // Chart and legend/data side by side, 70-30 split, with ellipsis for overflow
        return (
          <div className={styles.mediumPieLayout}>
            <div className={styles.chartWrapper} style={{ flex: '0 0 60%', minWidth: 0, minHeight: 0 }}>
              <Pie data={dataPoints} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
            </div>
            <div className={styles.legend} style={{ flex: '0 0 40%', minWidth: 0, minHeight: 0, paddingLeft: 16, overflow: 'hidden' }}>
              <h4 style={{margin:0,marginBottom:8,fontWeight:600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>Data</h4>
              <ul style={{listStyle:'none',padding:0,margin:0}}>
                {dataPoints.labels.map((label, idx) => (
                  <li
                    key={label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: 6,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}
                    title={`${label}: ${dataPoints.datasets[0].data[idx]}`}
                  >
                    <span style={{display:'inline-block',width:14,height:14,background:dataPoints.datasets[0].backgroundColor[idx],borderRadius:3,marginRight:8}} />
                    <span style={{
                      fontWeight:500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 70,
                      display: 'inline-block',
                      verticalAlign: 'middle'
                    }}>
                      {label.length > 12 ? label.slice(0, 12) + '...' : label}
                    </span>
                    <span style={{
                      marginLeft:'auto',
                      fontWeight:400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 40,
                      display: 'inline-block',
                      verticalAlign: 'middle'
                    }}>
                      {String(dataPoints.datasets[0].data[idx]).length > 6
                        ? String(dataPoints.datasets[0].data[idx]).slice(0, 6) + '...'
                        : dataPoints.datasets[0].data[idx]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      }
      // Large: default (legend on bottom)
      return (
        <div className={styles.chartWrapper}>
          <Pie data={dataPoints} options={chartOptions} />
        </div>
      );
    }

    // BAR: Only show the chart, no data/label for all sizes
    if (visualizationType === 'bar') {
      return (
        <div className={styles.chartWrapper}>
          <Bar data={dataPoints} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
        </div>
      );
    }

    // LINE
    return (
      <div className={styles.chartWrapper}>
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
  cards: PropTypes.arrayOf(PropTypes.object), // Now optional, can be []
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
  size: PropTypes.oneOf(['verySmall', 'small', 'medium', 'large']), // Add size prop
};

export default CustomMetricChart;
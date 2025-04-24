// utils/metricsUtils.js
import { format, startOfDay, addDays } from 'date-fns';

// Convert Firebase timestamp to JavaScript Date
const timestampToDate = (timestamp) => {
  return new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
};

// Get history entries for a specific field, filtered by cardTemplates and key-value filter
export const getFieldChanges = (cards, field, dateRange, cardTemplates, filter = null) => {
  const { start, end } = dateRange;
  const startDate = startOfDay(new Date(start));
  const endDate = startOfDay(new Date(end));

  return cards
    .filter((card) => {
      // Filter by cardTemplates
      if (!cardTemplates.includes(card.type)) return false;

      // Apply key-value filter if provided
      if (filter && filter.key) {
        const historyEntry = card.history?.find(
          (entry) => entry.field === filter.key && entry.newValue === filter.value
        );
        return !!historyEntry;
      }
      return true;
    })
    .flatMap((card) =>
      card.history
        .filter(
          (entry) =>
            entry.field === field &&
            timestampToDate(entry.timestamp) >= startDate &&
            timestampToDate(entry.timestamp) <= endDate
        )
        .map((entry) => ({
          cardId: card.id,
          cardType: card.type,
          field: entry.field,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          timestamp: timestampToDate(entry.timestamp),
        }))
    );
};

// Aggregate history data by day for line, bar, number, grouped by cardTemplate or filter
export const aggregateByDay = (history, aggregation, groupBy = null) => {
  if (!history.length) return { labels: [], datasets: [] };

  // Group by date and optionally by groupBy (e.g., cardType or filter value)
  const grouped = history.reduce((acc, entry) => {
    const date = format(entry.timestamp, 'yyyy-MM-dd');
    const groupKey = groupBy ? entry[groupBy] : entry.cardType;
    if (!acc[date]) acc[date] = {};
    if (!acc[date][groupKey]) acc[date][groupKey] = [];
    acc[date][groupKey].push(entry);
    return acc;
  }, {});

  // Generate labels
  const labels = [];
  const startDate = startOfDay(new Date(history[0].timestamp));
  const endDate = startOfDay(new Date(history[history.length - 1].timestamp));
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    labels.push(format(date, 'yyyy-MM-dd'));
  }

  // Generate datasets
  const groups = [...new Set(history.map((entry) => (groupBy ? entry[groupBy] : entry.cardType)))];
  const datasets = groups.map((group) => {
    const values = labels.map((date) => {
      const entries = grouped[date]?.[group] || [];
      let value;
      switch (aggregation) {
        case 'count':
          value = entries.length;
          break;
        case 'average':
          value =
            entries.length > 0
              ? entries.reduce((sum, e) => sum + parseFloat(e.newValue || 0), 0) / entries.length
              : 0;
          break;
        case 'sum':
          value = entries.reduce((sum, e) => sum + parseFloat(e.newValue || 0), 0);
          break;
        default:
          value = 0;
      }
      return value;
    });

    return {
      label: group,
      data: values,
      borderColor: getColor(group),
      backgroundColor: getColor(group, 0.2),
      fill: false,
    };
  });

  return { labels, datasets };
};

// Aggregate history data for pie charts (count unique values, grouped by cardTemplate or filter)
export const aggregateForPie = (history, groupBy = null) => {
  if (!history.length) return { labels: [], datasets: [] };

  // Group by unique values and optionally by groupBy
  const grouped = history.reduce((acc, entry) => {
    const value = entry.newValue || 'Unknown';
    const groupKey = groupBy ? entry[groupBy] : entry.cardType;
    if (!acc[groupKey]) acc[groupKey] = {};
    acc[groupKey][value] = (acc[groupKey][value] || 0) + 1;
    return acc;
  }, {});

  // Generate datasets
  const groups = Object.keys(grouped);
  const datasets = groups.map((group) => {
    const labels = Object.keys(grouped[group]);
    const values = Object.values(grouped[group]);
    return {
      label: group,
      data: values,
      backgroundColor: labels.map((_, i) => getColor(i)),
    };
  });

  return { labels: Object.keys(grouped[groups[0]] || {}), datasets };
};

// Generate metric data based on config
export const computeMetricData = (cards, config) => {
  const { field, dateRange, aggregation, cardTemplates, filter, visualizationType, groupBy } = config;
  const history = getFieldChanges(cards, field, dateRange, cardTemplates, filter);

  if (visualizationType === 'pie') {
    return aggregateForPie(history, groupBy);
  }
  return aggregateByDay(history, aggregation, groupBy);
};

// Helper to generate colors
const getColor = (key, alpha = 1) => {
  const colors = [
    `rgba(0, 122, 255, ${alpha})`,
    `rgba(255, 45, 85, ${alpha})`,
    `rgba(52, 199, 89, ${alpha})`,
    `rgba(255, 149, 0, ${alpha})`,
    `rgba(88, 86, 214, ${alpha})`,
  ];
  return colors[typeof key === 'number' ? key % colors.length : key.charCodeAt(0) % colors.length];
};
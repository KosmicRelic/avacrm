import { format, startOfDay, addDays, startOfMonth, addMonths } from 'date-fns';

// Helper to convert timestamp to Date
export const timestampToDate = (timestamp) => {
  if (typeof timestamp === 'object' && timestamp._seconds) {
    return new Date(timestamp._seconds * 1000);
  }
  return new Date(timestamp);
};

// Helper to calculate median
const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Helper to calculate standard deviation
const stddev = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

// Get field changes for multiple fields
export const getFieldChanges = (cards, fields, dateRange, cardTemplates, filter = null, includeHistory = true) => {
  console.log('getFieldChanges input:', { fields, dateRange, cardTemplates, filter, includeHistory });
  const { start, end } = dateRange;
  const startDate = startOfDay(new Date(start));
  const endDate = startOfDay(new Date(end));

  const filteredCards = cards.filter((card) => {
    if (!cardTemplates.includes(card.typeOfCards)) return false;
    if (filter && filter.key) {
      if (card[filter.key]?.toString() === filter.value) return true;
      const historyEntry = card.history?.find(
        (entry) => entry.field === filter.key && (entry.value || entry.newValue) === filter.value
      );
      return !!historyEntry;
    }
    return true;
  });
  console.log('Filtered cards:', filteredCards);

  let history = [];
  let currentValues = [];

  // Include history entries if enabled
  if (includeHistory) {
    history = filteredCards.flatMap((card) =>
      card.history
        .filter(
          (entry) =>
            fields.includes(entry.field) &&
            timestampToDate(entry.timestamp) >= startDate &&
            timestampToDate(entry.timestamp) <= endDate
        )
        .map((entry) => ({
          cardId: card.id,
          cardType: card.typeOfCards,
          field: entry.field,
          oldValue: entry.oldValue || null,
          newValue: entry.value || entry.newValue,
          timestamp: timestampToDate(entry.timestamp),
        }))
    );
  }

  // Include current field values
  const latestHistoryTimestamp = history.length
    ? Math.max(...history.map((h) => new Date(h.timestamp).getTime()))
    : new Date(end).getTime();

  currentValues = filteredCards.flatMap((card) =>
    fields.map((field) => ({
      cardId: card.id,
      cardType: card.typeOfCards,
      field,
      oldValue: null,
      newValue: card[field]?.toString(),
      timestamp: new Date(latestHistoryTimestamp),
    }))
  );

  const result = includeHistory ? [...currentValues, ...history] : currentValues;
  const filteredResult = result.filter((entry) => entry.newValue !== undefined);
  console.log('History and current entries:', filteredResult);
  return filteredResult;
};

// Aggregate data for pie chart
export const aggregateForPie = (history, groupBy) => {
  const grouped = history.reduce((acc, entry) => {
    const groupKey = groupBy ? entry[groupBy] : entry.cardType;
    acc[groupKey] = (acc[groupKey] || 0) + 1;
    return acc;
  }, {});

  const labels = Object.keys(grouped);
  const values = Object.values(grouped);

  return {
    labels,
    datasets: [
      {
        label: 'Count',
        data: values,
        backgroundColor: labels.map((_, i) => `hsl(${(i * 360) / labels.length}, 70%, 50%)`),
        borderColor: '#fff',
        borderWidth: 1,
      },
    ],
  };
};

// Aggregate data by day or month
export const aggregateByDay = (history, aggregation, groupBy = 'cardType', dateRange = null, granularity = 'monthly') => {
  if (!history.length) {
    console.log('No history entries, returning default dataset');
    const defaultLabel = granularity === 'monthly' ? format(new Date(), 'yyyy-MM') : format(new Date(), 'yyyy-MM-dd');
    return {
      labels: [defaultLabel],
      datasets: [
        {
          label: 'No Data',
          data: [0],
          borderColor: 'rgba(0, 122, 255, 1)',
          backgroundColor: 'rgba(0, 122, 255, 0.2)',
          fill: false,
        },
      ],
    };
  }

  // Sort history by timestamp
  const sortedHistory = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Use dateRange if provided, otherwise derive from history
  let startDate, endDate;
  if (dateRange && dateRange.start && dateRange.end) {
    startDate = granularity === 'monthly' ? startOfMonth(new Date(dateRange.start)) : startOfDay(new Date(dateRange.start));
    endDate = granularity === 'monthly' ? startOfMonth(new Date(dateRange.end)) : startOfDay(new Date(dateRange.end));
  } else {
    startDate = granularity === 'monthly' ? startOfMonth(new Date(sortedHistory[0].timestamp)) : startOfDay(new Date(sortedHistory[0].timestamp));
    endDate = granularity === 'monthly' ? startOfMonth(new Date(sortedHistory[sortedHistory.length - 1].timestamp)) : startOfDay(new Date(sortedHistory[sortedHistory.length - 1].timestamp));
  }

  if (startDate > endDate) {
    console.log('startDate after endDate, swapping:', { startDate, endDate });
    [startDate, endDate] = [endDate, startDate];
  }

  // Group by date and groupBy (cardType or field)
  const grouped = history.reduce((acc, entry) => {
    const date = format(entry.timestamp, granularity === 'monthly' ? 'yyyy-MM' : 'yyyy-MM-dd');
    const groupKey = groupBy ? entry[groupBy] : entry.cardType;
    if (!acc[date]) acc[date] = {};
    if (!acc[date][groupKey]) acc[date][groupKey] = [];
    acc[date][groupKey].push(entry);
    return acc;
  }, {});

  // Generate labels
  const labels = [];
  const addUnit = granularity === 'monthly' ? addMonths : addDays;
  const startUnit = granularity === 'monthly' ? startOfMonth : startOfDay;
  for (let date = startDate; date <= endDate; date = addUnit(date, 1)) {
    labels.push(format(date, granularity === 'monthly' ? 'yyyy-MM' : 'yyyy-MM-dd'));
  }

  // Generate datasets
  const groups = [...new Set(history.map((entry) => (groupBy ? entry[groupBy] : entry.cardType)))];
  const datasets = groups.map((group, i) => {
    const values = labels.map((date) => {
      const entries = grouped[date]?.[group] || [];
      const numericValues = entries
        .map((e) => parseFloat(e.newValue))
        .filter((v) => !isNaN(v));
      let value;
      switch (aggregation) {
        case 'count':
          value = entries.length;
          break;
        case 'average':
          value = numericValues.length > 0 ? numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length : 0;
          break;
        case 'sum':
          value = numericValues.reduce((sum, v) => sum + v, 0);
          break;
        case 'min':
          value = numericValues.length > 0 ? Math.min(...numericValues) : 0;
          break;
        case 'max':
          value = numericValues.length > 0 ? Math.max(...numericValues) : 0;
          break;
        case 'median':
          value = median(numericValues);
          break;
        case 'stddev':
          value = stddev(numericValues);
          break;
        default:
          value = 0;
      }
      return value;
    });

    return {
      label: group,
      data: values,
      borderColor: `hsl(${(i * 360) / groups.length}, 70%, 50%)`,
      backgroundColor: `hsl(${(i * 360) / groups.length}, 70%, 50%, 0.2)`,
      fill: aggregation === 'average',
      stack: groupBy, // Enable stacking for bar charts
    };
  });

  console.log('aggregateByDay output:', { labels, datasets });
  return { labels, datasets };
};

// Compute metric data
export const computeMetricData = (cards, config) => {
  console.log('computeMetricData config:', config);
  const { fields, dateRange, aggregation, cardTemplates, filter, visualizationType, groupBy, includeHistory, granularity } = config;
  const history = getFieldChanges(cards, fields, dateRange, cardTemplates, filter, includeHistory);
  console.log('History from getFieldChanges:', history);

  if (visualizationType === 'pie') {
    const result = aggregateForPie(history, groupBy);
    console.log('Pie chart data:', result);
    return result;
  }
  const result = aggregateByDay(history, aggregation, groupBy, dateRange, granularity);
  console.log('Line/Bar/Number chart data:', result);
  return result;
};

// Color helper
export const getColor = (key, opacity = 1) => {
  const colors = {
    Leads: `rgba(255, 45, 85, ${opacity})`,
    Deals: `rgba(0, 122, 255, ${opacity})`,
    default: `rgba(0, 122, 255, ${opacity})`,
  };
  return colors[key] || colors.default;
};
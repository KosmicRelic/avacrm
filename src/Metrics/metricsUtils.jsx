import { format, startOfDay, startOfMonth } from 'date-fns';

// Helper to convert timestamp to Date
export const timestampToDate = (timestamp) => {
  if (timestamp && typeof timestamp === 'object') {
    if (typeof timestamp._seconds === 'number') {
      return new Date(timestamp._seconds * 1000);
    }
    if (typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000);
    }
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

// Helper to check if a value is numeric
const isNumeric = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && isFinite(num);
};

// Get field changes for multiple fields, handling fields as an object
export const getFieldChanges = (
  records,
  fields,
  dateRange,
  recordTemplates,
  filterValues = {},
  includeHistory = true,
  headers = []
) => {
  const { start, end } = dateRange;
  const startDate = startOfDay(new Date(start));
  const endDate = startOfDay(new Date(end));

  // Filter records based on recordTemplates and filterValues
  const filteredRecords = records.filter((record) => {
    if (!recordTemplates.includes(record.typeOfRecord)) return false;

    // Apply filterValues
    return Object.keys(filterValues).every((key) => {
      const filter = filterValues[key];
      if (!filter || Object.keys(filter).length === 0) return true;

      const recordValue = record[key];
      if (filter.values) {
        // Case-insensitive matching for dropdowns
        return filter.values.some((val) => val.toLowerCase() === recordValue?.toString().toLowerCase());
      } else if (filter.start || filter.end) {
        const recordDate = new Date(recordValue);
        const startFilter = filter.start ? new Date(filter.start) : null;
        const endFilter = filter.end ? new Date(filter.end) : null;
        return (
          (!startFilter || recordDate >= startFilter) &&
          (!endFilter || recordDate <= endFilter)
        );
      } else if (filter.value) {
        switch (filter.condition || filter.order || 'equals') {
          case 'equals':
            return recordValue?.toString().toLowerCase() === filter.value.toLowerCase();
          case 'contains':
            return recordValue && recordValue.toString().toLowerCase().includes(filter.value.toLowerCase());
          case 'greater':
            return isNumeric(recordValue) && Number(recordValue) > Number(filter.value);
          case 'less':
            return isNumeric(recordValue) && Number(recordValue) < Number(filter.value);
          case 'greaterOrEqual':
            return isNumeric(recordValue) && Number(recordValue) >= Number(filter.value);
          case 'lessOrEqual':
            return isNumeric(recordValue) && Number(recordValue) <= Number(filter.value);
          case 'before':
            return new Date(recordValue) < new Date(filter.value);
          case 'after':
            return new Date(recordValue) > new Date(filter.value);
          case 'on':
            return new Date(recordValue).toDateString() === new Date(filter.value).toDateString();
          default:
            return true;
        }
      }
      return true;
    });
  });

  if (filteredRecords.length === 0) {
    // No records match the filters or record templates.
  }

  let history = [];
  let currentValues = [];

  // Process each record template and its fields
  recordTemplates.forEach((template) => {
    const templateFields = fields[template] || [];
    if (templateFields.length === 0) return;

    const templateRecords = filteredRecords.filter((record) => record.typeOfRecord === template);

    // Include history entries if enabled
    if (includeHistory) {
      history = [
        ...history,
        ...templateRecords.flatMap((record) =>
          record.history
            ? record.history
                .filter(
                  (entry) =>
                    templateFields.includes(entry.field) &&
                    timestampToDate(entry.timestamp) >= startDate &&
                    timestampToDate(entry.timestamp) <= endDate &&
                    isNumeric(entry.value)
                )
                .map((entry) => ({
                  recordId: record.id,
                  recordType: record.typeOfRecord,
                  field: entry.field,
                  oldValue: entry.oldValue || null,
                  newValue: entry.value || entry.newValue,
                  timestamp: timestampToDate(entry.timestamp),
                }))
            : []
        ),
      ];
    }

    // Include current field values
    const latestHistoryTimestamp = history.length
      ? Math.max(...history.map((h) => new Date(h.timestamp).getTime()))
      : new Date(end).getTime();

    currentValues = [
      ...currentValues,
      ...templateRecords.flatMap((record) =>
        templateFields
          .filter((field) => {
            const header = headers.find((h) => h.key === field);
            return header && header.type === 'number' && isNumeric(record[field]);
          })
          .map((field) => ({
            recordId: record.id,
            recordType: record.typeOfRecord,
            field,
            oldValue: null,
            newValue: record[field]?.toString(),
            timestamp: new Date(latestHistoryTimestamp),
          }))
      ),
    ];
  });

  const result = includeHistory ? [...currentValues, ...history] : currentValues;
  const filteredResult = result.filter((entry) => entry.newValue !== undefined && isNumeric(entry.newValue));
  return filteredResult;
};

// Aggregate data for pie chart
export const aggregateForPie = (history, groupBy, _fields, _recordTemplates) => {
  const grouped = history.reduce((acc, entry) => {
    const groupKey = groupBy === 'field' ? entry.field : groupBy ? entry[groupBy] : entry.recordType;
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
export const aggregateByDay = (
  history,
  aggregation,
  groupBy = 'recordType',
  dateRange = null,
  granularity = 'monthly'
) => {
  if (!history.length) {
    return {
      labels: [format(new Date(), granularity === 'monthly' ? 'yyyy-MM' : 'yyyy-MM-dd')],
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
  const sortedHistory = [...history].sort((a, b) => timestampToDate(a.timestamp) - timestampToDate(b.timestamp));

  // Use dateRange if provided, otherwise derive from history
  let startDate, endDate;
  if (dateRange && dateRange.start && dateRange.end) {
    startDate = granularity === 'monthly' ? startOfMonth(timestampToDate(dateRange.start)) : startOfDay(timestampToDate(dateRange.start));
    endDate = granularity === 'monthly' ? startOfMonth(timestampToDate(dateRange.end)) : startOfDay(timestampToDate(dateRange.end));
  } else {
    startDate = granularity === 'monthly' ? startOfMonth(timestampToDate(sortedHistory[0].timestamp)) : startOfDay(timestampToDate(sortedHistory[0].timestamp));
    endDate = granularity === 'monthly' ? startOfMonth(timestampToDate(sortedHistory[sortedHistory.length - 1].timestamp)) : startOfDay(timestampToDate(sortedHistory[sortedHistory.length - 1].timestamp));
  }

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  // Group by date and groupBy
  const grouped = history.reduce((acc, entry) => {
    const date = format(timestampToDate(entry.timestamp), granularity === 'monthly' ? 'yyyy-MM' : 'yyyy-MM-dd');
    const groupKey = groupBy === 'field' ? entry.field : groupBy ? entry[groupBy] : entry.recordType;
    if (!acc[date]) acc[date] = {};
    if (!acc[date][groupKey]) acc[date][groupKey] = [];
    acc[date][groupKey].push(entry);
    return acc;
  }, {});

  // Generate labels only for dates with data
  const labels = Object.keys(grouped).sort();

  // Generate datasets
  const groups = [...new Set(history.map((entry) => (groupBy === 'field' ? entry.field : groupBy ? entry[groupBy] : entry.recordType)))];
  const datasets = groups.map((group, i) => {
    const values = labels.map((date) => {
      const entries = grouped[date]?.[group] || [];
      const numericValues = entries
        .map((e) => parseFloat(e.newValue))
        .filter((v) => isNumeric(v));
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
      stack: groupBy && groupBy !== 'field' ? groupBy : undefined,
    };
  });

  return { labels, datasets };
};

// Compute metric data for number visualization
export const computeNumberMetric = (
  history,
  aggregation
) => {
  const numericValues = history
    .map((entry) => parseFloat(entry.newValue))
    .filter((v) => isNumeric(v));

  let value;
  switch (aggregation) {
    case 'count':
      value = history.length;
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

  return {
    labels: ['Current'],
    datasets: [
      {
        label: 'Value',
        data: [value],
        borderColor: 'rgba(0, 122, 255, 1)',
        backgroundColor: 'rgba(0, 122, 255, 0.2)',
      },
    ],
  };
};

// Aggregate data for two-line comparison chart
export const aggregateByDayForComparison = (
  history,
  aggregation,
  comparisonFields,
  dateRange,
  granularity
) => {
  if (!history.length) {
    return {
      labels: [format(new Date(), granularity === 'monthly' ? 'yyyy-MM' : 'yyyy-MM-dd')],
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
  const _sortedHistory = [...history].sort((a, b) => timestampToDate(a.timestamp) - timestampToDate(b.timestamp));

  // Use dateRange if provided
  let startDate = granularity === 'monthly' ? startOfMonth(timestampToDate(dateRange.start)) : startOfDay(timestampToDate(dateRange.start));
  let endDate = granularity === 'monthly' ? startOfMonth(timestampToDate(dateRange.end)) : startOfDay(timestampToDate(dateRange.end));

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  // Group by date and field
  const grouped = history.reduce((acc, entry) => {
    const date = format(timestampToDate(entry.timestamp), granularity === 'monthly' ? 'yyyy-MM' : 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = {};
    if (!acc[date][entry.field]) acc[date][entry.field] = [];
    acc[date][entry.field].push(entry);
    return acc;
  }, {});

  // Generate labels (dates with data)
  const labels = Object.keys(grouped).sort();

  // Create datasets for each comparison field
  const datasets = comparisonFields.map((field, i) => {
    const values = labels.map((date) => {
      const entries = grouped[date]?.[field] || [];
      const numericValues = entries
        .map((e) => parseFloat(e.newValue))
        .filter((v) => isNumeric(v));
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
      label: field,
      data: values,
      borderColor: i === 0 ? 'rgba(0, 122, 255, 1)' : 'rgba(255, 45, 85, 1)',
      backgroundColor: i === 0 ? 'rgba(0, 122, 255, 0.2)' : 'rgba(255, 45, 85, 0.2)',
      fill: false,
      tension: 0.4,
    };
  });

  return { labels, datasets };
};

// Compute scatter data for two fields
export const computeScatterData = (
  history,
  comparisonFields
) => {
  if (comparisonFields.length !== 2) {
    return {
      labels: [],
      datasets: [
        {
          label: 'No Data',
          data: [],
          borderColor: 'rgba(0, 122, 255, 1)',
          backgroundColor: 'rgba(0, 122, 255, 0.2)',
        },
      ],
    };
  }

  // Group history by recordId to pair field values
  const groupedByRecord = history.reduce((acc, entry) => {
    if (!acc[entry.recordId]) acc[entry.recordId] = {};
    acc[entry.recordId][entry.field] = parseFloat(entry.newValue);
    return acc;
  }, {});

  // Create data points where both fields have values
  const dataPoints = Object.values(groupedByRecord)
    .filter((record) => comparisonFields.every((field) => isNumeric(record[field])))
    .map((record) => ({
      x: record[comparisonFields[0]],
      y: record[comparisonFields[1]],
    }));

  return {
    labels: [],
    datasets: [
      {
        label: `${comparisonFields[0]} vs ${comparisonFields[1]}`,
        data: dataPoints,
        borderColor: 'rgba(0, 122, 255, 1)',
        backgroundColor: 'rgba(0, 122, 255, 0.6)',
        pointRadius: 5,
        showLine: true,
      },
    ],
  };
};

// Compute Pearson correlation coefficient
export const computeCorrelation = (data1, data2) => {
  if (data1.length !== data2.length || data1.length === 0) return 0;

  const n = data1.length;
  const mean1 = data1.reduce((sum, v) => sum + v, 0) / n;
  const mean2 = data2.reduce((sum, v) => sum + v, 0) / n;

  let covariance = 0;
  let stddev1 = 0;
  let stddev2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = data1[i] - mean1;
    const diff2 = data2[i] - mean2;
    covariance += diff1 * diff2;
    stddev1 += diff1 * diff1;
    stddev2 += diff2 * diff2;
  }

  stddev1 = Math.sqrt(stddev1);
  stddev2 = Math.sqrt(stddev2);

  if (stddev1 === 0 || stddev2 === 0) return 0;

  return covariance / (stddev1 * stddev2);
};

// Compute metric data
export const computeMetricData = (records, config, headers = []) => {
  const {
    fields,
    dateRange,
    aggregation,
    recordTemplates,
    filterValues = {},
    visualizationType,
    groupBy,
    includeHistory,
    granularity,
    comparisonFields = [],
  } = config;

  // Validate fields
  const allFields = comparisonFields.length > 0 ? comparisonFields : recordTemplates.flatMap((template) => fields[template] || []);
  if (allFields.length === 0) {
    return {
      labels: [format(new Date(), granularity === 'monthly' ? 'yyyy-MM' : 'yyyy-MM-dd')],
      datasets: [
        {
          label: 'No Data',
          data: [0],
          borderColor: 'rgba(0, 122, 255, 1)',
          backgroundColor: 'rgba(0, 122, 255, 0.2)',
        },
      ],
    };
  }

  // Validate field types
  const invalidFields = allFields.filter((field) => {
    const header = headers.find((h) => h.key === field);
    return header && header.type !== 'number';
  });
  if (invalidFields.length > 0 && visualizationType !== 'pie' && aggregation !== 'count') {
    // Non-numeric fields selected for numeric aggregation.
  }

  const history = getFieldChanges(
    records,
    comparisonFields.length > 0 ? { [recordTemplates[0]]: comparisonFields } : fields,
    dateRange,
    recordTemplates,
    filterValues,
    includeHistory,
    headers
  );

  if (visualizationType === 'pie') {
    const result = aggregateForPie(history, groupBy, fields, recordTemplates);
    return result;
  }

  if (visualizationType === 'number') {
    const result = computeNumberMetric(history, aggregation, fields, recordTemplates);
    return result;
  }

  if (visualizationType === 'scatter' && comparisonFields.length === 2) {
    const result = computeScatterData(history, comparisonFields, recordTemplates);
    return result;
  }

  if (comparisonFields.length === 2) {
    const result = aggregateByDayForComparison(
      history,
      aggregation,
      comparisonFields,
      dateRange,
      granularity,
      recordTemplates
    );
    return result;
  }

  const result = aggregateByDay(
    history,
    aggregation,
    groupBy,
    dateRange,
    granularity,
    fields,
    recordTemplates
  );
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
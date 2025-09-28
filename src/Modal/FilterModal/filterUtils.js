// Utility: filter rows locally based on filterValues and headers (supports multi-select)
export function filterRowsLocally(rows, filterValues, headers) {
  return rows.filter(row => {
    return Object.entries(filterValues).every(([key, filter]) => {
      if (!filter || Object.keys(filter).length === 0) return true;
      const header = headers.find(h => h.key === key);
      if (!header) return true;
      const value = row[key];
      if (header.type === 'number') {
        if (filter.start !== undefined && filter.start !== '' && Number(value) < Number(filter.start)) return false;
        if (filter.end !== undefined && filter.end !== '' && Number(value) > Number(filter.end)) return false;
        if (filter.order && filter.value !== undefined && filter.value !== '') {
          const numVal = Number(filter.value);
          if (filter.order === 'equals' && Number(value) !== numVal) return false;
          if (filter.order === 'greater' && Number(value) <= numVal) return false;
          if (filter.order === 'less' && Number(value) >= numVal) return false;
          if (filter.order === 'greaterOrEqual' && Number(value) < numVal) return false;
          if (filter.order === 'lessOrEqual' && Number(value) > numVal) return false;
        }
        return true;
      }
      if (header.type === 'dropdown') {
        if (Array.isArray(filter.values) && filter.values.length > 0) {
          // Dropdown: value can be string or array, filter.values is array
          if (Array.isArray(value)) {
            // If value is array, match if any selected value is present
            return value.some(v => filter.values.includes(v));
          } else {
            // If value is string, match if it's included in selected values
            return filter.values.includes(value);
          }
        }
        return true;
      }
      if (header.type === 'multi-select') {
        if (Array.isArray(filter.values) && filter.values.length > 0) {
          // Multi-select: value is array, filter.values is array
          if (!Array.isArray(value)) return false;
          // Match if any selected value is present in the row's value array
          return value.some(v => filter.values.includes(v));
        }
        return true;
      }
      if (header.type === 'text') {
        if (filter.value !== undefined && filter.value !== '') {
          const strVal = String(value || '');
          const cond = filter.condition || 'equals';
          if (cond === 'equals' && strVal !== filter.value) return false;
          if (cond === 'contains' && !strVal.includes(filter.value)) return false;
          if (cond === 'startsWith' && !strVal.startsWith(filter.value)) return false;
          if (cond === 'endsWith' && !strVal.endsWith(filter.value)) return false;
        }
        return true;
      }
      if (header.type === 'date') {
        // Implement date filtering if needed
        return true;
      }
      // Default: no filter
      return true;
    });
  });
}
// Utility to export array of objects to CSV and trigger download
export function exportArrayToCsv(filename, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    alert('No data to export.');
    return;
  }
  const replacer = (key, value) => (value === null || value === undefined ? '' : value);
  const headerSet = new Set();
  rows.forEach(row => Object.keys(row).forEach(key => headerSet.add(key)));
  const headers = Array.from(headerSet);
  const csv = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(fieldName => {
          let val = row[fieldName];
          if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
          return JSON.stringify(val, replacer);
        })
        .join(',')
    ),
  ].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

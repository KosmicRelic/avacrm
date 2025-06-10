export const formatFirestoreTimestamp = (value, opts = { asTimestamp: false }) => {
  if (value && typeof value === 'object' && ('seconds' in value || 'toDate' in value)) {
    // Always use the correct nanoseconds property name (Firestore uses 'nanoseconds', not 'nanosecond')
    let date;
    if (value.toDate) {
      date = value.toDate();
    } else if (typeof value.seconds === 'number') {
      date = new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6));
    }
    if (opts.asTimestamp) {
      if (typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
        return `Timestamp(seconds=${value.seconds}, nanoseconds=${value.nanoseconds})`;
      } else if (date instanceof Date && !isNaN(date.getTime())) {
        return `Timestamp(seconds=${Math.floor(date.getTime() / 1000)}, nanoseconds=${(date.getTime() % 1000) * 1e6})`;
      }
    } else if (date instanceof Date && !isNaN(date.getTime())) {
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  }
  if (opts.asTimestamp && value) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return `Timestamp(seconds=${Math.floor(date.getTime() / 1000)}, nanoseconds=${(date.getTime() % 1000) * 1e6})`;
    }
  }
  return value;
};
export const formatFirestoreTimestamp = (value) => {
  if (value && typeof value === 'object' && ('seconds' in value || 'toDate' in value)) {
    const date = value.toDate ? value.toDate() : new Date(value.seconds * 1000);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  return value;
};
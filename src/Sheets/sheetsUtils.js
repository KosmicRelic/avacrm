// Utility functions for the Sheets component
// These functions are extracted to improve code organization and reusability

/**
 * Decodes sheet names from URL format (dashes to spaces) and ignores recordId if present
 * @param {string} name - The encoded sheet name from URL
 * @returns {string} - The decoded sheet name
 */
export function decodeSheetName(name) {
  if (!name) return '';
  return name.split('/')[0].replace(/-/g, ' ');
}

/**
 * Robustly converts various date formats to milliseconds
 * @param {any} dateValue - The date value to convert
 * @returns {number} - Milliseconds since epoch, or NaN if invalid
 */
export function toMillis(dateValue) {
  // Firestore Timestamp object
  if (
    dateValue &&
    typeof dateValue === 'object' &&
    typeof dateValue.seconds === 'number' &&
    typeof dateValue.nanoseconds === 'number'
  ) {
    return dateValue.seconds * 1000 + Math.floor(dateValue.nanoseconds / 1e6);
  }

  // Firestore Timestamp with toDate()
  if (dateValue && typeof dateValue.toDate === 'function') {
    return dateValue.toDate().getTime();
  }

  // JS Date object
  if (dateValue instanceof Date) {
    return dateValue.getTime();
  }

  // ISO string or date string
  if (typeof dateValue === 'string') {
    const parsed = Date.parse(dateValue);
    if (!isNaN(parsed)) return parsed;
  }

  // null/undefined/invalid
  return NaN;
}

/**
 * Determines if a sheet is the primary sheet
 * @param {Object} sheet - The sheet object
 * @returns {boolean} - True if it's the primary sheet
 */
export function isPrimarySheet(sheet) {
  return sheet?.id === 'primarySheet';
}

/**
 * Gets the loading state for a sheet
 * @param {string} sheetId - The sheet ID
 * @param {Object} sheetRecordsFetched - Object tracking fetched sheets
 * @returns {boolean} - True if the sheet is loading
 */
export function getSheetLoadingState(sheetId, sheetRecordsFetched) {
  return sheetId && !sheetRecordsFetched[sheetId];
}
// Utility functions for handling assigned users and enhanced history

/**
 * Get a display name for a user ID, with fallback to email or uid
 * @param {string} uid - User ID
 * @param {Object} user - Current user object
 * @param {Array} teamMembers - Array of team member objects
 * @returns {string} Display name
 */
export const getDisplayName = (uid, user, teamMembers = []) => {
  if (!uid) return 'Unknown User';
  
  // Check if it's the current user
  if (uid === user?.uid) {
    return user?.name && user?.surname 
      ? `${user.name} ${user.surname}` 
      : user?.email || 'Me';
  }
  
  // Check team members
  const member = teamMembers.find((tm) => tm.uid === uid);
  if (member) {
    return member.name && member.surname 
      ? `${member.name} ${member.surname}`.trim()
      : member.email || uid;
  }
  
  return uid;
};

/**
 * Format a history entry for display
 * @param {Object} historyEntry - History entry with field, value, timestamp, modifiedBy
 * @param {Object} user - Current user object
 * @param {Array} teamMembers - Array of team member objects
 * @returns {string} Formatted history string
 */
export const formatHistoryEntry = (historyEntry, user, teamMembers = []) => {
  const { field, value, timestamp, modifiedBy } = historyEntry;
  
  // Compute the display name from the modifiedBy UID
  const userName = getDisplayName(modifiedBy, user, teamMembers);
  
  // Format the timestamp
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp?._seconds * 1000);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Format the field name
  const fieldName = formatFieldName(field);
  
  // Format the value
  const valueStr = value || '(empty)';
  
  return `${dateStr} ${timeStr} - ${userName} set ${fieldName} to "${valueStr}"`;
};

/**
 * Format field names for display (same logic as in RecordsEditor)
 * @param {string} key - Field key
 * @returns {string} Formatted field name
 */
export const formatFieldName = (key) => {
  if (key === key.toUpperCase()) {
    return key
      .split(/[_-]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Get the full history timeline for a record with formatted entries
 * @param {Object} record - Record object with history array
 * @param {Object} user - Current user object
 * @param {Array} teamMembers - Array of team member objects
 * @returns {Array} Array of formatted history entries
 */
export const getFormattedHistory = (record, user, teamMembers = []) => {
  if (!record?.history || !Array.isArray(record.history)) {
    return [];
  }
  
  return record.history
    .map(entry => ({
      ...entry,
      formatted: formatHistoryEntry(entry, user, teamMembers),
      date: entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp?._seconds * 1000)
    }))
    .sort((a, b) => b.date - a.date); // Most recent first
};

/**
 * Get who created a record (first history entry)
 * @param {Object} record - Record object with history array
 * @param {Object} user - Current user object
 * @param {Array} teamMembers - Array of team member objects
 * @returns {Object} Creator info with name and timestamp
 */
export const getRecordCreator = (record, user, teamMembers = []) => {
  if (!record?.history || !Array.isArray(record.history) || record.history.length === 0) {
    return { name: 'Unknown', timestamp: null };
  }
  
  // Find the earliest history entry
  const oldestEntry = record.history.reduce((oldest, current) => {
    const currentTime = current.timestamp?._seconds || current.timestamp?.toDate?.()?.getTime?.() / 1000 || 0;
    const oldestTime = oldest.timestamp?._seconds || oldest.timestamp?.toDate?.()?.getTime?.() / 1000 || 0;
    return currentTime < oldestTime ? current : oldest;
  });
  
  return {
    name: getDisplayName(oldestEntry.modifiedBy, user, teamMembers),
    timestamp: oldestEntry.timestamp,
    uid: oldestEntry.modifiedBy
  };
};

/**
 * Get who last modified a record (most recent history entry)
 * @param {Object} record - Record object with history array
 * @param {Object} user - Current user object
 * @param {Array} teamMembers - Array of team member objects
 * @returns {Object} Last modifier info with name and timestamp
 */
export const getLastModifier = (record, user, teamMembers = []) => {
  if (!record?.history || !Array.isArray(record.history) || record.history.length === 0) {
    return { name: 'Unknown', timestamp: null };
  }
  
  // Find the most recent history entry
  const newestEntry = record.history.reduce((newest, current) => {
    const currentTime = current.timestamp?._seconds || current.timestamp?.toDate?.()?.getTime?.() / 1000 || 0;
    const newestTime = newest.timestamp?._seconds || newest.timestamp?.toDate?.()?.getTime?.() / 1000 || 0;
    return currentTime > newestTime ? current : newest;
  });
  
  return {
    name: getDisplayName(newestEntry.modifiedBy, user, teamMembers),
    timestamp: newestEntry.timestamp,
    uid: newestEntry.modifiedBy
  };
};

/**
 * Check if a user has permission to view/edit a record based on assignment
 * @param {Object} record - Record object
 * @param {string} userUid - Current user's UID
 * @param {string} businessId - Business ID
 * @returns {Object} Permission object with view and edit booleans
 */
export const getRecordPermissions = (record, userUid, businessId) => {
  const isBusinessOwner = userUid === businessId;
  const isAssigned = record.assignedTo === userUid;
  
  return {
    view: isBusinessOwner || isAssigned,
    edit: isBusinessOwner || isAssigned,
    delete: isBusinessOwner, // Only business owner can delete
    viewHistory: isBusinessOwner // Only business owner can view full history
  };
};

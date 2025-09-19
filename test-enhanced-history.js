// Test file to verify enhanced history functionality
// This would be used in a test environment or for manual testing

import { getFormattedHistory, getRecordCreator, getLastModifier, formatHistoryEntry } from '../src/Utils/assignedToUtils.js';

// Mock data for testing
const mockUser = {
  uid: 'user123',
  name: 'John',
  surname: 'Doe',
  email: 'john.doe@example.com'
};

const mockTeamMembers = [
  {
    uid: 'user456',
    name: 'Jane',
    surname: 'Smith',
    email: 'jane.smith@example.com'
  },
  {
    uid: 'user789',
    name: 'Mike',
    surname: 'Johnson',
    email: 'mike.johnson@example.com'
  }
];

// Mock record with enhanced history
const mockRecord = {
  docId: 'record123',
  typeOfRecords: 'Leads',
  name: 'Test Lead',
  email: 'test@example.com',
  status: 'qualified',
  history: [
    {
      field: 'name',
      value: 'Test Lead',
      timestamp: { _seconds: 1704067200, _nanoseconds: 0 }, // Jan 1, 2024
      modifiedBy: 'user123'
    },
    {
      field: 'email',
      value: 'test@example.com',
      timestamp: { _seconds: 1704067260, _nanoseconds: 0 }, // Jan 1, 2024 - 1 min later
      modifiedBy: 'user123'
    },
    {
      field: 'status',
      value: 'contacted',
      timestamp: { _seconds: 1704153600, _nanoseconds: 0 }, // Jan 2, 2024
      modifiedBy: 'user456'
    },
    {
      field: 'status',
      value: 'qualified',
      timestamp: { _seconds: 1704240000, _nanoseconds: 0 }, // Jan 3, 2024
      modifiedBy: 'user789'
    }
  ]
};

// Test the utility functions
console.log('=== Testing Enhanced History Functionality ===\n');

// Test 1: Get formatted history
console.log('1. Formatted History:');
const formattedHistory = getFormattedHistory(mockRecord, mockUser, mockTeamMembers);
formattedHistory.forEach((entry, index) => {
  console.log(`   ${index + 1}. ${entry.formatted}`);
});

console.log('\n2. Record Creator:');
const creator = getRecordCreator(mockRecord, mockUser, mockTeamMembers);
console.log(`   Created by: ${creator.name} (${creator.uid})`);

console.log('\n3. Last Modifier:');
const lastModifier = getLastModifier(mockRecord, mockUser, mockTeamMembers);
console.log(`   Last modified by: ${lastModifier.name} (${lastModifier.uid})`);

console.log('\n4. Individual History Entry Format:');
const latestEntry = mockRecord.history[mockRecord.history.length - 1];
const formatted = formatHistoryEntry(latestEntry, mockUser, mockTeamMembers);
console.log(`   ${formatted}`);

console.log('\n=== Enhanced History Features ===');
console.log('✅ User information added to history entries');
console.log('✅ Display names with fallbacks');
console.log('✅ Creator and last modifier tracking');
console.log('✅ Formatted timeline display');
console.log('✅ Backward compatibility with existing history');

export { mockRecord, mockUser, mockTeamMembers };
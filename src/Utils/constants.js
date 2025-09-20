/**
 * Application constants and configuration
 * Centralizes commonly used values to improve maintainability
 */

// API and Firebase Configuration
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBVs39nQSA-r-AMG-f-iQlDvvcwcrMegxY",
  authDomain: "avacrm-6900e.firebaseapp.com",
  projectId: "avacrm-6900e",
  storageBucket: "avacrm-6900e.firebasestorage.app",
  messagingSenderId: "813051412328",
  appId: "1:813051412328:web:50ae8a080ea9aaff6c20dd",
  measurementId: "G-CDVZT070VS",
};

// UI Constants
export const UI_CONSTANTS = {
  // Animation durations
  ANIMATION_DURATION: {
    FAST: 200,
    NORMAL: 300,
    SLOW: 500,
  },

  // Spacing
  SPACING: {
    XS: 4,
    SM: 8,
    MD: 16,
    LG: 24,
    XL: 32,
    XXL: 48,
  },

  // Breakpoints
  BREAKPOINTS: {
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1200,
  },

  // Z-index layers
  Z_INDEX: {
    MODAL: 1000,
    DROPDOWN: 100,
    TOOLTIP: 200,
    HEADER: 50,
  },

  // Colors (CSS custom properties)
  COLORS: {
    PRIMARY: '#0984e3',
    SECONDARY: '#6c5ce7',
    SUCCESS: '#00b894',
    WARNING: '#fdcb6e',
    ERROR: '#d63031',
    INFO: '#74b9ff',
  },
};

// Performance Constants
export const PERFORMANCE_CONSTANTS = {
  // Debounce delays
  DEBOUNCE_DELAY: {
    SEARCH: 300,
    RESIZE: 150,
    SCROLL: 100,
  },

  // Cache durations
  CACHE_DURATION: {
    SHORT: 5 * 60 * 1000,    // 5 minutes
    MEDIUM: 30 * 60 * 1000,  // 30 minutes
    LONG: 2 * 60 * 60 * 1000, // 2 hours
  },

  // Loading states
  LOADING_STATES: {
    IDLE: 'idle',
    LOADING: 'loading',
    SUCCESS: 'success',
    ERROR: 'error',
  },
};

// Route Constants
export const ROUTES = {
  HOME: '/',
  SHEETS: '/sheets',
  DASHBOARD: '/dashboard',
  METRICS: '/metrics',
  ACTIONS: '/actions',
  SETTINGS: '/settings',
  SIGNIN: '/signin',
  SIGNUP_BUSINESS: '/signup/business',
};

// Sheet Constants
export const SHEET_CONSTANTS = {
  // Record types
  RECORD_TYPES: {
    CONTACT: 'contact',
    COMPANY: 'company',
    DEAL: 'deal',
    TASK: 'task',
  },

  // Field types
  FIELD_TYPES: {
    TEXT: 'text',
    NUMBER: 'number',
    DATE: 'date',
    DROPDOWN: 'dropdown',
    EMAIL: 'email',
    PHONE: 'phone',
    URL: 'url',
  },

  // Filter operations
  FILTER_OPERATIONS: {
    EQUALS: 'equals',
    CONTAINS: 'contains',
    GREATER: 'greater',
    LESS: 'less',
    BETWEEN: 'between',
  },

  // Sort directions
  SORT_DIRECTIONS: {
    ASCENDING: 'ascending',
    DESCENDING: 'descending',
  },
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  AUTHENTICATION_ERROR: 'Authentication failed. Please sign in again.',
  PERMISSION_ERROR: 'You do not have permission to perform this action.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  GENERIC_ERROR: 'An unexpected error occurred. Please try again later.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  SAVE_SUCCESS: 'Changes saved successfully.',
  DELETE_SUCCESS: 'Item deleted successfully.',
  CREATE_SUCCESS: 'Item created successfully.',
  UPDATE_SUCCESS: 'Item updated successfully.',
};

// Local Storage Keys
export const STORAGE_KEYS = {
  THEME: 'theme',
  USER_PREFERENCES: 'userPreferences',
  RECENT_SHEETS: 'recentSheets',
  FILTER_PREFERENCES: 'filterPreferences',
};

// API Constants
export const API_CONSTANTS = {
  // Request timeouts
  TIMEOUT: {
    SHORT: 5000,    // 5 seconds
    MEDIUM: 10000,  // 10 seconds
    LONG: 30000,    // 30 seconds
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY: 1000, // 1 second
    MAX_DELAY: 10000, // 10 seconds
  },
};

// Validation Constants
export const VALIDATION_CONSTANTS = {
  // Field length limits
  LENGTH: {
    NAME_MIN: 1,
    NAME_MAX: 100,
    EMAIL_MAX: 254,
    PHONE_MAX: 20,
    URL_MAX: 2000,
  },

  // Patterns
  PATTERNS: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^\+?[\d\s\-\(\)]+$/,
    URL: /^https?:\/\/.+/,
  },
};

// Feature Flags (for gradual rollouts)
export const FEATURE_FLAGS = {
  ENABLE_VIRTUAL_SCROLLING: true,
  ENABLE_ADVANCED_FILTERS: true,
  ENABLE_BULK_OPERATIONS: false,
  ENABLE_REAL_TIME_COLLABORATION: false,
};
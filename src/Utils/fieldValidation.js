/**
 * Field validation utilities for different field types
 */

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Phone validation regex (supports international formats)
 */
const PHONE_REGEX = /^[+]?[1-9][\d]{0,15}$/;

/**
 * Common country codes for phone number formatting
 */
export const COUNTRY_CODES = [
  { code: '+1', country: 'US', name: 'United States' },
  { code: '+1', country: 'CA', name: 'Canada' },
  { code: '+44', country: 'GB', name: 'United Kingdom' },
  { code: '+49', country: 'DE', name: 'Germany' },
  { code: '+33', country: 'FR', name: 'France' },
  { code: '+39', country: 'IT', name: 'Italy' },
  { code: '+34', country: 'ES', name: 'Spain' },
  { code: '+31', country: 'NL', name: 'Netherlands' },
  { code: '+46', country: 'SE', name: 'Sweden' },
  { code: '+47', country: 'NO', name: 'Norway' },
  { code: '+45', country: 'DK', name: 'Denmark' },
  { code: '+41', country: 'CH', name: 'Switzerland' },
  { code: '+43', country: 'AT', name: 'Austria' },
  { code: '+32', country: 'BE', name: 'Belgium' },
  { code: '+48', country: 'PL', name: 'Poland' },
  { code: '+420', country: 'CZ', name: 'Czech Republic' },
  { code: '+36', country: 'HU', name: 'Hungary' },
  { code: '+30', country: 'GR', name: 'Greece' },
  { code: '+351', country: 'PT', name: 'Portugal' },
  { code: '+353', country: 'IE', name: 'Ireland' },
  { code: '+61', country: 'AU', name: 'Australia' },
  { code: '+64', country: 'NZ', name: 'New Zealand' },
  { code: '+81', country: 'JP', name: 'Japan' },
  { code: '+82', country: 'KR', name: 'South Korea' },
  { code: '+86', country: 'CN', name: 'China' },
  { code: '+91', country: 'IN', name: 'India' },
  { code: '+7', country: 'RU', name: 'Russia' },
  { code: '+55', country: 'BR', name: 'Brazil' },
  { code: '+52', country: 'MX', name: 'Mexico' },
  { code: '+54', country: 'AR', name: 'Argentina' },
  { code: '+56', country: 'CL', name: 'Chile' },
  { code: '+57', country: 'CO', name: 'Colombia' },
  { code: '+58', country: 'VE', name: 'Venezuela' },
  { code: '+598', country: 'UY', name: 'Uruguay' },
  { code: '+27', country: 'ZA', name: 'South Africa' },
  { code: '+20', country: 'EG', name: 'Egypt' },
  { code: '+971', country: 'AE', name: 'UAE' },
  { code: '+966', country: 'SA', name: 'Saudi Arabia' },
  { code: '+90', country: 'TR', name: 'Turkey' },
  { code: '+972', country: 'IL', name: 'Israel' },
];

// Global variable to store custom country codes
let customCountryCodes = [];

/**
 * Set custom country codes (called from settings)
 */
export const setCustomCountryCodes = (codes) => {
  customCountryCodes = codes || [];
};

/**
 * Get all available country codes (built-in + custom)
 */
export const getAllCountryCodes = () => {
  return [...COUNTRY_CODES, ...customCountryCodes];
};

/**
 * Validates an email address
 * @param {string} email - The email to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
};

/**
 * Validates a phone number
 * @param {string} phone - The phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-(.)]/g, '');
  return PHONE_REGEX.test(cleaned);
};

/**
 * Validates a currency value
 * @param {string|number} value - The currency value to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const validateCurrency = (value) => {
  if (value === '' || value === null || value === undefined) return true; // Allow empty
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0;
};

/**
 * Validates a number field
 * @param {string|number} value - The number to validate
 * @param {object} options - Validation options (min, max, etc.)
 * @returns {boolean} - True if valid, false otherwise
 */
export const validateNumber = (value, options = {}) => {
  if (value === '' || value === null || value === undefined) return true; // Allow empty
  const num = parseFloat(value);
  if (isNaN(num)) return false;

  if (options.min !== undefined && num < options.min) return false;
  if (options.max !== undefined && num > options.max) return false;

  return true;
};

/**
 * Validates a field based on its type
 * @param {string} fieldType - The field type
 * @param {any} value - The value to validate
 * @param {object} options - Additional validation options
 * @returns {object} - { isValid: boolean, error?: string }
 */
export const validateField = (fieldType, value, options = {}) => {
  switch (fieldType) {
    case 'email': {
      const isValidEmail = validateEmail(value);
      return {
        isValid: isValidEmail,
        error: isValidEmail ? null : 'Please enter a valid email address'
      };
    }

    case 'phone': {
      const isValidPhone = validatePhone(value);
      return {
        isValid: isValidPhone,
        error: isValidPhone ? null : 'Please enter a valid phone number'
      };
    }

    case 'currency': {
      const isValidCurrency = validateCurrency(value);
      return {
        isValid: isValidCurrency,
        error: isValidCurrency ? null : 'Please enter a valid currency amount'
      };
    }

    case 'number': {
      const isValidNumber = validateNumber(value, options);
      return {
        isValid: isValidNumber,
        error: isValidNumber ? null : `Please enter a valid number${options.min !== undefined ? ` (min: ${options.min})` : ''}${options.max !== undefined ? ` (max: ${options.max})` : ''}`
      };
    }

    case 'date': {
      if (!value) return { isValid: true };
      const date = new Date(value);
      const isValidDate = !isNaN(date.getTime());
      return {
        isValid: isValidDate,
        error: isValidDate ? null : 'Please enter a valid date'
      };
    }

    default:
      return { isValid: true };
  }
};

/**
 * Formats a currency value for display
 * @param {number} value - The numeric value
 * @param {string} currency - The currency code (default: USD)
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (value, currency = 'USD') => {
  if (value === null || value === undefined || value === '') return '';

  const num = parseFloat(value);
  if (isNaN(num)) return value.toString();

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(num);
};

/**
 * Formats a phone number for display
 * @param {string} phone - The phone number
 * @returns {string} - Formatted phone string
 */
export const formatPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return phone || '';

  // Parse country code and phone number
  let countryCode = '';
  let phoneNumber = '';

  if (phone.startsWith('+')) {
    // Has country code
    const parts = phone.split(' ');
    if (parts.length >= 2) {
      countryCode = parts[0]; // e.g., "+30"
      phoneNumber = parts.slice(1).join(''); // e.g., "2101234567"
    } else {
      return phone; // Malformed, return as-is
    }
  } else {
    // No country code, treat as local number
    phoneNumber = phone.replace(/\D/g, '');
  }

  // Format based on country code
  switch (countryCode) {
    case '+30': // Greece
      return formatGreekPhone(phoneNumber);

    case '+1': // US/Canada
      return formatUSPhone(phoneNumber);

    case '+44': // UK
      return formatUKPhone(phoneNumber);

    case '+49': // Germany
      return formatGermanPhone(phoneNumber);

    case '+33': // France
      return formatFrenchPhone(phoneNumber);

    case '+39': // Italy
      return formatItalianPhone(phoneNumber);

    case '+34': // Spain
      return formatSpanishPhone(phoneNumber);

    case '+31': // Netherlands
      return formatDutchPhone(phoneNumber);

    case '+46': // Sweden
      return formatSwedishPhone(phoneNumber);

    case '+47': // Norway
      return formatNorwegianPhone(phoneNumber);

    case '+45': // Denmark
      return formatDanishPhone(phoneNumber);

    case '+41': // Switzerland
      return formatSwissPhone(phoneNumber);

    case '+43': // Austria
      return formatAustrianPhone(phoneNumber);

    case '+32': // Belgium
      return formatBelgianPhone(phoneNumber);

    case '+48': // Poland
      return formatPolishPhone(phoneNumber);

    case '+420': // Czech Republic
      return formatCzechPhone(phoneNumber);

    case '+36': // Hungary
      return formatHungarianPhone(phoneNumber);

    case '+30': // Greece (already handled above)
      return formatGreekPhone(phoneNumber);

    case '+351': // Portugal
      return formatPortuguesePhone(phoneNumber);

    case '+353': // Ireland
      return formatIrishPhone(phoneNumber);

    case '+61': // Australia
      return formatAustralianPhone(phoneNumber);

    case '+64': // New Zealand
      return formatNewZealandPhone(phoneNumber);

    case '+81': // Japan
      return formatJapanesePhone(phoneNumber);

    case '+82': // South Korea
      return formatKoreanPhone(phoneNumber);

    case '+86': // China
      return formatChinesePhone(phoneNumber);

    case '+91': // India
      return formatIndianPhone(phoneNumber);

    case '+7': // Russia
      return formatRussianPhone(phoneNumber);

    case '+55': // Brazil
      return formatBrazilianPhone(phoneNumber);

    case '+52': // Mexico
      return formatMexicanPhone(phoneNumber);

    case '+54': // Argentina
      return formatArgentinianPhone(phoneNumber);

    case '+56': // Chile
      return formatChileanPhone(phoneNumber);

    case '+57': // Colombia
      return formatColombianPhone(phoneNumber);

    default:
      // For unknown country codes, return with country code
      if (countryCode) {
        return `${countryCode} ${phoneNumber}`;
      }
      // For numbers without country code, try US formatting
      return formatUSPhone(phoneNumber);
  }
};

// Country-specific formatting functions
const formatGreekPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    if (cleaned.startsWith('69')) {
      // Mobile: 69x xxx xxxx
      return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
    } else if (cleaned.startsWith('2')) {
      // Landline: 2xx xxx xxxx
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
  }
  return phone;
};

const formatUSPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const number = cleaned.slice(1);
    return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
  }
  return phone;
};

const formatUKPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('7')) {
    // Mobile: 07xxx xxx xxx
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    // Landline: 0xx xxx xxxx
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

const formatGermanPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 10) {
    // German numbers: xxx xxxx xxx or similar
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    } else if (cleaned.length === 11) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
  }
  return phone;
};

const formatFrenchPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    // French: 0x xx xx xx xx
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
};

const formatItalianPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('3')) {
    // Mobile: 3xx xxx xxxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  if (cleaned.length >= 9) {
    // Landline: 0xx xxx xxxx or similar
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

const formatSpanishPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 9) {
    // Spanish: xxx xxx xxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

const formatDutchPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('6')) {
    // Mobile: 06 xxxx xxxx
    return `06 ${cleaned.slice(1, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length >= 9) {
    // Landline: 0xx xxx xxxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

const formatSwedishPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('7')) {
    // Mobile: 07x xxx xx xx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
};

const formatNorwegianPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 8) {
    // Norwegian: xxx xx xxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
};

const formatDanishPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 8) {
    // Danish: xx xx xx xx
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

const formatSwissPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('7')) {
    // Mobile: 07x xxx xx xx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
};

const formatAustrianPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 10) {
    // Austrian: 0xx xxx xxxx or similar
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

const formatBelgianPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 9 && cleaned.startsWith('4')) {
    // Mobile: 04xx xx xx xx
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
};

const formatPolishPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 9) {
    // Polish: xxx xxx xxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

const formatCzechPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 9) {
    // Czech: xxx xxx xxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

const formatHungarianPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 9 && cleaned.startsWith('20')) {
    // Mobile: 20 xxx xxxx
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
};

const formatPortuguesePhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 9) {
    // Portuguese: xxx xxx xxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

const formatIrishPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('8')) {
    // Mobile: 08x xxx xxxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

const formatAustralianPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('4')) {
    // Mobile: 04xx xxx xxx
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

const formatNewZealandPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('2')) {
    // Mobile: 02x xxx xxxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

const formatJapanesePhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('090')) {
    // Mobile: 090 xxxx xxxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

const formatKoreanPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('010')) {
    // Mobile: 010 xxxx xxxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

const formatChinesePhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // Mobile: 1xx xxxx xxxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

const formatIndianPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    // Indian: xxxx xxx xxx
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

const formatRussianPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    // Russian: xxx xxx xx xx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
};

const formatBrazilianPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('9')) {
    // Mobile: 9 xxxx xxxxx
    return `${cleaned.slice(0, 1)} ${cleaned.slice(1, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
};

const formatMexicanPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    // Mexican: xxx xxx xxxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

const formatArgentinianPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    // Argentinian: xxx xxx xxxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

const formatChileanPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('9')) {
    // Mobile: 9 xxxx xxxx
    return `${cleaned.slice(0, 1)} ${cleaned.slice(1, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
};

const formatColombianPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    // Colombian: xxx xxx xxxx
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};
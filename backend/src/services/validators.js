/**
 * @fileoverview Validation utilities for Indian statutory identifiers.
 * Includes Verhoeff algorithm for Aadhaar checksum validation.
 */

// Verhoeff Algorithm Tables
const dTable = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const pTable = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

/**
 * Validates string using Verhoeff checksum.
 * @param {string} str 
 * @returns {boolean}
 */
const validateVerhoeff = (str) => {
  let c = 0;
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const char = str.charAt(len - 1 - i);
    const num = parseInt(char, 10);
    if (isNaN(num)) return false;
    c = dTable[c][pTable[i % 8][num]];
  }
  return c === 0;
};

/**
 * Validate Permanent Account Number (PAN)
 * Format: 5 Alphabets, 4 Digits, 1 Alphabet (e.g. ABCDE1234F)
 * @param {string} pan 
 * @returns {boolean}
 */
const validatePAN = (pan) => {
  if (!pan) return false;
  const regex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  return regex.test(pan.toUpperCase());
};

/**
 * Validate Indian Financial System Code (IFSC)
 * Format: 4 Alphabets, 0, 6 Alphanumeric/Digits (e.g. SBIN0001234)
 * @param {string} ifsc 
 * @returns {boolean}
 */
const validateIFSC = (ifsc) => {
  if (!ifsc) return false;
  const regex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return regex.test(ifsc.toUpperCase());
};

/**
 * Validate Aadhaar Card Number (12 Digits with Verhoeff checksum)
 * @param {string} aadhaar 
 * @returns {boolean}
 */
const validateAadhaar = (aadhaar) => {
  if (!aadhaar) return false;
  const cleanAadhaar = aadhaar.replace(/\s/g, '');
  if (cleanAadhaar.length !== 12) return false;
  if (!/^\d{12}$/.test(cleanAadhaar)) return false;
  // Aadhaar cannot start with 0 or 1
  if (cleanAadhaar.charAt(0) === '0' || cleanAadhaar.charAt(0) === '1') return false;
  return validateVerhoeff(cleanAadhaar);
};

/**
 * Validate Universal Account Number (UAN) (12 Digits)
 * @param {string} uan 
 * @returns {boolean}
 */
const validateUAN = (uan) => {
  if (!uan) return false;
  return /^\d{12}$/.test(uan) && uan.charAt(0) !== '0';
};

/**
 * Validate Permanent Retirement Account Number (PRAN) (12 Digits)
 * @param {string} pran 
 * @returns {boolean}
 */
const validatePRAN = (pran) => {
  if (!pran) return false;
  return /^\d{12}$/.test(pran);
};

/**
 * Validate Bank Account Number (length between 9 and 18 digits)
 * @param {string} account 
 * @returns {boolean}
 */
const validateBankAccount = (account) => {
  if (!account) return false;
  return /^\d{9,18}$/.test(account);
};

/**
 * Validate strong password
 * Rules: min 12 chars, upper, lower, digit, special character
 * @param {string} password 
 * @returns {boolean}
 */
const validatePassword = (password) => {
  if (!password || password.length < 12) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
};

module.exports = {
  validatePAN,
  validateIFSC,
  validateAadhaar,
  validateUAN,
  validatePRAN,
  validateBankAccount,
  validatePassword
};

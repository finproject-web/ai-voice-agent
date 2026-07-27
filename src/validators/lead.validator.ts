import { body } from 'express-validator';

export const createLeadValidator = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  body('company')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Company name must not exceed 100 characters'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title must not exceed 100 characters'),
  body('industry')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Industry must not exceed 50 characters'),
  body('source')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Source must not exceed 50 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('assignedToId')
    .optional()
    .isUUID()
    .withMessage('Invalid assigned user ID'),
];

export const updateLeadValidator = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  body('status')
    .optional()
    .isIn(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST', 'DO_NOT_CONTACT'])
    .withMessage('Invalid status value'),
  body('assignedToId')
    .optional()
    .isUUID()
    .withMessage('Invalid assigned user ID'),
];

export const bulkImportValidator = [
  body('leads')
    .isArray({ min: 1 })
    .withMessage('Leads must be a non-empty array'),
  body('leads.*.firstName')
    .notEmpty()
    .withMessage('First name is required for each lead'),
  body('leads.*.lastName')
    .notEmpty()
    .withMessage('Last name is required for each lead'),
  body('leads.*.phone')
    .notEmpty()
    .withMessage('Phone number is required for each lead'),
];

import { body } from 'express-validator';

export const createCampaignValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Campaign name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Campaign name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('type')
    .optional()
    .isIn(['OUTBOUND', 'INBOUND', 'BLENDED'])
    .withMessage('Invalid campaign type'),
  body('voiceAgentId')
    .optional()
    .isString()
    .withMessage('Invalid voice agent ID'),
  body('priority')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Priority must be between 0 and 100'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
];

export const updateCampaignValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Campaign name must be between 3 and 100 characters'),
  body('status')
    .optional()
    .isIn(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'])
    .withMessage('Invalid campaign status'),
  body('type')
    .optional()
    .isIn(['OUTBOUND', 'INBOUND', 'BLENDED'])
    .withMessage('Invalid campaign type'),
  body('priority')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Priority must be between 0 and 100'),
];

export const addLeadsValidator = [
  body('leadIds')
    .isArray({ min: 1 })
    .withMessage('Lead IDs must be a non-empty array'),
  body('leadIds.*')
    .isUUID()
    .withMessage('Invalid lead ID format'),
];

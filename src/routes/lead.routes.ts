import { Router } from 'express';
import { LeadController } from '../controllers/lead.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  createLeadValidator,
  updateLeadValidator,
  bulkImportValidator,
} from '../validators/lead.validator';

const router = Router();

/**
 * @route   POST /api/v1/leads
 * @desc    Create a new lead
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'AGENT'),
  validate(createLeadValidator),
  LeadController.createLead
);

/**
 * @route   GET /api/v1/leads
 * @desc    Get all leads for tenant
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'AGENT', 'VIEWER'),
  LeadController.getLeads
);

/**
 * @route   GET /api/v1/leads/:id
 * @desc    Get lead by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'AGENT', 'VIEWER'),
  LeadController.getLeadById
);

/**
 * @route   PUT /api/v1/leads/:id
 * @desc    Update lead
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'AGENT'),
  validate(updateLeadValidator),
  LeadController.updateLead
);

/**
 * @route   DELETE /api/v1/leads/:id
 * @desc    Delete lead
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  LeadController.deleteLead
);

/**
 * @route   POST /api/v1/leads/bulk-import
 * @desc    Bulk import leads
 * @access  Private
 */
router.post(
  '/bulk-import',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validate(bulkImportValidator),
  LeadController.bulkImportLeads
);

export default router;

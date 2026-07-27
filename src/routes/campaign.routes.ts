import { Router } from 'express';
import { CampaignController } from '../controllers/campaign.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  createCampaignValidator,
  updateCampaignValidator,
  addLeadsValidator,
} from '../validators/campaign.validator';

const router = Router();

/**
 * @route   POST /api/v1/campaigns
 * @desc    Create a new campaign
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validate(createCampaignValidator),
  CampaignController.createCampaign
);

/**
 * @route   GET /api/v1/campaigns
 * @desc    Get all campaigns for tenant
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'AGENT', 'VIEWER'),
  CampaignController.getCampaigns
);

/**
 * @route   GET /api/v1/campaigns/:id
 * @desc    Get campaign by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'AGENT', 'VIEWER'),
  CampaignController.getCampaignById
);

/**
 * @route   PUT /api/v1/campaigns/:id
 * @desc    Update campaign
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validate(updateCampaignValidator),
  CampaignController.updateCampaign
);

/**
 * @route   DELETE /api/v1/campaigns/:id
 * @desc    Delete campaign
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  CampaignController.deleteCampaign
);

/**
 * @route   POST /api/v1/campaigns/:id/leads
 * @desc    Add leads to campaign
 * @access  Private
 */
router.post(
  '/:id/leads',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validate(addLeadsValidator),
  CampaignController.addLeadsToCampaign
);

/**
 * @route   DELETE /api/v1/campaigns/:id/leads/:leadId
 * @desc    Remove lead from campaign
 * @access  Private
 */
router.delete(
  '/:id/leads/:leadId',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  CampaignController.removeLeadFromCampaign
);

export default router;

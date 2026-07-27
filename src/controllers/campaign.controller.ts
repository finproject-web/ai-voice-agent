import { Request, Response, NextFunction } from 'express';
import { CampaignService } from '../services/campaign.service';
import { AppError } from '../middleware/error';

export class CampaignController {
  static async createCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const createdById = req.user?.userId!;
      const campaignData = req.body;

      const campaign = await CampaignService.createCampaign({
        ...campaignData,
        tenantId,
        createdById,
      });

      res.status(201).json({
        success: true,
        data: campaign,
        message: 'Campaign created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const filters = {
        status: req.query.status as string,
        type: req.query.type as string,
        createdById: req.query.createdById as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      };

      const result = await CampaignService.getCampaigns(tenantId, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCampaignById(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;

      const campaign = await CampaignService.getCampaignById(id, tenantId);

      res.status(200).json({
        success: true,
        data: campaign,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;
      const updateData = req.body;

      const campaign = await CampaignService.updateCampaign(id, tenantId, updateData);

      res.status(200).json({
        success: true,
        data: campaign,
        message: 'Campaign updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;

      await CampaignService.deleteCampaign(id, tenantId);

      res.status(200).json({
        success: true,
        message: 'Campaign deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async addLeadsToCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;
      const { leadIds } = req.body;

      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        throw new AppError('Lead IDs array is required', 400);
      }

      const result = await CampaignService.addLeadsToCampaign(id, tenantId, leadIds);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Leads added to campaign successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeLeadFromCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { id, leadId } = req.params;

      await CampaignService.removeLeadFromCampaign(id, tenantId, leadId);

      res.status(200).json({
        success: true,
        message: 'Lead removed from campaign successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

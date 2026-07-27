import { Request, Response, NextFunction } from 'express';
import { LeadService } from '../services/lead.service';
import { AppError } from '../middleware/error';

export class LeadController {
  static async createLead(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const leadData = req.body;

      const lead = await LeadService.createLead({
        ...leadData,
        tenantId,
      });

      res.status(201).json({
        success: true,
        data: lead,
        message: 'Lead created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const filters = {
        status: req.query.status as string,
        source: req.query.source as string,
        assignedToId: req.query.assignedToId as string,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      };

      const result = await LeadService.getLeads(tenantId, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLeadById(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;

      const lead = await LeadService.getLeadById(id, tenantId);

      res.status(200).json({
        success: true,
        data: lead,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateLead(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;
      const updateData = req.body;

      const lead = await LeadService.updateLead(id, tenantId, updateData);

      res.status(200).json({
        success: true,
        data: lead,
        message: 'Lead updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteLead(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;

      await LeadService.deleteLead(id, tenantId);

      res.status(200).json({
        success: true,
        message: 'Lead deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkImportLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { leads } = req.body;

      if (!Array.isArray(leads) || leads.length === 0) {
        throw new AppError('Leads array is required', 400);
      }

      const result = await LeadService.bulkImportLeads(tenantId, leads);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Bulk import completed',
      });
    } catch (error) {
      next(error);
    }
  }
}

import { google } from 'googleapis';
import logger from '../../config/logger';
import config from '../../config';
import fs from 'fs';
import path from 'path';

interface LeadData {
  name?: string;
  email?: string;
  phone?: string;
  loanAmount?: string;
  status?: string;
  notes?: string;
  applicationUrl?: string;
}

interface SheetRow {
  [key: string]: string | number;
}

export class GoogleSheetsService {
  private sheets: any;
  private spreadsheetId: string;
  private initialized: boolean = false;
  private tempKeyFile: string | null = null;

  constructor() {
    this.spreadsheetId = config.googleSheetId;
  }

  async cleanup(): Promise<void> {
    if (this.tempKeyFile && require('fs').existsSync(this.tempKeyFile)) {
      try {
        require('fs').unlinkSync(this.tempKeyFile);
        logger.info('Temporary service account file cleaned up');
      } catch (e) {
        logger.warn('Failed to clean up temporary service account file', { error: e });
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
      
      // Write credentials to a temporary file
      this.tempKeyFile = path.join(process.cwd(), 'temp-service-account.json');
      fs.writeFileSync(this.tempKeyFile, JSON.stringify(credentials, null, 2));
      
      const auth = new google.auth.JWT({
        keyFile: this.tempKeyFile,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      
      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;
      logger.info('Google Sheets service initialized');
    } catch (error) {
      logger.error('Failed to initialize Google Sheets service', { error });
      throw error;
    }
  }

  async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async readLeads(): Promise<SheetRow[]> {
    await this.ensureInitialized();

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A:Z',
      });

      const rows = response.data.values || [];
      const headers = rows[0] || [];

      logger.info('=== GOOGLE SHEETS HEADERS ===', { headers });

      const leads = rows.slice(1).map((row: any) => {
        const lead: SheetRow = {};
        headers.forEach((header: string, index: number) => {
          lead[header] = row[index] || '';
        });
        return lead;
      });

      logger.info(`Read ${leads.length} leads from Google Sheets`);
      if (leads.length > 0) {
        logger.info('=== FIRST LEAD DATA ===', { firstLead: leads[0] });
      }
      return leads;
    } catch (error) {
      logger.error('Failed to read leads from Google Sheets', { error });
      throw error;
    }
  }

  async getNextUnprocessedLead(): Promise<SheetRow | null> {
    await this.ensureInitialized();

    try {
      const leads = await this.readLeads();
      
      // Find first lead where processed is not 'yes' or empty
      const nextLead = leads.find((lead) => {
        const processed = String(lead.processed || '').toLowerCase();
        return processed !== 'yes' && processed !== 'true';
      });

      if (nextLead) {
        // Format phone number to E.164
        const phone = String(nextLead.phone || '');
        const formattedPhone = this.formatToE164(phone);
        
        logger.info('=== GOOGLE SHEETS: LEAD FETCHED ===', {
          name: nextLead.name,
          phone: formattedPhone,
          email: nextLead.email,
          status: nextLead.status,
          processed: nextLead.processed
        });
        
        // Return lead with formatted phone and original phone for ID
        return { 
          ...nextLead, 
          phone: formattedPhone,
          originalPhone: phone  // Store original phone for ID generation
        };
      } else {
        logger.info('=== GOOGLE SHEETS: NO UNPROCESSED LEADS FOUND ===');
      }

      return nextLead || null;
    } catch (error) {
      logger.error('Failed to get next unprocessed lead', { error });
      throw error;
    }
  }

  private formatToE164(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // If it's a 10-digit US number, add +1 prefix
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    // If it already has country code (11 digits), add + prefix
    if (cleaned.length === 11) {
      return `+${cleaned}`;
    }
    
    // If it already has + prefix, return as is
    if (phone.startsWith('+')) {
      return phone;
    }
    
    // Otherwise return cleaned with + prefix
    return `+${cleaned}`;
  }

  async updateCallStatus(phone: string, callStatus: string, processed: string = 'yes'): Promise<void> {
    await this.ensureInitialized();

    try {
      const leads = await this.readLeads();
      const rowIndex = leads.findIndex((lead) => lead.phone === phone);

      if (rowIndex === -1) {
        logger.warn(`Lead not found for phone: ${phone}`);
        return;
      }

      const headers = Object.keys(leads[0] || {});
      const callStatusIndex = headers.indexOf('call_status');
      const processedIndex = headers.indexOf('processed');

      if (callStatusIndex === -1) {
        logger.warn('call_status column not found');
      } else {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `Sheet1!${this.columnToLetter(callStatusIndex)}${rowIndex + 2}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[callStatus]],
          },
        });
        logger.info(`Updated call_status to ${callStatus} for phone ${phone}`);
      }

      if (processedIndex === -1) {
        logger.warn('processed column not found');
      } else {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `Sheet1!${this.columnToLetter(processedIndex)}${rowIndex + 2}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[processed]],
          },
        });
        logger.info(`Updated processed to ${processed} for phone ${phone}`);
      }

    } catch (error) {
      logger.error('Failed to update call status', { error });
      throw error;
    }
  }

  async findLeadByEmail(email: string): Promise<SheetRow | null> {
    const leads = await this.readLeads();
    return leads.find((lead) => lead.email === email) || null;
  }

  async findLeadByPhone(phone: string): Promise<SheetRow | null> {
    const leads = await this.readLeads();
    return leads.find((lead) => lead.phone === phone) || null;
  }

  async updateLeadStatus(email: string, status: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const leads = await this.readLeads();
      const rowIndex = leads.findIndex((lead) => lead.email === email);

      if (rowIndex === -1) {
        logger.warn(`Lead not found for email: ${email}`);
        return;
      }

      const statusColumnIndex = this.getColumnIndex(leads, 'status');
      if (statusColumnIndex === -1) {
        logger.warn('Status column not found');
        return;
      }

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Sheet1!${this.columnToLetter(statusColumnIndex)}${rowIndex + 2}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[status]],
        },
      });

      logger.info(`Updated lead status for ${email} to ${status}`);
    } catch (error) {
      logger.error('Failed to update lead status', { error });
      throw error;
    }
  }

  async saveLoanAmount(email: string, loanAmount: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const leads = await this.readLeads();
      const rowIndex = leads.findIndex((lead) => lead.email === email);

      if (rowIndex === -1) {
        logger.warn(`Lead not found for email: ${email}`);
        return;
      }

      const amountColumnIndex = this.getColumnIndex(leads, 'loanAmount');
      if (amountColumnIndex === -1) {
        logger.warn('Loan amount column not found');
        return;
      }

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Sheet1!${this.columnToLetter(amountColumnIndex)}${rowIndex + 2}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[loanAmount]],
        },
      });

      logger.info(`Saved loan amount ${loanAmount} for ${email}`);
    } catch (error) {
      logger.error('Failed to save loan amount', { error });
      throw error;
    }
  }

  async saveEmail(email: string, newEmail: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const leads = await this.readLeads();
      const rowIndex = leads.findIndex((lead) => lead.email === email);

      if (rowIndex === -1) {
        logger.warn(`Lead not found for email: ${email}`);
        return;
      }

      const emailColumnIndex = this.getColumnIndex(leads, 'email');
      if (emailColumnIndex === -1) {
        logger.warn('Email column not found');
        return;
      }

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Sheet1!${this.columnToLetter(emailColumnIndex)}${rowIndex + 2}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[newEmail]],
        },
      });

      logger.info(`Updated email from ${email} to ${newEmail}`);
    } catch (error) {
      logger.error('Failed to save email', { error });
      throw error;
    }
  }

  async saveNotes(email: string, notes: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const leads = await this.readLeads();
      const rowIndex = leads.findIndex((lead) => lead.email === email);

      if (rowIndex === -1) {
        logger.warn(`Lead not found for email: ${email}`);
        return;
      }

      const notesColumnIndex = this.getColumnIndex(leads, 'notes');
      if (notesColumnIndex === -1) {
        logger.warn('Notes column not found');
        return;
      }

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Sheet1!${this.columnToLetter(notesColumnIndex)}${rowIndex + 2}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[notes]],
        },
      });

      logger.info(`Saved notes for ${email}`);
    } catch (error) {
      logger.error('Failed to save notes', { error });
      throw error;
    }
  }

  async createLead(leadData: LeadData): Promise<void> {
    await this.ensureInitialized();

    try {
      const leads = await this.readLeads();
      const headers = Object.keys(leads[0] || {});

      const row = headers.map((header) => leadData[header as keyof LeadData] || '');

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A:Z',
        valueInputOption: 'RAW',
        resource: {
          values: [row],
        },
      });

      logger.info(`Created new lead for ${leadData.email}`);
    } catch (error) {
      logger.error('Failed to create lead', { error });
      throw error;
    }
  }

  async updateLead(email: string, leadData: Partial<LeadData>): Promise<void> {
    await this.ensureInitialized();

    try {
      const leads = await this.readLeads();
      const rowIndex = leads.findIndex((lead) => lead.email === email);

      if (rowIndex === -1) {
        logger.warn(`Lead not found for email: ${email}`);
        return;
      }

      const headers = Object.keys(leads[0] || {});
      const updates = Object.entries(leadData);

      for (const [key, value] of updates) {
        const columnIndex = headers.indexOf(key);
        if (columnIndex === -1) continue;

        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `Sheet1!${this.columnToLetter(columnIndex)}${rowIndex + 2}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[value]],
          },
        });
      }

      logger.info(`Updated lead for ${email}`);
    } catch (error) {
      logger.error('Failed to update lead', { error });
      throw error;
    }
  }

  private getColumnIndex(leads: SheetRow[], columnName: string): number {
    if (leads.length === 0) return -1;
    const headers = Object.keys(leads[0]);
    return headers.indexOf(columnName);
  }

  private columnToLetter(column: number): string {
    let letter = '';
    let temp = column;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }
}

export default new GoogleSheetsService();

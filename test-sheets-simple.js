require('dotenv').config();
const { google } = require('googleapis');

async function testGoogleSheets() {
  console.log('=== TESTING GOOGLE SHEETS INTEGRATION ===');
  console.log('Sheet ID:', process.env.GOOGLE_SHEET_ID);
  
  try {
    // Parse service account credentials
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    console.log('Service Account Email:', credentials.client_email);
    
    // Create auth client
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    
    // Create sheets client
    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log('\n1. Testing connection to Google Sheets...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:Z',
    });
    
    const rows = response.data.values || [];
    console.log('✓ GOOGLE SHEET CONNECTION: SUCCESS');
    console.log(`  Total rows found: ${rows.length}`);
    
    if (rows.length > 0) {
      const headers = rows[0];
      console.log('\n2. Headers:', headers);
      
      if (rows.length > 1) {
        const firstLead = {};
        headers.forEach((header, index) => {
          firstLead[header] = rows[1][index] || '';
        });
        console.log('\n3. First lead sample:', firstLead);
      }
    }
    
    // Find lead matching conditions
    console.log('\n4. Searching for lead with: status=New, call_status=queued, processed=no');
    const leads = rows.slice(1).map((row) => {
      const lead = {};
      headers.forEach((header, index) => {
        lead[header] = row[index] || '';
      });
      return lead;
    });
    
    const matchingLead = leads.find(lead => 
      lead.status === 'New' && 
      lead.call_status === 'queued' && 
      lead.processed === 'no'
    );
    
    if (matchingLead) {
      console.log('✓ LEAD FOUND:');
      console.log(`  Name: ${matchingLead.name}`);
      console.log(`  Phone: ${matchingLead.phone}`);
      console.log(`  Email: ${matchingLead.email}`);
    } else {
      console.log('✓ No matching lead found with specified conditions');
      console.log('  Available leads:', leads.length);
    }
    
    console.log('\n=== GOOGLE SHEETS INTEGRATION TEST COMPLETE ===');
  } catch (error) {
    console.error('✗ GOOGLE SHEET CONNECTION: FAILED');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
    process.exit(1);
  }
}

testGoogleSheets();

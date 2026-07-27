require('dotenv').config();
const googleSheetsService = require('./src/services/google-sheets/google-sheets.service');

async function testGoogleSheets() {
  console.log('=== TESTING GOOGLE SHEETS INTEGRATION ===');
  console.log('Sheet ID:', process.env.GOOGLE_SHEET_ID);
  
  try {
    // Test connection
    console.log('\n1. Testing connection to Google Sheets...');
    const leads = await googleSheetsService.readLeads();
    console.log('✓ GOOGLE SHEET CONNECTION: SUCCESS');
    console.log(`  Total leads found: ${leads.length}`);
    
    if (leads.length > 0) {
      console.log('\n2. Headers:', Object.keys(leads[0]));
      console.log('\n3. First lead sample:', leads[0]);
    }
    
    // Test fetching next unprocessed lead
    console.log('\n4. Fetching next unprocessed lead...');
    const nextLead = await googleSheetsService.getNextUnprocessedLead();
    
    if (nextLead) {
      console.log('✓ LEAD FOUND:');
      console.log(`  Name: ${nextLead.name}`);
      console.log(`  Phone: ${nextLead.phone}`);
      console.log(`  Email: ${nextLead.email}`);
      console.log(`  Status: ${nextLead.status}`);
      console.log(`  Call Status: ${nextLead.call_status}`);
      console.log(`  Processed: ${nextLead.processed}`);
    } else {
      console.log('✓ No unprocessed leads found');
    }
    
    console.log('\n=== GOOGLE SHEETS INTEGRATION TEST COMPLETE ===');
  } catch (error) {
    console.error('✗ GOOGLE SHEET CONNECTION: FAILED');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testGoogleSheets();

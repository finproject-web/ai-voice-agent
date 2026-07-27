/**
 * Direct Telnyx API Test
 * Tests Telnyx API connection without going through the full service layer
 */

require('dotenv').config();
const Telnyx = require('telnyx');

console.log('==========================================');
console.log('Telnyx API Direct Test');
console.log('==========================================\n');

const telnyx = new Telnyx(process.env.TELNYX_API_KEY);
const phoneNumber = '+14702054032';

async function testTelnyxConnection() {
  try {
    console.log('Testing Telnyx connection...');
    
    // Test 1: Create outbound call
    console.log('\n1. Creating outbound call...');
    console.log(`   To: ${phoneNumber}`);
    console.log(`   From: ${process.env.TELNYX_PHONE_NUMBER}`);
    console.log(`   Connection ID: ${process.env.TELNYX_CONNECTION_ID}`);
    
    const callPayload = {
      to: phoneNumber,
      from: process.env.TELNYX_PHONE_NUMBER,
      connection_id: process.env.TELNYX_CONNECTION_ID,
      caller_name: 'AI Sales Agent',
      recording_enabled: true,
      timeout: 30,
      webhook_url: `${process.env.WEBHOOK_URL}/telnyx/webhook`,
      webhook_url_method: 'POST',
    };
    
    console.log(`   Webhook URL: ${process.env.WEBHOOK_URL}/telnyx/webhook\n`);
    
    const call = await telnyx.calls.create(callPayload);
    
    console.log('✓ Call initiated successfully!');
    console.log('  Call connected - check your phone');
    console.log('\n📞 Answer your phone to receive the call!');
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

testTelnyxConnection();

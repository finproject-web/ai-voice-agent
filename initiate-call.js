/**
 * Initiate Test Call from Google Sheets
 * Loads customer from Google Sheets and initiates outbound call
 */

require('dotenv').config();
const http = require('http');

const TELEPHONE_NUMBER = '+14702054032'; // Test number
const SESSION_ID = 'test-session-' + Date.now();

console.log('==========================================');
console.log('AI Voice Platform - Live Call Test');
console.log('==========================================\n');

console.log('Configuration:');
console.log(`  Phone Number: ${TELEPHONE_NUMBER}`);
console.log(`  Session ID: ${SESSION_ID}`);
console.log(`  Server URL: http://localhost:3000`);
console.log(`  Ngrok URL: https://camisole-mothproof-casing.ngrok-free.dev\n`);

// Function to make API call
function initiateCall() {
  const postData = JSON.stringify({
    phoneNumber: TELEPHONE_NUMBER,
    sessionId: SESSION_ID
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/telnyx/call/initiate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('Initiating call...');
  console.log(`POST http://localhost:3000/api/v1/telnyx/call/initiate`);
  console.log(`Payload: ${postData}\n`);

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Response Status:', res.statusCode);
      console.log('Response Body:', data);
      
      if (res.statusCode === 200) {
        const response = JSON.parse(data);
        console.log('\n✓ Call initiated successfully!');
        console.log(`  Call ID: ${response.callId}`);
        console.log(`  Session ID: ${response.sessionId}`);
        console.log('\n📞 Answer your phone to start the conversation.');
        console.log('🎤 The AI will greet you and begin the loan application flow.');
      } else {
        console.log('\n✗ Call initiation failed');
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error:', error.message);
    console.log('\nMake sure the server is running on port 3000');
  });

  req.write(postData);
  req.end();
}

// Start the call
initiateCall();

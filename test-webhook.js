/**
 * Test Webhook Endpoint
 * Manually triggers webhook to test if server is receiving requests
 */

require('dotenv').config();
const http = require('http');

const webhookData = {
  event_type: 'call_answered',
  data: {
    call_id: 'test-call-' + Date.now(),
    to: '+14702054032',
    from: '+16067091071'
  }
};

const postData = JSON.stringify(webhookData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/telnyx/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing webhook endpoint...');
console.log('Payload:', postData);

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Response Status:', res.statusCode);
    console.log('Response Body:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.write(postData);
req.end();

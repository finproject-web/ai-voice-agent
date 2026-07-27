#!/usr/bin/env node

/**
 * Connection Verification Script
 * Verifies all external service connections before deployment
 */

require('dotenv').config({ path: '.env.staging' });
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logWarn(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

async function verifyEnvironmentVariables() {
  log('\n=== Verifying Environment Variables ===\n');
  
  const requiredVars = [
    'PORT',
    'NODE_ENV',
    'DATABASE_URL',
    'TELNYX_API_KEY',
    'TELNYX_PHONE_NUMBER',
    'TELNYX_CONNECTION_ID',
    'WEBHOOK_URL',
    'DEEPGRAM_API_KEY',
    'OPENAI_API_KEY',
    'NVIDIA_API_KEY',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_VOICE_ID',
    'GOOGLE_SHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_JSON',
    'GMAIL_USER',
    'GMAIL_APP_PASSWORD',
    'APPLICATION_URL',
    'HUMAN_TRANSFER_NUMBER'
  ];

  let allPresent = true;
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value && value !== '' && value !== 'your_production_webhook_secret_here') {
      logSuccess(`${varName}: configured`);
    } else {
      logError(`${varName}: missing or not configured`);
      allPresent = false;
    }
  }
  
  return allPresent;
}

async function verifyDatabaseConnection() {
  log('\n=== Verifying Database Connection ===\n');
  
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    
    await client.connect();
    await client.query('SELECT NOW()');
    await client.end();
    
    logSuccess('Database connection successful');
    return true;
  } catch (error) {
    logError(`Database connection failed: ${error.message}`);
    return false;
  }
}

async function verifyGoogleSheets() {
  log('\n=== Verifying Google Sheets Connection ===\n');
  
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    
    if (!credentials.client_email || !credentials.private_key) {
      logError('Invalid Google Service Account JSON');
      return false;
    }
    
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Test access to spreadsheet
    await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID
    });
    
    logSuccess('Google Sheets connection successful');
    logInfo(`Spreadsheet ID: ${process.env.GOOGLE_SHEET_ID}`);
    logInfo(`Service Account: ${credentials.client_email}`);
    return true;
  } catch (error) {
    logError(`Google Sheets connection failed: ${error.message}`);
    return false;
  }
}

async function verifyGmailSMTP() {
  log('\n=== Verifying Gmail SMTP Connection ===\n');
  
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
    
    await transporter.verify();
    
    logSuccess('Gmail SMTP connection successful');
    logInfo(`Email: ${process.env.GMAIL_USER}`);
    return true;
  } catch (error) {
    logError(`Gmail SMTP connection failed: ${error.message}`);
    return false;
  }
}

async function verifyTelnyxAPI() {
  log('\n=== Verifying Telnyx API ===\n');
  
  try {
    const response = await fetch('https://api.telnyx.com/v2/whoami', {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      logSuccess('Telnyx API connection successful');
      logInfo(`Phone Number: ${process.env.TELNYX_PHONE_NUMBER}`);
      logInfo(`Connection ID: ${process.env.TELNYX_CONNECTION_ID}`);
      logInfo(`Webhook URL: ${process.env.WEBHOOK_URL}`);
      return true;
    } else {
      logError(`Telnyx API authentication failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Telnyx API connection failed: ${error.message}`);
    return false;
  }
}

async function verifyDeepgramAPI() {
  log('\n=== Verifying Deepgram API ===\n');
  
  try {
    const response = await fetch('https://api.deepgram.com/v1/projects', {
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      logSuccess('Deepgram API connection successful');
      return true;
    } else {
      logError(`Deepgram API authentication failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Deepgram API connection failed: ${error.message}`);
    return false;
  }
}

async function verifyElevenLabsAPI() {
  log('\n=== Verifying ElevenLabs API ===\n');
  
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      logSuccess('ElevenLabs API connection successful');
      logInfo(`Voice ID: ${process.env.ELEVENLABS_VOICE_ID}`);
      return true;
    } else {
      logError(`ElevenLabs API authentication failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`ElevenLabs API connection failed: ${error.message}`);
    return false;
  }
}

async function verifyNVIDIAAPI() {
  log('\n=== Verifying NVIDIA API ===\n');
  
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      logSuccess('NVIDIA API connection successful');
      return true;
    } else {
      logError(`NVIDIA API authentication failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`NVIDIA API connection failed: ${error.message}`);
    return false;
  }
}

async function verifyOpenAIAPI() {
  log('\n=== Verifying OpenAI API ===\n');
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      logSuccess('OpenAI API connection successful');
      return true;
    } else {
      logError(`OpenAI API authentication failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`OpenAI API connection failed: ${error.message}`);
    return false;
  }
}

async function main() {
  log('\n==========================================');
  log('AI Voice Platform - Connection Verification');
  log('==========================================');
  
  const results = {
    environmentVariables: await verifyEnvironmentVariables(),
    database: await verifyDatabaseConnection(),
    googleSheets: await verifyGoogleSheets(),
    gmailSMTP: await verifyGmailSMTP(),
    telnyxAPI: await verifyTelnyxAPI(),
    deepgramAPI: await verifyDeepgramAPI(),
    elevenLabsAPI: await verifyElevenLabsAPI(),
    nvidiaAPI: await verifyNVIDIAAPI(),
    openaiAPI: await verifyOpenAIAPI()
  };
  
  log('\n=== Verification Summary ===\n');
  
  const allPassed = Object.values(results).every(result => result === true);
  
  for (const [service, passed] of Object.entries(results)) {
    if (passed) {
      logSuccess(service);
    } else {
      logError(service);
    }
  }
  
  log('\n==========================================\n');
  
  if (allPassed) {
    logSuccess('All connections verified successfully!');
    process.exit(0);
  } else {
    logError('Some connections failed. Please review the errors above.');
    process.exit(1);
  }
}

main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});

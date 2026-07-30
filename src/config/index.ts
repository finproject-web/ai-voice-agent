import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  // Database
  databaseUrl: string;

  // JWT
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;

  // Server
  port: number;
  nodeEnv: string;
  apiVersion: string;

  // CORS
  corsOrigin: string;

  // Rate Limiting
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;

  // Vapi
  vapiKey: string;
  vapiDefaultAssistantId: string;
  vapiWebhookSecret: string;

  // Telnyx
  telnyxApiKey: string;
  telnyxPhoneNumber: string;
  telnyxConnectionId: string;
  telnyxWebhookSecret: string;
  telnyxMediaStreamUrl: string;

  // OpenAI
  openaiApiKey: string;
  openaiModel: string;
  openaiTemperature: number;
  openaiMaxTokens: number;

  // Deepgram
  deepgramApiKey: string;

  // ElevenLabs
  elevenlabsApiKey: string;
  elevenlabsVoiceId: string;

  // NVIDIA
  nvidiaApiKey: string;

  // Google Sheets
  googleSheetId: string;
  googleServiceAccountJson: string;

  // Gmail
  gmailUser: string;
  gmailAppPassword: string;

  // Application
  applicationUrl: string;

  // Transfer
  humanTransferNumber: string;

  // SMTP
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;

  // Redis
  redisHost: string;
  redisPort: number;
  redisPassword: string;

  // AWS S3
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  awsS3Bucket: string;

  // Storage
  storageLocalPath: string;
  storageProvider: string;

  // Logging
  logLevel: string;
  logDir: string;

  // Encryption
  encryptionKey: string;

  // Webhook
  webhookSecret: string;
  webhookUrl: string;

  // Ngrok
  ngrokUrl: string;
}

const config: Config = {
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || 'v1',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  vapiKey: process.env.VAPI_API_KEY || '',
  vapiDefaultAssistantId: process.env.VAPI_DEFAULT_ASSISTANT_ID || '',
  vapiWebhookSecret: process.env.VAPI_WEBHOOK_SECRET || '',
  telnyxApiKey: process.env.TELNYX_API_KEY || '',
  telnyxPhoneNumber: process.env.TELNYX_PHONE_NUMBER || '',
  telnyxConnectionId: process.env.TELNYX_CONNECTION_ID || '',
  telnyxWebhookSecret: process.env.TELNYX_WEBHOOK_SECRET || '',
  telnyxMediaStreamUrl: process.env.TELNYX_MEDIA_STREAM_URL || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  openaiTemperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  openaiMaxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000', 10),
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID || '',
  nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
  googleSheetId: process.env.GOOGLE_SHEET_ID || '',
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}',
  gmailUser: process.env.GMAIL_USER || '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
  applicationUrl: process.env.APPLICATION_URL || '',
  humanTransferNumber: process.env.HUMAN_TRANSFER_NUMBER || '',
  smtpHost: process.env.SMTP_HOST || 'localhost',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  smtpFrom: process.env.SMTP_FROM || 'noreply@example.com',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD || '',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  awsS3Bucket: process.env.AWS_S3_BUCKET || '',
  storageLocalPath: process.env.STORAGE_LOCAL_PATH || './storage',
  storageProvider: process.env.STORAGE_PROVIDER || 'local',
  logLevel: process.env.LOG_LEVEL || 'info',
  logDir: process.env.LOG_DIR || 'logs',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  webhookUrl: process.env.WEBHOOK_URL || '',
  ngrokUrl: process.env.NGROK_URL || '',
};

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export default config;

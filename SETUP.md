# Enterprise AI Sales Automation Platform - Backend Setup Guide

This guide will help you set up and run the production-ready backend for the Enterprise AI Sales Automation Platform.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **PostgreSQL** (v14 or higher) - [Download here](https://www.postgresql.org/download/)
- **npm** or **yarn** (comes with Node.js)
- **Git** (optional, for version control)

## Installation Steps

### 1. Navigate to the Project Directory

```bash
cd "Enterprise AI Sales Automation Platform"
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Express.js and middleware
- Prisma ORM
- JWT and encryption libraries
- Winston logging
- Twilio and Vapi SDKs
- Testing libraries (Jest, Supertest)

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit the `.env` file with your actual configuration:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/enterprise_ai_sales?schema=public

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_this_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development
API_VERSION=v1

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Twilio Configuration (Get from https://www.twilio.com)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Vapi Configuration (Get from https://vapi.ai)
VAPI_API_KEY=your_vapi_api_key
VAPI_DEFAULT_ASSISTANT_ID=your_vapi_assistant_id
VAPI_WEBHOOK_SECRET=your_vapi_webhook_secret

# Logging Configuration
LOG_LEVEL=info
LOG_DIR=logs

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key_change_this

# Webhook Configuration
WEBHOOK_SECRET=yourWebhookSecretForVerification
WEBHOOK_URL=https://your-domain.com/api/webhooks
```

**Important Security Notes:**
- Generate strong random secrets for JWT and encryption keys
- Never commit `.env` file to version control
- Use different secrets for development and production
- The encryption key must be exactly 32 characters

### 4. Set Up PostgreSQL Database

#### Option A: Using Local PostgreSQL

1. Create a new database:
```sql
CREATE DATABASE enterprise_ai_sales;
```

2. Verify your DATABASE_URL in `.env` matches your PostgreSQL credentials.

#### Option B: Using Supabase (Recommended for Production)

1. Create a Supabase project at https://supabase.com
2. Get your database connection string from Supabase dashboard
3. Update DATABASE_URL in `.env`

### 5. Run Database Migrations

Generate Prisma Client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

This will:
- Create all database tables based on `prisma/schema.prisma`
- Set up relationships and indexes
- Generate the Prisma Client for database operations

### 6. Verify Database Setup (Optional)

Open Prisma Studio to view your database:

```bash
npm run prisma:studio
```

This will open a web interface at `http://localhost:5555` where you can view and edit your database.

## Running the Application

### Development Mode

Start the development server with hot-reload:

```bash
npm run dev
```

The server will start on `http://localhost:3001`

### Production Mode

Build the TypeScript code and start the server:

```bash
npm run build
npm start
```

## API Endpoints

### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout user
- `GET /api/v1/auth/profile` - Get user profile

### Leads

- `POST /api/v1/leads` - Create lead
- `GET /api/v1/leads` - Get all leads
- `GET /api/v1/leads/:id` - Get lead by ID
- `PUT /api/v1/leads/:id` - Update lead
- `DELETE /api/v1/leads/:id` - Delete lead
- `POST /api/v1/leads/bulk-import` - Bulk import leads

### Campaigns

- `POST /api/v1/campaigns` - Create campaign
- `GET /api/v1/campaigns` - Get all campaigns
- `GET /api/v1/campaigns/:id` - Get campaign by ID
- `PUT /api/v1/campaigns/:id` - Update campaign
- `DELETE /api/v1/campaigns/:id` - Delete campaign
- `POST /api/v1/campaigns/:id/leads` - Add leads to campaign
- `DELETE /api/v1/campaigns/:id/leads/:leadId` - Remove lead from campaign

### Health Check

- `GET /api/v1/health` - Server health check

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

## Project Structure

```
Enterprise AI Sales Automation Platform/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── config/                # Configuration files
│   │   ├── index.ts           # Main config
│   │   ├── logger.ts          # Winston logger
│   │   └── database.ts        # Prisma client
│   ├── controllers/           # Route controllers
│   │   ├── auth.controller.ts
│   │   ├── lead.controller.ts
│   │   └── campaign.controller.ts
│   ├── middleware/            # Express middleware
│   │   ├── auth.ts            # Authentication
│   │   ├── error.ts           # Error handling
│   │   ├── validation.ts      # Request validation
│   │   └── security.ts        # Security middleware
│   ├── routes/                # API routes
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── lead.routes.ts
│   │   └── campaign.routes.ts
│   ├── services/              # Business logic
│   │   ├── auth.service.ts
│   │   ├── lead.service.ts
│   │   ├── campaign.service.ts
│   │   ├── twilio.service.ts
│   │   └── vapi.service.ts
│   ├── types/                 # TypeScript types
│   │   └── express.ts
│   ├── utils/                 # Utility functions
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   └── encryption.ts
│   ├── validators/            # Request validators
│   │   ├── auth.validator.ts
│   │   ├── lead.validator.ts
│   │   └── campaign.validator.ts
│   ├── __tests__/             # Test files
│   │   ├── auth.test.ts
│   │   └── utils.test.ts
│   └── server.ts              # Application entry point
├── .env.example               # Example environment variables
├── .gitignore                 # Git ignore rules
├── jest.config.js             # Jest configuration
├── nodemon.json               # Nodemon configuration
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── README.md                  # Project documentation
```

## Database Schema

The application uses the following main entities:

- **Tenant**: Multi-tenant organization
- **User**: Platform users with roles (Admin, Manager, Agent, Viewer)
- **Lead**: Customer leads with contact information
- **Campaign**: Calling campaigns with scripts and schedules
- **Call**: Individual call records
- **Conversation**: Call transcripts and analysis
- **Analytics**: Performance metrics and analytics

## Security Features

- **JWT Authentication**: Access tokens with refresh token rotation
- **Password Hashing**: bcrypt with 12 salt rounds
- **Rate Limiting**: Configurable rate limits per endpoint
- **CORS**: Configurable CORS policies
- **Helmet**: Security headers for Express
- **Input Validation**: Comprehensive request validation
- **Encryption**: AES-256-GCM encryption for sensitive data

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Verify PostgreSQL is running
2. Check DATABASE_URL in `.env` is correct
3. Ensure database exists: `createdb enterprise_ai_sales`
4. Check PostgreSQL credentials

### Port Already in Use

If port 3001 is already in use:

1. Change PORT in `.env` to another port
2. Or kill the process using port 3001:
   ```bash
   # On Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   ```

### Prisma Issues

If you encounter Prisma-related errors:

```bash
# Regenerate Prisma Client
npm run prisma:generate

# Reset database (WARNING: This deletes all data)
npm run prisma:migrate reset
```

### TypeScript Errors

If you see TypeScript errors:

```bash
# Rebuild TypeScript
npm run build
```

## Next Steps

After completing the setup:

1. Test the API endpoints using Postman or curl
2. Set up your Twilio account for voice calls
3. Configure Vapi for AI voice agents
4. Review and customize the database schema if needed
5. Set up monitoring and logging for production
6. Configure CI/CD pipeline for deployment

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production` in environment
2. Use strong, randomly generated secrets
3. Enable HTTPS/TLS
4. Set up proper logging and monitoring
5. Configure database backups
6. Use a process manager like PM2
7. Set up load balancing for scalability
8. Configure proper CORS origins
9. Enable database connection pooling
10. Set up webhook endpoints for Twilio/Vapi

## Support

For issues or questions:
- Check the logs in the `logs/` directory
- Review the API documentation
- Check database connection and migrations
- Verify environment variables are set correctly

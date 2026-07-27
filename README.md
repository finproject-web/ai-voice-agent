# Enterprise AI Sales Automation Platform - Backend

Production-ready AI sales automation platform backend foundation.

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT + Refresh Tokens
- **Language**: TypeScript

## Features

- Multi-tenant architecture
- Secure authentication with JWT and refresh tokens
- Lead management
- Campaign management
- AI voice agent integration (Vapi)
- Twilio integration for voice calls
- Conversation tracking
- Analytics and reporting
- Comprehensive logging
- Rate limiting and security middleware

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```
Edit `.env` with your configuration.

3. Set up the database:
```bash
npm run prisma:migrate
npm run prisma:generate
```

4. Start development server:
```bash
npm run dev
```

### Project Structure

```
src/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── middleware/       # Express middleware
├── models/           # Prisma models
├── routes/           # API routes
├── services/         # Business logic
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
├── validators/       # Request validators
└── server.ts         # Application entry point
```

### API Endpoints

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout user

### Testing

```bash
npm test
npm run test:coverage
```

### Database Management

```bash
npm run prisma:studio    # Open Prisma Studio
npm run prisma:migrate   # Run migrations
npm run prisma:generate  # Generate Prisma Client
```

## Security

- JWT-based authentication
- Refresh token rotation
- Rate limiting
- CORS configuration
- Helmet security headers
- Input validation
- SQL injection prevention (Prisma)

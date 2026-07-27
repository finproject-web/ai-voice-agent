# API Documentation - Enterprise AI Sales Automation Platform

Base URL: `http://localhost:3001/api/v1`

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Response Format

All responses follow this format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": [ ... ] // For validation errors
}
```

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Secure@123",
  "firstName": "John",
  "lastName": "Doe",
  "tenantId": "optional-tenant-id"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "ADMIN",
    "tenantId": "uuid",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "User registered successfully"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Secure@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "tenantId": "uuid"
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token"
    }
  },
  "message": "Login successful"
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "jwt-refresh-token"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-access-token",
    "refreshToken": "new-jwt-refresh-token"
  },
  "message": "Token refreshed successfully"
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "jwt-refresh-token"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### Get Profile
```http
GET /auth/profile
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "ADMIN",
    "status": "ACTIVE",
    "avatar": null,
    "phone": null,
    "lastLoginAt": "2024-01-01T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "tenant": {
      "id": "uuid",
      "name": "Organization Name",
      "slug": "org-slug",
      "plan": "FREE",
      "status": "ACTIVE"
    }
  }
}
```

### Leads

#### Create Lead
```http
POST /leads
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "company": "Acme Corp",
  "title": "CEO",
  "industry": "Technology",
  "source": "Website",
  "tags": ["hot-lead", "enterprise"],
  "assignedToId": "user-uuid"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "company": "Acme Corp",
    "title": "CEO",
    "industry": "Technology",
    "status": "NEW",
    "source": "Website",
    "tags": ["hot-lead", "enterprise"],
    "score": 0,
    "assignedToId": "user-uuid",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "Lead created successfully"
}
```

#### Get Leads
```http
GET /leads?status=NEW&page=1&limit=50&search=jane
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status` (optional): Filter by status (NEW, CONTACTED, QUALIFIED, etc.)
- `source` (optional): Filter by source
- `assignedToId` (optional): Filter by assigned user
- `search` (optional): Search in name, email, phone, company
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "id": "uuid",
        "firstName": "Jane",
        "lastName": "Smith",
        "email": "jane@example.com",
        "phone": "+1234567890",
        "status": "NEW",
        "assignedTo": {
          "id": "uuid",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "totalPages": 2
    }
  }
}
```

#### Get Lead by ID
```http
GET /leads/:id
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "status": "NEW",
    "assignedTo": {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "calls": [
      {
        "id": "uuid",
        "status": "COMPLETED",
        "duration": 120,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### Update Lead
```http
PUT /leads/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "status": "CONTACTED",
  "score": 50,
  "notes": "Initial contact made"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "CONTACTED",
    "score": 50,
    "notes": "Initial contact made"
  },
  "message": "Lead updated successfully"
}
```

#### Delete Lead
```http
DELETE /leads/:id
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Lead deleted successfully"
}
```

#### Bulk Import Leads
```http
POST /leads/bulk-import
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "leads": [
    {
      "firstName": "Jane",
      "lastName": "Smith",
      "phone": "+1234567890"
    },
    {
      "firstName": "Bob",
      "lastName": "Johnson",
      "phone": "+0987654321"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "successful": 2,
    "failed": 0,
    "errors": []
  },
  "message": "Bulk import completed"
}
```

### Campaigns

#### Create Campaign
```http
POST /campaigns
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Q1 Sales Campaign",
  "description": "Q1 2024 outbound sales campaign",
  "type": "OUTBOUND",
  "script": "Hello, this is a sales call...",
  "voiceAgentId": "vapi-assistant-id",
  "schedule": {
    "startTime": "09:00",
    "endTime": "18:00",
    "daysOfWeek": [1, 2, 3, 4, 5]
  },
  "priority": 10,
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-03-31T23:59:59Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Q1 Sales Campaign",
    "description": "Q1 2024 outbound sales campaign",
    "status": "DRAFT",
    "type": "OUTBOUND",
    "script": "Hello, this is a sales call...",
    "voiceAgentId": "vapi-assistant-id",
    "priority": 10,
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-03-31T23:59:59Z",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "Campaign created successfully"
}
```

#### Get Campaigns
```http
GET /campaigns?status=ACTIVE&type=OUTBOUND&page=1&limit=50
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status` (optional): Filter by status (DRAFT, ACTIVE, PAUSED, COMPLETED, CANCELLED)
- `type` (optional): Filter by type (OUTBOUND, INBOUND, BLENDED)
- `createdById` (optional): Filter by creator
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "uuid",
        "name": "Q1 Sales Campaign",
        "status": "ACTIVE",
        "type": "OUTBOUND",
        "priority": 10,
        "createdBy": {
          "id": "uuid",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        },
        "_count": {
          "campaignLeads": 100
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 10,
      "totalPages": 1
    }
  }
}
```

#### Get Campaign by ID
```http
GET /campaigns/:id
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Q1 Sales Campaign",
    "status": "ACTIVE",
    "type": "OUTBOUND",
    "script": "Hello, this is a sales call...",
    "createdBy": {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "campaignLeads": [
      {
        "id": "uuid",
        "status": "PENDING",
        "lead": {
          "id": "uuid",
          "firstName": "Jane",
          "lastName": "Smith",
          "phone": "+1234567890"
        }
      }
    ]
  }
}
```

#### Update Campaign
```http
PUT /campaigns/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "status": "ACTIVE",
  "priority": 20
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "ACTIVE",
    "priority": 20
  },
  "message": "Campaign updated successfully"
}
```

#### Delete Campaign
```http
DELETE /campaigns/:id
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Campaign deleted successfully"
}
```

#### Add Leads to Campaign
```http
POST /campaigns/:id/leads
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "leadIds": ["lead-uuid-1", "lead-uuid-2", "lead-uuid-3"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "campaignId": "campaign-uuid",
      "leadId": "lead-uuid-1",
      "status": "PENDING"
    }
  ],
  "message": "Leads added to campaign successfully"
}
```

#### Remove Lead from Campaign
```http
DELETE /campaigns/:id/leads/:leadId
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Lead removed from campaign successfully"
}
```

### Health Check

#### Server Health
```http
GET /health
```

**Response (200):**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Rate Limiting

- Default: 100 requests per 15 minutes
- Authentication endpoints: 5 requests per 15 minutes

## User Roles

- **ADMIN**: Full access to all resources
- **MANAGER**: Can manage leads, campaigns, and view analytics
- **AGENT**: Can manage assigned leads and view campaigns
- **VIEWER**: Read-only access to most resources

## Validation Rules

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Phone Number
- Must be valid international format (e.g., +1234567890)

### Email
- Must be valid email format

## Webhooks

Webhooks are supported for:
- Call status updates (Twilio)
- AI agent events (Vapi)

Configure webhook URLs in environment variables.

## Pagination

All list endpoints support pagination:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)

Response includes pagination metadata:
```json
{
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

# Deployment Guide - Enterprise AI Sales Automation Platform

This guide covers deploying the backend to production environments.

## Prerequisites

- Production PostgreSQL database
- Domain name with SSL certificate
- Cloud hosting account (AWS, DigitalOcean, Heroku, etc.)
- Twilio account with phone numbers
- Vapi account for AI voice agents

## Environment Configuration

### Production Environment Variables

Create a production `.env` file with the following:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/dbname?schema=public

# JWT Configuration (Use strong random secrets)
JWT_SECRET=<generate-with-openssl-rand-base64-32>
JWT_REFRESH_SECRET=<generate-with-openssl-rand-base64-32>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=production
API_VERSION=v1

# CORS Configuration (Your frontend domain)
CORS_ORIGIN=https://your-frontend-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_production_twilio_sid
TWILIO_AUTH_TOKEN=your_production_twilio_token
TWILIO_PHONE_NUMBER=your_production_twilio_number

# Vapi Configuration
VAPI_API_KEY=your_production_vapi_key
VAPI_DEFAULT_ASSISTANT_ID=your_production_vapi_assistant_id
VAPI_WEBHOOK_SECRET=your_production_vapi_webhook_secret

# Logging Configuration
LOG_LEVEL=info
LOG_DIR=logs

# Encryption (Exactly 32 characters)
ENCRYPTION_KEY=<generate-32-char-random-string>

# Webhook Configuration
WEBHOOK_SECRET=<generate-random-webhook-secret>
WEBHOOK_URL=https://your-backend-domain.com/api/webhooks
```

### Generate Secure Secrets

```bash
# Generate JWT secrets
openssl rand -base64 32

# Generate encryption key (32 characters)
openssl rand -base64 24 | base64

# Generate webhook secret
openssl rand -hex 32
```

## Deployment Options

### Option 1: DigitalOcean App Platform

1. **Create a new App**
   - Go to DigitalOcean App Platform
   - Click "Create App"
   - Connect your GitHub repository

2. **Configure the App**
   - Build command: `npm run build`
   - Run command: `npm start`
   - Environment variables: Add all from above

3. **Add Database**
   - Create a PostgreSQL database
   - Copy connection string to DATABASE_URL

4. **Deploy**
   - Click "Deploy"
   - DigitalOcean will build and deploy automatically

### Option 2: AWS EC2

1. **Launch EC2 Instance**
   - Choose Ubuntu 20.04 LTS
   - Select instance type (t3.medium or larger)
   - Configure security groups (allow ports 80, 443, 22)

2. **Connect to Instance**
   ```bash
   ssh -i your-key.pem ubuntu@your-instance-ip
   ```

3. **Install Dependencies**
   ```bash
   sudo apt update
   sudo apt install -y nodejs npm postgresql-client
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

4. **Clone Repository**
   ```bash
   git clone your-repo-url
   cd Enterprise\ AI\ Sales\ Automation\ Platform
   npm install
   ```

5. **Setup Environment**
   ```bash
   cp .env.example .env
   nano .env  # Add your production values
   ```

6. **Run Migrations**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

7. **Setup PM2**
   ```bash
   sudo npm install -g pm2
   pm2 start dist/server.js --name "ai-sales-backend"
   pm2 save
   pm2 startup
   ```

8. **Setup Nginx**
   ```bash
   sudo apt install -y nginx
   sudo nano /etc/nginx/sites-available/ai-sales
   ```

   Nginx configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   sudo ln -s /etc/nginx/sites-available/ai-sales /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

9. **Setup SSL with Certbot**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### Option 3: Heroku

1. **Create Heroku App**
   ```bash
   heroku create your-app-name
   ```

2. **Add PostgreSQL**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set JWT_SECRET=your_secret
   heroku config:set JWT_REFRESH_SECRET=your_refresh_secret
   # Set all other variables
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

5. **Run Migrations**
   ```bash
   heroku run npm run prisma:migrate
   heroku run npm run prisma:generate
   ```

## Database Setup for Production

### PostgreSQL Configuration

1. **Create Production Database**
   ```sql
   CREATE DATABASE enterprise_ai_sales_prod;
   ```

2. **Create Database User**
   ```sql
   CREATE USER sales_user WITH ENCRYPTED PASSWORD 'strong_password';
   GRANT ALL PRIVILEGES ON DATABASE enterprise_ai_sales_prod TO sales_user;
   ```

3. **Enable Connection Pooling**
   - Configure PgBouncer for connection pooling
   - Set pool size based on your instance type

4. **Enable Backups**
   - Set up automated backups
   - Configure point-in-time recovery

### Run Migrations

```bash
npm run prisma:migrate deploy
npm run prisma:generate
```

## Monitoring and Logging

### Application Monitoring

1. **Setup Application Performance Monitoring**
   - New Relic
   - Datadog
   - Sentry for error tracking

2. **Configure Health Checks**
   - Endpoint: `/api/v1/health`
   - Monitor response time and uptime

3. **Database Monitoring**
   - Monitor connection pool usage
   - Track query performance
   - Set up alerts for slow queries

### Logging

1. **Centralized Logging**
   - Send logs to CloudWatch, Loggly, or similar
   - Configure log retention policies

2. **Log Levels**
   - Production: `info` and above
   - Development: `debug` and above

3. **Log Rotation**
   - Configure automatic log rotation
   - Archive old logs

## Security Hardening

### Server Security

1. **Firewall Configuration**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **SSH Security**
   - Disable password authentication
   - Use key-based authentication only
   - Change default SSH port

3. **Keep System Updated**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

### Application Security

1. **HTTPS Only**
   - Force HTTPS redirects
   - Use strong SSL/TLS ciphers

2. **Security Headers**
   - Helmet middleware is already configured
   - Review and adjust as needed

3. **Rate Limiting**
   - Configure appropriate limits
   - Monitor for abuse

4. **Input Validation**
   - All endpoints have validation
   - Review and strengthen as needed

## Scaling

### Horizontal Scaling

1. **Load Balancer**
   - Use AWS ALB, Nginx, or HAProxy
   - Configure health checks

2. **Multiple Instances**
   - Deploy multiple app instances
   - Use shared database

3. **Session Management**
   - JWT is stateless (scales well)
   - Refresh tokens stored in database

### Vertical Scaling

1. **Increase Resources**
   - More CPU and memory
   - Larger database instance

2. **Database Optimization**
   - Add indexes for frequent queries
   - Optimize slow queries
   - Enable query caching

## Backup and Recovery

### Database Backups

1. **Automated Backups**
   ```bash
   # Daily backup
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   ```

2. **Backup Strategy**
   - Daily full backups
   - Hourly incremental backups
   - Store backups in multiple locations

3. **Recovery Testing**
   - Test restore process regularly
   - Document recovery procedures

### Application Backups

1. **Code Backups**
   - Git repository
   - Tag releases

2. **Environment Backups**
   - Store environment variables securely
   - Use secret management services

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm test
      - name: Build
        run: npm run build
      - name: Deploy
        run: # Your deployment command
```

## Post-Deployment Checklist

- [ ] All environment variables set
- [ ] Database migrations run successfully
- [ ] SSL certificate installed
- [ ] Health check endpoint responding
- [ ] Authentication working
- [ ] API endpoints accessible
- [ ] Logging configured
- [ ] Monitoring setup
- [ ] Backups configured
- [ ] Security headers verified
- [ ] Rate limiting tested
- [ ] Webhook endpoints configured
- [ ] Twilio integration tested
- [ ] Vapi integration tested

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL
   - Verify database is accessible
   - Check firewall rules

2. **JWT Token Errors**
   - Verify JWT_SECRET matches
   - Check token expiration
   - Verify system time is correct

3. **Webhook Failures**
   - Verify webhook URL is public
   - Check webhook secret matches
   - Review webhook logs

4. **Memory Issues**
   - Increase instance size
   - Check for memory leaks
   - Optimize database queries

## Maintenance

### Regular Tasks

- Weekly: Review logs and metrics
- Monthly: Update dependencies
- Monthly: Review and rotate secrets
- Quarterly: Security audit
- Quarterly: Disaster recovery test

### Dependency Updates

```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Audit for security vulnerabilities
npm audit
npm audit fix
```

## Support

For deployment issues:
- Check application logs
- Review database logs
- Verify environment variables
- Test database connectivity
- Check firewall and security groups

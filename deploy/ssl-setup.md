# SSL Certificate Setup for Staging Environment

## Overview
This guide covers setting up SSL certificates for the staging environment at `staging.upstarloans.com`.

## Option 1: Let's Encrypt (Free, Recommended for Staging)

### Prerequisites
- Domain `staging.upstarloans.com` must point to your server IP
- Port 80 and 443 must be open on firewall
- Certbot installed on server

### Installation Steps

1. **Install Certbot**
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

2. **Obtain SSL Certificate**
```bash
sudo certbot --nginx -d staging.upstarloans.com
```

3. **Follow the Prompts**
- Enter email for renewal notifications
- Agree to Terms of Service
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

4. **Verify Certificate**
```bash
sudo certbot certificates
```

5. **Test Auto-Renewal**
```bash
sudo certbot renew --dry-run
```

### Certificate Locations
- Certificate: `/etc/letsencrypt/live/staging.upstarloans.com/fullchain.pem`
- Private Key: `/etc/letsencrypt/live/staging.upstarloans.com/privkey.pem`

### Update Nginx Configuration
Update the SSL paths in `nginx-staging.conf`:
```nginx
ssl_certificate /etc/letsencrypt/live/staging.upstarloans.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/staging.upstarloans.com/privkey.pem;
```

### Reload Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Option 2: Self-Signed Certificate (Development Only)

### Generate Self-Signed Certificate
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/staging.upstarloans.com.key \
  -out /etc/ssl/certs/staging.upstarloans.com.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=staging.upstarloans.com"
```

### Update Nginx Configuration
Use the paths in `nginx-staging.conf`:
```nginx
ssl_certificate /etc/ssl/certs/staging.upstarloans.com.crt;
ssl_certificate_key /etc/ssl/private/staging.upstarloans.com.key;
```

### Reload Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Option 3: Commercial SSL Certificate (Production)

### Generate CSR
```bash
sudo openssl req -new -newkey rsa:2048 -nodes \
  -keyout /etc/ssl/private/staging.upstarloans.com.key \
  -out /etc/ssl/certs/staging.upstarloans.com.csr
```

### Submit CSR to Certificate Authority
- Upload the CSR file to your CA
- Complete domain verification
- Download the certificate files

### Install Certificate
```bash
sudo cp your-certificate.crt /etc/ssl/certs/staging.upstarloans.com.crt
sudo cp intermediate-ca.crt /etc/ssl/certs/staging.upstarloans.com-chain.crt
```

### Update Nginx Configuration
```nginx
ssl_certificate /etc/ssl/certs/staging.upstarloans.com.crt;
ssl_certificate_key /etc/ssl/private/staging.upstarloans.com.key;
ssl_trusted_certificate /etc/ssl/certs/staging.upstarloans.com-chain.crt;
```

### Reload Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Verification

### Check SSL Configuration
```bash
openssl s_client -connect staging.upstarloans.com:443 -servername staging.upstarloans.com
```

### Online SSL Test
Visit: https://www.ssllabs.com/ssltest/analyze.html?d=staging.upstarloans.com

## Firewall Configuration

### Allow HTTPS Traffic
```bash
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
sudo ufw reload
```

## Automatic Renewal (Let's Encrypt)

### Renewal Timer
Certbot automatically sets up a systemd timer. Verify it:
```bash
sudo systemctl status certbot.timer
```

### Manual Renewal
```bash
sudo certbot renew
```

### Renewal with Nginx Reload
```bash
sudo certbot renew --post-hook "systemctl reload nginx"
```

## Troubleshooting

### Certificate Not Found
```bash
sudo ls -la /etc/letsencrypt/live/staging.upstarloans.com/
```

### Nginx Configuration Error
```bash
sudo nginx -t
```

### Port Already in Use
```bash
sudo netstat -tlnp | grep :443
```

### Permission Denied
```bash
sudo chmod 644 /etc/ssl/certs/staging.upstarloans.com.crt
sudo chmod 600 /etc/ssl/private/staging.upstarloans.com.key
```

## Security Best Practices

1. **Use Strong Ciphers**: Already configured in nginx-staging.conf
2. **Enable HSTS**: Already configured in nginx-staging.conf
3. **Disable Weak Protocols**: Only TLS 1.2 and 1.3 enabled
4. **Regular Updates**: Keep certbot and nginx updated
5. **Monitor Expiry**: Set up alerts for certificate expiry

## Production Deployment Note

For production, use a commercial SSL certificate from a trusted CA like:
- DigiCert
- Comodo
- GlobalSign
- Let's Encrypt (also suitable for production)

Let's Encrypt is recommended for both staging and production due to:
- Free of cost
- Automatic renewal
- Trusted by all major browsers
- Easy setup

# Telnyx Webhook Configuration for Staging

## Overview
This guide covers configuring Telnyx webhooks for the staging environment.

## Staging Webhook URL
```
https://staging.upstarloans.com/telnyx/webhook
```

## Prerequisites
- Staging server deployed and accessible
- SSL certificate installed
- Nginx configured and running
- Application running on port 3000

## Configuration Steps

### 1. Log in to Telnyx Dashboard
Visit: https://portal.telnyx.com/

### 2. Navigate to Connection Settings
- Go to "Phone Numbers" → Select your number (+16067091071)
- Or go to "Connections" → Select your connection (3011713956143170980)

### 3. Configure Webhook URL

#### For Phone Number:
1. Select the phone number: +16067091071
2. Scroll to "Webhooks" section
3. Click "Add Webhook" or edit existing webhook
4. Set webhook URL: `https://staging.upstarloans.com/telnyx/webhook`
5. Select events to receive:
   - `call.initiated`
   - `call.answered`
   - `call.ended`
   - `call.hangup`
   - `call.recording.saved`
   - `dtmf.received`
   - `speak.started`
   - `speak.ended`
6. Set HTTP method: POST
7. Add webhook signature secret (optional but recommended)
8. Save configuration

#### For Connection:
1. Select the connection: 3011713956143170980
2. Scroll to "Webhooks" section
3. Set webhook URL: `https://staging.upstarloans.com/telnyx/webhook`
4. Select events to receive (same as above)
5. Set HTTP method: POST
6. Add webhook signature secret
7. Save configuration

### 4. Webhook Signature Secret

#### Generate a Secure Secret
```bash
openssl rand -hex 32
```

#### Update Environment Variable
Add to `.env.staging`:
```
TELNYX_WEBHOOK_SECRET=your_generated_secret_here
```

#### Configure in Telnyx
- Enter the same secret in the Telnyx webhook configuration
- This enables signature validation for security

### 5. Webhook Events to Configure

#### Call Lifecycle Events
- `call.initiated` - Triggered when call is initiated
- `call.ringing` - Phone starts ringing
- `call.answered` - Call is answered
- `call.ending` - Call is about to end
- `call.ended` - Call has ended
- `call.hangup` - Call was hung up

#### Media Events
- `speak.started` - TTS started playing
- `speak.ended` - TTS finished playing
- `gather.started` - DTMF collection started
- `gather.ended` - DTMF collection ended
- `dtmf.received` - DTMF digit received

#### Recording Events
- `call.recording.started` - Recording started
- `call.recording.ended` - Recording ended
- `call.recording.saved` - Recording saved to storage

#### Transfer Events
- `call.transfer.started` - Transfer initiated
- `call.transfer.ended` - Transfer completed

### 6. Webhook Payload Structure

#### Example Call Initiated Event
```json
{
  "data": {
    "event_type": "call.initiated",
    "call_id": "1234567890",
    "call_session_id": "session-id",
    "from": "+16067091071",
    "to": "+15551234567",
    "direction": "outbound",
    "status": "ringing",
    "timestamp": "2026-07-25T12:00:00Z"
  },
  "event_type": "call.initiated",
  "timestamp": "2026-07-25T12:00:00Z"
}
```

### 7. Test Webhook

#### Manual Test
Use Telnyx's webhook testing tool in the dashboard:
1. Go to "Webhooks" → "Test Webhook"
2. Enter webhook URL: `https://staging.upstarloans.com/telnyx/webhook`
3. Select event type to test
4. Send test webhook
5. Check application logs for receipt

#### Automated Test
```bash
curl -X POST https://staging.upstarloans.com/telnyx/webhook \
  -H "Content-Type: application/json" \
  -H "X-Telnyx-Signature-Ed25519: test_signature" \
  -H "X-Telnyx-Timestamp: $(date +%s)" \
  -d '{
    "event_type": "call.initiated",
    "data": {
      "call_id": "test-call-123",
      "from": "+16067091071",
      "to": "+15551234567"
    }
  }'
```

### 8. Verify Webhook Receipt

#### Check Application Logs
```bash
pm2 logs ai-voice-platform-staging
```

#### Expected Log Output
```
[INFO] Telnyx webhook received
{
  "eventType": "call.initiated",
  "callId": "test-call-123"
}
```

### 9. Webhook Retry Configuration

Telnyx automatically retries failed webhook deliveries:
- Retry attempts: 3
- Retry interval: Exponential backoff
- Max retry duration: 24 hours

### 10. Webhook Security

#### Signature Validation
The application validates webhook signatures using:
- HMAC-SHA256 algorithm
- Timestamp verification
- Secret key from environment

#### IP Whitelisting (Optional)
Add Telnyx IP addresses to firewall:
```
54.172.60.0/23
54.208.16.0/23
```

### 11. Monitoring

#### Webhook Delivery Status
Monitor in Telnyx Dashboard:
- "Webhooks" → "Delivery Logs"
- View success/failure rates
- Check response times

#### Application Monitoring
Monitor webhook processing:
- Success rate
- Processing time
- Error rate
- Signature validation failures

### 12. Troubleshooting

#### Webhook Not Received
- Check webhook URL is correct
- Verify SSL certificate is valid
- Check firewall allows inbound traffic
- Verify application is running
- Check application logs for errors

#### Signature Validation Failed
- Verify TELNYX_WEBHOOK_SECRET matches in both places
- Check timestamp is within tolerance (5 minutes)
- Verify signature header is being passed correctly

#### 404 Error
- Verify Nginx configuration includes webhook location
- Check application route is defined
- Verify URL path is correct

#### 500 Error
- Check application logs for errors
- Verify all environment variables are set
- Check database connection
- Verify external API connections

### 13. Production Webhook Configuration

For production, update webhook URL to:
```
https://upstarloans.com/telnyx/webhook
```

Follow same steps with production URL.

### 14. Webhook Testing Checklist

- [ ] Webhook URL configured in Telnyx
- [ ] All required events selected
- [ ] Signature secret generated and configured
- [ ] Environment variable updated
- [ ] Test webhook sent successfully
- [ ] Application logs show webhook receipt
- [ ] Signature validation working
- [ ] All event types tested
- [ ] Error handling verified
- [ ] Monitoring configured

## Summary

After completing these steps:
1. Telnyx will send call events to your staging webhook
2. Your application will receive and process webhooks
3. Signature validation ensures security
4. All call lifecycle events are tracked
5. Ready for live call testing

## Next Steps

1. Complete webhook configuration
2. Run staging test call
3. Verify conversation flow
4. Test email delivery
5. Verify Google Sheets updates
6. Proceed to production deployment

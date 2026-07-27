# Staging Test Plan
**AI Voice Platform - Live Call Testing**

## Test Overview
This document outlines the comprehensive test plan for staging deployment verification.

## Test Environment
- **URL**: https://staging.upstarloans.com
- **Phone Number**: +16067091071
- **Test Date**: [To be filled during testing]
- **Testers**: [To be filled during testing]

## Pre-Test Checklist

### System Verification
- [ ] Application deployed and running
- [ ] PM2 process status: online
- [ ] Nginx configuration active
- [ ] SSL certificate valid
- [ ] Webhook URL configured in Telnyx
- [ ] All environment variables set
- [ ] Database connection verified
- [ ] External API connections verified

### Test Data Preparation
- [ ] Test customer added to Google Sheets
- [ ] Test phone number available
- [ ] Test email address available
- [ ] Application URL accessible
- [ ] Human transfer number verified

## Test Cases

### Test 1: Outbound Call Initiation

**Objective**: Verify outbound call can be initiated successfully

**Steps**:
1. Call API endpoint: `POST /api/v1/telnyx/call/initiate`
2. Payload:
```json
{
  "phoneNumber": "+15551234567",
  "sessionId": "test-session-001"
}
```
3. Verify response:
```json
{
  "success": true,
  "callId": "call-id-from-telnyx",
  "sessionId": "test-session-001"
}
```

**Expected Results**:
- [ ] API returns 200 status
- [ ] Call ID returned
- [ ] Telnyx webhook receives `call.initiated` event
- [ ] Application logs show call initiation
- [ ] PM2 logs show no errors

**Actual Results**: [To be filled]

---

### Test 2: AI Greeting

**Objective**: Verify AI voice greets customer correctly

**Steps**:
1. Wait for call to be answered
2. Listen for greeting
3. Verify greeting content

**Expected Greeting**:
"Hi [Customer Name]… this is Sophia from Up Start Loans. Am I speaking with [Customer Name] please?"

**Expected Results**:
- [ ] Voice is clear and natural
- [ ] Greeting plays within 2 seconds of call answer
- [ ] Customer name is correctly pronounced
- [ ] No audio artifacts or stuttering
- [ ] Voice matches ElevenLabs configured voice

**Actual Results**: [To be filled]

---

### Test 3: Customer Name Confirmation

**Objective**: Verify customer can confirm their identity

**Steps**:
1. Customer responds: "Yes, this is [Name]"
2. AI acknowledges confirmation
3. AI proceeds to loan interest question

**Expected AI Response**:
"Just a quick call… because you recently applied for a loan online. Are you still looking for a loan today?"

**Expected Results**:
- [ ] AI correctly identifies positive response
- [ ] Conversation state advances to INTEREST_CONFIRMATION
- [ ] Response is immediate (within 1 second)
- [ ] No false positives/negatives

**Actual Results**: [To be filled]

---

### Test 4: Loan Interest Question

**Objective**: Verify AI asks about loan interest

**Steps**:
1. Customer responds positively to loan interest
2. AI proceeds to loan amount question

**Expected AI Response**:
"What loan amount are you looking for today?"

**Expected Results**:
- [ ] AI correctly identifies loan interest
- [ ] Conversation state advances to LOAN_QUALIFICATION
- [ ] Response is immediate
- [ ] No confusion with other responses

**Actual Results**: [To be filled]

---

### Test 5: Loan Amount Collection

**Objective**: Verify AI collects loan amount correctly

**Steps**:
1. Customer states loan amount: "I need $5,000"
2. AI validates amount
3. AI proceeds to email verification

**Expected AI Response**:
"Okay, $5,000. I see we have your email on file. Is this still correct?"

**Edge Cases to Test**:
- [ ] Valid amount within range ($2,000 - $25,000)
- [ ] Amount below minimum ($1,500)
- [ ] Amount above maximum ($30,000)
- [ ] Amount with decimals ($5,500.50)
- [ ] Amount in words ("five thousand")

**Expected Results**:
- [ ] Valid amounts accepted
- [ ] Invalid amounts rejected with helpful message
- [ ] Amount stored in conversation state
- [ ] Conversation state advances to EMAIL_VERIFICATION

**Actual Results**: [To be filled]

---

### Test 6: Email Verification

**Objective**: Verify AI collects and verifies email

**Steps**:
1. AI presents email on file
2. Customer confirms or provides new email
3. AI proceeds to application email sending

**Expected AI Response**:
"Perfect… I'll send your secure application link right now."

**Edge Cases to Test**:
- [ ] Email confirmed as correct
- [ ] Email changed to new valid email
- [ ] Invalid email format provided
- [ ] Email with special characters

**Expected Results**:
- [ ] Email format validated
- [ ] Email stored in conversation state
- [ ] Conversation state advances to APPLICATION_EMAIL
- [ ] Email sent via Gmail SMTP

**Actual Results**: [To be filled]

---

### Test 7: Application Email Delivery

**Objective**: Verify application email is sent successfully

**Steps**:
1. Wait for email to be sent
2. Check test email inbox
3. Verify email content
4. Click application link

**Expected Email Content**:
- Subject: "Your Up Start Loans Application Link"
- Customer name in greeting
- Application link: https://staging.upstarloans.com/
- Loan amount included (if provided)
- Professional HTML formatting

**Expected Results**:
- [ ] Email received within 30 seconds
- [ ] Subject line correct
- [ ] Customer name personalized
- [ ] Application link clickable
- [ ] Loan amount displayed
- [ ] HTML formatting correct
- [ ] No spam flags

**Actual Results**: [To be filled]

---

### Test 8: Application Guidance

**Objective**: Verify AI guides through application steps

**Steps**:
1. AI provides first step guidance
2. Customer completes step
3. AI proceeds to next step

**Expected AI Response**:
"You'll receive an email shortly from Up Start Loans with your secure application link. Let me guide you through the application process one step at a time."

**11 Steps to Verify**:
1. Select Loan Agent
2. Loan Amount
3. Loan Term
4. Loan Purpose
5. Personal Information
6. Banking Information
7. Bank Verification
8. Loan Agreement
9. Digital Agreement
10. Signature
11. Dashboard Password

**Expected Results**:
- [ ] Each step explained clearly
- [ ] Help text available on request
- [ ] Steps progress sequentially
- [ ] Completion detected correctly
- [ ] Final confirmation message

**Actual Results**: [To be filled]

---

### Test 9: Google Sheets Update

**Objective**: Verify lead data is updated in Google Sheets

**Steps**:
1. Check Google Sheets after call
2. Verify lead row updated
3. Check specific fields

**Expected Updates**:
- [ ] Status updated to "Contacted" or "In Progress"
- [ ] Email updated if changed
- [ ] Loan amount recorded
- [ ] Notes added with call summary
- [ ] Timestamp recorded
- [ ] No duplicate rows created

**Actual Results**: [To be filled]

---

### Test 10: Objection Handling

**Objective**: Verify AI handles common objections

**Test 10a: Not Interested**
- Customer: "I don't need a loan"
- Expected: "That's completely okay. I just wanted to make sure you had the information available if your situation changes."
- Expected: Call ends gracefully
- [ ] Test passed

**Test 10b: Busy**
- Customer: "I'm busy right now"
- Expected: "No problem. I can send the application link so you can review it when convenient."
- Expected: Email sent
- [ ] Test passed

**Test 10c: How Did You Get My Number**
- Customer: "How did you get my number?"
- Expected: "You recently submitted an online loan inquiry, and we are following up regarding your request."
- Expected: Conversation continues
- [ ] Test passed

**Actual Results**: [To be filled]

---

### Test 11: Human Transfer

**Objective**: Verify transfer to human agent works

**Steps**:
1. Customer requests: "I want to speak to a human"
2. AI acknowledges transfer
3. Call transferred to human number

**Expected AI Response**:
"Let me transfer you to a human agent who can better assist you."

**Expected Results**:
- [ ] Transfer request recognized
- [ ] Call transferred to 4702063218
- [ ] Transfer successful
- [ ] No audio interruption

**Actual Results**: [To be filled]

---

### Test 12: Call Termination

**Objective**: Verify call ends gracefully

**Steps**:
1. Customer hangs up
2. AI detects hangup
3. Call resources cleaned up

**Expected Results**:
- [ ] Hangup detected via webhook
- [ ] Conversation state marked as completed
- [ ] Call resources released
- [ ] No memory leaks
- [ ] Logs show clean termination

**Actual Results**: [To be filled]

---

### Test 13: Audio Quality

**Objective**: Verify audio quality throughout call

**Metrics to Measure**:
- [ ] Voice clarity (1-10 scale)
- [ ] Latency (target: < 500ms)
- [ ] No audio dropouts
- [ ] No background noise
- [ ] Consistent volume
- [ ] Natural speech rhythm

**Actual Results**: [To be filled]

---

### Test 14: Transcription Accuracy

**Objective**: Verify Deepgram transcription accuracy

**Test Phrases**:
1. "Yes, this is John"
2. "I need five thousand dollars"
3. "My email is john@example.com"
4. "I'm interested in a loan"
5. "I want to speak to a human"

**Expected Results**:
- [ ] Transcription accuracy > 90%
- [ ] Numbers correctly transcribed
- [ ] Email addresses correctly transcribed
- [ ] Interim transcripts displayed
- [ ] Final transcripts accurate

**Actual Results**: [To be filled]

---

### Test 15: Error Handling

**Objective**: Verify system handles errors gracefully

**Test 15a: No Answer**
- Call not answered after 30 seconds
- Expected: Call terminated, status logged
- [ ] Test passed

**Test 15b: Invalid Email**
- Customer provides invalid email
- Expected: Error message, request valid email
- [ ] Test passed

**Test 15c: API Failure**
- External API (Deepgram/ElevenLabs) fails
- Expected: Graceful degradation, error logged
- [ ] Test passed

**Test 15d: Network Timeout**
- Network timeout during call
- Expected: Call terminated, error logged
- [ ] Test passed

**Actual Results**: [To be filled]

---

## Performance Testing

### Load Test
- **Concurrent Calls**: 5 simultaneous calls
- **Expected**: All calls handled without degradation
- **Actual**: [To be filled]

### Stress Test
- **Duration**: 10 continuous calls
- **Expected**: No memory leaks, stable performance
- **Actual**: [To be filled]

---

## Security Testing

### Webhook Signature Validation
- [ ] Invalid signature rejected (401)
- [ ] Valid signature accepted (200)
- [ ] Timestamp verification works
- [ ] Replay attack prevention

### Input Validation
- [ ] SQL injection attempts blocked
- [ ] XSS attempts blocked
- [ ] Invalid phone numbers rejected
- [ ] Invalid emails rejected

---

## Monitoring During Test

### Metrics to Monitor
- [ ] CPU usage
- [ ] Memory usage
- [ ] Response times
- [ ] Error rates
- [ ] Webhook delivery rate
- [ ] Email delivery rate

### Logs to Review
- [ ] Application logs
- [ ] Nginx access logs
- [ ] Nginx error logs
- [ ] PM2 logs
- [ ] Telnyx webhook logs

---

## Test Results Summary

### Pass/Fail Status
- Test 1: [ ] PASS / FAIL
- Test 2: [ ] PASS / FAIL
- Test 3: [ ] PASS / FAIL
- Test 4: [ ] PASS / FAIL
- Test 5: [ ] PASS / FAIL
- Test 6: [ ] PASS / FAIL
- Test 7: [ ] PASS / FAIL
- Test 8: [ ] PASS / FAIL
- Test 9: [ ] PASS / FAIL
- Test 10: [ ] PASS / FAIL
- Test 11: [ ] PASS / FAIL
- Test 12: [ ] PASS / FAIL
- Test 13: [ ] PASS / FAIL
- Test 14: [ ] PASS / FAIL
- Test 15: [ ] PASS / FAIL

### Overall Result
- [ ] ALL TESTS PASSED
- [ ] SOME TESTS FAILED (see details)
- [ ] CRITICAL FAILURES (block production)

### Issues Found
1. [Description]
2. [Description]
3. [Description]

### Recommendations
1. [Recommendation]
2. [Recommendation]
3. [Recommendation]

---

## Sign-off

**Tested By**: ___________________
**Date**: ___________________
**Approved By**: ___________________
**Date**: ___________________

---

## Next Steps After Testing

If all tests pass:
1. Document any minor issues
2. Create production deployment plan
3. Schedule production deployment
4. Prepare production environment

If tests fail:
1. Document all failures
2. Prioritize fixes
3. Re-test after fixes
4. Repeat until all tests pass

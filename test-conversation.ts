/**
 * Simple Conversation State Machine Test
 * Tests the conversation flow without requiring full server deployment
 */

import conversationStateMachine from './src/services/conversation-state-machine/conversation-state-machine.service';

console.log('==========================================');
console.log('AI Voice Platform - Conversation Test');
console.log('==========================================\n');

async function testConversation() {
  const sessionId = 'test-session-001';
  const phoneNumber = '+15551234567';

  console.log('1. Initializing conversation state...');
  await conversationStateMachine.initializeState(sessionId, phoneNumber);
  console.log('✓ Conversation initialized\n');

  console.log('2. Testing Greeting stage...');
  let response = await conversationStateMachine.processInput(sessionId, 'Hello');
  console.log(`AI Response: "${response}"`);
  console.log('Expected: "Hi [name]… this is Sophia from Up Start Loans. Am I speaking with [name] please?"\n');

  console.log('3. Testing customer confirmation...');
  response = await conversationStateMachine.processInput(sessionId, 'Yes, this is John');
  console.log(`AI Response: "${response}"`);
  console.log('Expected: "Just a quick call… because you recently applied for a loan online. Are you still looking for a loan today?"\n');

  console.log('4. Testing loan interest...');
  response = await conversationStateMachine.processInput(sessionId, 'Yes, I am interested');
  console.log(`AI Response: "${response}"`);
  console.log('Expected: "What loan amount are you looking for today?"\n');

  console.log('5. Testing loan amount...');
  response = await conversationStateMachine.processInput(sessionId, 'I need $5,000');
  console.log(`AI Response: "${response}"`);
  console.log('Expected: "Okay, $5,000. I see we have your email on file. Is this still correct?"\n');

  console.log('6. Testing email confirmation...');
  response = await conversationStateMachine.processInput(sessionId, 'Yes, that\'s correct');
  console.log(`AI Response: "${response}"`);
  console.log('Expected: "Perfect… I\'ll send your secure application link right now."\n');

  console.log('7. Testing objection handling...');
  const objectionSession = 'test-session-002';
  await conversationStateMachine.initializeState(objectionSession, phoneNumber);
  await conversationStateMachine.processInput(objectionSession, 'Hello');
  await conversationStateMachine.processInput(objectionSession, 'Yes, this is John');
  response = await conversationStateMachine.processInput(objectionSession, 'I don\'t need a loan');
  console.log(`AI Response: "${response}"`);
  console.log('Expected: "That\'s completely okay. I just wanted to make sure you had the information available if your situation changes."\n');

  console.log('8. Testing human transfer...');
  const transferSession = 'test-session-003';
  await conversationStateMachine.initializeState(transferSession, phoneNumber);
  await conversationStateMachine.processInput(transferSession, 'Hello');
  await conversationStateMachine.processInput(transferSession, 'Yes, this is John');
  response = await conversationStateMachine.processInput(transferSession, 'I want to speak to a human');
  console.log(`AI Response: "${response}"`);
  console.log('Expected: Transfer to human agent\n');

  console.log('==========================================');
  console.log('Conversation Test Complete');
  console.log('==========================================');
}

testConversation().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});

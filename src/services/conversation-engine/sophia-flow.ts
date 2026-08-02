import { ConversationContext, FunctionCall } from './types';

export interface StageResult {
  spokenText: string;
  toolCalls: FunctionCall[];
  stateUpdates: Record<string, any>;
}

const YES_WORDS = ['yes', 'yeah', 'yep', 'yup', 'sure', 'correct', 'right', 'speaking', 'this is', 'affirmative', 'ok', 'okay', 'go ahead', 'sounds good', 'good', 'fine'];
const NO_WORDS = ['no', 'nope', 'not interested', 'not really', 'nah', 'don\'t need', 'do not need', 'wrong number', 'not me'];
// Common phrases that contain a bare "no" but are actually affirmative/neutral
// in context (e.g. "no problem" said in response to a yes/no question means
// agreement, not refusal). These must be checked before the generic NO_WORDS
// substring match to avoid misclassifying them as negative.
const NEGATIVE_FALSE_POSITIVES = ['no problem', 'no worries', 'not a problem', 'no issue', 'no issues'];

function stripNegativeFalsePositives(text: string): string {
  let stripped = text;
  for (const phrase of NEGATIVE_FALSE_POSITIVES) {
    stripped = stripped.split(phrase).join('');
  }
  return stripped;
}

export function isAffirmative(text: string): boolean {
  const lower = stripNegativeFalsePositives(text.toLowerCase().trim());
  if (NO_WORDS.some((w) => lower.includes(w))) return false;
  // A bare "yes"/"ok" that's actually prefacing a real question (e.g. "yes,
  // but why do you need my email?") must not be treated as a plain
  // confirmation, or the deterministic stage would silently skip the
  // question and jump straight to the next scripted line.
  if (looksLikeQuestion(text)) return false;
  return YES_WORDS.some((w) => lower.includes(w));
}

export function isNegative(text: string): boolean {
  const lower = stripNegativeFalsePositives(text.toLowerCase().trim());
  return NO_WORDS.some((w) => lower.includes(w));
}

const QUESTION_WORDS = ['why', 'what', 'how', 'when', 'where', 'who', 'which', 'can i', 'can you', 'is it', 'is this', 'do i', 'does it', 'will it', 'are you'];

// PROGRESS_WORDS/YES_WORDS use loose substring matching against very common
// filler words ("ok", "yes", "done"...). Customers often preface a genuine
// question with one of these ("okay, but why do you need my bank info?"), so
// without this guard the deterministic layer would treat the whole utterance
// as a bare acknowledgment, silently skip the question, and jump straight to
// the next canned application step. Treat anything containing a "?" or a
// question word as NOT a plain acknowledgment so it falls through to
// FAQ/LLM handling instead.
export function looksLikeQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes('?')) return true;
  return QUESTION_WORDS.some((w) => lower.includes(w));
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
};

function wordsToNumber(text: string): number | null {
  const words = text.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let found = false;
  for (const word of words) {
    const value = NUMBER_WORDS[word];
    if (value === undefined) continue;
    found = true;
    if (value === 100) {
      current = (current || 1) * value;
    } else if (value === 1000) {
      current = (current || 1) * value;
      total += current;
      current = 0;
    } else {
      current += value;
    }
  }
  total += current;
  return found ? total : null;
}

export function extractLoanAmount(text: string): number | null {
  const digitMatch = text.replace(/,/g, '').match(/\$?\s*(\d{2,6})\s*(k|thousand)?/i);
  if (digitMatch) {
    let amount = parseFloat(digitMatch[1]);
    if (digitMatch[2]) amount *= 1000;
    if (amount >= 100 && amount <= 1000000) return Math.round(amount);
  }
  const wordAmount = wordsToNumber(text);
  if (wordAmount && wordAmount >= 100) return wordAmount;
  return null;
}

export function extractEmail(text: string): string | null {
  const directMatch = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  if (directMatch) return directMatch[0].toLowerCase();

  // Handle spoken-out emails like "john dot doe at gmail dot com"
  let normalized = text
    .toLowerCase()
    .replace(/\s+at\s+/g, '@')
    .replace(/\s+dot\s+/g, '.')
    .replace(/\s+underscore\s+/g, '_')
    .replace(/\s+dash\s+/g, '-')
    .replace(/\s+/g, '');

  const spokenMatch = normalized.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  return spokenMatch ? spokenMatch[0] : null;
}

interface FaqEntry {
  triggers: string[];
  response: string;
}

export const SOPHIA_FAQ: FaqEntry[] = [
  { triggers: ['who are you', 'who is this', 'what company', 'where are you calling from'], response: 'I am Sophia from Up Start Loans.' },
  { triggers: ['is this a scam', 'scam', 'legit', 'can i trust', 'fraud', 'is this real', 'fake'], response: 'No, this is a legitimate call regarding your submitted loan inquiry with Up Start Loans.' },
  { triggers: ['interest rate', 'apr', 'how much interest', 'what percent'], response: 'Your exact rate depends on your credit profile and will show in the application before you sign anything.' },
  { triggers: ['how long does it take', 'how soon', 'how fast', 'when will i get', 'funding time'], response: 'Most customers receive funds within one to two business days after approval.' },
  { triggers: ['credit check', 'credit score', 'hard pull', 'affect my credit', 'hurt my credit'], response: 'We start with a soft credit check which does not impact your credit score.' },
  { triggers: ['fees', 'application fee', 'hidden fees', 'pay anything', 'charge me'], response: 'There are no application fees. All costs are clearly shown in your loan agreement before you sign.' },
  { triggers: ['how did you get my number', 'where did you get my number'], response: 'You submitted a loan inquiry online and your profile was selected.' },
  { triggers: ['why do you need my email', 'why email'], response: 'We use your email to send your secure application link.' },
  { triggers: ['why do you need my social', 'social security', 'ssn'], response: 'Social Security number is required for identity verification and compliance with federal lending regulations.' },
  { triggers: ['why bank', 'bank information', 'routing number', 'account number'], response: 'We need your bank details so the loan company knows where to deposit your funds if you are approved.' },
  { triggers: ['username', 'password'], response: 'Login details are used only for instant account verification, not for accessing your funds. This is standard for online lending.' },
  { triggers: ['is this safe', 'unsafe', 'is this secure'], response: 'Yes, everything is handled over a secure encrypted connection used for identity verification only.' },
  { triggers: ['speak to a human', 'talk to a person', 'live agent', 'real person', 'transfer me'], response: 'Of course, one moment while I transfer you to an account specialist.' },
];

// Fixed, deterministic script lines for each application step (verbatim from
// the Sophia persona's APPLICATION GUIDANCE reference). Tracking progression
// through these here — instead of relying on the LLM to remember/report
// which step the customer is on — is what prevents the "stuck repeating the
// same line forever" failure mode.
export const APPLICATION_STEP_SCRIPTS: Record<number, string> = {
  1: 'Please select my name, Sophia Jones.',
  2: 'You can choose any amount between two thousand and twenty five thousand dollars depending on your needs.',
  3: "The loan term is how long you'd like your payments spread out, anywhere from six to sixty months. Choose what works best for you.",
  4: 'Just choose the option that best matches what you plan to use the funds for.',
  5: 'This section is just basic identity and contact information needed for the application review.',
  6: "If you can't find your bank, that's okay. Please scroll down and select the Other option at the bottom.",
  7: 'This step is bank verification. It helps confirm account ownership and complete the standard review process.',
  8: 'This is the loan agreement. It explains the terms, authorization, and application review process.',
  9: 'This confirms electronically that you want to continue with your application review.',
  10: 'You can complete your signature using your finger on your phone or your mouse.',
  11: 'This password gives you secure access to your application dashboard.',
};
export const TOTAL_APPLICATION_STEPS = Object.keys(APPLICATION_STEP_SCRIPTS).length;

const PROGRESS_WORDS = ['done', 'next', 'okay', 'ok', 'got it', 'opened', 'i see it', "i'm there", 'ready', 'moved on', 'finished', 'yes', 'yeah'];
const STEP_DONE_WORDS = ['done', 'finished', 'completed', 'selected', 'entered', 'filled', 'filled in', 'submitted', 'signed', 'next'];
const TRANSFER_WORDS = ['human', 'real person', 'live agent', 'speak to a person', 'talk to a person', 'representative', 'transfer me'];
const END_WORDS = ['bye', 'goodbye', 'hang up', "that's all", 'no thanks', "i'm done", 'stop calling'];
const HESITANT_WORDS = ['nervous', 'scared', 'not comfortable', 'unsafe', "don't trust", 'worried', 'uncomfortable'];
const CONFUSED_WORDS = ['confused', "don't know", 'not sure', 'help me', "don't understand", 'what do i do', 'i need help'];
// Only treat these explicit phrases as confirmation the customer is actually on the website.
const WEBSITE_OPENED_WORDS = ['opened', 'i see it', 'i see the', 'i can see it', "i'm there", 'i am there', 'it loaded', 'page loaded', 'loaded', 'website open', 'site open', 'app open'];

// Screen-aware application step detection. Returns the 1-11 step number the customer is describing.
function detectApplicationStep(text: string): number | null {
  const lower = text.toLowerCase();
  if (lower.includes('select your loan agent') || (lower.includes('loan agent') && lower.includes('select')) || (lower.includes('agent') && !lower.includes('agency'))) return 1;
  if (lower.includes('loan amount') || lower.includes('amount')) return 2;
  if (lower.includes('loan term') || lower.includes('term') || lower.includes('how long')) return 3;
  if (lower.includes('loan purpose') || lower.includes('purpose')) return 4;
  if (lower.includes('personal information') || lower.includes('first name') || lower.includes('last name') || lower.includes('home address') || lower.includes('date of birth') || lower.includes('ssn') || lower.includes('social security')) return 5;
  if (lower.includes('bank information') || lower.includes('routing number') || lower.includes('account number') || lower.includes('bank name')) return 6;
  if (lower.includes('bank verification') || lower.includes('verification') || lower.includes('bank login')) return 7;
  if (lower.includes('loan agreement') || lower.includes('agreement')) return 8;
  if (lower.includes('digital agreement') || lower.includes('digital')) return 9;
  if (lower.includes('signature') || lower.includes('sign')) return 10;
  if (lower.includes('dashboard password') || lower.includes('password') || lower.includes('dashboard')) return 11;
  return null;
}
// Phrases meaning the customer did not receive or cannot find the email.
// STT may drop apostrophes, so include both contracted and uncontracted forms.
const EMAIL_NOT_RECEIVED_WORDS = [
  "didn't get", 'did not get', "didnt get", 'didnt get it', "didn't get it", 'did not get it',
  "haven't got", 'have not got', "didn't receive", 'did not receive', "didnt receive", 'didnt receive it',
  'not received', 'never got', 'never received', 'no email', 'no link', 'no mail', 'nothing in my inbox',
  "can't find", 'cannot find', 'cant find', "don't see", 'do not see', 'dont see', 'dont see it',
  'not there', 'not in my inbox', 'not in inbox', 'inbox empty', 'where is the email', 'where is it',
];

function detectSupportMode(text: string): 'FULL_GUIDANCE' | 'HESITANT' | null {
  const lower = text.toLowerCase();
  if (HESITANT_WORDS.some((w) => lower.includes(w))) return 'HESITANT';
  if (CONFUSED_WORDS.some((w) => lower.includes(w))) return 'FULL_GUIDANCE';
  return null;
}

export function matchFaq(text: string): string | null {
  const lower = text.toLowerCase();
  for (const entry of SOPHIA_FAQ) {
    if (entry.triggers.some((t) => lower.includes(t))) {
      return entry.response;
    }
  }
  return null;
}

export function stageQuestion(stage: string, context: ConversationContext): string {
  const name = context.customerName || 'the customer';
  const email = context.customerEmail;
  const hasEmail = !!email && email !== 'Not on file';

  switch (stage) {
    case 'greeting':
    case 'identity_confirmation':
      return `Hi ${name}, this is Sophia from Up Start Loans. How are you doing today?`;
    case 'interest_confirmation':
      return 'Are you still looking for a loan today?';
    case 'loan_amount':
      return 'What loan amount are you looking for today?';
    case 'email_confirmation':
      return hasEmail && !context.state?.email_sent
        ? `Perfect. I have your email as ${email}. If I send you the application now, do you have a few minutes to complete it with me?`
        : hasEmail
          ? `Do you see the website link?`
          : 'Could you provide your best email address so I can send you the application link?';
    case 'application_guidance': {
      const subStep = context.state?.current_application_step;
      if (subStep === 'email_link') return 'You should receive an email from Up Start Loans. Do you see the website link?';
      if (subStep === 'website_open') return "Perfect. Please open the website. Once it's open, let me know. I'll stay right here with you.";
      if (subStep === 'awaiting_screen' || subStep === undefined || subStep === '0') return 'Great. What do you see on the screen?';
      const step = Number(subStep);
      if (step >= 1 && step <= TOTAL_APPLICATION_STEPS) return APPLICATION_STEP_SCRIPTS[step];
      return 'Great. What do you see on the screen?';
    }
    default:
      return '';
  }
}

/**
 * Deterministic stage handler. Returns null when the user's message is
 * ambiguous for this stage (caller should fall back to FAQ/LLM, then
 * re-ask the stage question to guarantee forward progress).
 */
export function handleDeterministicStage(
  stage: string,
  context: ConversationContext,
  userMessage: string
): StageResult | null {
  const name = context.customerName || 'the customer';
  const email = context.customerEmail;
  const hasEmail = !!email && email !== 'Not on file';

  switch (stage) {
    case 'greeting':
    case 'identity_confirmation': {
      if (isNegative(userMessage)) {
        return {
          spokenText: 'No problem, thanks for your time. Have a great day.',
          toolCalls: [{ name: 'endCall', parameters: {} }],
          stateUpdates: { identity_confirmed: false },
        };
      }
      if (isAffirmative(userMessage)) {
        return {
          spokenText: "I'm glad to hear that. I called today because you had submitted an online request regarding a loan, and I wanted to check whether you're still interested.",
          toolCalls: [],
          stateUpdates: { currentStage: 'interest_confirmation', identity_confirmed: true },
        };
      }
      return null;
    }

    case 'interest_confirmation': {
      if (isNegative(userMessage)) {
        return {
          spokenText: 'No problem at all, thanks for your time. Have a great day.',
          toolCalls: [{ name: 'endCall', parameters: {} }],
          stateUpdates: {},
        };
      }
      if (isAffirmative(userMessage)) {
        return {
          spokenText: 'Great, what loan amount are you looking for today?',
          toolCalls: [],
          stateUpdates: { currentStage: 'loan_amount', interest_confirmed: true },
        };
      }
      return null;
    }

    case 'loan_amount': {
      const amount = extractLoanAmount(userMessage);
      if (amount !== null) {
        const spokenText = hasEmail
          ? `Perfect. I have your email as ${email}. If I send you the application now, do you have a few minutes to complete it with me?`
          : 'Got it. Could you provide your best email address so I can send you the application link?';
        return {
          spokenText,
          toolCalls: [],
          stateUpdates: { currentStage: 'email_confirmation', loan_amount: amount },
        };
      }
      return null;
    }

    case 'email_confirmation': {
      if (hasEmail && (isAffirmative(userMessage) || PROGRESS_WORDS.some((w) => userMessage.toLowerCase().includes(w))) && !extractEmail(userMessage)) {
        return {
          spokenText: "Perfect. I've just sent it. You should receive an email from Up Start Loans. Do you see the website link?",
          toolCalls: [{ name: 'sendLoanEmail', parameters: { email } }],
          stateUpdates: { email_confirmed: true, email_sent: true, application_started: true, currentStage: 'application_guidance', current_application_step: 'email_link' },
        };
      }
      const newEmail = extractEmail(userMessage);
      if (newEmail) {
        return {
          spokenText: "Perfect. I've just sent it. You should receive an email from Up Start Loans. Do you see the website link?",
          toolCalls: [{ name: 'sendLoanEmail', parameters: { email: newEmail } }],
          stateUpdates: { email_confirmed: true, email_sent: true, application_started: true, currentStage: 'application_guidance', current_application_step: 'email_link', customerEmail: newEmail },
        };
      }
      if (isNegative(userMessage)) {
        return {
          spokenText: "No problem, just let me know if you'd like to continue.",
          toolCalls: [],
          stateUpdates: {},
        };
      }
      return null;
    }

    case 'application_guidance': {
      const lower = userMessage.toLowerCase();
      const state = context.state || { currentStage: stage };

      if (TRANSFER_WORDS.some((w) => lower.includes(w))) {
        return {
          spokenText: 'Sure, one moment while I transfer you.',
          toolCalls: [{ name: 'transferCall', parameters: { to: '4702063218' } }],
          stateUpdates: { transferRequired: true },
        };
      }

      if (END_WORDS.some((w) => lower.includes(w))) {
        return {
          spokenText: 'No problem, have a great day.',
          toolCalls: [{ name: 'endCall', parameters: {} }],
          stateUpdates: {},
        };
      }

      // If the customer says they did not get the email, resend it and
      // reset the website-opened gate so we wait for them to actually open it.
      if (EMAIL_NOT_RECEIVED_WORDS.some((w) => lower.includes(w))) {
        return {
          spokenText: "I apologize, let me resend it right now. Please check your inbox and spam folder. Let me know once the website opens.",
          toolCalls: [{ name: 'sendLoanEmail', parameters: { email: context.customerEmail } }],
          stateUpdates: { website_opened: false, current_application_step: 'email_link' },
        };
      }

      const subStep = state.current_application_step || 'email_link';

      // Phase 1: the customer needs to see the website link in the email
      if (subStep === 'email_link') {
        if (YES_WORDS.some((w) => lower.includes(w)) || PROGRESS_WORDS.some((w) => lower.includes(w)) || lower.includes('see') || lower.includes('got it')) {
          return {
            spokenText: "Perfect. Please open the website. Once it's open, let me know. I'll stay right here with you.",
            toolCalls: [],
            stateUpdates: { current_application_step: 'website_open' },
          };
        }
        return {
          spokenText: 'Do you see the website link?',
          toolCalls: [],
          stateUpdates: {},
        };
      }

      // Phase 2: the customer needs to open the website
      if (subStep === 'website_open') {
        if (WEBSITE_OPENED_WORDS.some((w) => lower.includes(w))) {
          return {
            spokenText: 'Great. What do you see on the screen?',
            toolCalls: [],
            stateUpdates: { website_opened: true, current_application_step: 'awaiting_screen', application_started: true },
          };
        }
        return {
          spokenText: "Perfect. Please open the website. Once it's open, let me know. I'll stay right here with you.",
          toolCalls: [],
          stateUpdates: {},
        };
      }

      // Phase 3: screen-aware guidance one step at a time
      const currentStep = Number(subStep);
      const isAwaitingScreen = isNaN(currentStep) || currentStep <= 0;
      const detectedStep = detectApplicationStep(userMessage);

      // Customer is indicating a step is complete
      const stepDone = STEP_DONE_WORDS.some((w) => lower.includes(w));
      if (!isAwaitingScreen && stepDone) {
        return {
          spokenText: 'Perfect. What do you see next?',
          toolCalls: [],
          stateUpdates: { current_application_step: 'awaiting_screen' },
        };
      }

      // Customer describes the current or a new screen, or is ahead
      if (detectedStep) {
        let instruction = APPLICATION_STEP_SCRIPTS[detectedStep];
        if (detectedStep === 2 && state.loan_amount) {
          const amount = String(state.loan_amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
          instruction = `Enter the $${amount} amount we discussed.`;
        }
        return {
          spokenText: `Perfect. ${instruction}`,
          toolCalls: [],
          stateUpdates: { current_application_step: String(detectedStep) },
        };
      }

      const mode = detectSupportMode(userMessage);
      if (mode === 'HESITANT') {
        return {
          spokenText: "I completely understand your concern. Take your time, I'm here to explain anything that feels unclear.",
          toolCalls: [],
          stateUpdates: { customer_support_mode: 'HESITANT' },
        };
      }

      if (mode === 'FULL_GUIDANCE') {
        return {
          spokenText: 'No problem. What do you see on the screen right now?',
          toolCalls: [],
          stateUpdates: { customer_support_mode: 'FULL_GUIDANCE' },
        };
      }

      return {
        spokenText: 'What do you see on the screen?',
        toolCalls: [],
        stateUpdates: {},
      };
    }

    default:
      return null;
  }
}

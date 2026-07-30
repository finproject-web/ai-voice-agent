import { ConversationContext, FunctionCall } from './types';

export interface StageResult {
  spokenText: string;
  toolCalls: FunctionCall[];
  stateUpdates: Record<string, any>;
}

const YES_WORDS = ['yes', 'yeah', 'yep', 'yup', 'sure', 'correct', 'right', 'speaking', 'this is', 'affirmative', 'ok', 'okay', 'go ahead', 'sounds good'];
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
  return YES_WORDS.some((w) => lower.includes(w));
}

export function isNegative(text: string): boolean {
  const lower = stripNegativeFalsePositives(text.toLowerCase().trim());
  return NO_WORDS.some((w) => lower.includes(w));
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
  1: "On that screen, you'll simply select my name, Sophia, as your loan assistant.",
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
const TRANSFER_WORDS = ['human', 'real person', 'live agent', 'speak to a person', 'talk to a person', 'representative', 'transfer me'];
const END_WORDS = ['bye', 'goodbye', 'hang up', "that's all", 'no thanks', "i'm done", 'stop calling'];
const HESITANT_WORDS = ['nervous', 'scared', 'not comfortable', 'unsafe', "don't trust", 'worried', 'uncomfortable'];
const CONFUSED_WORDS = ['confused', "don't know", 'not sure', 'help me', "don't understand", 'what do i do', 'i need help'];

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
      return `Can I talk to ${name}?`;
    case 'interest_confirmation':
      return 'Are you still looking for a loan today?';
    case 'loan_amount':
      return 'What loan amount are you looking for today?';
    case 'email_confirmation':
      return hasEmail
        ? `Is ${email} still the correct email?`
        : 'Could you provide your best email address so I can send you the application link?';
    case 'application_guidance': {
      const step = Number(context.state?.current_application_step) || 0;
      if (!context.state?.website_opened) {
        return 'Please open the email and let me know once the website opens.';
      }
      return APPLICATION_STEP_SCRIPTS[step] || APPLICATION_STEP_SCRIPTS[1];
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
          spokenText: "Great. I'm calling because you recently applied for a loan and your application has been pre-qualified. Are you still looking for a loan today?",
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
          ? `Got it. I have your email as ${email}. Is that still correct?`
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
      if (hasEmail && isAffirmative(userMessage) && !extractEmail(userMessage)) {
        return {
          spokenText: "Great, I'm sending the application email now.",
          toolCalls: [{ name: 'sendLoanEmail', parameters: { email } }],
          stateUpdates: { email_confirmed: true, email_sent: true, application_started: true, currentStage: 'application_guidance' },
        };
      }
      const newEmail = extractEmail(userMessage);
      if (newEmail) {
        return {
          spokenText: "Thanks, I'll send it to that email now.",
          toolCalls: [{ name: 'sendLoanEmail', parameters: { email: newEmail } }],
          stateUpdates: { email_confirmed: true, email_sent: true, application_started: true, currentStage: 'application_guidance', customerEmail: newEmail },
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

      // Gate: the customer must confirm the website/application is open
      // before we start walking through numbered steps.
      if (!state.website_opened) {
        if (isAffirmative(userMessage) || PROGRESS_WORDS.some((w) => lower.includes(w))) {
          return {
            spokenText: `Great. ${APPLICATION_STEP_SCRIPTS[1]}`,
            toolCalls: [],
            stateUpdates: { website_opened: true, current_application_step: 1, application_started: true },
          };
        }
        return null;
      }

      const mode = detectSupportMode(userMessage);

      if (mode === 'HESITANT') {
        return {
          spokenText: "I completely understand your concern. Take your time, I'm here to explain anything that feels unclear.",
          toolCalls: [],
          stateUpdates: { customer_support_mode: 'HESITANT' },
        };
      }

      const currentStep = Number(state.current_application_step) || 0;
      if (currentStep >= TOTAL_APPLICATION_STEPS) {
        return null;
      }

      if (PROGRESS_WORDS.some((w) => lower.includes(w)) || mode === 'FULL_GUIDANCE') {
        const nextStep = currentStep === 0 ? 1 : Math.min(currentStep + 1, TOTAL_APPLICATION_STEPS);
        return {
          spokenText: APPLICATION_STEP_SCRIPTS[nextStep],
          toolCalls: [],
          stateUpdates: {
            current_application_step: nextStep,
            customer_support_mode: mode || state.customer_support_mode || 'SELF_SERVICE',
            ...(nextStep >= TOTAL_APPLICATION_STEPS ? { application_completed: true } : {}),
          },
        };
      }

      return null;
    }

    default:
      return null;
  }
}

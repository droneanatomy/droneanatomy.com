/* ============================================================
   enquirySteps — what the enquiry asks, in what order, and what
   counts as answered.

   A REGISTRY, not markup. Same shape as flightBeats' SCENES and the
   topo's summits: the content of the beat is data, the component only
   knows how to render a Field. Adding a question is a line here rather
   than a new branch in the dialog, and the validation gate that decides
   when NEXT lights up is derived from the same table instead of being a
   second list that can drift out of step with the first.

   THE THREE STEPS ARE THE POINT. One long form asks for everything
   before it has earned anything; three named steps ask for a little,
   acknowledge it, and ask for a little more. The reference splits at
   exactly the same seam — who you are, what it is about, then the
   detail — and that ordering is doing the work, not the styling.
   ============================================================ */

export type Field =
  | {
      kind: 'text' | 'email';
      name: string;
      label: string;
      ph: string;
      required?: boolean;
      autoComplete?: string;
    }
  /* Dial code + number as one field. They are two controls and one
     answer, so validation and layout both want them together. */
  | { kind: 'phone'; name: string; label: string; ph: string; required?: boolean }
  | { kind: 'select'; name: string; label: string; ph: string; options: string[]; required?: boolean }
  | { kind: 'textarea'; name: string; label: string; ph: string; rows: number; required?: boolean };

export interface Step {
  id: string;
  /* Shown next to the number. Kept short — it is a label for a stage,
     not a sentence. */
  title: string;
  fields: Field[];
}

/* Dial codes, India first.

   Ordered by who actually enquires rather than alphabetically, because
   an alphabetical list buries the common case at position 30 and every
   visitor pays for the rare one. */
export const DIAL_CODES: { code: string; label: string }[] = [
  { code: '+91', label: 'IN (+91)' },
  { code: '+1', label: 'US (+1)' },
  { code: '+44', label: 'GB (+44)' },
  { code: '+971', label: 'AE (+971)' },
  { code: '+65', label: 'SG (+65)' },
  { code: '+61', label: 'AU (+61)' },
  { code: '+49', label: 'DE (+49)' },
  { code: '+33', label: 'FR (+33)' },
  { code: '+31', label: 'NL (+31)' },
  { code: '+81', label: 'JP (+81)' },
  { code: '+27', label: 'ZA (+27)' },
];

export const STEPS: Step[] = [
  {
    id: 'you',
    title: 'Your details',
    fields: [
      { kind: 'text', name: 'name', label: 'Your name', ph: 'Your name', required: true, autoComplete: 'name' },
      { kind: 'email', name: 'email', label: 'Your email', ph: 'you@company.com', required: true, autoComplete: 'email' },
      { kind: 'phone', name: 'phone', label: 'Your phone number', ph: 'Phone (optional)' },
      {
        kind: 'select',
        name: 'source',
        label: 'How did you find us?',
        ph: 'How did you find us?',
        options: ['Search', 'A referral', 'LinkedIn', 'Instagram', 'A trade show', 'An article', 'Somewhere else'],
      },
    ],
  },
  {
    id: 'about',
    title: 'What you need',
    fields: [
      {
        kind: 'select',
        name: 'intent',
        label: 'What can we help with?',
        ph: 'What can we help with?',
        required: true,
        options: [
          'Buying a platform',
          'A custom build',
          'Survey & mapping work',
          'Inspection work',
          'A partnership',
          'Support for a platform I own',
          'Something else',
        ],
      },
      {
        kind: 'select',
        name: 'platform',
        label: 'Which platform',
        ph: 'Which platform? (optional)',
        options: ['P10 Pro', 'NOXR-1', 'Cyclops 3', 'Cyclops Mini', 'LiftX 100', 'Not sure yet'],
      },
      {
        kind: 'select',
        name: 'timeline',
        label: 'When you need it',
        ph: 'When do you need it?',
        options: ['As soon as possible', 'Within a month', 'This quarter', 'Later this year', 'Just exploring'],
      },
    ],
  },
  {
    id: 'more',
    title: 'A little more',
    fields: [
      {
        kind: 'select',
        name: 'budget',
        label: 'Budget range',
        ph: 'Budget range (optional)',
        options: ['Under ₹5L', '₹5L – ₹20L', '₹20L – ₹50L', '₹50L+', 'Not decided'],
      },
      {
        kind: 'textarea',
        name: 'message',
        label: 'Your message',
        ph: 'Where does it need to fly, and what does it need to see?',
        rows: 4,
        required: true,
      },
    ],
  },
];

export type Values = Record<string, string>;

/* Deliberately permissive.

   A stricter pattern rejects addresses that are perfectly valid — plus
   tags, new TLDs, non-ASCII locals — and the only thing that actually
   proves an address works is sending to it. This catches the typo class
   of error (no @, no dot, a trailing space) and gets out of the way. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function fieldValid(f: Field, values: Values): boolean {
  const v = (values[f.name] ?? '').trim();
  if (!f.required) return true;
  if (f.kind === 'email') return EMAIL.test(v);
  return v.length > 0;
}

/* Whether a step has been answered well enough to move on. Drives NEXT's
   enabled state, so the gate and the asterisks can never disagree. */
export function stepValid(step: Step, values: Values): boolean {
  return step.fields.every((f) => fieldValid(f, values));
}

export function allValid(values: Values): boolean {
  return STEPS.every((s) => stepValid(s, values));
}

/* The first step that still has something missing, or -1 if none do.
   Used to send the viewer back to the real problem when they hit SEND
   early, rather than showing a message about a field they cannot see. */
export function firstIncomplete(values: Values): number {
  return STEPS.findIndex((s) => !stepValid(s, values));
}

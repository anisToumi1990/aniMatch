import type { AreaLevel, CompatibilityArea } from '@/lib/compatibilityV2';

/**
 * Compatibility v2 texts (docs/compatibility-v2-proposal.md, section 4).
 * Rule: clear first, witty second. No idioms, nothing that needs a second read,
 * no names or pronouns, so every line works for any pair and relationship type.
 */

/** Bar labels. A high score is always good, so "Conflict" reads as "Handling conflict". */
export const AREA_LABELS: Record<CompatibilityArea, string> = {
  communication: 'Communication',
  energy: 'Energy',
  conflict: 'Handling conflict',
  values: 'Shared values',
};

export const AREA_COPY: Record<CompatibilityArea, Record<AreaLevel, string>> = {
  communication: {
    high: 'You understand each other easily, even on hard topics. Rare, and very handy.',
    medium: 'You mostly understand each other. When something sounds off, ask before assuming.',
    low: 'The same words often mean different things to you two. Check what the other meant.',
  },
  energy: {
    high: 'You like the same pace and the same plans. Picking a weekend takes seconds.',
    medium: 'One of you often wants more action than the other. Take turns choosing.',
    low: 'One of you wants to go out, the other wants to stay in. Plan some of each.',
  },
  conflict: {
    high: 'You rarely fight, and when you do, you both calm down fast.',
    medium: 'You argue sometimes and get past it. Try not to bring up old fights.',
    low: 'Small disagreements turn into fights quickly. Agree now on how to take a break.',
  },
  values: {
    high: 'You want the same things from life, and you would plan them the same way.',
    medium: 'You want similar things but go about them differently. Agree on the plan first.',
    low: 'What matters most to each of you is different. Talk about priorities early.',
  },
};

export const CLICK_TITLE = 'Where you click';
export const CLASH_TITLE = 'Where you clash';

// Rules that check a Money Circle post before it can be added. Plain code, so it works with no AI.
// This catches the obvious cases, not everything: a real board also needs human moderators.

const RULES: { reason: string; test: RegExp }[] = [
  { reason: 'It looks like a card number. Never share one here.', test: /\b(?:\d[ -]?){13,19}\b/ },
  { reason: 'It looks like bank details. Never share a sort code or account number here.', test: /\b\d{2}[- ]\d{2}[- ]\d{2}\b|\b(?:sort code|account number)\b|\bIBAN\b/i },
  { reason: 'It looks like a phone number. Keep your post anonymous.', test: /(?:\+44\s?|\b0)\d(?:[\s-]?\d){8,10}\b/ },
  { reason: 'It looks like an email address. Keep your post anonymous.', test: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { reason: 'It looks like a home address or postcode. Keep your post anonymous.', test: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i },
  {
    reason: 'It looks like an offer of a loan or a quick-money scheme. These are not allowed, because they often target people under pressure.',
    test: /\b(?:i|we) (?:can )?(?:lend|loan)\b|\bquick cash\b|\bdm me\b|\bmessage me\b.*\b(?:loan|cash|money|invest)|\bguaranteed (?:returns?|profit|income)\b|\bdouble your money\b|\bcrypto (?:signals?|tips?)\b|\bno credit checks?\b/i,
  },
];

/** The reason a post can't be added, or null if the rules found no problem. */
export function moderationProblem(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 3) return 'Please write a little more.';
  if (trimmed.length > 500) return 'Please keep it under 500 characters.';
  return RULES.find((r) => r.test.test(trimmed))?.reason ?? null;
}

// English only for now. Polish, Hindi and Urdu come back one at a time, each after a native speaker
// has reviewed it (the earlier unreviewed translations are in git at the hackathon-demo tag).
const en: Record<string, string> = {
  safeDays: 'Safe days',
  safeDaysHint: 'How long your money could cover essentials if income stopped',
};

export const t = (key: string) => en[key] ?? key;

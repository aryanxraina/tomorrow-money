import type { Lang } from './types';

type Dict = Record<string, string>;

const en: Dict = {
  money: 'Money',
  snap: 'Snap',
  pay: 'Pay',
  ask: 'Ask',
  more: 'More',
  understand: 'Understand',
  detect: 'Detect',
  predict: 'Predict',
  support: 'Support',
  plan: 'Plan',
  safeDays: 'Safe days',
  safeDaysHint: 'How long your money could cover essentials if income stopped',
  startCheckin: 'Start my check-in',
  tryDemo: 'Try a demo person',
};

const pl: Dict = {
  money: 'Pieniądze',
  snap: 'Paragon',
  pay: 'Płacę',
  ask: 'Zapytaj',
  more: 'Więcej',
  understand: 'Zrozum',
  detect: 'Wykryj',
  predict: 'Przewiduj',
  support: 'Wsparcie',
  plan: 'Plan',
  safeDays: 'Bezpieczne dni',
  safeDaysHint: 'Na ile dni wystarczy pieniędzy na podstawowe wydatki, gdyby dochód się zatrzymał',
  startCheckin: 'Zacznij ankietę',
  tryDemo: 'Wypróbuj osobę demo',
};

const hi: Dict = {
  money: 'पैसा',
  snap: 'रसीद',
  pay: 'भुगतान',
  ask: 'पूछें',
  more: 'और',
  understand: 'समझें',
  detect: 'पहचानें',
  predict: 'अनुमान',
  support: 'सहायता',
  plan: 'योजना',
  safeDays: 'सुरक्षित दिन',
  safeDaysHint: 'आमदनी रुकने पर आपका पैसा ज़रूरी ख़र्चों के लिए कितने दिन चलेगा',
  startCheckin: 'मेरी जाँच शुरू करें',
  tryDemo: 'डेमो व्यक्ति आज़माएँ',
};

const ur: Dict = {
  money: 'پیسہ',
  snap: 'رسید',
  pay: 'ادائیگی',
  ask: 'پوچھیں',
  more: 'مزید',
  understand: 'سمجھیں',
  detect: 'پہچانیں',
  predict: 'پیش گوئی',
  support: 'مدد',
  plan: 'منصوبہ',
  safeDays: 'محفوظ دن',
  safeDaysHint: 'آمدنی رک جائے تو آپ کا پیسہ ضروری اخراجات کے لیے کتنے دن چلے گا',
  startCheckin: 'میرا جائزہ شروع کریں',
  tryDemo: 'ڈیمو شخص آزمائیں',
};

const DICTS: Record<Lang, Dict> = { en, pl, hi, ur };

export function t(lang: Lang, key: string) {
  return DICTS[lang]?.[key] ?? en[key] ?? key;
}

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'pl', label: 'Polski' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'ur', label: 'اردو' },
];

export const isRtl = (l: Lang) => l === 'ur';

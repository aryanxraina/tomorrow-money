import type { Analysis } from './engine/analyse';
import { safeDays } from './engine/analyse';
import { gbp, niceDate } from './engine/dates';
import type { Forecast } from './engine/forecast';
import { CATEGORY_LABEL } from './engine/categorise';
import type { Profile } from './hooks';
import type { Lang } from './types';

export type StepKey = 'understand' | 'detect' | 'predict' | 'support' | 'plan';

const pct = (p: number) => `${Math.round(p * 100)}%`;

/** Compact, numbers-only context the AI is allowed to use (and nothing else). */
export function buildFacts(profile: Profile, an: Analysis, plan: Forecast, selectedTitles: string[]) {
  const f = an.forecast;
  return {
    name: profile.name,
    today: an.today,
    groups: an.groups.map((g) => g.label),
    worry: profile.answers.worry || undefined,
    balance: Math.round(an.balance),
    monthlyIn: Math.round(an.summary.monthlyIn),
    monthlyOut: Math.round(an.summary.monthlyOut),
    essentialsPercentOfIncome: Math.round(an.summary.essentialsRatio * 100),
    topSpending: an.summary.byCategory.slice(0, 4).map((c) => ({ category: CATEGORY_LABEL[c.category], perMonth: Math.round(c.monthly) })),
    problems: an.problems.slice(0, 4).map((p) => ({ title: p.title, perYear: p.annualCost ? Math.round(p.annualCost) : undefined })),
    extraCostsPerYear: Math.round(an.premiumAnnual),
    firstRisk: f.firstRisk
      ? { date: niceDate(f.firstRisk.date), chanceBelowZero: pct(f.firstRisk.p), around: f.firstRisk.trigger?.label }
      : null,
    highestRiskNext90Days: pct(f.maxRisk.p),
    highestRiskDate: niceDate(f.maxRisk.date),
    upcomingBigBills: an.upcoming
      .filter((u) => u.amount < -50)
      .slice(0, 4)
      .map((u) => ({ date: niceDate(u.date), what: u.label, amount: Math.round(-u.amount) })),
    supportPerMonth: Math.round(an.supportMonthly),
    supportOneOff: Math.round(an.supportOneOff),
    supportTop: an.support.slice(0, 3).map((s) => s.title),
    planSteps: selectedTitles.slice(0, 5),
    highestRiskWithPlan: pct(plan.maxRisk.p),
    riskyDaysNext90: f.days.filter((d) => d.pBelow0 >= 0.25).length,
    riskyDaysWithPlan: plan.days.filter((d) => d.pBelow0 >= 0.25).length,
    safeDaysNow: Math.round(an.bufferDays),
    safeDaysIn90DaysWithoutPlan: Math.round(safeDays(an, f, profile.answers.savings)),
    safeDaysIn90DaysWithPlan: Math.round(safeDays(an, plan, profile.answers.savings)),
  };
}

export type Facts = ReturnType<typeof buildFacts>;

type Words = {
  understand: (x: Facts) => string;
  detectSome: (x: Facts) => string;
  detectCost: (x: Facts) => string;
  detectNone: string;
  predictRisk: (x: Facts, around: string) => string;
  predictPeak: (x: Facts) => string;
  predictSteady: (x: Facts) => string;
  around: (what: string) => string;
  supportSome: (x: Facts, oneOff: string) => string;
  supportOneOff: (x: Facts) => string;
  supportNone: string;
  planSome: (x: Facts) => string;
  planNone: string;
  affordRisky: (a: AffordFacts) => string;
  affordOk: (a: AffordFacts) => string;
  saferDate: (date: string) => string;
  askRisk: (x: Facts) => string;
  askSteady: (x: Facts, next: string) => string;
  noneSoon: string;
};

// Program-written wording in every supported language, so the app stays usable with no AI at all.
// Names of bills and problems stay in English because they come from the engine.
const WORDS: Record<Lang, Words> = {
  en: {
    understand: (x) => `About ${gbp(x.monthlyIn)} comes in and ${gbp(x.monthlyOut)} goes out each month. Essentials take ${x.essentialsPercentOfIncome}% of your income.`,
    detectSome: (x) => `We found ${x.problems.length} things to look at, starting with "${x.problems[0].title}".`,
    detectCost: (x) => ` Extra costs add up to about ${gbp(x.extraCostsPerYear)} a year.`,
    detectNone: 'No big problems found. Nice work.',
    predictRisk: (x, around) => `There is a ${x.firstRisk!.chanceBelowZero} chance your balance goes below £0 on ${x.firstRisk!.date}${around}.`,
    predictPeak: (x) => ` The risk reaches ${x.highestRiskNext90Days} by ${x.highestRiskDate}.`,
    predictSteady: (x) => `Your money looks steady for the next 90 days. The highest risk of going below £0 is ${x.highestRiskNext90Days}.`,
    around: (w) => `, around ${w}`,
    supportSome: (x, oneOff) => `You may be missing about ${gbp(x.supportPerMonth)} a month${oneOff}. Start with ${x.supportTop[0]}.`,
    supportOneOff: (x) => ` plus ${gbp(x.supportOneOff)} one-off`,
    supportNone: 'We did not find extra support for you right now. We will check again as things change.',
    planSome: (x) => `With these steps, risky days in the next 3 months go from ${x.riskyDaysNext90} to ${x.riskyDaysWithPlan}, and your safe days go from ${x.safeDaysIn90DaysWithoutPlan} to ${x.safeDaysIn90DaysWithPlan}.`,
    planNone: 'Pick a step below to see how it changes your forecast.',
    affordRisky: (a) => `Not a safe time for ${a.amount}. Buying it today moves your chance of going below £0 in the next 30 days from ${a.riskBefore} to ${a.riskAfter}.`,
    affordOk: (a) => `${a.amount} looks OK. Your chance of going below £0 in the next 30 days goes from ${a.riskBefore} to ${a.riskAfter}.`,
    saferDate: (d) => ` A safer date: ${d}.`,
    askRisk: (x) => `Your first risky day is ${x.firstRisk!.date} (${x.firstRisk!.chanceBelowZero} chance of going below £0). Your plan brings the highest risk down to ${x.highestRiskWithPlan}.`,
    askSteady: (_x, next) => `Your money looks steady for the next 90 days. Next big bill: ${next}.`,
    noneSoon: 'none soon',
  },
  pl: {
    understand: (x) => `Co miesiąc wpływa około ${gbp(x.monthlyIn)}, a wydajesz ${gbp(x.monthlyOut)}. Podstawowe wydatki to ${x.essentialsPercentOfIncome}% Twojego dochodu.`,
    detectSome: (x) => `Znaleźliśmy kilka spraw do sprawdzenia (${x.problems.length}). Pierwsza: "${x.problems[0].title}".`,
    detectCost: (x) => ` Dodatkowe koszty to około ${gbp(x.extraCostsPerYear)} rocznie.`,
    detectNone: 'Nie znaleźliśmy dużych problemów. Dobra robota.',
    predictRisk: (x, around) => `Jest ${x.firstRisk!.chanceBelowZero} szans, że saldo spadnie poniżej £0 w dniu ${x.firstRisk!.date}${around}.`,
    predictPeak: (x) => ` Ryzyko dochodzi do ${x.highestRiskNext90Days} do ${x.highestRiskDate}.`,
    predictSteady: (x) => `Przez najbliższe 90 dni Twoje pieniądze wyglądają stabilnie. Najwyższe ryzyko spadku poniżej £0 to ${x.highestRiskNext90Days}.`,
    around: (w) => `, przy płatności ${w}`,
    supportSome: (x, oneOff) => `Możesz nie otrzymywać około ${gbp(x.supportPerMonth)} miesięcznie${oneOff}. Zacznij od: ${x.supportTop[0]}.`,
    supportOneOff: (x) => ` oraz ${gbp(x.supportOneOff)} jednorazowo`,
    supportNone: 'Na razie nie znaleźliśmy dodatkowego wsparcia. Sprawdzimy ponownie, gdy coś się zmieni.',
    planSome: (x) => `Dzięki tym krokom ryzykowne dni w ciągu 3 miesięcy zmienią się z ${x.riskyDaysNext90} na ${x.riskyDaysWithPlan}, a bezpieczne dni z ${x.safeDaysIn90DaysWithoutPlan} na ${x.safeDaysIn90DaysWithPlan}.`,
    planNone: 'Wybierz krok poniżej, aby zobaczyć, jak zmieni prognozę.',
    affordRisky: (a) => `To nie jest bezpieczny moment na wydatek ${a.amount}. Zakup dzisiaj zmienia szansę spadku poniżej £0 w ciągu 30 dni z ${a.riskBefore} na ${a.riskAfter}.`,
    affordOk: (a) => `Wydatek ${a.amount} wygląda bezpiecznie. Szansa spadku poniżej £0 w ciągu 30 dni zmienia się z ${a.riskBefore} na ${a.riskAfter}.`,
    saferDate: (d) => ` Bezpieczniejsza data: ${d}.`,
    askRisk: (x) => `Pierwszy ryzykowny dzień to ${x.firstRisk!.date} (${x.firstRisk!.chanceBelowZero} szans na spadek poniżej £0). Plan obniża najwyższe ryzyko do ${x.highestRiskWithPlan}.`,
    askSteady: (_x, next) => `Przez najbliższe 90 dni Twoje pieniądze wyglądają stabilnie. Następny duży rachunek: ${next}.`,
    noneSoon: 'na razie brak',
  },
  hi: {
    understand: (x) => `हर महीने लगभग ${gbp(x.monthlyIn)} आते हैं और ${gbp(x.monthlyOut)} ख़र्च होते हैं। ज़रूरी ख़र्च आपकी आमदनी का ${x.essentialsPercentOfIncome}% हैं।`,
    detectSome: (x) => `हमें देखने लायक ${x.problems.length} बातें मिलीं। पहली: "${x.problems[0].title}"।`,
    detectCost: (x) => ` अतिरिक्त ख़र्च साल में लगभग ${gbp(x.extraCostsPerYear)} हैं।`,
    detectNone: 'कोई बड़ी समस्या नहीं मिली। बहुत अच्छा।',
    predictRisk: (x, around) => `${x.firstRisk!.date} को आपका बैलेंस £0 से नीचे जाने की ${x.firstRisk!.chanceBelowZero} संभावना है${around}।`,
    predictPeak: (x) => ` ${x.highestRiskDate} तक जोखिम ${x.highestRiskNext90Days} तक पहुँच जाता है।`,
    predictSteady: (x) => `अगले 90 दिन आपका पैसा स्थिर दिखता है। £0 से नीचे जाने का सबसे ज़्यादा जोखिम ${x.highestRiskNext90Days} है।`,
    around: (w) => ` (${w} के समय)`,
    supportSome: (x, oneOff) => `आपको शायद हर महीने लगभग ${gbp(x.supportPerMonth)}${oneOff} नहीं मिल रहे। ${x.supportTop[0]} से शुरू करें।`,
    supportOneOff: (x) => ` और एक बार ${gbp(x.supportOneOff)}`,
    supportNone: 'अभी आपके लिए अतिरिक्त सहायता नहीं मिली। हालात बदलने पर हम फिर देखेंगे।',
    planSome: (x) => `इन कदमों से अगले 3 महीनों में जोखिम वाले दिन ${x.riskyDaysNext90} से ${x.riskyDaysWithPlan} होंगे, और सुरक्षित दिन ${x.safeDaysIn90DaysWithoutPlan} से ${x.safeDaysIn90DaysWithPlan} होंगे।`,
    planNone: 'नीचे कोई कदम चुनें और देखें कि अनुमान कैसे बदलता है।',
    affordRisky: (a) => `${a.amount} ख़र्च करने का यह सुरक्षित समय नहीं है। आज ख़रीदने से अगले 30 दिनों में £0 से नीचे जाने की संभावना ${a.riskBefore} से ${a.riskAfter} हो जाती है।`,
    affordOk: (a) => `${a.amount} ठीक लगता है। अगले 30 दिनों में £0 से नीचे जाने की संभावना ${a.riskBefore} से ${a.riskAfter} होती है।`,
    saferDate: (d) => ` ज़्यादा सुरक्षित तारीख़: ${d}।`,
    askRisk: (x) => `आपका पहला जोखिम वाला दिन ${x.firstRisk!.date} है (£0 से नीचे जाने की ${x.firstRisk!.chanceBelowZero} संभावना)। आपकी योजना सबसे ज़्यादा जोखिम को ${x.highestRiskWithPlan} तक लाती है।`,
    askSteady: (_x, next) => `अगले 90 दिन आपका पैसा स्थिर दिखता है। अगला बड़ा बिल: ${next}।`,
    noneSoon: 'अभी कोई नहीं',
  },
  ur: {
    understand: (x) => `ہر مہینے تقریباً ${gbp(x.monthlyIn)} آتے ہیں اور ${gbp(x.monthlyOut)} خرچ ہوتے ہیں۔ ضروری اخراجات آپ کی آمدنی کا ${x.essentialsPercentOfIncome}% ہیں۔`,
    detectSome: (x) => `ہمیں دیکھنے کی ${x.problems.length} باتیں ملیں۔ پہلی: "${x.problems[0].title}"۔`,
    detectCost: (x) => ` اضافی اخراجات سال میں تقریباً ${gbp(x.extraCostsPerYear)} ہیں۔`,
    detectNone: 'کوئی بڑا مسئلہ نہیں ملا۔ بہت خوب۔',
    predictRisk: (x, around) => `${x.firstRisk!.date} کو آپ کا بیلنس £0 سے نیچے جانے کا ${x.firstRisk!.chanceBelowZero} امکان ہے${around}۔`,
    predictPeak: (x) => ` ${x.highestRiskDate} تک خطرہ ${x.highestRiskNext90Days} تک پہنچ جاتا ہے۔`,
    predictSteady: (x) => `اگلے 90 دن آپ کا پیسہ مستحکم لگتا ہے۔ £0 سے نیچے جانے کا سب سے زیادہ خطرہ ${x.highestRiskNext90Days} ہے۔`,
    around: (w) => ` (${w} کے وقت)`,
    supportSome: (x, oneOff) => `شاید آپ کو ہر مہینے تقریباً ${gbp(x.supportPerMonth)}${oneOff} نہیں مل رہے۔ ${x.supportTop[0]} سے شروع کریں۔`,
    supportOneOff: (x) => ` اور ایک بار ${gbp(x.supportOneOff)}`,
    supportNone: 'ابھی آپ کے لیے اضافی مدد نہیں ملی۔ حالات بدلنے پر ہم دوبارہ دیکھیں گے۔',
    planSome: (x) => `ان قدموں سے اگلے 3 مہینوں میں خطرے والے دن ${x.riskyDaysNext90} سے ${x.riskyDaysWithPlan} ہوں گے، اور محفوظ دن ${x.safeDaysIn90DaysWithoutPlan} سے ${x.safeDaysIn90DaysWithPlan} ہوں گے۔`,
    planNone: 'نیچے کوئی قدم چنیں اور دیکھیں کہ پیش گوئی کیسے بدلتی ہے۔',
    affordRisky: (a) => `${a.amount} خرچ کرنے کا یہ محفوظ وقت نہیں ہے۔ آج خریدنے سے اگلے 30 دنوں میں £0 سے نیچے جانے کا امکان ${a.riskBefore} سے ${a.riskAfter} ہو جاتا ہے۔`,
    affordOk: (a) => `${a.amount} ٹھیک لگتا ہے۔ اگلے 30 دنوں میں £0 سے نیچے جانے کا امکان ${a.riskBefore} سے ${a.riskAfter} ہوتا ہے۔`,
    saferDate: (d) => ` زیادہ محفوظ تاریخ: ${d}۔`,
    askRisk: (x) => `آپ کا پہلا خطرے والا دن ${x.firstRisk!.date} ہے (£0 سے نیچے جانے کا ${x.firstRisk!.chanceBelowZero} امکان)۔ آپ کا منصوبہ سب سے زیادہ خطرے کو ${x.highestRiskWithPlan} تک لاتا ہے۔`,
    askSteady: (_x, next) => `اگلے 90 دن آپ کا پیسہ مستحکم لگتا ہے۔ اگلا بڑا بل: ${next}۔`,
    noneSoon: 'ابھی کوئی نہیں',
  },
};

/** Rule-based wording, used when no AI is available. */
export function templates(x: Facts, lang: Lang = 'en'): Record<StepKey, string> {
  const w = WORDS[lang] ?? WORDS.en;
  const risk = x.firstRisk;
  const peak = risk && x.highestRiskDate !== risk.date && x.highestRiskNext90Days !== risk.chanceBelowZero ? w.predictPeak(x) : '';
  return {
    understand: w.understand(x),
    detect: x.problems.length ? `${w.detectSome(x)}${x.extraCostsPerYear ? w.detectCost(x) : ''}` : w.detectNone,
    predict: risk ? `${w.predictRisk(x, risk.around ? w.around(risk.around) : '')}${peak}` : w.predictSteady(x),
    support: x.supportTop.length ? w.supportSome(x, x.supportOneOff ? w.supportOneOff(x) : '') : w.supportNone,
    plan: x.planSteps.length ? w.planSome(x) : w.planNone,
  };
}

export interface AffordFacts {
  amount: string;
  riskBefore: string;
  riskAfter: string;
  safe: boolean;
  saferDate?: string;
}

/** The verdict on a purchase. Decided here by code and always shown, whatever the AI then writes. */
export function affordVerdict(a: AffordFacts, lang: Lang = 'en') {
  const w = WORDS[lang] ?? WORDS.en;
  return `${a.safe ? w.affordOk(a) : w.affordRisky(a)}${a.saferDate ? w.saferDate(a.saferDate) : ''}`;
}

/** Coach answer for general questions when no AI is available. */
export function rulesAnswer(x: Facts, lang: Lang = 'en') {
  const w = WORDS[lang] ?? WORDS.en;
  return x.firstRisk ? w.askRisk(x) : w.askSteady(x, x.upcomingBigBills[0]?.what ?? w.noneSoon);
}

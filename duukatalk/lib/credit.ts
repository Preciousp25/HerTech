export const CREDIT_LIMIT = 15000;
export const LARGE_QUANTITY_THRESHOLD = 20;
export const SAVINGS_PERCENT = 10;
export const HIGH_STRESS_SAVINGS_PERCENT = 20;
export const CAUTIOUS_SAVINGS_PERCENT = 15;
export const LOW_SALES_SAVINGS_PERCENT = 5;
export const MAX_CREDIT_TO_SALES_RATIO = 0.5;

export type GuidanceLanguage = "EN" | "LUG" | "MIX";

export function parseGuidanceLanguage(value: string | null | undefined): GuidanceLanguage {
  if (value === "EN" || value === "LUG" || value === "MIX") return value;
  return "EN";
}

export function localizeGuidance(language: GuidanceLanguage, english: string, luganda: string): string {
  if (language === "EN") return english;
  if (language === "LUG") return luganda;
  return `${english} · ${luganda}`;
}

export function isOutstandingCredit(txn: {
  payment_type?: string;
  settled?: boolean;
}): boolean {
  return (txn.payment_type || "").toLowerCase() === "credit" && txn.settled !== true;
}

export function calculateSavingsRecommendation(totalSales: number, totalCreditOutstanding = 0): number {
  const creditToSalesRatio = calculateCreditToSalesRatio(totalSales, totalCreditOutstanding);
  let savingsPercent = SAVINGS_PERCENT;

  if (totalSales <= 0) {
    savingsPercent = LOW_SALES_SAVINGS_PERCENT;
  } else if (creditToSalesRatio > MAX_CREDIT_TO_SALES_RATIO) {
    savingsPercent = HIGH_STRESS_SAVINGS_PERCENT;
  } else if (creditToSalesRatio >= 0.3) {
    savingsPercent = CAUTIOUS_SAVINGS_PERCENT;
  }

  return Math.round(totalSales * (savingsPercent / 100));
}

export function calculateCreditToSalesRatio(totalSales: number, totalCreditOutstanding: number): number {
  if (!Number.isFinite(totalSales) || totalSales <= 0) return 0;
  return Math.min(1, Math.max(0, totalCreditOutstanding / Math.max(totalSales, 1)));
}

export function loanReadinessScore(totalSales: number, totalCreditOutstanding: number): number {
  if (!Number.isFinite(totalSales) || totalSales <= 0) return 0;

  const creditToSalesRatio = calculateCreditToSalesRatio(totalSales, totalCreditOutstanding);
  const savingsRatio = Math.min(50, Math.max(0, SAVINGS_PERCENT));
  const debtRatio = Math.min(50, Math.max(0, 50 - (creditToSalesRatio * 100)));
  const salesMomentum = Math.min(20, Math.max(0, Math.round(Math.min(1, totalSales / Math.max(totalSales, 1)) * 20)));

  const baseScore = savingsRatio + debtRatio + salesMomentum;
  if (creditToSalesRatio > MAX_CREDIT_TO_SALES_RATIO) {
    return Math.round(Math.min(35, Math.max(5, baseScore * 0.45)));
  }

  return Math.round(Math.min(100, Math.max(5, baseScore)));
}

export type LoanGuidance = {
  recommendedSavings: number;
  savingsPercent: number;
  creditToSalesRatio: number;
  creditSharePercent: number;
  loanReadinessScore: number;
  loanAdvice: string;
  shouldStopLending: boolean;
};

export function buildLoanGuidance(
  totalSales: number,
  totalCreditOutstanding: number,
  language: GuidanceLanguage = "EN",
): LoanGuidance {
  const creditToSalesRatio = calculateCreditToSalesRatio(totalSales, totalCreditOutstanding);
  const creditSharePercent = Math.round(creditToSalesRatio * 100);
  const score = loanReadinessScore(totalSales, totalCreditOutstanding);
  const shouldStopLending = creditToSalesRatio > MAX_CREDIT_TO_SALES_RATIO;

  let savingsPercent = SAVINGS_PERCENT;
  if (totalSales <= 0) {
    savingsPercent = LOW_SALES_SAVINGS_PERCENT;
  } else if (creditToSalesRatio > MAX_CREDIT_TO_SALES_RATIO) {
    savingsPercent = HIGH_STRESS_SAVINGS_PERCENT;
  } else if (creditToSalesRatio >= 0.3) {
    savingsPercent = CAUTIOUS_SAVINGS_PERCENT;
  }

  const recommendedSavings = Math.round(totalSales * (savingsPercent / 100));
  const savingsTarget = Math.round(totalSales * (savingsPercent / 100));
  const savingsTargetMessageEn = `Save ${savingsPercent}% of sales, about UGX ${savingsTarget.toLocaleString()}, to build a bank-ready savings record and strengthen your loan eligibility.`;
  const savingsTargetMessageLug = `Tereka ${savingsPercent}% ku bigobawo, nga buli ${savingsTarget.toLocaleString()} UGX, okuzimba ebiwandiiko by'okusasaza ebisale n'okuwaanyi awamu obuyinza bw'okukola esawo.`;
  const savingsTargetMessage = localizeGuidance(language, savingsTargetMessageEn, savingsTargetMessageLug);

  let advice = savingsTargetMessage;
  if (shouldStopLending) {
    const english = `Pause new lending because outstanding credit is ${creditSharePercent}% of sales, above the safe cash-to-credit cap of ${Math.round(MAX_CREDIT_TO_SALES_RATIO * 100)}%. Recover cash from customers, keep lending below the sale value, and aim to keep sales cash stronger than credit.`;
    const luganda = `Lekeka okukuza obulava obupya kubanga amabanja agasigalidde galinga ${creditSharePercent}% ku bigobawo, okusukka ku kkomo lya ssente eziriwo ne z'emubanja e ${Math.round(MAX_CREDIT_TO_SALES_RATIO * 100)}%. Funya ssente eri abaguzi, wewale okukuza obulava obupya obusaale ebigobawo, era gezaako okukuuma ssente ku bigobawo okusinga amabanja.`;
    advice = localizeGuidance(language, english, luganda);
  } else if (creditToSalesRatio >= 0.3) {
    const english = `Cash is still healthy, but outstanding credit is ${creditSharePercent}% of sales. Keep lending careful, collect repayments, and save ${savingsPercent}% of sales, about UGX ${savingsTarget.toLocaleString()}, before adding more credit.`;
    const luganda = `Ssente ziri mu bulamu, naye amabanja agasigalidde gali ${creditSharePercent}% ku bigobawo. Kukuza obulava obupya okuteekateeka, funya ebigoberera by'abaguzi, era teeka ku side ${savingsPercent}% ku bigobawo, nga buli UGX ${savingsTarget.toLocaleString()}, nga tonaddako omubanja.`;
    advice = localizeGuidance(language, english, luganda);
  } else {
    const english = `Sales are stronger than credit exposure. Keep adding only a careful amount of credit, save ${savingsPercent}% of sales, about UGX ${savingsTarget.toLocaleString()}, and grow the cash position before expanding loans.`;
    const luganda = `Ebigobawo byazaala nnyo okusinga amabanja. Genda mu kukuluza obulava obupya obutono, teeka ${savingsPercent}% ku bigobawo, nga buli UGX ${savingsTarget.toLocaleString()}, era gaziya ssente eziriwo nga tonazikozesa mu kukuliza obulava.`;
    advice = localizeGuidance(language, english, luganda);
  }

  return {
    recommendedSavings,
    savingsPercent,
    creditToSalesRatio,
    creditSharePercent,
    loanReadinessScore: score,
    loanAdvice: advice,
    shouldStopLending,
  };
}

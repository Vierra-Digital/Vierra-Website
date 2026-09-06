/** Blank/negative/non-finite input is treated as 0 rather than surfacing NaN in the result. */
export function sanitizeNonNegative(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Clamped to the 0-100 range a percentage requires, independent of what was typed. */
export function sanitizePercent(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export type LtvInputs = {
  averagePurchaseValue: number;
  costOfGoodsPercent: number;
  numReferrals: number;
  returnsPerYear: number;
  customerTermYears: number;
  numClientsBroughtIn: number;
};

/** Formula is unchanged from the original calculator; only input handling changed around it. */
export function calculateLtv(inputs: LtvInputs): { ltv: number; retainer: number } {
  const grossProfitPerPurchase = inputs.averagePurchaseValue * (1 - inputs.costOfGoodsPercent / 100);
  const ltv = grossProfitPerPurchase * inputs.returnsPerYear * inputs.customerTermYears * (inputs.numReferrals + 1);
  const retainer = (ltv * inputs.numClientsBroughtIn) / 2;
  return {
    ltv: Number.isFinite(ltv) ? ltv : 0,
    retainer: Number.isFinite(retainer) ? retainer : 0,
  };
}

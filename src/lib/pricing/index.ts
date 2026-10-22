// VAriable pricing (plan section 4 and the appendix).
//
//   commitment price = round_up(rate / (1 - margin), step)
//   standard price   = round_up(commitment price * uplift, step)
//
// Run this on the server only: it takes the talent's private rate.
//
// All money is in integer US cents and all ratios are integer basis points
// (1% = 100 bps), so there is no floating point drift. Prices always round
// up, which means the margin kept is never below the target margin.

export const BPS = 10_000;

export const DEFAULTS = {
  targetMarginBps: 4_500, // 45% margin floor
  standardUpliftBps: 12_000, // 1.2x for month to month after the first 90 days
  roundingStepCents: 500, // round up to the nearest $5
} as const;

export type PricingSettings = {
  targetMarginBps: number;
  standardUpliftBps: number;
  roundingStepCents: number;
};

// An admin pricing rule. Any field left out falls back to the next, less
// specific rule, ending at DEFAULTS.
export type PricingRule = {
  scope: "global" | "role" | "partner" | "client";
  // Niche role slug, partner id or client id. Not used for "global".
  scopeId?: string;
} & Partial<PricingSettings>;

export type PricingContext = {
  role?: string;
  partnerId?: string;
  clientId?: string;
};

// Most specific first.
const SCOPE_ORDER: PricingRule["scope"][] = ["client", "partner", "role", "global"];

export type Quote = PricingSettings & {
  rateCents: number;
  commitmentPriceCents: number;
  standardPriceCents: number;
  // Margin actually kept after rounding, in bps of the client price.
  commitmentMarginBps: number;
  standardMarginBps: number;
};

function assertCents(name: string, value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive whole number of cents, got ${value}`);
  }
}

function ceilDiv(a: number, b: number) {
  return Math.floor((a + b - 1) / b);
}

export function roundUpToStep(cents: number, stepCents: number) {
  assertCents("stepCents", stepCents);
  return ceilDiv(cents, stepCents) * stepCents;
}

// Margin kept, in bps of the price, rounded down so it never overstates.
export function marginBps(priceCents: number, rateCents: number) {
  assertCents("priceCents", priceCents);
  return Math.floor(((priceCents - rateCents) * BPS) / priceCents);
}

export function validateSettings(s: PricingSettings) {
  if (!Number.isInteger(s.targetMarginBps) || s.targetMarginBps < 0 || s.targetMarginBps >= BPS) {
    throw new RangeError(`targetMarginBps must be 0 to 9999, got ${s.targetMarginBps}`);
  }
  if (!Number.isInteger(s.standardUpliftBps) || s.standardUpliftBps < BPS) {
    throw new RangeError(`standardUpliftBps must be at least ${BPS} (1x), got ${s.standardUpliftBps}`);
  }
  assertCents("roundingStepCents", s.roundingStepCents);
}

// Picks each setting from the most specific matching rule: client, then
// partner, then role, then global, then DEFAULTS.
export function resolveSettings(rules: PricingRule[], ctx: PricingContext = {}): PricingSettings {
  const idFor = { client: ctx.clientId, partner: ctx.partnerId, role: ctx.role, global: undefined };
  const matching = SCOPE_ORDER.flatMap((scope) =>
    rules.filter((r) => r.scope === scope && (scope === "global" || (r.scopeId !== undefined && r.scopeId === idFor[scope]))),
  );
  const pick = <K extends keyof PricingSettings>(key: K): number =>
    matching.find((r) => r[key] !== undefined)?.[key] ?? DEFAULTS[key];

  const settings = {
    targetMarginBps: pick("targetMarginBps"),
    standardUpliftBps: pick("standardUpliftBps"),
    roundingStepCents: pick("roundingStepCents"),
  };
  validateSettings(settings);
  return settings;
}

// Prices for one talent rate. Store the whole Quote on the placement and on
// every invoice line so past invoices never change when rules change.
export function quote(rateCents: number, settings: PricingSettings = DEFAULTS): Quote {
  assertCents("rateCents", rateCents);
  validateSettings(settings);
  const { targetMarginBps, standardUpliftBps, roundingStepCents } = settings;

  const commitmentPriceCents = roundUpToStep(
    ceilDiv(rateCents * BPS, BPS - targetMarginBps),
    roundingStepCents,
  );
  const standardPriceCents = roundUpToStep(
    ceilDiv(commitmentPriceCents * standardUpliftBps, BPS),
    roundingStepCents,
  );

  return {
    rateCents,
    ...settings,
    commitmentPriceCents,
    standardPriceCents,
    commitmentMarginBps: marginBps(commitmentPriceCents, rateCents),
    standardMarginBps: marginBps(standardPriceCents, rateCents),
  };
}

// Buyout when a client hires introduced talent directly: 2 months of the
// billed monthly price (plan section 13).
export function buyoutCents(billedMonthlyCents: number, months = 2) {
  assertCents("billedMonthlyCents", billedMonthlyCents);
  return billedMonthlyCents * months;
}

// Leaving a 6-month commitment early: the client pays the gap between the
// standard and commitment price for each month used.
// TODO(confirm): suggested rule in the plan, not yet confirmed by Jhona.
export function earlyExitFeeCents(q: Pick<Quote, "commitmentPriceCents" | "standardPriceCents">, monthsUsed: number) {
  if (!Number.isInteger(monthsUsed) || monthsUsed < 0) {
    throw new RangeError(`monthsUsed must be a whole number of months, got ${monthsUsed}`);
  }
  return (q.standardPriceCents - q.commitmentPriceCents) * monthsUsed;
}

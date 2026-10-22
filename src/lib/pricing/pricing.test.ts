import { describe, expect, it } from "vitest";
import {
  buyoutCents,
  DEFAULTS,
  earlyExitFeeCents,
  quote,
  resolveSettings,
  roundUpToStep,
  type PricingRule,
} from "./index";

const usd = (dollars: number) => dollars * 100;

describe("quote: tier table in plan section 4", () => {
  // [tier, talent rate, 6-month price, standard price, margin kept bps (commitment, standard)]
  const table: [string, number, number, number, number, number][] = [
    ["Essentials full time", 800, 1_455, 1_750, 4_501, 5_428],
    ["Essentials part time", 450, 820, 985, 4_512, 5_431],
    ["Professional", 1_000, 1_820, 2_185, 4_505, 5_423],
    ["Executive", 1_300, 2_365, 2_840, 4_503, 5_422],
  ];

  it.each(table)("%s: $%i rate", (_tier, rate, commitment, standard, cMargin, sMargin) => {
    const q = quote(usd(rate));
    expect(q.commitmentPriceCents).toBe(usd(commitment));
    expect(q.standardPriceCents).toBe(usd(standard));
    expect(q.commitmentMarginBps).toBe(cMargin);
    expect(q.standardMarginBps).toBe(sMargin);
  });

  it("stores the settings used, so past invoices can be explained", () => {
    expect(quote(usd(800))).toMatchObject({ rateCents: usd(800), ...DEFAULTS });
  });

  it("the 6-month commitment saves about 17% on Essentials", () => {
    const q = quote(usd(800));
    const savingBps = Math.round(((q.standardPriceCents - q.commitmentPriceCents) * 10_000) / q.standardPriceCents);
    expect(savingBps).toBe(1_686);
  });
});

describe("quote: partner channel table in plan section 4", () => {
  it("35% partner margin, rounded up like every other price", () => {
    expect(quote(usd(800), { ...DEFAULTS, targetMarginBps: 3_500 }).commitmentPriceCents).toBe(usd(1_235));
  });

  it("30% partner margin", () => {
    expect(quote(usd(800), { ...DEFAULTS, targetMarginBps: 3_000 }).commitmentPriceCents).toBe(usd(1_145));
  });
});

describe("quote: rounding never cuts into the margin", () => {
  it("an exact result is not bumped up a step", () => {
    // $1,100 / 0.55 = $2,000 exactly
    expect(quote(usd(1_100)).commitmentPriceCents).toBe(usd(2_000));
  });

  it("one cent over a step rounds up to the next step", () => {
    expect(roundUpToStep(usd(2_000) + 1, 500)).toBe(usd(2_005));
  });

  it("margin kept is at or above target for every rate from $300 to $5,000 at 30%, 35% and 45%", () => {
    for (const targetMarginBps of [3_000, 3_500, 4_500]) {
      for (let rate = usd(300); rate <= usd(5_000); rate += 137) {
        const q = quote(rate, { ...DEFAULTS, targetMarginBps });
        expect(q.commitmentPriceCents - rate).toBeGreaterThanOrEqual(
          Math.ceil((q.commitmentPriceCents * targetMarginBps) / 10_000) - 1,
        );
        expect(q.commitmentMarginBps).toBeGreaterThanOrEqual(targetMarginBps);
        expect(q.standardPriceCents).toBeGreaterThanOrEqual(q.commitmentPriceCents);
        expect(q.commitmentPriceCents % 500).toBe(0);
        expect(q.standardPriceCents % 500).toBe(0);
      }
    }
  });

  it("supports hourly prices with a smaller rounding step", () => {
    // $6.50/h at 45% = $11.818... -> $11.85 with a 5 cent step
    const q = quote(650, { ...DEFAULTS, roundingStepCents: 5 });
    expect(q.commitmentPriceCents).toBe(1_185);
    expect(q.commitmentMarginBps).toBeGreaterThanOrEqual(4_500);
  });
});

describe("quote: rejects bad input", () => {
  it.each([0, -100, 800.5, Number.NaN])("rate %s", (rate) => {
    expect(() => quote(rate)).toThrow(RangeError);
  });

  it.each([-1, 10_000, 12_000, 45.5])("margin %s bps", (targetMarginBps) => {
    expect(() => quote(usd(800), { ...DEFAULTS, targetMarginBps })).toThrow(RangeError);
  });

  it("uplift below 1x", () => {
    expect(() => quote(usd(800), { ...DEFAULTS, standardUpliftBps: 9_000 })).toThrow(RangeError);
  });

  it("zero rounding step", () => {
    expect(() => quote(usd(800), { ...DEFAULTS, roundingStepCents: 0 })).toThrow(RangeError);
  });
});

describe("resolveSettings: most specific rule wins", () => {
  const rules: PricingRule[] = [
    { scope: "global", targetMarginBps: 4_500, standardUpliftBps: 12_000 },
    { scope: "role", scopeId: "developer", targetMarginBps: 4_000 },
    { scope: "partner", scopeId: "flextroops", targetMarginBps: 3_500 },
    { scope: "client", scopeId: "client-a", targetMarginBps: 4_200, roundingStepCents: 1_000 },
  ];

  it("falls back to DEFAULTS with no rules", () => {
    expect(resolveSettings([])).toEqual(DEFAULTS);
  });

  it("uses global with no context", () => {
    expect(resolveSettings(rules).targetMarginBps).toBe(4_500);
  });

  it("role beats global", () => {
    expect(resolveSettings(rules, { role: "developer" }).targetMarginBps).toBe(4_000);
  });

  it("partner beats role", () => {
    expect(resolveSettings(rules, { role: "developer", partnerId: "flextroops" }).targetMarginBps).toBe(3_500);
  });

  it("client beats partner", () => {
    const s = resolveSettings(rules, { role: "developer", partnerId: "flextroops", clientId: "client-a" });
    expect(s).toEqual({ targetMarginBps: 4_200, standardUpliftBps: 12_000, roundingStepCents: 1_000 });
  });

  it("a rule for someone else does not apply", () => {
    expect(resolveSettings(rules, { clientId: "client-b", partnerId: "other" }).targetMarginBps).toBe(4_500);
  });

  it("a scoped rule without an id never matches", () => {
    expect(resolveSettings([{ scope: "client", targetMarginBps: 1_000 }], {}).targetMarginBps).toBe(4_500);
  });

  it("rejects an invalid rule value", () => {
    expect(() => resolveSettings([{ scope: "global", targetMarginBps: 10_000 }])).toThrow(RangeError);
  });
});

describe("buyout and early exit", () => {
  it("buyout is 2 months of the billed price (plan example: $2,910)", () => {
    expect(buyoutCents(usd(1_455))).toBe(usd(2_910));
  });

  it("early exit charges the standard vs commitment gap for months used", () => {
    expect(earlyExitFeeCents(quote(usd(800)), 3)).toBe(usd((1_750 - 1_455) * 3));
  });

  it("early exit rejects partial months", () => {
    expect(() => earlyExitFeeCents(quote(usd(800)), 1.5)).toThrow(RangeError);
  });
});

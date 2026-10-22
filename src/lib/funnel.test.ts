import { describe, expect, it } from "vitest";
import { computeFunnel, MIN_APPLICANTS_FOR_CLAIM, supportedClaim, windowMonths, type HistoricalCount } from "./funnel";

const NOW = new Date("2026-10-22T12:00:00Z");
const ev = (talent_id: string, to_status: string, created_at: string) => ({ talent_id, to_status, created_at });
const hist = (month: string, o: Partial<HistoricalCount> = {}): HistoricalCount => ({
  month,
  source: "OnlineJobs.ph",
  applied: 0,
  screened: 0,
  tested: 0,
  interviewed: 0,
  accepted: 0,
  ...o,
});

describe("windowMonths", () => {
  it("covers the last 12 calendar months including this one", () => {
    const m = windowMonths(NOW);
    expect(m).toHaveLength(12);
    expect(m[0]).toBe("2025-11-01");
    expect(m[11]).toBe("2026-10-01");
  });

  it("crosses year boundaries", () => {
    expect(windowMonths(new Date("2026-01-15T00:00:00Z"), 3)).toEqual(["2025-11-01", "2025-12-01", "2026-01-01"]);
  });
});

describe("computeFunnel", () => {
  it("counts each applicant once, at the furthest stage reached", () => {
    const f = computeFunnel(
      [
        ev("a", "submitted", "2026-09-01T00:00:00Z"),
        ev("a", "screening", "2026-09-02T00:00:00Z"),
        ev("a", "skills_test", "2026-09-05T00:00:00Z"),
        ev("a", "interview", "2026-09-08T00:00:00Z"),
        ev("a", "accepted", "2026-09-10T00:00:00Z"),
        ev("b", "submitted", "2026-09-03T00:00:00Z"),
        ev("b", "screening", "2026-09-04T00:00:00Z"),
        ev("b", "rejected", "2026-09-06T00:00:00Z"),
        ev("c", "submitted", "2026-10-01T00:00:00Z"),
      ],
      [],
      NOW,
    );
    expect(f.platform).toEqual({ applied: 3, screened: 2, tested: 1, interviewed: 1, accepted: 1 });
    expect(f.acceptanceBps).toBe(3333);
  });

  it("treats a skipped stage as passed", () => {
    const f = computeFunnel(
      [ev("a", "submitted", "2026-09-01T00:00:00Z"), ev("a", "interview", "2026-09-02T00:00:00Z")],
      [],
      NOW,
    );
    expect(f.platform).toEqual({ applied: 1, screened: 1, tested: 1, interviewed: 1, accepted: 0 });
  });

  it("does not count a later resubmission as a second application", () => {
    const f = computeFunnel(
      [
        ev("a", "submitted", "2026-09-01T00:00:00Z"),
        ev("a", "paused", "2026-09-02T00:00:00Z"),
        ev("a", "submitted", "2026-09-03T00:00:00Z"),
      ],
      [],
      NOW,
    );
    expect(f.platform.applied).toBe(1);
  });

  it("leaves out applicants who first submitted before the window", () => {
    const f = computeFunnel(
      [ev("old", "submitted", "2025-10-31T23:59:59Z"), ev("old", "accepted", "2026-02-01T00:00:00Z")],
      [],
      NOW,
    );
    expect(f.platform.applied).toBe(0);
    expect(f.platform.accepted).toBe(0);
  });

  it("adds past counts inside the window and ignores older months", () => {
    const f = computeFunnel(
      [ev("a", "submitted", "2026-09-01T00:00:00Z"), ev("a", "accepted", "2026-09-02T00:00:00Z")],
      [
        hist("2026-03-01", { applied: 400, screened: 120, accepted: 6 }),
        hist("2026-03-01", { source: "Referral", applied: 20, accepted: 1 }),
        hist("2025-10-01", { applied: 999, accepted: 999 }),
      ],
      NOW,
    );
    expect(f.historical).toEqual({ applied: 420, screened: 120, tested: 0, interviewed: 0, accepted: 7 });
    expect(f.total.applied).toBe(421);
    expect(f.total.accepted).toBe(8);
    expect(f.months.find((m) => m.month === "2026-03-01")?.historical.applied).toBe(420);
    expect(f.months.find((m) => m.month === "2026-09-01")?.platform.accepted).toBe(1);
  });

  it("has no acceptance rate with no applicants", () => {
    expect(computeFunnel([], [], NOW).acceptanceBps).toBeNull();
  });
});

describe("supportedClaim", () => {
  it("says hand-selected below the minimum sample", () => {
    const c = supportedClaim({ applied: MIN_APPLICANTS_FOR_CLAIM - 1, accepted: 1 });
    expect(c.text).toBe("Hand-selected");
    expect(c.percent).toBeNull();
  });

  it.each([
    [1000, 10, 1],
    [1000, 11, 2],
    [1000, 30, 3],
    [1000, 31, 5],
    [1000, 100, 10],
  ])("%i applied, %i accepted -> top %i%", (applied, accepted, percent) => {
    expect(supportedClaim({ applied, accepted })).toMatchObject({ percent, text: `Top ${percent}% of applicants` });
  });

  it("says hand-selected when more than 10% are accepted", () => {
    expect(supportedClaim({ applied: 1000, accepted: 101 }).text).toBe("Hand-selected");
  });

  it("never rounds a claim in VAriable's favour", () => {
    // 1.001% must not be called top 1%
    expect(supportedClaim({ applied: 100_000, accepted: 1_001 }).percent).toBe(2);
  });
});

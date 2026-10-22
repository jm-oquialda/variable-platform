// Vetting funnel and the "top X%" claim (plan section 3, "Top 1% claim").
//
// Window: the last 12 calendar months including the current one (UTC).
// Platform applicants are counted in the month they first submitted, and
// at the furthest stage they have reached. Past counts entered by admin
// (OnlineJobs.ph and others) are added month by month.

export const STAGES = ["applied", "screened", "tested", "interviewed", "accepted"] as const;
export type Stage = (typeof STAGES)[number];
export type StageCounts = Record<Stage, number>;

export const STAGE_LABEL: Record<Stage, string> = {
  applied: "Applied",
  screened: "Screened",
  tested: "Skills tested",
  interviewed: "Interviewed",
  accepted: "Accepted",
};

// Vetting status -> how far through the funnel it is. Rejected and paused
// do not move anyone forward.
const RANK: Record<string, number> = {
  submitted: 1,
  screening: 2,
  skills_test: 3,
  interview: 4,
  accepted: 5,
};

export type VettingEvent = { talent_id: string; to_status: string; created_at: string };
export type HistoricalCount = StageCounts & { month: string; source: string };

export type MonthRow = { month: string; platform: StageCounts; historical: StageCounts };

export type Funnel = {
  since: string; // YYYY-MM-01
  platform: StageCounts;
  historical: StageCounts;
  total: StageCounts;
  months: MonthRow[];
  acceptanceBps: number | null;
};

const empty = (): StageCounts => ({ applied: 0, screened: 0, tested: 0, interviewed: 0, accepted: 0 });

function add(a: StageCounts, b: StageCounts): StageCounts {
  return Object.fromEntries(STAGES.map((s) => [s, a[s] + b[s]])) as StageCounts;
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function windowMonths(now: Date, months = 12): string[] {
  const out: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return out;
}

export function computeFunnel(events: VettingEvent[], historical: HistoricalCount[], now: Date, months = 12): Funnel {
  const keys = windowMonths(now, months);
  const byMonth = new Map(keys.map((k) => [k, { month: k, platform: empty(), historical: empty() }]));

  // Per talent: when they first submitted, and the furthest stage reached.
  const people = new Map<string, { submitted: string | null; rank: number }>();
  for (const e of [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const p = people.get(e.talent_id) ?? { submitted: null, rank: 0 };
    if (e.to_status === "submitted" && !p.submitted) p.submitted = e.created_at;
    p.rank = Math.max(p.rank, RANK[e.to_status] ?? 0);
    people.set(e.talent_id, p);
  }

  for (const p of people.values()) {
    if (!p.submitted) continue;
    const row = byMonth.get(monthKey(new Date(p.submitted)));
    if (!row) continue;
    STAGES.forEach((stage, i) => {
      if (p.rank >= i + 1) row.platform[stage] += 1;
    });
  }

  for (const h of historical) {
    const row = byMonth.get(h.month);
    if (!row) continue;
    for (const stage of STAGES) row.historical[stage] += h[stage];
  }

  const rows = [...byMonth.values()];
  const platform = rows.reduce((acc, r) => add(acc, r.platform), empty());
  const hist = rows.reduce((acc, r) => add(acc, r.historical), empty());
  const total = add(platform, hist);

  return {
    since: keys[0],
    platform,
    historical: hist,
    total,
    months: rows,
    acceptanceBps: total.applied > 0 ? Math.round((total.accepted * 10_000) / total.applied) : null,
  };
}

// The strongest claim the numbers support. Below the minimum sample the
// site says "hand-selected" rather than a percentage.
// TODO(confirm): minimum sample size with Jhona.
export const MIN_APPLICANTS_FOR_CLAIM = 300;
const CLAIM_STEPS = [1, 2, 3, 5, 10];

export type Claim = { text: string; reason: string; percent: number | null };

export function supportedClaim(total: Pick<StageCounts, "applied" | "accepted">): Claim {
  if (total.applied < MIN_APPLICANTS_FOR_CLAIM) {
    return {
      text: "Hand-selected",
      percent: null,
      reason: `Fewer than ${MIN_APPLICANTS_FOR_CLAIM} applicants in the last 12 months, so no percentage claim yet.`,
    };
  }
  // accepted / applied <= step%  <=>  accepted * 100 <= step * applied
  const step = CLAIM_STEPS.find((p) => total.accepted * 100 <= p * total.applied);
  if (step === undefined) {
    return {
      text: "Hand-selected",
      percent: null,
      reason: "More than 10% of applicants were accepted, so a top-percent claim would overstate selectivity.",
    };
  }
  return {
    text: `Top ${step}% of applicants`,
    percent: step,
    reason: `${total.accepted} of ${total.applied} applicants accepted in the last 12 months.`,
  };
}

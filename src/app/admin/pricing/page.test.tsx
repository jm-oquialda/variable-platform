import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Render the admin pricing page and the public pricing block with the
// database replaced by the plan's starting values.

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({}) }));
vi.mock("@/lib/supabase/env", () => ({ hasSupabaseEnv: () => true }));
vi.mock("./actions", () => ({
  saveTierMinRates: vi.fn(),
  republishTierPrices: vi.fn(),
  saveGlobalRule: vi.fn(),
  saveRoleOverride: vi.fn(),
  deleteOverride: vi.fn(),
  saveAddonPackages: vi.fn(),
}));

const store = vi.hoisted(() => ({
  rules: [] as unknown[],
  tiers: [] as unknown[],
}));

vi.mock("@/lib/pricing/store", () => ({
  loadPricingRules: async () => store.rules,
  loadTierMinRates: async () =>
    new Map([
      ["essentials", 80_000],
      ["professional", 100_000],
      ["executive", 130_000],
    ]),
  loadTiers: async () => store.tiers,
  loadAddonPackages: async () => [
    { slug: "starter", name: "Starter", description: "1 agent, 1 workflow", sort_order: 1, setup_cents: 150_000, monthly_cents: 20_000 },
    { slug: "custom", name: "Custom", description: "Larger builds", sort_order: 3, setup_cents: null, monthly_cents: null },
  ],
}));

const tier = (slug: string, name: string, sort: number, c: number | null, s: number | null) => ({
  slug,
  name,
  sort_order: sort,
  commitment_price_cents: c,
  standard_price_cents: s,
  prices_published_at: c ? "2026-10-21T19:00:00Z" : null,
});

beforeEach(() => {
  store.rules = [
    { id: 1, scope: "global", targetMarginBps: 4_500, standardUpliftBps: 12_000, roundingStepCents: 500 },
    { id: 2, scope: "role", scopeId: "developer", targetMarginBps: 4_000 },
  ];
  store.tiers = [
    tier("essentials", "Essentials", 1, 145_500, 175_000),
    tier("professional", "Professional", 2, 182_000, 218_500),
    tier("executive", "Executive", 3, 236_500, 284_000),
  ];
});

async function renderAdmin(params: Record<string, string> = {}) {
  const { default: PricingPage } = await import("./page");
  return renderToStaticMarkup(await PricingPage({ searchParams: Promise.resolve(params) }));
}

describe("admin pricing page", () => {
  it("shows each tier's prices calculated from its minimum rate", async () => {
    const html = await renderAdmin();
    for (const price of ["$1,455", "$1,750", "$1,820", "$2,185", "$2,365", "$2,840"]) {
      expect(html).toContain(price);
    }
    expect(html).toContain("45.0% / 54.2%");
  });

  it("prefills the global rule", async () => {
    const html = await renderAdmin();
    expect(html).toMatch(/name="margin"[^>]*value="45"/);
    expect(html).toMatch(/name="uplift"[^>]*value="1.2"/);
    expect(html).toMatch(/name="rounding"[^>]*value="5"/);
  });

  it("lists role overrides", async () => {
    const html = await renderAdmin();
    expect(html).toContain("Developer / Software Engineer");
    expect(html).toContain("40.00%");
  });

  it("price check uses the role override", async () => {
    // $1,000 at 40% = $1,666.67 -> $1,670; standard $2,004 -> $2,005
    const html = await renderAdmin({ rate: "1000", role: "developer" });
    expect(html).toContain("$1,670");
    expect(html).toContain("$2,005");
    expect(html).toContain("40.00% margin");
  });

  it("price check without a role uses the global rule", async () => {
    const html = await renderAdmin({ rate: "800" });
    expect(html).toContain("VAriable keeps / mo");
    expect(html).toContain("$655");
  });

  it("explains a bad price check rate", async () => {
    const html = await renderAdmin({ rate: "abc" });
    expect(html).toContain("Enter the rate in dollars");
  });

  it("shows save confirmations and errors", async () => {
    expect(await renderAdmin({ saved: "tiers" })).toContain("Public prices recalculated and published.");
    expect(await renderAdmin({ error: "global-range" })).toContain("Margin must be below 100%");
  });

  it("offers to publish when prices were never published", async () => {
    store.tiers = [tier("essentials", "Essentials", 1, null, null)];
    expect(await renderAdmin()).toContain("Publish current prices now");
  });
});

describe("public pricing block", () => {
  async function renderPublic() {
    const { PublicPricing } = await import("@/components/PublicPricing");
    const el = await PublicPricing();
    return el ? renderToStaticMarkup(el) : "";
  }

  it("shows published starting prices and the add-on from price", async () => {
    const html = await renderPublic();
    expect(html).toContain("$1,455");
    expect(html).toContain("$2,840");
    expect(html).toContain("Save about 17%");
    expect(html).toContain("from $1,500 setup + $200/mo upkeep");
  });

  it("never shows a talent rate or margin", async () => {
    const html = await renderPublic();
    expect(html).not.toContain("$800");
    expect(html).not.toContain("$1,000");
    expect(html).not.toContain("$1,300");
    expect(html).not.toMatch(/margin/i);
  });

  it("renders nothing until prices are published", async () => {
    store.tiers = [tier("essentials", "Essentials", 1, null, null)];
    expect(await renderPublic()).toBe("");
  });
});

// Turning admin form input into cents and basis points, and back for display.
// Parsers return null for anything that is not a clean, positive value, so
// a typo never becomes a price.

const MONEY = /^\$?\s*(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;
const DECIMAL = /^\d+(\.\d+)?$/;

// "1,455" / "$1455.50" / "800" -> cents
export function parseDollarsToCents(input: string): number | null {
  const s = input.trim();
  if (!MONEY.test(s)) return null;
  const [whole, frac = ""] = s.replace(/[$,\s]/g, "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

// "45" / "45.5" / "45%" -> 4500 / 4550. Two decimals at most.
export function parsePercentToBps(input: string): number | null {
  const s = input.trim().replace(/%$/, "").trim();
  if (!DECIMAL.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > 2) return null;
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

// "1.2" / "1.2x" -> 12000. Four decimals at most.
export function parseMultiplierToBps(input: string): number | null {
  const s = input.trim().replace(/[x×]$/i, "").trim();
  if (!DECIMAL.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > 4) return null;
  return Number(whole) * 10_000 + Number(frac.padEnd(4, "0"));
}

// 145500 -> "$1,455"; 145550 -> "$1,455.50"
export function formatCents(cents: number): string {
  const whole = cents % 100 === 0;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// For prefilling inputs: 145500 -> "1455"; 145550 -> "1455.50"
export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

// 4501 -> "45.0%"
export function formatBps(bps: number, digits = 1): string {
  return `${(bps / 100).toFixed(digits)}%`;
}

// 12000 -> "1.2"
export function bpsToMultiplier(bps: number): string {
  return String(bps / 10_000);
}

import { describe, expect, it } from "vitest";
import {
  centsToInput,
  formatBps,
  formatCents,
  parseDollarsToCents,
  parseMultiplierToBps,
  parsePercentToBps,
} from "./format";

describe("parseDollarsToCents", () => {
  it.each([
    ["800", 80_000],
    ["$1,455", 145_500],
    ["1455.5", 145_550],
    ["$ 1455.05", 145_505],
    ["  2,365 ", 236_500],
  ])("%s", (input, cents) => expect(parseDollarsToCents(input)).toBe(cents));

  it.each(["", "0", "-800", "abc", "1,45", "12.345", "1e3", "$", "800 USD"])("rejects %j", (input) =>
    expect(parseDollarsToCents(input)).toBeNull(),
  );
});

describe("parsePercentToBps", () => {
  it.each([
    ["45", 4_500],
    ["45%", 4_500],
    ["35.5", 3_550],
    ["0", 0],
  ])("%s", (input, bps) => expect(parsePercentToBps(input)).toBe(bps));

  it.each(["", "-5", "45.555", "abc"])("rejects %j", (input) => expect(parsePercentToBps(input)).toBeNull());
});

describe("parseMultiplierToBps", () => {
  it.each([
    ["1.2", 12_000],
    ["1.2x", 12_000],
    ["1", 10_000],
    ["1.25", 12_500],
  ])("%s", (input, bps) => expect(parseMultiplierToBps(input)).toBe(bps));

  it.each(["", "x", "-1.2", "1.23456"])("rejects %j", (input) => expect(parseMultiplierToBps(input)).toBeNull());
});

describe("display", () => {
  it("formats whole dollars without cents", () => expect(formatCents(145_500)).toBe("$1,455"));
  it("formats cents when present", () => expect(formatCents(145_550)).toBe("$1,455.50"));
  it("formats basis points as a percent", () => expect(formatBps(4_501)).toBe("45.0%"));
  it("prefills inputs", () => {
    expect(centsToInput(80_000)).toBe("800");
    expect(centsToInput(145_550)).toBe("1455.50");
  });
});

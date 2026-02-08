import { describe, expect, test } from "bun:test";
import {
  calculateGini,
  calculateVelocity,
  generateProgressBar,
} from "./analytics.js";

describe("calculateGini", () => {
  test("returns 0 for empty values", () => {
    expect(calculateGini([])).toBe(0);
  });

  test("returns 0 for equal values", () => {
    expect(calculateGini([10, 10, 10, 10])).toBe(0);
  });

  test("returns high inequality score for skewed values", () => {
    const score = calculateGini([100, 0, 0, 0]);
    expect(score).toBeGreaterThan(0.7);
  });
});

describe("calculateVelocity", () => {
  test("returns null when fewer than four prior weeks are available", () => {
    expect(calculateVelocity(100, [80, 90, 95])).toBeNull();
  });

  test("returns null when trailing average is zero", () => {
    expect(calculateVelocity(0, [0, 0, 0, 0])).toBeNull();
  });

  test("calculates percentage delta against trailing 4-week average", () => {
    const velocity = calculateVelocity(120, [100, 100, 100, 100]);
    expect(velocity).toBe(20);
  });
});

describe("generateProgressBar", () => {
  test("renders clamped bars", () => {
    expect(generateProgressBar(0)).toBe("░░░░░░░░░░");
    expect(generateProgressBar(0.5)).toBe("█████░░░░░");
    expect(generateProgressBar(1)).toBe("██████████");
  });

  test("renders a balanced bar for invalid values", () => {
    expect(generateProgressBar(Number.NaN)).toBe("█████░░░░░");
  });
});

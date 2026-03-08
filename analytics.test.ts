import { describe, expect, test } from "bun:test";
import {
  calculateGini,
  calculateVelocity,
  createAnalyticsMarkdown,
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

describe("createAnalyticsMarkdown", () => {
  test("renders a table layout without bars or emoji", () => {
    expect(
      createAnalyticsMarkdown({
        current: {
          artists: [],
          totalScrobbles: 96,
          uniqueArtists: 46,
          depthScore: 0.45,
        },
        currentDiscovery: {
          newArtists: 15,
          discoveryRate: 33,
        },
        velocity: -49,
        previousDepth: 0.61,
        previousDiscoveryRate: 17,
        previousVelocity: 78,
        topFiveCoverage: 47,
      })
    ).toBe(`METRIC     THIS WEEK                CHANGE
Depth      0.45  balanced mix       ↓ -0.16
Discovery  Medium (15 new artists)  ↑ +16%
Velocity   ↓ 49%  slow week         ↓ -127%

SUMMARY
Top 5 coverage   47% of total plays
Unique artists   46
Total scrobbles  96

Velocity = change vs trailing 4-week average`);
  });

  test("renders n/a when comparison history is unavailable", () => {
    expect(
      createAnalyticsMarkdown({
        current: {
          artists: [],
          totalScrobbles: 10,
          uniqueArtists: 4,
          depthScore: 0.2,
        },
        currentDiscovery: {
          newArtists: 1,
          discoveryRate: 25,
        },
        velocity: null,
        previousDepth: null,
        previousDiscoveryRate: null,
        previousVelocity: null,
        topFiveCoverage: 50,
      })
    ).toContain("Velocity   insufficient history     n/a");
  });
});

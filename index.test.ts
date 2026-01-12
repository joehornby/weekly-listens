import { adjustAndPad, createTopArtistList, generateChart } from "./index.js";
import { test, expect, describe } from "bun:test";

describe("testing East Asian name truncation and padding", () => {
  test("Chinese characters should be padded to 8 characters", () => {
    expect(adjustAndPad("你好世界", 8)).toBe("你好世界");
  });
  test("Japanese characters should be padded to 10 characters", () => {
    expect(adjustAndPad("こんにちは", 10)).toBe("こんにちは");
  });
  test("Korean characters should be padded to 10 characters", () => {
    expect(adjustAndPad("안녕하세요", 10)).toBe("안녕하세요");
  });
});

describe("testing European accented characters", () => {
  test("é accent character should be padded to 6 characters", () => {
    expect(adjustAndPad("café", 6)).toBe("café  ");
  });
  test("ü accent character should be padded to 8 characters", () => {
    expect(adjustAndPad("München", 8)).toBe("München ");
  });
  test("ç accent character should be padded to 10 characters", () => {
    expect(adjustAndPad("François", 10)).toBe("François  ");
  });
  test("ř accent character should be padded to 7 characters", () => {
    expect(adjustAndPad("Dvořák", 7)).toBe("Dvořák ");
  });
});

describe("testing truncation with mixed characters", () => {
  test("你好世界Hello should be truncated to 8 characters", () => {
    expect(adjustAndPad("你好世界Hello", 8)).toBe("你好世界");
  });
  test("Beyoncé should be truncated to 4 characters", () => {
    expect(adjustAndPad("Beyoncé", 4)).toBe("Beyo");
  });
});

describe("testing mixed characters", () => {
  test("Tokyo東京 should be padded to 10 characters", () => {
    expect(adjustAndPad("Tokyo東京", 10)).toBe("Tokyo東京 ");
  });
  test("Café☕ should be padded to 7 characters", () => {
    expect(adjustAndPad("Café☕", 7)).toBe("Café☕ ");
  });
  test("BTS (방탄소년단) should be padded to 15 characters", () => {
    expect(adjustAndPad("BTS (방탄소년단)", 15)).toBe("BTS (방탄소년단");
  });
  test("BLACKPINK블랙핑크 should be padded to 10 characters", () => {
    expect(adjustAndPad("BLACKPINK블랙핑크", 10)).toBe("BLACKPINK ");
  });
});

describe("testing edge cases", () => {
  test("empty string should be padded to 5 characters", () => {
    expect(adjustAndPad("", 5)).toBe("     ");
  });
  test("zero width should be empty string", () => {
    expect(adjustAndPad("a", 0)).toBe("");
  });
});

// Mock configuration for testing
const mockConfig = {
  gistId: "test-gist",
  githubToken: "test-token", 
  lastfmKey: "test-key",
  lastfmUsername: "test-user"
};

describe("Empty Data Handling", () => {
  test("should return creative message when no artists", async () => {
    const originalLog = console.log;
    const logMessages: string[] = [];
    console.log = (message: string) => { logMessages.push(message); };
    
    const result = await createTopArtistList([], 5, mockConfig);
    
    expect(result).toBe("No spotify this week – probably exploring podcasts, audiobooks and analog music.");
    expect(logMessages[0]).toBe("No listening data found for this week - using fallback message");
    
    console.log = originalLog;
  });

  test("should return creative message when total plays is zero", async () => {
    const originalLog = console.log;
    const logMessages: string[] = [];
    console.log = (message: string) => { logMessages.push(message); };
    
    // Create properly typed artist objects with zero play counts
    const artistsWithZeroPlays = [
      {
        streamable: 0 as const,
        image: [{ "#text": "", size: "" }],
        mbid: "",
        url: "",
        playcount: "0",
        "@attr": { rank: "1" },
        name: "Artist 1"
      },
      {
        streamable: 0 as const,
        image: [{ "#text": "", size: "" }],
        mbid: "",
        url: "",
        playcount: "0",
        "@attr": { rank: "2" },
        name: "Artist 2"
      }
    ];
    
    const result = await createTopArtistList(artistsWithZeroPlays, 5, mockConfig);
    
    expect(result).toBe("No spotify this week – probably exploring podcasts, audiobooks and analog music.");
    expect(logMessages[0]).toBe("Total plays is zero - using fallback message");
    
    console.log = originalLog;
  });
});

describe("Chart Generation Edge Cases", () => {
  test("should handle NaN input gracefully", () => {
    const originalLog = console.log;
    const logMessages: string[] = [];
    console.log = (message: string) => { logMessages.push(message); };
    
    const result = generateChart(NaN, 10);
    
    expect(result).toBe("–––––|––––");
    expect(logMessages[0]).toBe("Invalid fraction value: NaN - using balanced chart");
    
    console.log = originalLog;
  });

  test("should handle Infinity input gracefully", () => {
    const originalLog = console.log;
    const logMessages: string[] = [];
    console.log = (message: string) => { logMessages.push(message); };
    
    const result = generateChart(Infinity, 10);
    
    expect(result).toBe("–––––|––––");
    expect(logMessages[0]).toBe("Invalid fraction value: Infinity - using balanced chart");
    
    console.log = originalLog;
  });

  test("should handle negative input gracefully", () => {
    const originalLog = console.log;
    const logMessages: string[] = [];
    console.log = (message: string) => { logMessages.push(message); };
    
    const result = generateChart(-0.5, 10);
    
    expect(result).toBe("–––––|––––");
    expect(logMessages[0]).toBe("Invalid fraction value: -0.5 - using balanced chart");
    
    console.log = originalLog;
  });

  test("should handle normal input correctly", () => {
    const result = generateChart(0.3, 10);
    expect(result).toBe("–––|––––––");
  });

  test("should handle 0% fraction correctly", () => {
    const result = generateChart(0, 10);
    expect(result).toBe("|–––––––––");
  });

  test("should handle 100% fraction correctly", () => {
    const result = generateChart(1, 10);
    expect(result).toBe("–––––––––|");
  });
});

describe("Integration Tests", () => {
  test("should handle real Last.fm empty response structure", async () => {
    const originalLog = console.log;
    const logMessages: string[] = [];
    console.log = (message: string) => { logMessages.push(message); };
    
    const emptyLastFMResponse: never[] = [];
    
    const result = await createTopArtistList(emptyLastFMResponse, 5, mockConfig);
    
    expect(result).toBe("No spotify this week – probably exploring podcasts, audiobooks and analog music.");
    expect(logMessages[0]).toBe("No listening data found for this week - using fallback message");
    
    console.log = originalLog;
  });
});

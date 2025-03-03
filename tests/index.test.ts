import stringWidth from "string-width";
import { adjustAndPad } from "../src/index.js";

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

describe("testing emoji family", () => {
  test("👨‍👩‍👧‍👦Family should be padded to 8 characters", () => {
    expect(adjustAndPad("👨‍👩‍👧‍👦Family", 8)).toBe("👨‍👩‍👧‍👦Fami");
  });
  test("🎵🎶🎸 should be padded to 6 characters", () => {
    expect(adjustAndPad("🎵🎶🎸", 6)).toBe("🎵🎶🎸");
  });
});

describe("testing edge cases", () => {
  test("empty string should be padded to 5 characters", () => {
    expect(adjustAndPad("", 5)).toBe("     ");
  });
  test("zero width should be empty string", () => {
    expect(adjustAndPad("a", 0)).toBe("");
  });
  test("multiple emojis should be padded to 6 characters", () => {
    expect(adjustAndPad("🎵🎶🎸🎵🎶🎸", 6)).toBe("🎵🎶🎸🎵🎶🎸");
  });
  test("complex emoji should be padded to 8 characters", () => {
    expect(adjustAndPad("👨‍👩‍👧‍👦Family", 8)).toBe("👨‍👩‍👧‍👦Fami");
  });
});

import { Octokit } from "octokit";
import fetch from "node-fetch";
import {
  type LastFMArtistGetInfoResponse,
  type LastFMUserGetTopArtistsResponse,
} from "./types.js";
import {
  type GetResponseTypeFromEndpointMethod,
  type GetResponseDataTypeFromEndpointMethod,
} from "@octokit/types";
import stringWidth from "string-width";

const MAX_NUM_ARTISTS = 5;

const config = {
  gistId: process.env.GIST_ID,
  githubToken: process.env.GH_TOKEN,
  lastfmKey: process.env.LASTFM_KEY,
  lastfmUsername: process.env.LASTFM_USERNAME,
};
type Config = typeof config;

const octokit = new Octokit({
  auth: `${config.githubToken}`,
});

type GistResponseType = GetResponseTypeFromEndpointMethod<
  typeof octokit.rest.gists.get
>;
type GistResponseDataType = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.rest.gists.get
>;

async function main() {
  // Check for missing environment variables
  if (
    !config.gistId ||
    !config.githubToken ||
    !config.lastfmKey ||
    !config.lastfmUsername
  ) {
    throw new Error("Required env vars are missing");
  }

  try {
    const gist = await getGist(config.gistId);
    const artists = await getTopArtists(config);
    const formattedContent = await createTopArtistList(
      artists,
      MAX_NUM_ARTISTS,
      config
    );

    const title = `🎧 This week's soundtrack ${
      new Date().toISOString().split("T")[0]
    }`;
    if (process.env.NODE_ENV === "development") {
      console.log("Gist would be updated with this content in production:\n");
      console.log(title);
      console.log(formattedContent);
    } else {
      await updateGist(gist, title, formattedContent, config);
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

async function getGist<GistResponseDataType>(id: string) {
  try {
    return await octokit.rest.gists.get({
      gist_id: id,
    });
  } catch (error) {
    console.error(`Error fetching gist: ${id}:`, error);
    throw new Error(
      `Failed to fetch gist: ${error instanceof Error ? error.message : error}`
    ); // Re-throw error to handle in main
  }
}

async function getTopArtists(config: Config) {
  const { lastfmKey, lastfmUsername } = config;
  const API_BASE =
    "http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&format=json&period=7day&";
  const API_ENDPOINT = `${API_BASE}user=${lastfmUsername}&api_key=${lastfmKey}&limit=${MAX_NUM_ARTISTS}`;
  const response = await fetch(API_ENDPOINT);
  if (!response.ok) {
    throw new Error(
      `Last.fm API request failed with status ${response.status}`
    );
  }
  const {
    topartists: { artist },
  } = (await response.json()) as LastFMUserGetTopArtistsResponse;
  return artist;
}

async function createTopArtistList(
  artists: LastFMUserGetTopArtistsResponse["topartists"]["artist"],
  listLength: number,
  config: Config
) {
  const numberOfArtists = Math.min(listLength, artists.length);

  const totalPlays = artists
    .slice(0, numberOfArtists)
    .reduce((total, { playcount }) => total + parseInt(playcount, 10), 0);

  const lines = await Promise.all(
    artists.map(async ({ name, playcount }, index) => {
      // Find out if artist is new this week
      const isNewThisWeek = await isArtistNewThisWeek(
        name,
        parseInt(playcount, 10),
        config
      );

      name = `${name}${isNewThisWeek ? " *" : ""}`;

      // format table entry
      name = adjustAndPad(name.substring(0, 27), 28);
      const plays = parseInt(playcount, 10);
      const bar = generateChart(plays / totalPlays, 12);

      return `${name} ${bar} ${plays.toString().padStart(5, " ")} plays`;
    })
  );

  return lines.join("\n") + `\n\n* = new this week`;
}

function adjustAndPad(str: string, maxWidth: number) {
  const width = stringWidth(str);

  // If it fits, just pad it
  if (width <= maxWidth) {
    return str + " ".repeat(maxWidth - width);
  }

  // Otherwise, truncate it carefully around full characters
  let truncatedStr = "";
  let currentWidth = 0;

  for (const char of str) {
    const charWidth = stringWidth(char);
    if (currentWidth + charWidth > maxWidth) {
      break;
    }
    truncatedStr += char;
    currentWidth += charWidth;
  }

  const paddingNeeded = maxWidth - stringWidth(truncatedStr);
  return truncatedStr + " ".repeat(paddingNeeded);
}

function testAdjustAndPad() {
  console.log("=== Testing adjustAndPad function ===");

  // Test with East Asian characters
  console.log("\n--- East Asian Characters ---");
  testCase("你好世界", 8, "你好世界", "Chinese characters");
  testCase("こんにちは", 10, "こんにちは", "Japanese characters");
  testCase("안녕하세요", 10, "안녕하세요", "Korean characters");

  // Test with European accented characters
  console.log("\n--- European Accented Characters ---");
  testCase("café", 6, "café  ", "é character");
  testCase("München", 8, "München ", "ü character");
  testCase("François", 10, "François  ", "ç character");
  testCase("Dvořák", 7, "Dvořák ", "ř character");

  // Test with mixed characters
  console.log("\n--- Mixed Characters ---");
  testCase("Tokyo東京", 10, "Tokyo東京 ", "mixed Latin and East Asian");
  testCase("Café☕", 7, "Café☕ ", "Latin with emoji");

  // Korean example - based on character analysis, we know it should truncate after "소년"
  testCase(
    "BTS (방탄소년단)",
    15,
    "BTS (방탄소년단",
    "Korean group name with parentheses"
  );

  // Test with truncation
  console.log("\n--- Truncation Tests ---");
  testCase("你好世界Hello", 8, "你好世界", "truncation of mixed characters");
  testCase("Beyoncé", 4, "Beyo", "truncation with accented character");

  // BLACKPINK example - based on character analysis, we know BLACKPINK is width 9
  // and max width is 10, so it should be "BLACKPINK " (with one space)
  testCase("BLACKPINK블랙핑크", 10, "BLACKPINK ", "truncation at boundary");

  // Edge cases
  console.log("\n--- Edge Cases ---");
  testCase("", 5, "     ", "empty string");
  testCase("a", 0, "", "zero width");

  // Emoji family example - we know the emoji is width 2, and "Fa" is width 2
  // so with max width 8, it should fit "👨‍👩‍👧‍👦Fami" (emoji + 4 letters)
  testCase("👨‍👩‍👧‍👦Family", 8, "👨‍👩‍👧‍👦Fami", "complex emoji");
  testCase("🎵🎶🎸", 6, "🎵🎶🎸", "multiple emojis");

  console.log("\n=== All tests completed! ===");
}

// Helper function to run a test case and report results
function testCase(
  input: string,
  maxWidth: number,
  expected: string,
  description: string
) {
  const result = adjustAndPad(input, maxWidth);
  const resultWidth = stringWidth(result);
  const expectedWidth = stringWidth(expected);

  console.log(
    `Testing: "${input}" (width: ${stringWidth(input)}) → max width ${maxWidth}`
  );
  console.log(`Result: "${result}" (width: ${resultWidth})`);

  if (result === expected) {
    console.log(`✅ PASSED: ${description}`);
  } else {
    console.log(`❌ FAILED: ${description}`);
    console.log(`   Expected: "${expected}" (width: ${expectedWidth})`);
    console.log(`   Actual:   "${result}" (width: ${resultWidth})`);
  }

  // Also verify the width is correct
  if (resultWidth !== maxWidth) {
    console.log(
      `⚠️ WARNING: Result width ${resultWidth} doesn't match target width ${maxWidth}`
    );
  }
}

// Run the tests
testAdjustAndPad();

function generateChart(fraction: number, size: number) {
  const position = Math.floor(fraction * size);
  return "–".repeat(position) + "|" + "–".repeat(size - position - 1);
}

async function isArtistNewThisWeek(
  name: string,
  playcount: number,
  config: Config
) {
  const { lastfmKey, lastfmUsername } = config;
  const API_ENDPOINT = `http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${name}&username=${lastfmUsername}&api_key=${lastfmKey}&format=json`;
  try {
    const response = await fetch(API_ENDPOINT);
    if (!response.ok) {
      throw new Error(
        `Last.fm API request failed with status ${response.status}`
      );
    }
    const {
      artist: {
        stats: { userplaycount },
      },
    } = (await response.json()) as LastFMArtistGetInfoResponse;

    return (
      userplaycount !== undefined && playcount === parseInt(userplaycount, 10)
    );
  } catch {
    console.error(`Failed to check if ${name} is new this week`);
    return false;
  }
}

async function updateGist(
  gist: GetResponseTypeFromEndpointMethod<typeof octokit.rest.gists.get>,
  title: string,
  content: string,
  config: Config
) {
  try {
    const filename = gist.data.files ? Object.keys(gist.data.files)[0] : "";

    await octokit.rest.gists.update({
      gist_id: config.gistId!,
      files: {
        [filename]: {
          filename: `🎧 This week's soundtrack ${
            new Date().toISOString().split("T")[0]
          }`,
          content,
        },
      },
    });
  } catch (error) {
    console.error(`Unable to update gist:\n${error}`);
    throw new Error(
      `Failed to update gist: ${error instanceof Error ? error.message : error}`
    ); // Re-throw error to handle in main
  }
}

(async () => {
  await main();
})();

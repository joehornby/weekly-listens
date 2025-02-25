// index.ts
import { Octokit } from "octokit";
import fetch from "node-fetch";
import stringWidth from "string-width";
var MAX_NUM_ARTISTS = 5;
var config = {
  gistId: process.env.GIST_ID,
  githubToken: process.env.GH_TOKEN,
  lastfmKey: process.env.LASTFM_KEY,
  lastfmUsername: process.env.LASTFM_USERNAME
};
var octokit = new Octokit({
  auth: `${config.githubToken}`
});
async function main() {
  if (!config.gistId || !config.githubToken || !config.lastfmKey || !config.lastfmUsername) {
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
    const title = `\u{1F3A7} This week's soundtrack ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`;
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
async function getGist(id) {
  try {
    return await octokit.rest.gists.get({
      gist_id: id
    });
  } catch (error) {
    console.error(`Error fetching gist: ${id}:`, error);
    throw new Error(
      `Failed to fetch gist: ${error instanceof Error ? error.message : error}`
    );
  }
}
async function getTopArtists(config2) {
  const { lastfmKey, lastfmUsername } = config2;
  const API_BASE = "http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&format=json&period=7day&";
  const API_ENDPOINT = `${API_BASE}user=${lastfmUsername}&api_key=${lastfmKey}&limit=${MAX_NUM_ARTISTS}`;
  const response = await fetch(API_ENDPOINT);
  if (!response.ok) {
    throw new Error(
      `Last.fm API request failed with status ${response.status}`
    );
  }
  const {
    topartists: { artist }
  } = await response.json();
  return artist;
}
async function createTopArtistList(artists, listLength, config2) {
  const numberOfArtists = Math.min(listLength, artists.length);
  const totalPlays = artists.slice(0, numberOfArtists).reduce((total, { playcount }) => total + parseInt(playcount, 10), 0);
  const lines = await Promise.all(
    artists.map(async ({ name, playcount }, index) => {
      const isNewThisWeek = await isArtistNewThisWeek(
        name,
        parseInt(playcount, 10),
        config2
      );
      name = `${name}${isNewThisWeek ? " *" : ""}`;
      name = adjustAndPad(name.substring(0, 27), 28);
      const plays = parseInt(playcount, 10);
      const bar = generateChart(plays / totalPlays, 12);
      return `${name} ${bar} ${plays.toString().padStart(5, " ")} plays`;
    })
  );
  return lines.join("\n") + `

* = new this week`;
}
function adjustAndPad(str, maxWidth) {
  const width = stringWidth(str);
  if (width <= maxWidth) {
    return str + " ".repeat(maxWidth - width);
  }
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
  console.log("\n--- East Asian Characters ---");
  testCase("\u4F60\u597D\u4E16\u754C", 8, "\u4F60\u597D\u4E16\u754C", "Chinese characters");
  testCase("\u3053\u3093\u306B\u3061\u306F", 10, "\u3053\u3093\u306B\u3061\u306F", "Japanese characters");
  testCase("\uC548\uB155\uD558\uC138\uC694", 10, "\uC548\uB155\uD558\uC138\uC694", "Korean characters");
  console.log("\n--- European Accented Characters ---");
  testCase("caf\xE9", 6, "caf\xE9  ", "\xE9 character");
  testCase("M\xFCnchen", 8, "M\xFCnchen ", "\xFC character");
  testCase("Fran\xE7ois", 10, "Fran\xE7ois  ", "\xE7 character");
  testCase("Dvo\u0159\xE1k", 7, "Dvo\u0159\xE1k ", "\u0159 character");
  console.log("\n--- Mixed Characters ---");
  testCase("Tokyo\u6771\u4EAC", 10, "Tokyo\u6771\u4EAC ", "mixed Latin and East Asian");
  testCase("Caf\xE9\u2615", 7, "Caf\xE9\u2615 ", "Latin with emoji");
  testCase(
    "BTS (\uBC29\uD0C4\uC18C\uB144\uB2E8)",
    15,
    "BTS (\uBC29\uD0C4\uC18C\uB144\uB2E8",
    "Korean group name with parentheses"
  );
  console.log("\n--- Truncation Tests ---");
  testCase("\u4F60\u597D\u4E16\u754CHello", 8, "\u4F60\u597D\u4E16\u754C", "truncation of mixed characters");
  testCase("Beyonc\xE9", 4, "Beyo", "truncation with accented character");
  testCase("BLACKPINK\uBE14\uB799\uD551\uD06C", 10, "BLACKPINK ", "truncation at boundary");
  console.log("\n--- Edge Cases ---");
  testCase("", 5, "     ", "empty string");
  testCase("a", 0, "", "zero width");
  testCase("\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}Family", 8, "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}Fami", "complex emoji");
  testCase("\u{1F3B5}\u{1F3B6}\u{1F3B8}", 6, "\u{1F3B5}\u{1F3B6}\u{1F3B8}", "multiple emojis");
  console.log("\n=== All tests completed! ===");
}
function testCase(input, maxWidth, expected, description) {
  const result = adjustAndPad(input, maxWidth);
  const resultWidth = stringWidth(result);
  const expectedWidth = stringWidth(expected);
  console.log(
    `Testing: "${input}" (width: ${stringWidth(input)}) \u2192 max width ${maxWidth}`
  );
  console.log(`Result: "${result}" (width: ${resultWidth})`);
  if (result === expected) {
    console.log(`\u2705 PASSED: ${description}`);
  } else {
    console.log(`\u274C FAILED: ${description}`);
    console.log(`   Expected: "${expected}" (width: ${expectedWidth})`);
    console.log(`   Actual:   "${result}" (width: ${resultWidth})`);
  }
  if (resultWidth !== maxWidth) {
    console.log(
      `\u26A0\uFE0F WARNING: Result width ${resultWidth} doesn't match target width ${maxWidth}`
    );
  }
}
testAdjustAndPad();
function generateChart(fraction, size) {
  const position = Math.floor(fraction * size);
  return "\u2013".repeat(position) + "|" + "\u2013".repeat(size - position - 1);
}
async function isArtistNewThisWeek(name, playcount, config2) {
  const { lastfmKey, lastfmUsername } = config2;
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
        stats: { userplaycount }
      }
    } = await response.json();
    return userplaycount !== void 0 && playcount === parseInt(userplaycount, 10);
  } catch {
    console.error(`Failed to check if ${name} is new this week`);
    return false;
  }
}
async function updateGist(gist, title, content, config2) {
  try {
    const filename = gist.data.files ? Object.keys(gist.data.files)[0] : "";
    await octokit.rest.gists.update({
      gist_id: config2.gistId,
      files: {
        [filename]: {
          filename: `\u{1F3A7} This week's soundtrack ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`,
          content
        }
      }
    });
  } catch (error) {
    console.error(`Unable to update gist:
${error}`);
    throw new Error(
      `Failed to update gist: ${error instanceof Error ? error.message : error}`
    );
  }
}
(async () => {
  await main();
})();
//# sourceMappingURL=index.js.map
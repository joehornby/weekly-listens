import { Octokit } from "octokit";
import fetch from "node-fetch";
import {
  type LastFMArtistGetInfoResponse,
  type LastFMUserGetWeeklyArtistChartResponse,
  type LastFMUserGetWeeklyChartListResponse,
} from "./types.js";
import { type GetResponseTypeFromEndpointMethod } from "@octokit/types";

const BAR_SIZE = 10;
const HISTORY_WEEKS = 4;
const REQUIRED_WINDOWS = 6;
const NEW_ARTIST_CHECK_CONCURRENCY = 5;

const config = {
  gistId: process.env.ANALYTICS_GIST_ID,
  githubToken: process.env.GH_TOKEN,
  lastfmKey: process.env.LASTFM_KEY,
  lastfmUsername: process.env.LASTFM_USERNAME,
};

type Config = typeof config;

type WeeklyWindow = {
  from: number;
  to: number;
};

type ArtistPlay = {
  name: string;
  playcount: number;
};

type WeeklyMetrics = {
  artists: ArtistPlay[];
  totalScrobbles: number;
  uniqueArtists: number;
  depthScore: number;
};

type DiscoveryMetrics = {
  newArtists: number;
  discoveryRate: number;
};

const octokit = new Octokit({
  auth: `${config.githubToken}`,
});

async function main() {
  if (
    !config.gistId ||
    !config.githubToken ||
    !config.lastfmKey ||
    !config.lastfmUsername
  ) {
    throw new Error("Required env vars are missing");
  }

  try {
    const runDate = new Date().toISOString().split("T")[0];
    const gist = await getGist(config.gistId);
    const windows = await getWeeklyWindows(config, REQUIRED_WINDOWS);

    const weeklyMetrics: WeeklyMetrics[] = [];
    for (const window of windows) {
      try {
        const artists = await getWeeklyArtists(config, window);
        weeklyMetrics.push(createWeeklyMetrics(artists));
      } catch (error) {
        console.warn(
          `Skipping weekly window ${window.from}-${window.to}: ${
            error instanceof Error ? error.message : error
          }`
        );
      }
    }

    const current = weeklyMetrics[0];
    if (!current) {
      throw new Error("No weekly metrics could be calculated");
    }

    const newArtistCache = new Map<string, Promise<number | null>>();
    const currentDiscovery = await getDiscoveryMetrics(
      current.artists,
      config,
      newArtistCache
    );
    const previousDiscovery =
      weeklyMetrics[1] !== undefined
        ? await getDiscoveryMetrics(
            weeklyMetrics[1].artists,
            config,
            newArtistCache
          )
        : null;

    const velocity = calculateVelocity(
      current.totalScrobbles,
      weeklyMetrics.slice(1, 1 + HISTORY_WEEKS).map((week) => week.totalScrobbles)
    );
    const previousVelocity =
      weeklyMetrics.length >= REQUIRED_WINDOWS
        ? calculateVelocity(
            weeklyMetrics[1].totalScrobbles,
            weeklyMetrics
              .slice(2, 2 + HISTORY_WEEKS)
              .map((week) => week.totalScrobbles)
          )
        : null;

    const previousDepth = weeklyMetrics[1]?.depthScore ?? null;
    const topFiveCoverage = calculateTopFiveCoverage(current.artists);
    const content = createAnalyticsMarkdown({
      runDate,
      current,
      currentDiscovery,
      velocity,
      previousDepth,
      previousDiscoveryRate: previousDiscovery?.discoveryRate ?? null,
      previousVelocity,
      topFiveCoverage,
    });

    const title = `📊 Weekly Listening Stats ${runDate}`;

    if (process.env.NODE_ENV === "development") {
      console.log("Gist would be updated with this content in production:\n");
      console.log(title);
      console.log(content);
    } else {
      await updateGist(gist, title, content, config);
    }
  } catch (error) {
    console.error("An error occurred:", error);
    process.exit(1);
  }
}

async function getGist(id: string) {
  try {
    return await octokit.rest.gists.get({
      gist_id: id,
    });
  } catch (error) {
    console.error(`Error fetching gist: ${id}:`, error);
    throw new Error(
      `Failed to fetch gist: ${error instanceof Error ? error.message : error}`
    );
  }
}

async function getWeeklyWindows(config: Config, count: number): Promise<WeeklyWindow[]> {
  const { lastfmKey, lastfmUsername } = config;
  const endpoint =
    `https://ws.audioscrobbler.com/2.0/?method=user.getweeklychartlist` +
    `&user=${lastfmUsername}&api_key=${lastfmKey}&format=json`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Last.fm API request failed with status ${response.status}`);
  }

  const data =
    (await response.json()) as LastFMUserGetWeeklyChartListResponse;
  const charts = data.weeklychartlist?.chart ?? [];
  const normalized = charts
    .map((chart) => ({
      from: Number.parseInt(chart.from, 10),
      to: Number.parseInt(chart.to, 10),
    }))
    .filter((chart) => Number.isFinite(chart.from) && Number.isFinite(chart.to))
    .sort((a, b) => b.to - a.to);

  if (normalized.length === 0) {
    throw new Error("No weekly chart windows returned from Last.fm");
  }

  const now = Math.floor(Date.now() / 1000);
  const completedWindows = normalized.filter((chart) => chart.to <= now);
  const source = completedWindows.length > 0 ? completedWindows : normalized;
  return source.slice(0, count);
}

async function getWeeklyArtists(
  config: Config,
  window: WeeklyWindow
): Promise<ArtistPlay[]> {
  const { lastfmKey, lastfmUsername } = config;
  const endpoint =
    `https://ws.audioscrobbler.com/2.0/?method=user.getweeklyartistchart` +
    `&user=${lastfmUsername}&from=${window.from}&to=${window.to}` +
    `&api_key=${lastfmKey}&format=json`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Last.fm API request failed with status ${response.status}`);
  }

  const data =
    (await response.json()) as LastFMUserGetWeeklyArtistChartResponse;
  const rawArtists = data.weeklyartistchart?.artist;
  const artistList = normalizeArtistList(rawArtists);
  return artistList
    .map((artist) => ({
      name: artist.name,
      playcount: Number.parseInt(artist.playcount, 10),
    }))
    .filter((artist) => Number.isFinite(artist.playcount) && artist.playcount > 0);
}

function normalizeArtistList(
  artists: LastFMUserGetWeeklyArtistChartResponse["weeklyartistchart"]["artist"] | undefined
) {
  if (artists === undefined) {
    return [];
  }
  return Array.isArray(artists) ? artists : [artists];
}

function createWeeklyMetrics(artists: ArtistPlay[]): WeeklyMetrics {
  const totalScrobbles = artists.reduce(
    (total, artist) => total + artist.playcount,
    0
  );
  return {
    artists,
    totalScrobbles,
    uniqueArtists: artists.length,
    depthScore: calculateGini(artists.map((artist) => artist.playcount)),
  };
}

export function calculateGini(values: number[]): number {
  const nonNegativeValues = values.filter((value) => value >= 0);
  const count = nonNegativeValues.length;
  if (count === 0) {
    return 0;
  }

  const total = nonNegativeValues.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return 0;
  }

  const sorted = [...nonNegativeValues].sort((a, b) => a - b);
  let weightedSum = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const position = index + 1;
    weightedSum += (2 * position - count - 1) * sorted[index];
  }

  return Math.min(Math.max(weightedSum / (count * total), 0), 1);
}

async function getDiscoveryMetrics(
  artists: ArtistPlay[],
  config: Config,
  cache: Map<string, Promise<number | null>>
): Promise<DiscoveryMetrics> {
  if (artists.length === 0) {
    return {
      newArtists: 0,
      discoveryRate: 0,
    };
  }

  const flags = await mapWithConcurrency(
    artists,
    NEW_ARTIST_CHECK_CONCURRENCY,
    async (artist) =>
      isArtistNewThisWeek(artist.name, artist.playcount, config, cache)
  );
  const newArtists = flags.filter(Boolean).length;
  return {
    newArtists,
    discoveryRate: (newArtists / artists.length) * 100,
  };
}

async function mapWithConcurrency<T, U>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<U>
): Promise<U[]> {
  if (values.length === 0) {
    return [];
  }

  const result = new Array<U>(values.length);
  let nextIndex = 0;
  const workers = new Array(Math.min(concurrency, values.length))
    .fill(0)
    .map(async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        result[currentIndex] = await mapper(values[currentIndex]);
      }
    });

  await Promise.all(workers);
  return result;
}

async function isArtistNewThisWeek(
  artistName: string,
  weeklyPlaycount: number,
  config: Config,
  cache: Map<string, Promise<number | null>>
) {
  const key = artistName.toLowerCase();
  const cached = cache.get(key);
  if (cached !== undefined) {
    const cachedPlaycount = await cached;
    return cachedPlaycount !== null && cachedPlaycount === weeklyPlaycount;
  }

  const fetchPromise = getUserPlaycount(artistName, config);
  cache.set(key, fetchPromise);
  const userPlaycount = await fetchPromise;
  return userPlaycount !== null && userPlaycount === weeklyPlaycount;
}

async function getUserPlaycount(
  artistName: string,
  config: Config
): Promise<number | null> {
  const { lastfmKey, lastfmUsername } = config;
  const endpoint =
    `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo` +
    `&artist=${encodeURIComponent(artistName)}` +
    `&username=${lastfmUsername}&api_key=${lastfmKey}&format=json`;
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as LastFMArtistGetInfoResponse;
    const userPlaycount = data.artist?.stats?.userplaycount;
    if (userPlaycount === undefined) {
      return null;
    }
    const parsed = Number.parseInt(userPlaycount, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function calculateVelocity(
  currentTotal: number,
  priorTotals: number[]
): number | null {
  if (priorTotals.length !== HISTORY_WEEKS) {
    return null;
  }
  const trailingAverage =
    priorTotals.reduce((sum, total) => sum + total, 0) / priorTotals.length;
  if (trailingAverage === 0) {
    return null;
  }

  return ((currentTotal - trailingAverage) / trailingAverage) * 100;
}

function calculateTopFiveCoverage(artists: ArtistPlay[]): number {
  const total = artists.reduce((sum, artist) => sum + artist.playcount, 0);
  if (total === 0) {
    return 0;
  }

  const topFiveTotal = [...artists]
    .sort((a, b) => b.playcount - a.playcount)
    .slice(0, 5)
    .reduce((sum, artist) => sum + artist.playcount, 0);
  return (topFiveTotal / total) * 100;
}

export function generateProgressBar(fraction: number, size = BAR_SIZE): string {
  if (!Number.isFinite(fraction)) {
    const balanced = Math.floor(size / 2);
    return "█".repeat(balanced) + "░".repeat(size - balanced);
  }

  const clamped = Math.min(Math.max(fraction, 0), 1);
  const filled = Math.min(Math.max(Math.round(clamped * size), 0), size);
  return "█".repeat(filled) + "░".repeat(size - filled);
}

function formatVelocity(velocity: number | null): string {
  if (velocity === null) {
    return "insufficient history";
  }
  return `${velocity >= 0 ? "+" : ""}${Math.round(velocity)}%`;
}

function describeDepth(score: number): string {
  if (score >= 0.75) {
    return "Deep Dive 🔬";
  }
  if (score >= 0.5) {
    return "Focused Loop 🎯";
  }
  if (score >= 0.3) {
    return "Balanced Mix 🎧";
  }
  return "Wide Discovery 🌍";
}

function describeVelocity(velocity: number | null): string {
  if (velocity === null) {
    return "insufficient history";
  }
  if (velocity >= 20) {
    return "Surge week 🚀";
  }
  if (velocity >= 5) {
    return "Binge week 🚀";
  }
  if (velocity > -5) {
    return "Steady pace ➡️";
  }
  if (velocity > -20) {
    return "Cool-off week 🧊";
  }
  return "Slow week 🐢";
}

function formatTrend(
  label: string,
  current: number,
  previous: number | null,
  formatter: (delta: number) => string
): string {
  if (previous === null) {
    return `→ ${label} n/a`;
  }

  const delta = current - previous;
  const arrow = delta > 0 ? "↗" : delta < 0 ? "↘" : "→";
  return `${arrow} ${label} ${formatter(delta)}`;
}

function createAnalyticsMarkdown(args: {
  runDate: string;
  current: WeeklyMetrics;
  currentDiscovery: DiscoveryMetrics;
  velocity: number | null;
  previousDepth: number | null;
  previousDiscoveryRate: number | null;
  previousVelocity: number | null;
  topFiveCoverage: number;
}) {
  const {
    runDate,
    current,
    currentDiscovery,
    velocity,
    previousDepth,
    previousDiscoveryRate,
    previousVelocity,
    topFiveCoverage,
  } = args;

  const depthValue = current.depthScore.toFixed(2);
  const depthBar = generateProgressBar(current.depthScore);
  const discoveryPercent = Math.round(currentDiscovery.discoveryRate);
  const discoveryBar = generateProgressBar(currentDiscovery.discoveryRate / 100);
  const velocityBar = generateProgressBar(
    velocity === null ? Number.NaN : Math.min(Math.abs(velocity) / 50, 1)
  );

  const velocityLabel = formatVelocity(velocity);
  const depthTrend = formatTrend("Depth", current.depthScore, previousDepth, (delta) =>
    `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`
  );
  const discoveryTrend = formatTrend(
    "Discovery",
    currentDiscovery.discoveryRate,
    previousDiscoveryRate,
    (delta) => `${delta >= 0 ? "+" : ""}${Math.round(delta)}%`
  );
  const velocityTrend =
    velocity === null || previousVelocity === null
      ? "→ Velocity insufficient history"
      : formatTrend("Velocity", velocity, previousVelocity, (delta) =>
          `${delta >= 0 ? "+" : ""}${Math.round(delta)}%`
        );

  return [
    `DEPTH      ${depthValue}  ${depthBar}  ${describeDepth(
      current.depthScore
    )}`,
    `DISCOVERY  ${discoveryPercent}%   ${discoveryBar}  ${currentDiscovery.newArtists} new artists *`,
    `VELOCITY   ${velocityLabel}  ${velocityBar}  ${describeVelocity(
      velocity
    )}`,
    "",
    `vs last week: ${depthTrend}  ${discoveryTrend}  ${velocityTrend}`,
    `Top 5 Coverage: ${Math.round(topFiveCoverage)}% of total plays`,
    `Unique Artists: ${current.uniqueArtists}`,
    `Total Scrobbles: ${current.totalScrobbles}`,
    "",
    "* = new this week",
  ].join("\n");
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
          filename: title,
          content,
        },
      },
    });
  } catch (error) {
    console.error(`Unable to update gist:\n${error}`);
    throw new Error(
      `Failed to update gist: ${error instanceof Error ? error.message : error}`
    );
  }
}

if (!process.env.NODE_ENV?.includes("test")) {
  (async () => {
    await main();
  })();
}

# Weekly Listens

A script to fetch Last.fm listening data and write two companion gists:

1. Artist leaderboard gist
2. Weekly listening analytics gist

Artist gist output looks like:

```text
Martin Luke Brown            ██████░░░░░░    23 plays
Mk.gee                       ████░░░░░░░░    17 plays
Genevieve Artadi *           ████░░░░░░░░    14 plays
Low Roar                     ███░░░░░░░░░    10 plays
Nilüfer Yanya                ██░░░░░░░░░░     9 plays

* = new this week
```

## Setup

You will need to:

1. Create two Gists on GitHub (artists + analytics).
2. Create a new Last.fm API key.
3. Create a new GitHub token with gist and repo scopes.

Then create a `.env` file in the root of the project with the following variables from your GitHub and Last.fm accounts:

```bash
# .env

ARTISTS_GIST_ID=
ANALYTICS_GIST_ID=
GH_TOKEN=
LASTFM_KEY=
LASTFM_USERNAME=
```

## Installation

```bash
bun install
```

## Build

```bash
bun run build
```

## Run

Check `.github/workflows/update-chart.yml` for the GitHub Actions workflow.
It's set to run every day at 8am UTC. If you want to run it weekly instead, you can change the cron schedule to something like `0 0 * * 0` (midnight Sunday).

## Testing

I'm using Bun's test runner. The API is similar to Jest or Vitest if you'd prefer to install those and use them instead.

```bash
bun test
```

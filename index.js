import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";
import eaw from "eastasianwidth";

const {
    GIST_ID: gistId,
    GH_TOKEN: githubToken,
    LASTFM_KEY: lastfmKey,
    LASTFM_USERNAME: lastfmUsername,
} = process.env;

const octokit = new Octokit({
    auth: `${githubToken}`,
})

const MAX_NUM_ARTISTS = 10;

async function main () {
    if (!gistId || !githubToken || !lastfmKey || !lastfmUsername) {
        throw new Error("Required env vars are missing");
    }

    // Get existing gh gist
    let gist;

    try {
        gist = await octokit.gists.get({
            gist_id: gistId,
        });
    } catch (error) {
        console.error("Error fetching gist:", error);
        return
    }

    // Get last.fm data
    const artists = await getTopArtists();

    const numberOfArtists = Math.min(MAX_NUM_ARTISTS, artists.length);

    const totalPlays = artists.slice(0, numberOfArtists)
        .reduce((total, { playcount }) => total + parseInt(playcount, 10), 0);

    // Process and format last.fm data
    const lines = await Promise.all(artists.map(async ({ name, playcount }, index) => {
        // Find out if artist is new this week
        const isNewThisWeek = await isArtistNewThisWeek(name, playcount);

        name = `${name}${isNewThisWeek ? " *" : ""}`;

        // Create display table
        name = adjustAndPad(name.substring(0,25), 26);
        const plays = parseInt(playcount, 10);
        const bar = generateChart(plays / totalPlays, 12);

        return `${(index + 1).toString().padStart(2, "0")}. ${name} ${bar} ${plays.toString().padStart(5, " ")} plays`;
    }))
    
    // const formattedContent = lines.map((line, index) => `${(index + 1).toString().padStart(2, "0")}. ${line}\n`) + `    * = new this week`;
    const formattedContent = lines.join("\n") + `\n    * = new this week`;
    console.log(formattedContent)
    try {
        const filename = Object.keys(gist.data.files)[0];
        
        await octokit.gists.update({
            gist_id: gistId,
            files: {
                [filename]: {
                    filename: `🎧 My top music artists this week`,
                    content: formattedContent,
                },
            },
        });
    } catch (error) {
        console.error(`Unable to update gist:\n${error}`);
    }
}

async function getTopArtists() {
    const API_BASE = "http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&format=json&period=7day&";
    const API_ENDPOINT = `${API_BASE}user=${lastfmUsername}&api_key=${lastfmKey}&limit=${MAX_NUM_ARTISTS}`;
    const {topartists: { artist }} = await (await fetch(API_ENDPOINT)).json();
    return artist;
}

function adjustAndPad(str, maxWidth) {
    const width = eaw.length(str);
    let adjustedStr = str.slice(0, Math.max(0, str.length - (width - maxWidth)));
    const paddingNeeded = maxWidth - eaw.length(adjustedStr);
    return adjustedStr.padEnd(adjustedStr.length + paddingNeeded);
}

function generateChart(fraction, size) {
    const position = Math.floor(fraction * size);
    return "–".repeat(position) + "█" + "–".repeat(size - position - 1)
}

async function isArtistNewThisWeek(name, playcount) {
    const API_ENDPOINT = `http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${name}&username=${lastfmUsername}&api_key=${lastfmKey}&format=json`;
    try {
        const {artist: {stats : { userplaycount }}} = await (await fetch(API_ENDPOINT)).json();
        return playcount === userplaycount
    } catch {
        return false
    }

}

(async () => {
    await main();
})();

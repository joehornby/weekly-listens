import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";
import eaw from "eastasianwidth";

const MAX_NUM_ARTISTS = 5;

const config = {
    gistId: process.env.GIST_ID,
    githubToken: process.env.GH_TOKEN,
    lastfmKey: process.env.LASTFM_KEY,
    lastfmUsername: process.env.LASTFM_USERNAME,
};


const octokit = new Octokit({
    auth: `${config.githubToken}`,
})


async function main () {
    // Check for missing environment variables
    if (!config.gistId || !config.githubToken || !config.lastfmKey || !config.lastfmUsername) {
        throw new Error("Required env vars are missing");
    }

    try {
        const gist = await getGist(config.gistId);
        const artists = await getTopArtists(config);
        const formattedContent = await createTopArtistList(artists, MAX_NUM_ARTISTS, config);

        if (process.env.NODE_ENV === "development") {
            console.log(`🎧 This week's soundtrack ${(new Date()).toISOString().split('T')[0]}`)
            console.log(formattedContent);
        } else {
            await updateGist(gist, formattedContent, config);
        }

    } catch (error) {
        console.error("An error occurred:", error);
    }


    
}

async function getGist(id) {
    try {
        return await octokit.gists.get({
            gist_id: id,
        });
    } catch (error) {
        console.error(`Error fetching gist: ${id}:`, error);
        throw new Error(`Failed to fetch gist: ${error.message}`); // Re-throw error to handle in main
    }
}

async function getTopArtists(config) {
    const { lastfmKey, lastfmUsername } = config;
    const API_BASE = "http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&format=json&period=7day&";
    const API_ENDPOINT = `${API_BASE}user=${lastfmUsername}&api_key=${lastfmKey}&limit=${MAX_NUM_ARTISTS}`;
    const response = await fetch(API_ENDPOINT);
    if (!response.ok) {
        throw new Error(`Last.fm API request failed with status ${response.status}`);
    }
    const {topartists: { artist }} = await response.json();
    return artist;
}

async function createTopArtistList(artists, listLength, config){
    const numberOfArtists = Math.min(listLength, artists.length);

    const totalPlays = artists.slice(0, numberOfArtists)
        .reduce((total, { playcount }) => total + parseInt(playcount, 10), 0);

    const lines = await Promise.all(artists.map(async ({ name, playcount }, index) => {
        // Find out if artist is new this week
        const isNewThisWeek = await isArtistNewThisWeek(name, playcount, config);

        name = `${name}${isNewThisWeek ? " *" : ""}`;

        // format table entry
        name = adjustAndPad(name.substring(0,25), 26);
        const plays = parseInt(playcount, 10);
        const bar = generateChart(plays / totalPlays, 12);

        return `${(index + 1).toString()} ${name} ${bar} ${plays.toString().padStart(5, " ")} plays`;
    }))
    
    return lines.join("\n") + `\n\n* = new this week`;
}

function adjustAndPad(str, maxWidth) {
    const width = eaw.length(str);
    let adjustedStr = str.slice(0, Math.max(0, str.length - (width - maxWidth)));
    const paddingNeeded = maxWidth - eaw.length(adjustedStr);
    return adjustedStr.padEnd(adjustedStr.length + paddingNeeded);
}

function generateChart(fraction, size) {
    const position = Math.floor(fraction * size);
    return "–".repeat(position) + "|" + "–".repeat(size - position - 1)
}

async function isArtistNewThisWeek(name, playcount, config) {
    const { lastfmKey, lastfmUsername } = config;
    const API_ENDPOINT = `http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${name}&username=${lastfmUsername}&api_key=${lastfmKey}&format=json`;
    try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) {
            throw new Error(`Last.fm API request failed with status ${response.status}`);
        }
        const {artist: {stats : { userplaycount }}} = await response.json();
        return playcount === userplaycount
    } catch {
        console.error(`Failed to check if ${name} is new this week`);
        return false
    }

}

async function updateGist(gist, content, config) {
    try {
        const filename = Object.keys(gist.data.files)[0];
        
        await octokit.gists.update({
            gist_id: config.gistId,
            files: {
                [filename]: {
                    filename: `🎧 This week's soundtrack ${(new Date()).toISOString().split('T')[0]}`,
                    content,
                },
            },
        });
    } catch (error) {
        console.error(`Unable to update gist:\n${error}`);
        throw new Error(`Failed to update gist: ${error.message}`); // Re-throw error to handle in main
    }
}

(async () => {
    await main();
})();

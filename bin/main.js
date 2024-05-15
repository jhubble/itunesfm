#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const fsPromises = fs_1.default.promises;
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const prompt_1 = __importDefault(require("prompt"));
const lastfm_1 = require("./lastfm");
const TRACK_CACHE = path_1.default.resolve(__dirname, "../iTunescache.json");
console.log("TRACK_CACHE", TRACK_CACHE);
prompt_1.default.colors = false;
// Store ambiguous songs in this DB.
const MATCHING_FILE = path_1.default.resolve(__dirname, "../matching.json");
async function quickPrompt(message) {
    while (true) {
        const { result } = await prompt_1.default.get({
            properties: { result: { message } },
        });
        if (result) {
            return result;
        }
    }
}
async function promptForMatch(name, artist, matches) {
    console.log("Multiple matches for %s by %s. Enter valid numbers (comma separated):", name || "??", artist || "??");
    for (let i = 0; i < matches.length; i++) {
        console.log("%d: %s by %s (%d plays)", i + 1, matches[i].name, matches[i].artist.name, matches[i].playcount);
    }
    const reply = name !== "reallyask" ? "0" : await quickPrompt("Enter some numbers (0 for none, a for all)");
    console.log("defaulting to no match");
    if (reply === "a" || reply === "A") {
        return matches;
    }
    let result = [];
    for (const num of reply.split(",")) {
        const match = matches[parseInt(num, 10) - 1];
        if (match != null) {
            result.push(match);
        }
    }
    return result;
}
async function main() {
    try {
        let provider;
        if (os_1.default.platform() === "win32") {
            console.log("using windows provider");
            provider = require("./providers/WindowsProvider.js");
        }
        else if (os_1.default.platform() === "darwin") {
            console.log("using mac provider");
            provider = require("./providers/OSXProvider");
        }
        else {
            throw new Error(`platform ${os_1.default.platform()} not supported`);
        }
        const useCached = process.argv.indexOf("cache") !== -1;
        let tracksPromise;
        // Start fetching from iTunes immediately.
        if (useCached && fs_1.default.existsSync(TRACK_CACHE)) {
            console.log("get tracks cache");
            tracksPromise = fsPromises.readFile(TRACK_CACHE, 'utf-8').then(result => {
                console.log("reading track cache");
                return JSON.parse(result.toString());
            });
        }
        else {
            console.log("get tracks promise");
            tracksPromise = provider.getTracks().then(result => {
                console.log("got tracks");
                fs_1.default.writeFileSync(TRACK_CACHE, JSON.stringify(result));
                return result;
            });
        }
        let username = process.argv[2];
        console.log("username", username);
        if (username == null) {
            username = await quickPrompt("Enter your last.fm username");
        }
        let artistMatch = 0;
        let artistNotMatch = 0;
        let trackMatch = 0;
        let trackNotMatch = 0;
        console.log("starting -- getting top tracks");
        const topTracks = await (0, lastfm_1.getTopTracks)(username, useCached);
        console.log("got top tracks , getting tracks");
        const myTracks = await tracksPromise;
        console.log("got myTracks");
        const artistHash = {};
        topTracks.forEach(track => {
            const artist = track.artist.name.replace(/^The /, '').toLowerCase();
            if (!artistHash[artist]) {
                artistHash[artist] = [];
            }
            artistHash[artist].push(track);
        });
        console.log("Found %d tracks locally, %d on last.fm.", Object.keys(myTracks).length, topTracks.length);
        let matching = {};
        try {
            matching = JSON.parse(fs_1.default.readFileSync(MATCHING_FILE).toString());
        }
        catch (e) { }
        const updates = {};
        for (const id in myTracks) {
            const { name, artist, playedCount } = myTracks[id];
            const artistSimple = artist.replace(/^The /, '').toLowerCase();
            const urls = matching[id];
            let matches = [];
            if (artistHash[artistSimple]) {
                artistMatch++;
                matches = await (0, lastfm_1.matchTrack)(artistHash[artistSimple], name, artist, urls);
            }
            else {
                console.warn(` --> Artist not found: ${artistSimple}`);
                artistNotMatch++;
            }
            if (matches.length === 0) {
                trackNotMatch++;
                console.warn(`warning: could not match ${name} by ${artist} (id = ${id})`);
                if (urls != null) {
                    console.warn("additionally, you provided urls but none matched");
                }
                continue;
            }
            trackMatch++;
            if (urls == null && matches.length > 1) {
                matches = await promptForMatch(name, artist, matches);
                matching[id] = matches.map((x) => x.url);
            }
            let matchPlayCount = 0;
            for (const match of matches) {
                matchPlayCount += parseInt(match.playcount, 10);
            }
            if (playedCount < matchPlayCount) {
                console.log(`will update ${name}: ${artist} to ${matchPlayCount}`);
                updates[id] = matchPlayCount;
            }
        }
        console.warn("UPDATES", updates);
        console.warn(`Artist Match    : ${artistMatch}`);
        console.warn(`Artist Not Match: ${artistNotMatch}`);
        console.warn(`Track Match     : ${trackMatch}`);
        console.warn(`Track Not Match : ${trackNotMatch}`);
        console.warn(`Updates         : ${Object.keys(updates).length}`);
        if (Object.keys(updates).length === 0) {
            console.log("No play counts were changed.");
        }
        else {
            const ok = await quickPrompt("Save changes? y/n");
            if (ok === "y") {
                console.log("Saving changes..");
                await provider.updateTracks(updates);
            }
        }
        fs_1.default.writeFileSync(MATCHING_FILE, JSON.stringify(matching));
    }
    catch (e) {
        console.error(e);
    }
}
main();

/* @flow */

import type {TrackInfo} from './lastfm';

import invariant from 'assert';
import fs from 'fs';
import os from 'os';
import prompt from 'prompt';
import promisify from './promisify';
import {getTopTracks, findMatchingTracks} from './lastfm';

prompt.colors = false;

// Store ambiguous songs in this DB.
const MATCHING_FILE = 'matching.json';

async function quickPrompt(message: string): Promise<string> {
  const {result} = await promisify(prompt, 'get', {properties: {result: {message}}});
  return result;
}

async function promptForMatch(name: ?string, artist: ?string, matches: Array<TrackInfo>) {
  console.log(
    'Multiple matches for %s by %s. Please pick one:',
    name || '??',
    artist || '??',
  );
  for (let i = 0; i < matches.length; i++) {
    console.log(
      '%d: %s by %s (%d plays)',
      i + 1,
      matches[i].name,
      matches[i].artist.name,
      matches[i].playcount,
    );
  }
  let num;
  do {
    num = parseInt(await quickPrompt('Enter a number (0 for none)'), 10);
    // repeat until num is valid (not NaN)
  } while (num != num);
  if (num <= 0 || num >= matches.length) {
    return null;
  }
  return matches[num - 1];
}

const URL_REGEX = /^.+last.fm\/music\/([^/]+)\/[^/]+\/([^/]+)$/;
function normalizeURL(url: string) {
  const match = URL_REGEX.exec(url);
  if (match == null) {
    console.warn(`warning: invalid URL ${url} in matching.json`);
    return null;
  }
  // The album is never provided by last.fm's API.
  return `http://www.last.fm/music/${match[1]}/_/${match[2]}`;
}

async function matchTrack(
  tracks: Array<TrackInfo>,
  name: string,
  artist: ?string,
  key: string,
  matching: Object,
) {
  const {matches, nameMatches} = findMatchingTracks(
    tracks,
    name,
    artist,
    matching[key] && normalizeURL(matching[key]),
  );
  let match;
  if (matches.length + nameMatches.length === 0) {
    console.log(`warning: could not match ${name} by ${artist} (id = ${key})`);
    // TODO: use heuristics to determine possible matches
  } else if (matches.length === 1 || nameMatches.length === 1) {
    match = matches[0] || nameMatches[0];
  } else {
    match = await promptForMatch(name, artist, matches.length ? matches : nameMatches);
    // Record the absence of a match as well.
    matching[key] = match == null ? '' : match.url;
  }
  return match;
}

async function main() {
  try {
    let provider;
    if (os.platform() === 'win32') {
      provider = require('./providers/WindowsProvider.js');
    } else if (os.platform() === 'darwin') {
      provider = require('./providers/OSXProvider');
    } else {
      throw new Error(`platform ${os.platform()} not supported`);
    }
    // Start fetching from iTunes immediately.
    const tracksPromise = provider.getTracks();

    let username = process.argv[2];
    if (username == null) {
      username = await quickPrompt('Enter your last.fm username');
    }
    const useCached = process.argv.indexOf('cache') !== -1;

    const topTracks = await getTopTracks(username, useCached);
    const myTracks = await tracksPromise;

    console.log(
      'Found %d tracks locally, %d on last.fm.',
      Object.keys(myTracks).length,
      topTracks.length,
    );

    let matching = {};
    try {
      matching = JSON.parse(fs.readFileSync(MATCHING_FILE).toString());
    } catch (e) {}

    const updates = {};
    for (const id in myTracks) {
      const {name, artist, playedCount} = myTracks[id];
      const match = await matchTrack(topTracks, name, artist, id, matching);
      if (match != null) {
        const matchPlayCount = parseInt(match.playcount, 10);
        if (playedCount < matchPlayCount) {
          console.log(`will update ${name}: ${artist} to ${match.playcount}`);
          updates[id] = matchPlayCount;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      console.log('No play counts were changed.');
    } else {
      const ok = await quickPrompt('Save changes? y/n');
      if (ok === 'y') {
        console.log('Saving changes..');
        await provider.updateTracks(updates);
      }
    }

    fs.writeFileSync(MATCHING_FILE, JSON.stringify(matching));
  } catch (e) {
    console.error(e);
  }
}

main();

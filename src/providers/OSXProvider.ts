/* @flow */


import type {ITunesTrackInfo, Provider} from './Provider';

console.log("provider");
const osa = require('osa');

function Application(app: string): any {} // stub for Flow

function osaPromise(fn, ...args): any {
	console.log("prom");
  return new Promise((resolve, reject) => {
	  console.log("OSA:",fn);
    osa(fn, ...args, (err, result) => {
	    console.log("running this promise", fn);
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

const OSXProvider: Provider = {
  async getTracks() {
	  console.log("returning promise for osx provider");
    return await osaPromise(() => {
      console.log("getting playlist");
      var itunes = Application('Music');
      console.log("getting tracks");
      var tracks = itunes.libraryPlaylists[0].tracks;


      var result = {};
      for (var i = 0; i < tracks.length; i++) {
	      console.log(i);
        var track = tracks[i];
        result[track.persistentID()] = {
          name: track.name(),
          artist: track.artist(),
          playedCount: track.playedCount(),
	  album: track.album()
        };
      }
      return result;
    });
  },

  async updateTracks(counts) {
	  console.log("UT");
    await osaPromise((counts) => {
      var itunes = Application('Music');
      var tracks = itunes.libraryPlaylists[0].tracks;
      for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        var id = track.persistentID();
        if (counts[id]) {
          track.playedCount = counts[id];
        }
      }
    }, counts);
  },
};

module.exports = OSXProvider;

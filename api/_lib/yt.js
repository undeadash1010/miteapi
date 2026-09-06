import { Innertube, UniversalCache } from 'youtubei.js';

let ytPromise = null;

export function getYT() {
  if (!ytPromise) {
    ytPromise = Innertube.create({
      lang: 'en',
      location: 'US',
      retrieve_player: true,
      cache: new UniversalCache(false),
      generate_session_locally: true,
    });
  }
  return ytPromise;
}
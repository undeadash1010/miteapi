import { Innertube, UniversalCache } from 'youtubei.js';
import { BG } from 'bgutils-js';
import { JSDOM } from 'jsdom';

let ytPromise = null;

async function generatePoToken(visitorData) {
  const requestKey = 'O43z0dpjhgX20SCx4KAo';
  const dom = new JSDOM();
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });

  const bgConfig = {
    fetch: (url, options) => fetch(url, options),
    globalObj: globalThis,
    identifier: visitorData,
    requestKey,
  };

  const bgChallenge = await BG.Challenge.create(bgConfig);
  if (!bgChallenge) throw new Error('Could not get BG challenge');

  const interpreterJavascript =
    bgChallenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;

  if (interpreterJavascript) {
    new Function(interpreterJavascript)();
  } else {
    throw new Error('Could not load VM interpreter');
  }

  const poTokenResult = await BG.PoToken.generate({
    program: bgChallenge.program,
    globalName: bgChallenge.globalName,
    bgConfig,
  });

  return poTokenResult.poToken;
}

export async function getYT() {
  if (ytPromise) return ytPromise;

  ytPromise = (async () => {
    const yt = await Innertube.create({
      lang: 'en',
      location: 'US',
      retrieve_player: true,
      cache: new UniversalCache(false),
      generate_session_locally: true,
    });

    try {
      const visitorData = yt.session.context.client.visitorData;
      const poToken = await generatePoToken(visitorData);
      yt.session.po_token = poToken;
      yt.session.context.client.visitorData = visitorData;
      console.log('PoToken attached successfully');
    } catch (e) {
      console.error('PoToken generation failed, continuing without it:', e.message);
    }

    return yt;
  })();

  return ytPromise;
}

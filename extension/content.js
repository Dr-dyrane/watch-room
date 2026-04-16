const APP_SOURCE = 'watch-room-app';
const EXT_SOURCE = 'watch-room-extension';

function getVideo() {
  return document.querySelector('video');
}

function getNetflixTitle() {
  const selectors = [
    '[data-uia="video-title"]',
    'h4[data-uia="video-title"]',
    '.video-title h4',
    'title'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }

  return document.title.replace(' - Netflix', '').trim();
}

function pushStateToPage() {
  const video = getVideo();
  window.postMessage(
    {
      source: EXT_SOURCE,
      type: 'NETFLIX_STATE',
      currentTime: video?.currentTime ?? 0,
      paused: video?.paused ?? true,
      title: getNetflixTitle(),
    },
    '*',
  );
}

function handleControl(action, time) {
  const video = getVideo();
  if (!video) return { ok: false, error: 'No video element found' };

  if (action === 'PLAY') {
    video.play();
  }

  if (action === 'PAUSE') {
    video.pause();
  }

  if (action === 'SEEK_FORWARD') {
    video.currentTime = video.currentTime + 10;
  }

  if (action === 'SEEK_BACKWARD') {
    video.currentTime = Math.max(0, video.currentTime - 10);
  }

  if (action === 'SYNC_NOW' && typeof time === 'number') {
    video.currentTime = time;
  }

  window.setTimeout(pushStateToPage, 100);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GET_STATE') {
    const video = getVideo();
    sendResponse({
      ok: Boolean(video),
      currentTime: video?.currentTime ?? 0,
      paused: video?.paused ?? true,
      title: getNetflixTitle(),
    });
    return true;
  }

  const result = handleControl(message?.type, message?.time);
  sendResponse(result);
  return true;
});

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== APP_SOURCE) return;

  if (event.data.type === 'PING_EXTENSION') {
    window.postMessage({ source: EXT_SOURCE, type: 'EXTENSION_READY' }, '*');
    pushStateToPage();
    return;
  }

  if (event.data.type === 'APP_CONTROL') {
    const { action, currentTime } = event.data.payload || {};
    handleControl(action, currentTime);
  }
});

window.setInterval(pushStateToPage, 4000);
pushStateToPage();

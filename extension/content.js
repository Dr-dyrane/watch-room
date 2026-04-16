const APP_SOURCE = 'watch-room-app';
const EXT_SOURCE = 'watch-room-extension';

const ROOM_HOST_MATCHERS = ['localhost', '127.0.0.1', 'watch-room.vercel.app'];

let latestRoomContext = null;
let overlayController = null;

function isNetflixPage() {
  return window.location.hostname.includes('netflix.com');
}

function isRoomPage() {
  const host = window.location.hostname;

  return ROOM_HOST_MATCHERS.some((value) => host === value || host.endsWith(`.${value}`));
}

function getVideo() {
  return document.querySelector('video');
}

function getNetflixTitle() {
  const selectors = ['[data-uia="video-title"]', 'h4[data-uia="video-title"]', '.video-title h4', 'title'];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.trim()) {
      return element.textContent.trim();
    }
  }

  return document.title.replace(' - Netflix', '').trim();
}

function getNetflixState() {
  const video = getVideo();

  return {
    ok: Boolean(video),
    currentTime: video?.currentTime ?? 0,
    paused: video?.paused ?? true,
    title: getNetflixTitle(),
  };
}

function pushStateToPage(state) {
  window.postMessage(
    {
      source: EXT_SOURCE,
      type: 'NETFLIX_STATE',
      currentTime: state.currentTime ?? 0,
      paused: state.paused ?? true,
      title: state.title ?? '',
    },
    '*',
  );
}

function handleNetflixControl(action, time) {
  const video = getVideo();

  if (!video) {
    return { ok: false, error: 'No Netflix video found' };
  }

  if (action === 'PLAY') {
    video.play();
  }

  if (action === 'PAUSE') {
    video.pause();
  }

  if (action === 'SEEK_FORWARD') {
    video.currentTime += 10;
  }

  if (action === 'SEEK_BACKWARD') {
    video.currentTime = Math.max(0, video.currentTime - 10);
  }

  if (action === 'SYNC_NOW' && typeof time === 'number') {
    video.currentTime = time;
  }

  window.setTimeout(() => {
    const nextState = getNetflixState();
    pushStateToPage(nextState);
    overlayController?.updatePlayerState(nextState);
  }, 120);

  return { ok: true };
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function createCinemaOverlay() {
  const root = document.createElement('div');
  root.id = 'watch-room-cinema-overlay';
  document.documentElement.appendChild(root);

  const shadow = root.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .shell {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 2147483647;
        width: min(360px, calc(100vw - 32px));
        color: #f5f7fb;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
      }
      .panel {
        display: grid;
        gap: 12px;
        padding: 16px;
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(14, 17, 24, 0.92), rgba(8, 11, 16, 0.84));
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(24px);
      }
      .mini {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .eyebrow {
        margin: 0 0 6px;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(245, 247, 251, 0.6);
      }
      .title {
        margin: 0;
        font-size: 24px;
        line-height: 1;
        letter-spacing: -0.04em;
      }
      .muted {
        margin: 0;
        color: rgba(245, 247, 251, 0.72);
        font-size: 13px;
      }
      .time {
        font-size: 42px;
        line-height: 0.92;
        letter-spacing: -0.07em;
        font-weight: 600;
      }
      .cluster {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .chip,
      .person,
      .button,
      .play {
        border: 0;
        border-radius: 999px;
        color: inherit;
      }
      .chip,
      .person {
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.08);
        font-size: 12px;
      }
      .person {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: rgba(255,255,255,0.28);
      }
      .dot.on {
        background: #4ade80;
      }
      .controls {
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: center;
      }
      .button,
      .play {
        cursor: pointer;
        background: rgba(255, 255, 255, 0.1);
        min-width: 48px;
        min-height: 48px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 160ms ease, background 160ms ease, opacity 160ms ease;
      }
      .button:hover,
      .play:hover {
        transform: translateY(-1px);
      }
      .play {
        min-width: 64px;
        min-height: 64px;
        background: #f5f7fb;
        color: #090c11;
      }
      .footer {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .action {
        flex: 1;
        min-width: 0;
        border: 0;
        cursor: pointer;
        border-radius: 18px;
        padding: 12px 14px;
        color: inherit;
        background: rgba(255, 255, 255, 0.08);
        font-size: 13px;
      }
      .collapse {
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 999px;
        background: rgba(255,255,255,0.08);
        color: inherit;
        cursor: pointer;
      }
      .hidden .body {
        display: none;
      }
      @media (max-width: 720px) {
        .shell {
          right: 12px;
          left: 12px;
          bottom: 12px;
          width: auto;
        }
      }
    </style>
    <div class="shell">
      <div class="panel">
        <div class="mini">
          <div>
            <p class="eyebrow">Watch Room Cinema</p>
            <h2 class="title" data-title>Netflix</h2>
          </div>
          <button class="collapse" data-collapse aria-label="Collapse overlay">−</button>
        </div>
        <div class="body">
          <p class="muted" data-subtitle>Waiting for room context</p>
          <div class="time" data-time>0:00</div>
          <div class="controls">
            <button class="button" data-action="SEEK_BACKWARD" aria-label="Seek backward 10 seconds">-10</button>
            <button class="play" data-action="PLAY_PAUSE" aria-label="Play or pause">Play</button>
            <button class="button" data-action="SEEK_FORWARD" aria-label="Seek forward 10 seconds">+10</button>
            <button class="button" data-action="SYNC_NOW" aria-label="Sync now">Sync</button>
          </div>
          <div class="cluster" data-people></div>
          <div class="footer">
            <button class="action" data-open-room>Open room</button>
            <button class="action" data-open-netflix>Netflix home</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const shell = shadow.querySelector('.shell');
  const title = shadow.querySelector('[data-title]');
  const subtitle = shadow.querySelector('[data-subtitle]');
  const time = shadow.querySelector('[data-time]');
  const play = shadow.querySelector('[data-action="PLAY_PAUSE"]');
  const people = shadow.querySelector('[data-people]');
  const collapse = shadow.querySelector('[data-collapse]');
  const openRoom = shadow.querySelector('[data-open-room]');
  const openNetflix = shadow.querySelector('[data-open-netflix]');

  const updatePlayerState = (state) => {
    title.textContent = state.title || latestRoomContext?.title || 'Netflix';
    time.textContent = formatTime(state.currentTime ?? 0);
    play.textContent = state.paused ? 'Play' : 'Pause';
  };

  const updateRoomState = (context) => {
    latestRoomContext = context;
    subtitle.textContent = context?.subtitle || 'Room connected';
    people.innerHTML = '';

    (context?.members ?? []).forEach((member) => {
      const chip = document.createElement('div');
      chip.className = 'person';
      chip.innerHTML = `<span class="dot ${member.online ? 'on' : ''}"></span><span>${member.name}</span>`;
      people.appendChild(chip);
    });

    title.textContent = getNetflixState().title || context?.title || 'Netflix';
  };

  collapse.addEventListener('click', () => {
    shell.classList.toggle('hidden');
    collapse.textContent = shell.classList.contains('hidden') ? '+' : '−';
  });

  shadow.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.getAttribute('data-action');
      const state = getNetflixState();
      const action = type === 'PLAY_PAUSE' ? (state.paused ? 'PLAY' : 'PAUSE') : type;

      handleNetflixControl(action, state.currentTime);
      chrome.runtime.sendMessage({
        type: 'OVERLAY_CONTROL',
        action,
        currentTime: state.currentTime,
      });
    });
  });

  openRoom.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_ROOM' });
  });

  openNetflix.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_NETFLIX' });
  });

  updatePlayerState(getNetflixState());

  return {
    updatePlayerState,
    updateRoomState,
  };
}

function installNetflixBridge() {
  overlayController = createCinemaOverlay();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'GET_STATE') {
      sendResponse(getNetflixState());
      return true;
    }

    if (message?.type === 'ROOM_CONTEXT') {
      overlayController?.updateRoomState(message.payload ?? null);
      sendResponse({ ok: true });
      return true;
    }

    const result = handleNetflixControl(message?.type, message?.time);
    sendResponse(result);
    return true;
  });

  chrome.runtime.sendMessage({ type: 'GET_ROOM_CONTEXT' }, (response) => {
    if (response?.ok && response.payload) {
      overlayController?.updateRoomState(response.payload);
    }
  });

  window.setInterval(() => {
    const state = getNetflixState();
    pushStateToPage(state);
    overlayController?.updatePlayerState(state);
  }, 4000);

  const initialState = getNetflixState();
  pushStateToPage(initialState);
  overlayController.updatePlayerState(initialState);
}

function installRoomBridge() {
  async function requestState() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_NETFLIX_STATE' });

    if (response?.ok) {
      pushStateToPage(response);
    }

    return response;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'OVERLAY_CONTROL') {
      window.postMessage(
        {
          source: EXT_SOURCE,
          type: 'OVERLAY_CONTROL',
          action: message.action,
          currentTime: message.currentTime,
        },
        '*',
      );
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  window.addEventListener('message', async (event) => {
    if (event.source !== window) {
      return;
    }

    if (!event.data || event.data.source !== APP_SOURCE) {
      return;
    }

    if (event.data.type === 'PING_EXTENSION') {
      window.postMessage({ source: EXT_SOURCE, type: 'EXTENSION_READY' }, '*');
      await requestState();
      return;
    }

    if (event.data.type === 'APP_CONTROL') {
      const { action, currentTime } = event.data.payload || {};

      const response = await chrome.runtime.sendMessage({
        type: 'CONTROL_NETFLIX',
        action,
        time: currentTime,
      });

      if (response?.ok) {
        await requestState();
      } else {
        window.postMessage(
          {
            source: EXT_SOURCE,
            type: 'EXTENSION_ERROR',
            message: response?.error ?? 'Unable to control Netflix',
          },
          '*',
        );
      }
    }

    if (event.data.type === 'OPEN_NETFLIX') {
      const response = await chrome.runtime.sendMessage({ type: 'OPEN_NETFLIX' });

      if (!response?.ok) {
        window.postMessage(
          {
            source: EXT_SOURCE,
            type: 'EXTENSION_ERROR',
            message: response?.error ?? 'Unable to open Netflix',
          },
          '*',
        );
      }
    }

    if (event.data.type === 'ROOM_CONTEXT_UPDATE') {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_ROOM_CONTEXT',
        payload: event.data.payload,
      });
    }
  });

  window.setInterval(() => {
    requestState();
  }, 5000);
}

if (isNetflixPage()) {
  installNetflixBridge();
}

if (isRoomPage()) {
  installRoomBridge();
}

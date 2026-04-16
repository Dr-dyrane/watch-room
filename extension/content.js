const APP_SOURCE = 'watch-room-app';
const EXT_SOURCE = 'watch-room-extension';

const ROOM_HOST_MATCHERS = ['localhost', '127.0.0.1', 'watch-room.vercel.app', 'watch-room-xi.vercel.app'];

let latestRoomContext = null;
let overlayController = null;
let netflixBridgeInstalled = false;
let netflixNavigationObserver = null;

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
    void video.play();
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
  const existingRoot = document.getElementById('watch-room-cinema-overlay');
  if (existingRoot) {
    existingRoot.remove();
  }

  const root = document.createElement('div');
  root.id = 'watch-room-cinema-overlay';
  document.documentElement.appendChild(root);

  const shadow = root.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .shell {
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 2147483647;
        width: min(392px, calc(100vw - 32px));
        max-height: calc(100vh - 48px);
        color: #f5f7fb;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
      }
      .panel {
        position: relative;
        display: grid;
        gap: 16px;
        padding: 18px;
        padding-right: 5.2rem;
        border-radius: 34px;
        background: linear-gradient(180deg, rgba(14, 17, 24, 0.92), rgba(8, 11, 16, 0.84));
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(24px);
        max-height: inherit;
        overflow: auto;
      }
      .mini {
        display: flex;
        align-items: flex-start;
      }
      .headline {
        display: grid;
        gap: 4px;
        min-width: 0;
      }
      .eyebrow {
        margin: 0;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(245, 247, 251, 0.6);
      }
      .title {
        margin: 0;
        font-size: 22px;
        line-height: 1.02;
        letter-spacing: -0.05em;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      .body {
        display: grid;
        gap: 16px;
      }
      .hero {
        display: grid;
        gap: 12px;
        padding: 12px 0 2px;
      }
      .hero::before {
        content: "";
        position: absolute;
        inset: 76px 24px auto 24px;
        height: 120px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(93, 135, 189, 0.28) 0, rgba(93, 135, 189, 0) 72%);
        filter: blur(10px);
        pointer-events: none;
      }
      .muted {
        margin: 0;
        color: rgba(245, 247, 251, 0.72);
        font-size: 13px;
        line-height: 1.35;
      }
      .time {
        position: relative;
        font-size: 50px;
        line-height: 0.92;
        letter-spacing: -0.07em;
        font-weight: 600;
      }
      .cluster {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .person,
      .button,
      .play,
      .action,
      .collapse {
        border: 0;
        border-radius: 999px;
        color: inherit;
      }
      .person {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: rgba(255, 255, 255, 0.08);
        font-size: 12px;
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
        gap: 12px;
        align-items: center;
        justify-content: center;
        padding: 2px 0;
      }
      .button,
      .play {
        cursor: pointer;
        background: rgba(255, 255, 255, 0.09);
        min-width: 56px;
        min-height: 56px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        transition: transform 160ms ease, background 160ms ease, opacity 160ms ease, filter 160ms ease;
      }
      .button:hover,
      .play:hover {
        transform: translateY(-1px);
        filter: brightness(1.04);
      }
      .button[disabled],
      .play[disabled],
      .action[disabled] {
        cursor: default;
        opacity: 0.46;
        filter: none;
      }
      .button[disabled]:hover,
      .play[disabled]:hover,
      .action[disabled]:hover {
        transform: none;
      }
      .button:focus-visible,
      .play:focus-visible,
      .action:focus-visible,
      .collapse:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.55);
        outline-offset: 2px;
      }
      .play {
        min-width: 82px;
        min-height: 82px;
        background: #f5f7fb;
        color: #090c11;
        font-size: 17px;
      }
      .footer {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .action {
        flex: 1;
        min-width: 0;
        cursor: pointer;
        border-radius: 18px;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.08);
        font-size: 13px;
      }
      .collapse {
        position: absolute;
        top: 18px;
        right: 18px;
        width: 38px;
        height: 38px;
        background: rgba(255,255,255,0.08);
        cursor: pointer;
      }
      .hidden .body {
        display: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .button,
        .play,
        .action,
        .collapse {
          transition: none;
        }
      }
      @media (max-width: 720px) {
        .shell {
          top: auto;
          right: 12px;
          left: 12px;
          bottom: 12px;
          width: auto;
          max-height: min(76vh, 720px);
        }
        .panel {
          padding: 16px;
          padding-right: 4.8rem;
          border-radius: 30px;
        }
        .time {
          font-size: 46px;
        }
        .controls {
          gap: 10px;
        }
        .button {
          min-width: 52px;
          min-height: 52px;
        }
        .play {
          min-width: 74px;
          min-height: 74px;
        }
        .collapse {
          top: 16px;
          right: 16px;
        }
      }
    </style>
    <div class="shell">
      <div class="panel">
        <div class="mini">
          <div class="headline">
            <p class="eyebrow">Watch Room Cinema</p>
            <h2 class="title" data-title>Netflix</h2>
          </div>
          <button class="collapse" data-collapse aria-label="Collapse overlay">-</button>
        </div>
        <div class="body">
          <div class="hero">
            <p class="muted" data-subtitle>Waiting for room context</p>
            <div class="time" data-time>0:00</div>
            <div class="controls">
              <button class="button" data-action="SEEK_BACKWARD" aria-label="Seek backward 10 seconds">-10</button>
              <button class="play" data-action="PLAY_PAUSE" aria-label="Play or pause">Play</button>
              <button class="button" data-action="SEEK_FORWARD" aria-label="Seek forward 10 seconds">+10</button>
              <button class="button" data-action="SYNC_NOW" aria-label="Sync now">Sync</button>
            </div>
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
  const sync = shadow.querySelector('[data-action="SYNC_NOW"]');
  const people = shadow.querySelector('[data-people]');
  const collapse = shadow.querySelector('[data-collapse]');
  const openRoom = shadow.querySelector('[data-open-room]');
  const openNetflix = shadow.querySelector('[data-open-netflix]');

  sync.disabled = true;

  const updatePlayerState = (state) => {
    title.textContent = state.title || latestRoomContext?.title || 'Netflix';
    time.textContent = formatTime(state.currentTime ?? 0);
    play.textContent = state.paused ? 'Play' : 'Pause';
    play.disabled = !state.ok;
  };

  const updateRoomState = (context) => {
    latestRoomContext = context;
    subtitle.textContent = context?.subtitle || 'Room connected';
    people.innerHTML = '';

    (context?.members ?? []).forEach((member) => {
      const chip = document.createElement('div');
      chip.className = 'person';

      const dot = document.createElement('span');
      dot.className = member.online ? 'dot on' : 'dot';

      const label = document.createElement('span');
      label.textContent = member.name;

      chip.append(dot, label);
      people.appendChild(chip);
    });

    title.textContent = getNetflixState().title || context?.title || 'Netflix';
    sync.disabled = (context?.members ?? []).filter((member) => member.online).length < 2;
  };

  collapse.addEventListener('click', () => {
    shell.classList.toggle('hidden');
    collapse.textContent = shell.classList.contains('hidden') ? '+' : '-';
  });

  shadow.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.getAttribute('data-action');
      const state = getNetflixState();
      const action = type === 'PLAY_PAUSE' ? (state.paused ? 'PLAY' : 'PAUSE') : type;
      const onlineMembers = (latestRoomContext?.members ?? []).filter((member) => member.online).length;

      if (!state.ok && action !== 'OPEN_NETFLIX') {
        overlayController?.updatePlayerState(getNetflixState());
        return;
      }

      if (action === 'SYNC_NOW' && onlineMembers < 2) {
        overlayController?.updatePlayerState(getNetflixState());
        pushStateToPage(getNetflixState());
        return;
      }

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
  if (netflixBridgeInstalled) {
    overlayController?.updateRoomState(latestRoomContext);
    overlayController?.updatePlayerState(getNetflixState());
    return;
  }

  netflixBridgeInstalled = true;
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
    void requestState();
  }, 5000);
}

function ensureNetflixOverlay() {
  const existingRoot = document.getElementById('watch-room-cinema-overlay');

  if (!existingRoot) {
    overlayController = createCinemaOverlay();

    if (latestRoomContext) {
      overlayController.updateRoomState(latestRoomContext);
    }

    overlayController.updatePlayerState(getNetflixState());
    return;
  }

  overlayController?.updatePlayerState(getNetflixState());
}

function installNetflixNavigationWatcher() {
  if (netflixNavigationObserver) {
    return;
  }

  let lastHref = window.location.href;

  netflixNavigationObserver = new MutationObserver(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      window.setTimeout(() => {
        ensureNetflixOverlay();
      }, 300);
    } else if (!document.getElementById('watch-room-cinema-overlay')) {
      ensureNetflixOverlay();
    }
  });

  netflixNavigationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('popstate', () => {
    window.setTimeout(() => {
      ensureNetflixOverlay();
    }, 300);
  });
}

if (isNetflixPage()) {
  installNetflixBridge();
  installNetflixNavigationWatcher();
}

if (isRoomPage()) {
  installRoomBridge();
}

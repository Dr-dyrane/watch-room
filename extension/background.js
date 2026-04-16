const ROOM_URL_PATTERNS = [
  'http://localhost:3000/*',
  'http://127.0.0.1:3000/*',
  'https://*.vercel.app/*',
];
const DEFAULT_ROOM_URL = 'https://watch-room-xi.vercel.app/';

function getNetflixTabs(callback) {
  chrome.tabs.query({ url: ['https://www.netflix.com/*'] }, (tabs) => {
    callback(tabs.filter((tab) => typeof tab.id === 'number'));
  });
}

function getNetflixTab(callback) {
  getNetflixTabs((tabs) => {
    callback(tabs[0]);
  });
}

function getRoomTabs(callback) {
  chrome.tabs.query({ url: ROOM_URL_PATTERNS }, (tabs) => {
    callback(tabs.filter((tab) => typeof tab.id === 'number'));
  });
}

function getOrCreateNetflixTab(callback) {
  getNetflixTab((netflixTab) => {
    if (netflixTab?.id) {
      callback(netflixTab);
      return;
    }

    chrome.tabs.create({ url: 'https://www.netflix.com/browse', active: true }, (createdTab) => {
      callback(createdTab);
    });
  });
}

function getOrCreateRoomTab(callback) {
  getRoomTabs((tabs) => {
    const roomTab = tabs.find((tab) => typeof tab.url === 'string' && tab.url.startsWith(DEFAULT_ROOM_URL)) ?? tabs[0];

    if (roomTab?.id) {
      callback(roomTab);
      return;
    }

    chrome.tabs.create({ url: DEFAULT_ROOM_URL, active: true }, (createdTab) => {
      callback(createdTab);
    });
  });
}

function withNetflixBridge(tabId, message, sendResponse) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError || !response) {
      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: ['content.js'],
        },
        () => {
          chrome.tabs.sendMessage(tabId, message, (retriedResponse) => {
            if (chrome.runtime.lastError || !retriedResponse) {
              sendResponse({ ok: false, error: 'Netflix bridge unavailable on tab' });
              return;
            }

            sendResponse(retriedResponse);
          });
        },
      );
      return;
    }

    sendResponse(response);
  });
}

function broadcastRoomContext(payload) {
  getNetflixTabs((tabs) => {
    tabs.forEach((netflixTab) => {
      if (!netflixTab?.id) {
        return;
      }

      withNetflixBridge(
        netflixTab.id,
        {
          type: 'ROOM_CONTEXT',
          payload,
        },
        () => {},
      );
    });
  });
}

function getStoredRoomContext() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['watchRoomContext'], (result) => {
      resolve(result.watchRoomContext ?? null);
    });
  });
}

function getNetflixStateSafe(tabId) {
  return new Promise((resolve) => {
    withNetflixBridge(tabId, { type: 'GET_STATE' }, (response) => {
      resolve(response ?? { ok: false, error: 'Netflix bridge unavailable' });
    });
  });
}

async function getExtensionStatus() {
  const [roomContext, roomTabs, netflixTabs] = await Promise.all([
    getStoredRoomContext(),
    new Promise((resolve) => getRoomTabs(resolve)),
    new Promise((resolve) => getNetflixTabs(resolve)),
  ]);

  const netflixTab = netflixTabs[0] ?? null;
  const roomTab = roomTabs.find((tab) => typeof tab.url === 'string' && tab.url.startsWith(DEFAULT_ROOM_URL)) ?? roomTabs[0] ?? null;
  const netflixState = netflixTab?.id ? await getNetflixStateSafe(netflixTab.id) : { ok: false, error: 'No Netflix tab found' };
  const onlineCount = Array.isArray(roomContext?.members)
    ? roomContext.members.filter((member) => member?.online).length
    : 0;

  return {
    ok: true,
    roomUrl: DEFAULT_ROOM_URL,
    room: {
      found: Boolean(roomTab?.id),
      tabId: roomTab?.id ?? null,
      title: roomContext?.title ?? 'Watch Room',
      subtitle: roomContext?.subtitle ?? 'Room not connected',
      onlineCount,
    },
    netflix: {
      found: Boolean(netflixTab?.id),
      tabId: netflixTab?.id ?? null,
      title: netflixState?.ok ? netflixState.title ?? 'Netflix ready' : 'Netflix not ready',
      paused: netflixState?.ok ? Boolean(netflixState.paused) : true,
      currentTime: netflixState?.ok ? Number(netflixState.currentTime ?? 0) : 0,
    },
  };
}

async function updateActionState() {
  const status = await getExtensionStatus();
  const badgeText = status.room.found && status.netflix.found ? 'ON' : status.room.found ? 'RM' : status.netflix.found ? 'NF' : '';
  const badgeColor =
    status.room.found && status.netflix.found
      ? '#9dc0eb'
      : status.room.found
        ? '#7fa5d6'
        : status.netflix.found
          ? '#6a7a95'
          : '#3b4451';

  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });
}

chrome.tabs.onUpdated.addListener(() => {
  void updateActionState();
});

chrome.tabs.onRemoved.addListener(() => {
  void updateActionState();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.watchRoomContext) {
    void updateActionState();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  void updateActionState();
});

chrome.runtime.onStartup.addListener(() => {
  void updateActionState();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GET_NETFLIX_STATE') {
    getNetflixTab((netflixTab) => {
      if (!netflixTab?.id) {
        sendResponse({ ok: false, error: 'No Netflix tab found' });
        return;
      }

      withNetflixBridge(netflixTab.id, { type: 'GET_STATE' }, sendResponse);
    });

    return true;
  }

  if (message?.type === 'GET_EXTENSION_STATUS') {
    void getExtensionStatus().then(sendResponse);
    return true;
  }

  if (message?.type === 'CONTROL_NETFLIX') {
    getNetflixTab((netflixTab) => {
      if (!netflixTab?.id) {
        sendResponse({ ok: false, error: 'No Netflix tab found' });
        return;
      }

      withNetflixBridge(
        netflixTab.id,
        {
          type: message.action,
          time: message.time,
        },
        sendResponse,
      );
    });

    return true;
  }

  if (message?.type === 'OPEN_NETFLIX') {
    getOrCreateNetflixTab((netflixTab) => {
      if (!netflixTab?.id) {
        sendResponse({ ok: false, error: 'Unable to open Netflix' });
        return;
      }

      chrome.tabs.update(netflixTab.id, { active: true }, () => {
        void updateActionState();
        sendResponse({ ok: true, tabId: netflixTab.id });
      });
    });

    return true;
  }

  if (message?.type === 'UPDATE_ROOM_CONTEXT') {
    chrome.storage.local.set({ watchRoomContext: message.payload }, () => {
      broadcastRoomContext(message.payload);
      void updateActionState();
      sendResponse({ ok: true });
    });

    return true;
  }

  if (message?.type === 'GET_ROOM_CONTEXT') {
    chrome.storage.local.get(['watchRoomContext'], (result) => {
      sendResponse({ ok: true, payload: result.watchRoomContext ?? null });
    });

    return true;
  }

  if (message?.type === 'OVERLAY_CONTROL') {
    getRoomTabs((tabs) => {
      const roomTab = tabs.find((tab) => typeof tab.url === 'string' && tab.url.startsWith(DEFAULT_ROOM_URL)) ?? tabs[0];

      if (!roomTab?.id) {
        sendResponse({ ok: false, error: 'No room tab found' });
        return;
      }

      chrome.tabs.sendMessage(
        roomTab.id,
        {
          type: 'OVERLAY_CONTROL',
          action: message.action,
          currentTime: message.currentTime,
        },
        (response) => {
          sendResponse(response ?? { ok: false, error: 'Room tab did not respond' });
        },
      );
    });

    return true;
  }

  if (message?.type === 'OPEN_ROOM') {
    getOrCreateRoomTab((roomTab) => {
      if (!roomTab?.id) {
        sendResponse({ ok: false, error: 'Unable to open room' });
        return;
      }

      chrome.tabs.update(roomTab.id, { active: true }, () => {
        void updateActionState();
        sendResponse({ ok: true, tabId: roomTab.id });
      });
    });

    return true;
  }
});

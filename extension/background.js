const ROOM_URL_PATTERNS = ['http://localhost:3000/*', 'http://127.0.0.1:3000/*', 'https://*.vercel.app/*'];
const DEFAULT_ROOM_URL = 'http://localhost:3000';

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
    const roomTab = tabs[0];

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
        sendResponse({ ok: true, tabId: netflixTab.id });
      });
    });

    return true;
  }

  if (message?.type === 'UPDATE_ROOM_CONTEXT') {
    chrome.storage.local.set({ watchRoomContext: message.payload }, () => {
      broadcastRoomContext(message.payload);
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
      const roomTab = tabs[0];

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
        sendResponse({ ok: true, tabId: roomTab.id });
      });
    });

    return true;
  }
});

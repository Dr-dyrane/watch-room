chrome.runtime.onInstalled.addListener(() => {
  console.log('[watch-room] extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GET_NETFLIX_STATE') {
    chrome.tabs.query({ url: 'https://www.netflix.com/*' }, (tabs) => {
      const netflixTab = tabs.find((tab) => typeof tab.id === 'number');

      if (!netflixTab?.id) {
        sendResponse({ ok: false, error: 'No Netflix tab found' });
        return;
      }

      chrome.tabs.sendMessage(netflixTab.id, { type: 'GET_STATE' }, (response) => {
        sendResponse(response ?? { ok: false, error: 'No response from content script' });
      });
    });

    return true;
  }

  if (message?.type === 'CONTROL_NETFLIX') {
    chrome.tabs.query({ url: 'https://www.netflix.com/*' }, (tabs) => {
      const netflixTab = tabs.find((tab) => typeof tab.id === 'number');

      if (!netflixTab?.id) {
        sendResponse({ ok: false, error: 'No Netflix tab found' });
        return;
      }

      chrome.tabs.sendMessage(
        netflixTab.id,
        {
          type: message.action,
          time: message.time,
        },
        (response) => {
          sendResponse(response ?? { ok: false, error: 'No response from Netflix tab' });
        },
      );
    });

    return true;
  }
});

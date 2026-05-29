import { browser } from 'wxt/browser';

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  const requestCounts = new Map<number, number>();

  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.type === 'main_frame') {
        requestCounts.set(details.tabId, 0);
      }
      
      if (details.tabId !== -1) {
        const count = requestCounts.get(details.tabId) || 0;
        requestCounts.set(details.tabId, count + 1);
      }
      
      return undefined;
    },
    { urls: ['<all_urls>'] }
  );

  browser.tabs.onRemoved.addListener((tabId) => {
    requestCounts.delete(tabId);
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_NETWORK_STATS' && message.tabId) {
      const count = requestCounts.get(message.tabId) || 0;
      sendResponse({ requestCount: count });
    }
  });
});

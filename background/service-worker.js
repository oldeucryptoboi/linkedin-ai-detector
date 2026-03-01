// Set defaults on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['enabled', 'sensitivity'], (data) => {
    const defaults = {};
    if (data.enabled === undefined) defaults.enabled = true;
    if (data.sensitivity === undefined) defaults.sensitivity = 50;
    if (Object.keys(defaults).length > 0) {
      chrome.storage.sync.set(defaults);
    }
  });
});

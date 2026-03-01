// Set defaults on install + migrate legacy keys
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['enabled', 'sensitivity', 'provider', 'claudeApiKey', 'apiKey'], (data) => {
    const updates = {};
    if (data.enabled === undefined) updates.enabled = true;
    if (data.sensitivity === undefined) updates.sensitivity = 50;
    if (data.provider === undefined) updates.provider = 'local';

    // Migrate legacy claudeApiKey → apiKey + provider
    if (data.claudeApiKey && !data.apiKey) {
      updates.apiKey = data.claudeApiKey;
      updates.provider = 'claude';
    }

    if (Object.keys(updates).length > 0) {
      chrome.storage.sync.set(updates);
    }

    // Clean up legacy key
    if (data.claudeApiKey) {
      chrome.storage.sync.remove('claudeApiKey');
    }
  });
});

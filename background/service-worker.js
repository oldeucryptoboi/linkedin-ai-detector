// Set defaults on install + migrate legacy keys
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(null, (data) => {
    const updates = {};
    if (data.enabled === undefined) updates.enabled = true;
    if (data.sensitivity === undefined) updates.sensitivity = 50;
    if (data.provider === undefined) updates.provider = 'local';

    // Migrate legacy claudeApiKey → apiKey_claude
    if (data.claudeApiKey && !data.apiKey_claude) {
      updates.apiKey_claude = data.claudeApiKey;
      updates.provider = 'claude';
    }

    // Migrate single apiKey → apiKey_claude (from previous refactor)
    if (data.apiKey && !data.apiKey_claude) {
      updates.apiKey_claude = data.apiKey;
      if (data.provider === 'claude' || !data.provider) {
        updates.provider = 'claude';
      }
    }

    if (Object.keys(updates).length > 0) {
      chrome.storage.sync.set(updates);
    }

    // Clean up legacy keys
    const toRemove = [];
    if (data.claudeApiKey) toRemove.push('claudeApiKey');
    if (data.apiKey) toRemove.push('apiKey');
    if (toRemove.length > 0) chrome.storage.sync.remove(toRemove);
  });
});

// Settings persistence via chrome.storage.sync
const enabledCheckbox = document.getElementById('enabled');
const sensitivitySlider = document.getElementById('sensitivity');
const sensitivityValue = document.getElementById('sensitivity-value');
const apiKeyInput = document.getElementById('api-key');
const apiKeyStatus = document.getElementById('api-key-status');

let saveTimeout;

// Load current settings
chrome.storage.sync.get(['enabled', 'sensitivity', 'claudeApiKey'], (data) => {
  enabledCheckbox.checked = data.enabled !== false; // default true
  sensitivitySlider.value = data.sensitivity ?? 50;
  sensitivityValue.textContent = sensitivitySlider.value;
  if (data.claudeApiKey) {
    apiKeyInput.value = data.claudeApiKey;
    apiKeyStatus.textContent = 'Key saved';
    apiKeyStatus.className = 'api-key-status api-key-status--saved';
  }
});

// Save on change
enabledCheckbox.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: enabledCheckbox.checked });
});

sensitivitySlider.addEventListener('input', () => {
  sensitivityValue.textContent = sensitivitySlider.value;
  chrome.storage.sync.set({ sensitivity: parseInt(sensitivitySlider.value) });
});

apiKeyInput.addEventListener('input', () => {
  clearTimeout(saveTimeout);
  apiKeyStatus.textContent = '';
  apiKeyStatus.className = 'api-key-status';

  saveTimeout = setTimeout(() => {
    const key = apiKeyInput.value.trim();
    chrome.storage.sync.set({ claudeApiKey: key }, () => {
      if (key) {
        apiKeyStatus.textContent = 'Key saved';
        apiKeyStatus.className = 'api-key-status api-key-status--saved';
      } else {
        apiKeyStatus.textContent = 'Key cleared';
        apiKeyStatus.className = 'api-key-status';
      }
    });
  }, 500);
});

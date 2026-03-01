// Settings persistence via chrome.storage.sync
const enabledCheckbox = document.getElementById('enabled');
const sensitivitySlider = document.getElementById('sensitivity');
const sensitivityValue = document.getElementById('sensitivity-value');
const apiKeyInput = document.getElementById('api-key');
const apiKeyMasked = document.getElementById('api-key-masked');
const apiKeyStatus = document.getElementById('api-key-status');

let saveTimeout;

function maskKey(key) {
  const visible = key.substring(0, 12);
  return visible + '\u2022'.repeat(Math.min(key.length - 12, 20));
}

function showMasked(key) {
  apiKeyMasked.textContent = maskKey(key);
  apiKeyMasked.style.display = '';
  apiKeyInput.style.display = 'none';
  apiKeyStatus.textContent = 'Key saved';
  apiKeyStatus.className = 'api-key-status api-key-status--saved';
}

function showInput() {
  apiKeyMasked.style.display = 'none';
  apiKeyInput.style.display = '';
  apiKeyInput.focus();
}

// Load current settings
chrome.storage.sync.get(['enabled', 'sensitivity', 'claudeApiKey'], (data) => {
  enabledCheckbox.checked = data.enabled !== false; // default true
  sensitivitySlider.value = data.sensitivity ?? 50;
  sensitivityValue.textContent = sensitivitySlider.value;
  if (data.claudeApiKey) {
    apiKeyInput.value = data.claudeApiKey;
    showMasked(data.claudeApiKey);
  } else {
    showInput();
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

// Click masked key to edit
apiKeyMasked.addEventListener('click', () => {
  showInput();
});

// Save key on blur or Enter
function saveKey() {
  clearTimeout(saveTimeout);
  const key = apiKeyInput.value.trim();
  chrome.storage.sync.set({ claudeApiKey: key }, () => {
    if (key) {
      showMasked(key);
    } else {
      apiKeyStatus.textContent = 'Key cleared';
      apiKeyStatus.className = 'api-key-status';
    }
  });
}

apiKeyInput.addEventListener('blur', saveKey);
apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveKey();
  }
});

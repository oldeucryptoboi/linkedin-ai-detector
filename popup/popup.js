// Settings persistence via chrome.storage.sync
const enabledCheckbox = document.getElementById('enabled');
const sensitivitySlider = document.getElementById('sensitivity');
const sensitivityValue = document.getElementById('sensitivity-value');
const sensitivityGroup = document.getElementById('sensitivity-group');
const apiKeyGroup = document.getElementById('api-key-group');
const apiKeyInput = document.getElementById('api-key');
const apiKeyMasked = document.getElementById('api-key-masked');
const apiKeyStatus = document.getElementById('api-key-status');
const apiKeyHint = document.getElementById('api-key-hint');
const providerRadios = document.querySelectorAll('input[name="provider"]');

const PROVIDER_CONFIG = {
  claude: {
    placeholder: 'sk-ant-...',
    hint: 'Get a key at <a href="https://console.anthropic.com/" target="_blank">console.anthropic.com</a>.',
  },
  openai: {
    placeholder: 'sk-...',
    hint: 'Get a key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>.',
  },
  gemini: {
    placeholder: 'AIza...',
    hint: 'Get a key at <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com</a>.',
  },
};

let currentProvider = 'local';

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

function updateProviderUI(prov) {
  currentProvider = prov;

  if (prov === 'local') {
    sensitivityGroup.classList.remove('hidden');
    apiKeyGroup.classList.add('hidden');
  } else {
    sensitivityGroup.classList.add('hidden');
    apiKeyGroup.classList.remove('hidden');

    const config = PROVIDER_CONFIG[prov];
    apiKeyInput.placeholder = config.placeholder;
    apiKeyHint.innerHTML = config.hint;
  }
}

// Load current settings
chrome.storage.sync.get(['enabled', 'sensitivity', 'provider', 'apiKey'], (data) => {
  enabledCheckbox.checked = data.enabled !== false; // default true
  sensitivitySlider.value = data.sensitivity ?? 50;
  sensitivityValue.textContent = sensitivitySlider.value;

  const prov = data.provider || 'local';
  // Check the correct radio
  for (const radio of providerRadios) {
    radio.checked = radio.value === prov;
  }
  updateProviderUI(prov);

  if (data.apiKey && prov !== 'local') {
    apiKeyInput.value = data.apiKey;
    showMasked(data.apiKey);
  } else {
    apiKeyMasked.style.display = 'none';
    apiKeyInput.style.display = '';
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

// Provider selection
for (const radio of providerRadios) {
  radio.addEventListener('change', () => {
    const prov = radio.value;
    updateProviderUI(prov);
    chrome.storage.sync.set({ provider: prov });

    // Reset key display when switching providers
    apiKeyInput.value = '';
    apiKeyMasked.style.display = 'none';
    apiKeyInput.style.display = '';
    apiKeyStatus.textContent = '';
    // Clear the stored key when switching
    chrome.storage.sync.set({ apiKey: '' });
  });
}

// Click masked key to edit
apiKeyMasked.addEventListener('click', () => {
  showInput();
});

// Save key on blur or Enter
function saveKey() {
  const key = apiKeyInput.value.trim();
  chrome.storage.sync.set({ apiKey: key }, () => {
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

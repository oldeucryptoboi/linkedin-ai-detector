window.AIDetector = window.AIDetector || {};

// Entry point: MutationObserver, post discovery, orchestration
(() => {
  const SELECTORS = {
    // LinkedIn feed post containers
    feedPost: '.feed-shared-update-v2',
    // Post text content
    postText: '.feed-shared-update-v2__description, .feed-shared-text, .break-words',
    // "See more" expanded text container
    seeMoreText: '.feed-shared-inline-show-more-text',
  };

  const MIN_TEXT_LENGTH = 100;
  const processedPosts = new WeakSet();
  let enabled = true;
  let sensitivity = 50;
  let provider = 'local';
  let apiKey = '';

  const PROVIDER_NAMES = {
    local: 'Local',
    claude: 'Claude',
    openai: 'OpenAI',
    gemini: 'Gemini',
  };

  const AI_PROMPT = `Analyze this LinkedIn post and determine if it was written by AI or a human. Return ONLY valid JSON with no other text: {"score": <0.0-1.0 where 1.0 = certainly AI>, "reasoning": "<1-2 sentence explanation>"}

Post text:
`;

  let settingsLoaded = false;

  function apiKeyStorageKey(prov) {
    return `apiKey_${prov}`;
  }

  // Load settings from chrome.storage, then run initial scan
  function loadSettings(onReady) {
    chrome.storage.sync.get(null, (data) => {
      if (data.enabled !== undefined) enabled = data.enabled;
      if (data.sensitivity !== undefined) sensitivity = data.sensitivity;
      if (data.provider !== undefined) provider = data.provider;
      apiKey = data[apiKeyStorageKey(provider)] || '';
      settingsLoaded = true;
      onReady();
    });

    // Listen for setting changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enabled) {
        enabled = changes.enabled.newValue;
        if (!enabled) removeAllBadges();
        else scanAllPosts();
      }
      if (changes.sensitivity) {
        sensitivity = changes.sensitivity.newValue;
        if (provider === 'local') reanalyzeAll();
      }

      const providerChanged = changes.provider;
      const keyChanged = changes[apiKeyStorageKey(providerChanged ? providerChanged.newValue : provider)];

      if (providerChanged) {
        provider = providerChanged.newValue;
        // Read the key for the new provider
        chrome.storage.sync.get([apiKeyStorageKey(provider)], (data) => {
          apiKey = data[apiKeyStorageKey(provider)] || '';
          clearAndRescan();
        });
      } else if (keyChanged) {
        apiKey = keyChanged.newValue || '';
        clearAndRescan();
      }
    });
  }

  // Extract text content from a post element
  function extractPostText(postEl) {
    const textEl = postEl.querySelector(SELECTORS.seeMoreText) ||
                   postEl.querySelector(SELECTORS.postText);
    if (!textEl) return '';
    return textEl.innerText || textEl.textContent || '';
  }

  // Bind badge click to toggle its panel, closing others
  function bindBadgeClick(badge, panel) {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      document.querySelectorAll('.laid-panel--open').forEach(p => {
        if (p !== panel) p.classList.remove('laid-panel--open');
      });
      window.AIDetector.detailPanel.toggle(panel);
    });
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && e.target !== badge) {
        panel.classList.remove('laid-panel--open');
      }
    });
  }

  // Fetch AI analysis directly from content script
  // (MV3 content scripts can fetch cross-origin URLs in host_permissions)
  async function requestAIAnalysis(prov, key, text) {
    if (!key) return null;

    const prompt = AI_PROMPT + text;

    try {
      let rawText;

      if (prov === 'claude') {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 256,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!resp.ok) {
          console.warn('[LAID] Claude API error:', resp.status, await resp.text());
          return null;
        }
        const result = await resp.json();
        rawText = result.content?.[0]?.text || '';

      } else if (prov === 'openai') {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 256,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!resp.ok) {
          console.warn('[LAID] OpenAI API error:', resp.status);
          return null;
        }
        const result = await resp.json();
        rawText = result.choices?.[0]?.message?.content || '';

      } else if (prov === 'gemini') {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );
        if (!resp.ok) {
          console.warn('[LAID] Gemini API error:', resp.status);
          return null;
        }
        const result = await resp.json();
        rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      // Strip markdown code fences if present
      rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(rawText);
      return {
        score: Math.max(0, Math.min(1, parsed.score)),
        reasoning: parsed.reasoning || '',
      };
    } catch (err) {
      console.warn(`[LAID] ${prov} API error:`, err.message);
      return null;
    }
  }

  // Process a single post element
  function processPost(postEl) {
    if (processedPosts.has(postEl)) return;
    if (!enabled) return;

    const text = extractPostText(postEl);
    if (text.length < MIN_TEXT_LENGTH) return;

    processedPosts.add(postEl);

    // Ensure the post container has relative positioning for badge placement
    const computedStyle = window.getComputedStyle(postEl);
    if (computedStyle.position === 'static') {
      postEl.style.position = 'relative';
    }

    // Store text for reanalysis
    postEl._laidText = text;

    if (provider === 'local') {
      // Run heuristic analysis
      const result = window.AIDetector.detector.analyze(text, sensitivity);
      const badge = window.AIDetector.badge.create(result);
      const panel = window.AIDetector.detailPanel.create(result);
      bindBadgeClick(badge, panel);

      postEl.appendChild(badge);
      postEl.appendChild(panel);

      postEl._laidBadge = badge;
      postEl._laidPanel = panel;
    } else {
      // API provider — show loading, then call API
      const loadingBadge = window.AIDetector.badge.createLoading();
      postEl.appendChild(loadingBadge);
      postEl._laidBadge = loadingBadge;

      requestAIAnalysis(provider, apiKey, text).then((aiResult) => {
        loadingBadge.remove();

        if (!aiResult) return;

        const badge = window.AIDetector.badge.createAI(aiResult);
        const panel = window.AIDetector.detailPanel.createAI(aiResult, PROVIDER_NAMES[provider]);
        bindBadgeClick(badge, panel);

        postEl.appendChild(badge);
        postEl.appendChild(panel);

        postEl._laidBadge = badge;
        postEl._laidPanel = panel;
      });
    }
  }

  // Scan all visible posts
  function scanAllPosts() {
    const posts = document.querySelectorAll(SELECTORS.feedPost);
    for (const post of posts) {
      processPost(post);
    }
  }

  // Remove all badges and panels
  function removeAllBadges() {
    document.querySelectorAll('.laid-badge').forEach(b => b.remove());
    document.querySelectorAll('.laid-panel').forEach(p => p.remove());
    // Allow reprocessing
    const posts = document.querySelectorAll(SELECTORS.feedPost);
    for (const post of posts) {
      processedPosts.delete(post);
      post._laidBadge = null;
      post._laidPanel = null;
    }
  }

  // Clear all badges and rescan (when provider or key changes)
  function clearAndRescan() {
    removeAllBadges();
    if (enabled) scanAllPosts();
  }

  // Reanalyze all processed posts (when sensitivity changes, local only)
  function reanalyzeAll() {
    const posts = document.querySelectorAll(SELECTORS.feedPost);
    for (const post of posts) {
      if (post._laidText && post._laidBadge && post._laidPanel) {
        const result = window.AIDetector.detector.analyze(post._laidText, sensitivity);

        // Update badge
        post._laidBadge.style.backgroundColor = result.color;
        post._laidBadge.textContent = Math.round(result.score * 100);
        post._laidBadge.title = `Heuristic: ${result.label}`;

        // Replace panel
        const newPanel = window.AIDetector.detailPanel.create(result);
        const wasOpen = post._laidPanel.classList.contains('laid-panel--open');
        post._laidPanel.remove();
        post.appendChild(newPanel);
        post._laidPanel = newPanel;
        if (wasOpen) newPanel.classList.add('laid-panel--open');

        // Re-bind badge click
        post._laidBadge.onclick = null;
        bindBadgeClick(post._laidBadge, newPanel);
      }
    }
  }

  // MutationObserver with requestAnimationFrame debounce
  let rafPending = false;
  function onMutation() {
    if (!settingsLoaded || rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (enabled) scanAllPosts();
    });
  }

  // Initialize
  function init() {
    window.AIDetector.styles.inject();

    // Observe for new posts (LinkedIn SPA / infinite scroll)
    const observer = new MutationObserver(onMutation);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Load settings, then run first scan
    loadSettings(() => {
      if (enabled) scanAllPosts();
    });
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

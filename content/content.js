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

  // Load settings from chrome.storage
  function loadSettings() {
    if (chrome?.storage?.sync) {
      chrome.storage.sync.get(['enabled', 'sensitivity'], (data) => {
        if (data.enabled !== undefined) enabled = data.enabled;
        if (data.sensitivity !== undefined) sensitivity = data.sensitivity;
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
          reanalyzeAll();
        }
      });
    }
  }

  // Extract text content from a post element
  function extractPostText(postEl) {
    // Try multiple selectors to find the text
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

  // Call Claude API directly from content script (MV3 allows cross-origin
  // fetch to URLs declared in host_permissions)
  async function requestClaudeAnalysis(text) {
    try {
      const data = await chrome.storage.sync.get(['claudeApiKey']);
      const apiKey = data.claudeApiKey;
      if (!apiKey) return null;

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: `Analyze this LinkedIn post and determine if it was written by AI or a human. Return ONLY valid JSON with no other text: {"score": <0.0-1.0 where 1.0 = certainly AI>, "reasoning": "<1-2 sentence explanation>"}

Post text:
${text}`,
          }],
        }),
      });

      if (!resp.ok) {
        console.warn('[LAID] Claude API error:', resp.status);
        return null;
      }

      const result = await resp.json();
      let content = result.content?.[0]?.text || '';
      // Strip markdown code fences if present
      content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(content);
      return {
        score: Math.max(0, Math.min(1, parsed.score)),
        reasoning: parsed.reasoning || '',
      };
    } catch (err) {
      console.warn('[LAID] Claude API error:', err.message);
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

    // Run heuristic analysis
    const result = window.AIDetector.detector.analyze(text, sensitivity);

    // Create badge group container
    const group = document.createElement('div');
    group.className = 'laid-badge-group';

    // Heuristic badge + panel
    const badge = window.AIDetector.badge.create(result);
    const panel = window.AIDetector.detailPanel.create(result);
    bindBadgeClick(badge, panel);
    group.appendChild(badge);

    postEl.appendChild(group);
    postEl.appendChild(panel);

    // Store references for reanalysis
    postEl._laidText = text;
    postEl._laidBadge = badge;
    postEl._laidPanel = panel;
    postEl._laidGroup = group;

    // Claude badge — show loading, then call API
    const loadingBadge = window.AIDetector.badge.createLoading();
    group.appendChild(loadingBadge);

    requestClaudeAnalysis(text).then((claudeResult) => {
      loadingBadge.remove();

      if (!claudeResult) return;

      const claudeBadge = window.AIDetector.badge.createClaude(claudeResult);
      const claudePanel = window.AIDetector.detailPanel.createClaude(claudeResult);
      bindBadgeClick(claudeBadge, claudePanel);
      group.appendChild(claudeBadge);
      postEl.appendChild(claudePanel);

      postEl._laidClaudeBadge = claudeBadge;
      postEl._laidClaudePanel = claudePanel;
    });
  }

  // Scan all visible posts
  function scanAllPosts() {
    const posts = document.querySelectorAll(SELECTORS.feedPost);
    for (const post of posts) {
      processPost(post);
    }
  }

  // Remove all badges (when disabled)
  function removeAllBadges() {
    document.querySelectorAll('.laid-badge-group').forEach(g => g.remove());
    document.querySelectorAll('.laid-badge').forEach(b => b.remove());
    document.querySelectorAll('.laid-panel').forEach(p => p.remove());
  }

  // Reanalyze all processed posts (when sensitivity changes)
  function reanalyzeAll() {
    const posts = document.querySelectorAll(SELECTORS.feedPost);
    for (const post of posts) {
      if (post._laidText && post._laidBadge && post._laidPanel) {
        const result = window.AIDetector.detector.analyze(post._laidText, sensitivity);

        // Update heuristic badge
        post._laidBadge.style.backgroundColor = result.color;
        post._laidBadge.textContent = Math.round(result.score * 100);
        post._laidBadge.title = `Heuristic: ${result.label}`;

        // Replace heuristic panel
        const newPanel = window.AIDetector.detailPanel.create(result);
        const wasOpen = post._laidPanel.classList.contains('laid-panel--open');
        post._laidPanel.remove();
        post.appendChild(newPanel);
        post._laidPanel = newPanel;
        if (wasOpen) newPanel.classList.add('laid-panel--open');

        // Re-bind heuristic badge click
        post._laidBadge.onclick = null;
        bindBadgeClick(post._laidBadge, newPanel);
      }
    }
  }

  // MutationObserver with requestAnimationFrame debounce
  let rafPending = false;
  function onMutation() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (enabled) scanAllPosts();
    });
  }

  // Initialize
  function init() {
    window.AIDetector.styles.inject();
    loadSettings();

    // Initial scan
    scanAllPosts();

    // Observe for new posts (LinkedIn SPA / infinite scroll)
    const observer = new MutationObserver(onMutation);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

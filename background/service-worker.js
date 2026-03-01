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

// Handle API calls from content scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'aiAnalysis') return false;

  analyzeWithAI(msg.provider, msg.apiKey, msg.text)
    .then(sendResponse)
    .catch(() => sendResponse(null));

  return true; // keep message channel open for async response
});

const AI_PROMPT = `Analyze this LinkedIn post and determine if it was written by AI or a human. Return ONLY valid JSON with no other text: {"score": <0.0-1.0 where 1.0 = certainly AI>, "reasoning": "<1-2 sentence explanation>"}

Post text:
`;

async function analyzeWithAI(provider, apiKey, text) {
  if (!apiKey) return null;

  const prompt = AI_PROMPT + text;

  try {
    let rawText;

    if (provider === 'claude') {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!resp.ok) {
        console.warn('[LAID] Claude API error:', resp.status);
        return null;
      }
      const result = await resp.json();
      rawText = result.content?.[0]?.text || '';

    } else if (provider === 'openai') {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
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

    } else if (provider === 'gemini') {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
    console.warn(`[LAID] ${provider} API error:`, err.message);
    return null;
  }
}

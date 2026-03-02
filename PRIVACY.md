# Privacy Policy — LAID (LinkedIn AI Detector)

**Last updated:** March 1, 2026

## What LAID Does

LAID is a Chrome extension that analyzes LinkedIn posts to estimate whether they were written by AI or a human.

## Data Collection

LAID does **not** collect, store, or transmit any personal data to us. We have no servers, no analytics, and no tracking.

## Local Mode (Default)

When using the Local detection engine, all analysis runs entirely in your browser. No post content or user data leaves your machine.

## API Mode (Optional)

When you choose to use an API provider (Claude, OpenAI, or Gemini), the text content of LinkedIn posts visible in your feed is sent to the selected provider's API for analysis. This happens only when:

- You explicitly select an API provider in the extension settings
- You enter your own API key

The API calls go directly from your browser to the provider. LAID does not proxy, log, or store any of this data. Your API key is stored locally in Chrome's `chrome.storage.sync` and is never sent anywhere other than the provider you selected.

Refer to each provider's privacy policy for how they handle data:

- [Anthropic (Claude)](https://www.anthropic.com/privacy)
- [OpenAI](https://openai.com/privacy)
- [Google (Gemini)](https://policies.google.com/privacy)

## Permissions

- **storage**: Saves your preferences (enabled state, sensitivity, provider, API keys) in Chrome's synced storage.
- **host_permissions** for `linkedin.com`: Required to inject the content script that reads post text for analysis.
- **host_permissions** for API domains: Required to make API calls when you opt into an API provider.

## Contact

If you have questions, open an issue at [github.com/oldeucryptoboi/linkedin-ai-detector](https://github.com/oldeucryptoboi/linkedin-ai-detector/issues).

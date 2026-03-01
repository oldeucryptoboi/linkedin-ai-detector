# LAID — LinkedIn AI Detector

A Chrome extension that detects AI-generated content on LinkedIn. Each post gets a score badge showing how likely it was written by AI.

Works out of the box with a **local heuristic engine** (no API key needed), or switch to **Claude**, **OpenAI**, or **Gemini** for LLM-powered analysis.

## How It Works

LAID injects into the LinkedIn feed and analyzes every post as you scroll. A colored badge appears on each post:

- **Green** (0-40%) — Unlikely AI
- **Amber** (40-70%) — Possibly AI
- **Red** (70-100%) — Likely AI

Click any badge to see the full breakdown.

## Detection Engines

### Local (default)

The local engine runs 10 weighted heuristic signals entirely in your browser — no data leaves your machine:

| Signal | Weight | What It Catches |
|--------|--------|-----------------|
| Burstiness | 15% | AI writes uniform sentence lengths; humans vary wildly |
| Abstraction | 12% | Buzzword density: "leverage", "synergy", "ecosystem" |
| Generic Phrases | 12% | "Let's dive in", "game-changer", "in today's rapidly..." |
| Transitions | 10% | Overuse of "Moreover", "Furthermore", "Additionally" |
| Paragraph Uniformity | 10% | AI paragraphs are suspiciously similar in length |
| Structure | 10% | Hook → framework → CTA arc that AI loves |
| Cadence | 8% | Punctuation variety, vocabulary diversity, emotional markers |
| Contrast Hooks | 8% | "The question isn't X, it's Y" rhetorical patterns |
| List Density | 8% | AI overuses bullet points and numbered lists |
| Three-Point Patterns | 7% | "First... Second... Third..." and rule-of-three constructions |

Adjust the **sensitivity slider** (0-100) to tune for fewer false positives or more aggressive detection.

### API Providers

For LLM-powered detection, configure an API key in the popup:

| Provider | Model | Key Format |
|----------|-------|------------|
| Claude (Anthropic) | claude-haiku-4-5 | `sk-ant-...` |
| OpenAI | gpt-4o-mini | `sk-...` |
| Gemini (Google) | gemini-2.0-flash | `AIza...` |

API keys are stored per-provider in `chrome.storage.sync` — switching providers won't lose your keys.

## Install

1. Clone the repo:
   ```bash
   git clone https://github.com/oldeucryptoboi/linkedin-ai-detector.git
   ```
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the cloned directory
5. Navigate to LinkedIn — badges appear automatically

## Usage

- Click the LAID icon in the toolbar to open settings
- Toggle the extension on/off
- Select a detection engine (Local, Claude, OpenAI, Gemini)
- For API providers, enter your API key — it saves automatically
- For Local mode, adjust the sensitivity slider

## Project Structure

```
├── manifest.json              # MV3 extension config
├── background/
│   └── service-worker.js      # Settings defaults + migration
├── content/
│   ├── content.js             # Main entry: MutationObserver, post scanning
│   ├── detector.js            # Signal orchestrator (weighted scoring)
│   ├── signals/               # 10 independent signal analyzers
│   └── ui/                    # Badge, detail panel, injected styles
├── lib/
│   ├── text-utils.js          # Sentence splitting, CV, TTR
│   ├── word-lists.js          # Curated word/phrase lists
│   └── scoring.js             # Score → label/color mapping
├── popup/
│   ├── popup.html             # Settings UI
│   └── popup.js               # Storage sync, provider management
└── scripts/
    ├── test-live.mjs          # Automated Playwright test
    └── diagnose.mjs           # Diagnostic script
```

## Privacy

- **Local mode**: All analysis runs in your browser. No data is sent anywhere.
- **API mode**: Post text is sent to the selected provider's API (Anthropic, OpenAI, or Google) for analysis. No data is stored on any intermediary server.

## License

MIT

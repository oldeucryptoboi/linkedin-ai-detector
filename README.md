# LAID — LinkedIn AI Detector

A Chrome extension that detects AI-generated content on LinkedIn. Each post gets a score badge showing how likely it was written by AI.

Works out of the box with a **local heuristic engine** (no API key needed), or switch to **Claude**, **OpenAI**, or **Gemini** for LLM-powered analysis. When using an LLM provider, local heuristic results are sent alongside the post text, giving the model quantitative signals to cross-reference against its own qualitative reading.

## How It Works

LAID injects into the LinkedIn feed and analyzes every post as you scroll. A colored badge appears on each post:

- **Green** (0-40%) — Unlikely AI
- **Amber** (40-70%) — Possibly AI
- **Red** (70-100%) — Likely AI

Click any badge to see the full breakdown of all 14 signals.

## Detection Approach

### Research Background

LAID's signal design draws on peer-reviewed research documenting statistical tells in AI-generated text:

- **Excess vocabulary** — Kobak et al. (2024) analyzed 14 million PubMed abstracts and found abrupt post-ChatGPT spikes in words like "delve," "intricate," "commendable," "meticulous," and "tapestry." Published in [*Science Advances*](https://www.science.org/doi/10.1126/sciadv.adt3813). Liang et al. (2024) found similar patterns in ICLR peer reviews, with "commendable" appearing 9.8x more and "meticulous" 34.7x more than pre-ChatGPT baselines ([ICML 2024](https://arxiv.org/abs/2403.07183), [*Nature Human Behaviour*](https://www.nature.com/articles/s41562-025-02273-8)).

- **Em dash overuse** — AI models use em dashes at roughly 10x the rate of human writers. Goedecke (2025) traces this to late-1800s print books in training data that use em dashes at ~30% rates ([analysis](https://www.seangoedecke.com/em-dashes/)).

- **Contraction avoidance** — Jakesch et al. (2023) showed in 6 experiments with 4,600 participants that AI text uses contractions less frequently as part of a broader formality bias ([*PNAS*](https://doi.org/10.1073/pnas.2208839120)).

- **Epistemic flatness** — AI uses formulaic hedges ("it is important to note," "essentially") rather than genuine uncertainty markers ("idk," "i could be wrong"). The VERMILLION framework (2025) documents this pattern of reliance on generic cohesion strategies ([*Research Leap*](https://researchleap.com/the-disappearing-author-linguistic-and-cognitive-markers-of-ai-generated-communication/)).

- **Burstiness and uniformity** — GPTZero pioneered the use of [perplexity and burstiness](https://gptzero.me/news/perplexity-and-burstiness-what-is-it/) as detection signals, based on the observation that human writing naturally alternates between short and long sentences while AI tends toward uniform structure.

- **Stylometric detection** — DetectGPT ([ICML 2023](https://arxiv.org/abs/2301.11305)) introduced zero-shot detection via probability curvature. StyloAI ([Springer 2024](https://arxiv.org/abs/2405.10129)) achieved 81-98% accuracy using 31 stylometric features.

### Local Engine (default)

The local engine runs 14 weighted heuristic signals entirely in your browser — no data leaves your machine:

| Signal | Weight | What It Catches |
|--------|--------|-----------------|
| Burstiness | 10% | AI writes uniform sentence lengths; humans vary wildly |
| Abstraction | 9% | Buzzword density: "leverage", "delve", "tapestry", "ecosystem" + multi-word phrases like "at its core", "a testament to" |
| Generic Phrases | 9% | "Let's dive in", "game-changer", "in today's rapidly..." |
| Em Dash | 8% | AI overuses em dashes (—) at ~10x the human rate |
| Epistemic | 8% | Fake hedges ("essentially", "it is important to note") vs genuine uncertainty ("idk", "i could be wrong") |
| Transitions | 7% | Overuse of "Moreover", "Furthermore", "Additionally" |
| Paragraph Uniformity | 7% | AI paragraphs are suspiciously similar in length |
| Structure | 7% | Hook → framework → CTA arc that AI loves |
| Contractions | 6% | AI avoids contractions ("does not" instead of "doesn't") |
| Specificity | 6% | Vague anecdotes ("a colleague once told me") vs specific human details (names, dates, non-round numbers) |
| Cadence | 6% | Punctuation variety, vocabulary diversity, emotional markers |
| Contrast Hooks | 6% | "The question isn't X, it's Y" rhetorical patterns |
| List Density | 6% | AI overuses bullet points and numbered lists |
| Three-Point Patterns | 5% | "First... Second... Third..." and rule-of-three constructions |

Adjust the **sensitivity slider** (0-100) to tune for fewer false positives or more aggressive detection.

### LLM Providers

For LLM-powered detection, configure an API key in the popup:

| Provider | Model | Key Format |
|----------|-------|------------|
| Claude (Anthropic) | claude-haiku-4-5 | `sk-ant-...` |
| OpenAI | gpt-4o-mini | `sk-...` |
| Gemini (Google) | gemini-2.0-flash | `AIza...` |

When using an LLM provider, LAID first runs all 14 local signals, then sends both the post text and the heuristic results to the LLM. The prompt uses a rubric-based chain-of-thought approach covering 8 categories (Voice, Epistemic Texture, Structure, Lexical, Sentences, Emotion, Social/Platform, Cognitive Process) with particular attention to "engagement-optimized executive voice" tells like pop culture hooks, named frameworks, clean problem-insight-moral structures, and unsourced statistics.

API keys are stored per-provider in `chrome.storage.sync` — switching providers won't lose your keys.

## Install

1. Download or clone the repo:
   - **Download**: Click the green **Code** button above, then **Download ZIP**. Extract the ZIP to a folder.
   - **Or clone**:
     ```bash
     git clone https://github.com/oldeucryptoboi/linkedin-ai-detector.git
     ```
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `linkedin-ai-detector` folder (the one containing `manifest.json`)
6. The LAID icon appears in your toolbar — navigate to LinkedIn and badges show up automatically

To update later, `git pull` (or re-download the ZIP) and click the reload button on the extension card in `chrome://extensions/`.

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
│   ├── signals/               # 14 independent signal analyzers
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

## References

1. Kobak, D., et al. (2024). "Delving into LLM-assisted writing in biomedical publications through excess vocabulary." *Science Advances*. [doi:10.1126/sciadv.adt3813](https://www.science.org/doi/10.1126/sciadv.adt3813)
2. Liang, W., et al. (2024). "Monitoring AI-Modified Content at Scale." *ICML 2024*. [arXiv:2403.07183](https://arxiv.org/abs/2403.07183)
3. Liang, W., et al. (2025). "Mapping the Increasing Use of LLMs in Scientific Papers." *Nature Human Behaviour*. [doi:10.1038/s41562-025-02273-8](https://www.nature.com/articles/s41562-025-02273-8)
4. Jakesch, M., et al. (2023). "Human heuristics for AI-generated language are flawed." *PNAS*, 120(11). [doi:10.1073/pnas.2208839120](https://doi.org/10.1073/pnas.2208839120)
5. Mitchell, E., et al. (2023). "DetectGPT: Zero-Shot Machine-Generated Text Detection using Probability Curvature." *ICML 2023*. [arXiv:2301.11305](https://arxiv.org/abs/2301.11305)
6. Goedecke, S. (2025). "Why do AI models use so many em-dashes?" [seangoedecke.com](https://www.seangoedecke.com/em-dashes/)
7. Juzek, T. & Ward, J. (2024). "Why Does ChatGPT 'Delve' So Much?" *COLING 2025*. [arXiv:2412.11385](https://arxiv.org/abs/2412.11385)

## License

MIT

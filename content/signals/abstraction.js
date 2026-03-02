window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Abstraction: measures the ratio of abstract/vague buzzwords to total words.
// AI text tends to be heavy on abstract corporate/tech jargon.
window.AIDetector.signals.abstraction = (text) => {
  const { tokenize } = window.AIDetector.textUtils;
  const { linearScale } = window.AIDetector.scoring;
  const { abstractWords, abstractPhrases } = window.AIDetector.wordLists;

  const tokens = tokenize(text);
  if (tokens.length < 10) {
    return { score: 0, detail: 'Too few words to measure' };
  }

  // Pass 1: single-token abstract words
  let count = 0;
  const found = [];
  for (const token of tokens) {
    if (abstractWords.has(token)) {
      count++;
      if (found.length < 5 && !found.includes(token)) {
        found.push(token);
      }
    }
  }

  // Pass 2: multi-word abstract phrases
  const lower = text.toLowerCase();
  let phraseCount = 0;
  for (const phrase of abstractPhrases) {
    const matches = lower.split(phrase).length - 1;
    if (matches > 0) {
      phraseCount += matches;
      if (found.length < 5 && !found.includes(phrase)) {
        found.push(phrase);
      }
    }
  }

  // Each phrase match counts as 2 tokens worth (multi-word = stronger signal)
  const effectiveCount = count + phraseCount * 2;
  const ratio = effectiveCount / tokens.length;

  // Normal human writing: 0-2% abstract words
  // AI-heavy text: 4-8%+
  const score = linearScale(ratio, 0.01, 0.06);

  const pct = (ratio * 100).toFixed(1);
  const examples = found.length > 0 ? ` (${found.join(', ')})` : '';

  return {
    score,
    detail: `${pct}% abstract words${examples}`
  };
};

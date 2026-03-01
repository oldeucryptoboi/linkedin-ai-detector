window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Transitions: measures the percentage of sentences starting with transitional phrases.
// AI loves to start sentences with "Moreover,", "Furthermore,", "Additionally," etc.
window.AIDetector.signals.transitions = (text) => {
  const { splitSentences } = window.AIDetector.textUtils;
  const { linearScale } = window.AIDetector.scoring;
  const { transitionPhrases } = window.AIDetector.wordLists;

  const sentences = splitSentences(text);
  if (sentences.length < 3) {
    return { score: 0, detail: 'Too few sentences to measure' };
  }

  let count = 0;
  const found = [];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const phrase of transitionPhrases) {
      if (lower.startsWith(phrase)) {
        count++;
        if (found.length < 3 && !found.includes(phrase)) {
          found.push(phrase);
        }
        break;
      }
    }
  }

  const ratio = count / sentences.length;

  // Human writing: 5-15% transitional starts
  // AI writing: 25-50%+
  const score = linearScale(ratio, 0.10, 0.40);

  const pct = (ratio * 100).toFixed(0);
  const examples = found.length > 0 ? ` (${found.join(', ')})` : '';

  return {
    score,
    detail: `${pct}% of sentences start with transitions${examples}`
  };
};

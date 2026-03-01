window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Burstiness: measures sentence length variation using coefficient of variation.
// Human writing is naturally "bursty" — short punchy sentences mixed with long ones.
// AI tends to produce uniform sentence lengths (low CV).
window.AIDetector.signals.burstiness = (text) => {
  const { splitSentences, wordCount, cv } = window.AIDetector.textUtils;
  const { inverseLinearScale } = window.AIDetector.scoring;

  const sentences = splitSentences(text);
  if (sentences.length < 3) {
    return { score: 0, detail: 'Too few sentences to measure' };
  }

  const lengths = sentences.map(s => wordCount(s));
  const coefficient = cv(lengths);

  // Human writing typically has CV of 0.5-0.9+
  // AI writing typically has CV of 0.15-0.35
  // Low CV = uniform = more AI-like → high signal score
  const score = inverseLinearScale(coefficient, 0.2, 0.7);

  const label = coefficient < 0.3 ? 'Very uniform' :
                coefficient < 0.5 ? 'Somewhat uniform' : 'Natural variation';

  return {
    score,
    detail: `Sentence length CV: ${coefficient.toFixed(2)} (${label})`
  };
};

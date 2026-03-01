window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Generic Phrases: detects known AI filler phrases with individual diagnostic weights.
// Phrases like "Let's dive in" or "game-changer" are strong AI signals.
window.AIDetector.signals.genericPhrases = (text) => {
  const { clamp01 } = window.AIDetector.scoring;
  const { genericPhrases } = window.AIDetector.wordLists;

  const lower = text.toLowerCase();
  if (lower.length < 20) {
    return { score: 0, detail: 'Too short to measure' };
  }

  let totalWeight = 0;
  let matchCount = 0;
  const found = [];

  for (const { phrase, weight } of genericPhrases) {
    if (lower.includes(phrase)) {
      totalWeight += weight;
      matchCount++;
      if (found.length < 4) {
        found.push(`"${phrase}"`);
      }
    }
  }

  // Score based on cumulative diagnostic weight of found phrases
  // 1 strong phrase (~0.8) should give ~0.4 score
  // 2-3 phrases should push toward 0.7-0.9
  const score = clamp01(totalWeight / 2.0);

  const examples = found.length > 0 ? `: ${found.join(', ')}` : '';

  return {
    score,
    detail: `${matchCount} AI filler phrase${matchCount !== 1 ? 's' : ''} found${examples}`
  };
};

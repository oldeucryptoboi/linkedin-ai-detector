window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Cadence: combines punctuation diversity, type-token ratio, and emotional marker usage.
// AI text tends to have low punctuation diversity, moderate TTR, and few emotional markers.
window.AIDetector.signals.cadence = (text) => {
  const { tokenize, typeTokenRatio } = window.AIDetector.textUtils;
  const { clamp01, linearScale, inverseLinearScale } = window.AIDetector.scoring;
  const { emotionalMarkers } = window.AIDetector.wordLists;

  const tokens = tokenize(text);
  if (tokens.length < 15) {
    return { score: 0, detail: 'Too short to measure cadence' };
  }

  // 1. Punctuation diversity: count distinct punctuation types used
  const punctuation = text.match(/[^\w\s]/g) || [];
  const punctTypes = new Set(punctuation);
  // Human text uses varied punctuation: dashes, semicolons, parens, etc.
  // AI sticks to periods, commas, question marks
  const punctDiversity = punctTypes.size;
  const punctScore = inverseLinearScale(punctDiversity, 3, 8);

  // 2. Type-Token Ratio: AI tends toward a "comfortable" middle range
  // Very high or very low TTR is more human
  const ttr = typeTokenRatio(tokens);
  // AI typically 0.45-0.60 for longer text
  // If TTR is in the "AI comfort zone", score higher
  const ttrMidpoint = 0.52;
  const ttrDistance = Math.abs(ttr - ttrMidpoint);
  const ttrScore = inverseLinearScale(ttrDistance, 0, 0.15);

  // 3. Emotional markers: presence of informal markers suggests human
  const lower = text.toLowerCase();
  let emotionalCount = 0;
  for (const marker of emotionalMarkers) {
    if (lower.includes(marker)) emotionalCount++;
  }
  // Any emotional markers reduce AI likelihood
  const emotionalScore = emotionalCount === 0 ? 0.6 :
                          emotionalCount === 1 ? 0.3 : 0;

  // Weighted combination of sub-signals
  const score = clamp01(punctScore * 0.35 + ttrScore * 0.30 + emotionalScore * 0.35);

  const parts = [];
  if (punctScore > 0.4) parts.push('low punctuation variety');
  if (ttrScore > 0.4) parts.push('uniform vocabulary');
  if (emotionalScore > 0.4) parts.push('no informal markers');
  const detail = parts.length > 0 ? parts.join(', ') : 'Natural cadence';

  return {
    score,
    detail: `Cadence: ${detail} (TTR: ${ttr.toFixed(2)})`
  };
};

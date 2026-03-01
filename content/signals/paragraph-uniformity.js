window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Paragraph Uniformity: measures paragraph length variation using CV.
// AI tends to produce paragraphs of similar length. Humans vary more.
window.AIDetector.signals.paragraphUniformity = (text) => {
  const { splitParagraphs, wordCount, cv } = window.AIDetector.textUtils;
  const { inverseLinearScale } = window.AIDetector.scoring;

  const paragraphs = splitParagraphs(text);
  if (paragraphs.length < 3) {
    return { score: 0, detail: 'Too few paragraphs to measure' };
  }

  const lengths = paragraphs.map(p => wordCount(p));
  const coefficient = cv(lengths);

  // Human writing: CV typically 0.5-1.0+ (mix of short and long paragraphs)
  // AI writing: CV typically 0.1-0.3 (uniform paragraphs)
  const score = inverseLinearScale(coefficient, 0.2, 0.7);

  const label = coefficient < 0.25 ? 'Very uniform' :
                coefficient < 0.45 ? 'Somewhat uniform' : 'Natural variation';

  return {
    score,
    detail: `Paragraph length CV: ${coefficient.toFixed(2)} (${label})`
  };
};

window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Em Dash: measures em dash frequency per sentence.
// ChatGPT and Claude statistically overuse em dashes (—) compared to human writers,
// who more commonly use commas, parentheses, or colons for the same purpose.
window.AIDetector.signals.emDash = (text) => {
  const { splitSentences } = window.AIDetector.textUtils;
  const { linearScale } = window.AIDetector.scoring;

  const sentences = splitSentences(text);
  if (sentences.length < 3) {
    return { score: 0, detail: 'Too few sentences to measure' };
  }

  // Count em dashes (—) and en dashes used as em dashes ( – )
  const emDashCount = (text.match(/\u2014/g) || []).length;
  const enDashAsEmCount = (text.match(/\s\u2013\s/g) || []).length;
  const totalDashes = emDashCount + enDashAsEmCount;

  const dashesPerSentence = totalDashes / sentences.length;

  // Human writing: ~0.02-0.05 em dashes per sentence
  // AI writing: ~0.15-0.40+ em dashes per sentence
  const score = linearScale(dashesPerSentence, 0.05, 0.30);

  return {
    score,
    detail: `${totalDashes} em dash${totalDashes !== 1 ? 'es' : ''} in ${sentences.length} sentences (${dashesPerSentence.toFixed(2)}/sent)`
  };
};

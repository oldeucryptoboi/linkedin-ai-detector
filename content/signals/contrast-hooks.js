window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Contrast Hooks: detects "The question isn't X, it's Y" style openings.
// AI-generated LinkedIn posts love this rhetorical device.
window.AIDetector.signals.contrastHooks = (text) => {
  const { splitSentences } = window.AIDetector.textUtils;
  const { clamp01 } = window.AIDetector.scoring;
  const { contrastHookPatterns } = window.AIDetector.wordLists;

  const sentences = splitSentences(text);
  if (sentences.length < 2) {
    return { score: 0, detail: 'Too short to detect hooks' };
  }

  // Check first 3 sentences (hooks are always at the start)
  const opening = sentences.slice(0, 3);
  let matchCount = 0;
  let matchedPattern = '';

  for (const sentence of opening) {
    for (const pattern of contrastHookPatterns) {
      if (pattern.test(sentence)) {
        matchCount++;
        if (!matchedPattern) {
          // Truncate to show what matched
          matchedPattern = sentence.length > 60 ?
            sentence.substring(0, 57) + '...' : sentence;
        }
        break;
      }
    }
  }

  // One contrast hook in the opening is a moderate signal
  // Two+ is very strong
  const score = clamp01(matchCount * 0.6);

  const detail = matchCount > 0
    ? `${matchCount} contrast hook${matchCount > 1 ? 's' : ''}: "${matchedPattern}"`
    : 'No contrast hooks detected';

  return { score, detail };
};

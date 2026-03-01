window.AIDetector = window.AIDetector || {};

window.AIDetector.textUtils = (() => {
  // Split text into sentences, handling abbreviations and edge cases
  function splitSentences(text) {
    if (!text || !text.trim()) return [];
    // Normalize whitespace
    const cleaned = text.replace(/\s+/g, ' ').trim();
    // Split on sentence-ending punctuation followed by space or end
    const raw = cleaned.split(/(?<=[.!?])\s+(?=[A-Z\u00C0-\u024F"])/);
    // Filter out empty/whitespace-only entries
    return raw.filter(s => s.trim().length > 0).map(s => s.trim());
  }

  // Split text into paragraphs (double newline or blank line)
  function splitParagraphs(text) {
    if (!text || !text.trim()) return [];
    return text.split(/\n\s*\n/).filter(p => p.trim().length > 0).map(p => p.trim());
  }

  // Tokenize text into words (lowercase)
  function tokenize(text) {
    if (!text) return [];
    return text.toLowerCase().match(/[a-z'\u00E0-\u024F]+/g) || [];
  }

  // Count words in text
  function wordCount(text) {
    return tokenize(text).length;
  }

  // Split text into lines
  function splitLines(text) {
    if (!text || !text.trim()) return [];
    return text.split(/\n/).filter(l => l.trim().length > 0).map(l => l.trim());
  }

  // Compute mean of an array
  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  // Compute standard deviation
  function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const variance = arr.reduce((sum, val) => sum + (val - m) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }

  // Coefficient of variation (stddev / mean)
  function cv(arr) {
    const m = mean(arr);
    if (m === 0) return 0;
    return stddev(arr) / m;
  }

  // Type-Token Ratio: unique words / total words
  function typeTokenRatio(tokens) {
    if (!tokens.length) return 1;
    const unique = new Set(tokens);
    return unique.size / tokens.length;
  }

  return {
    splitSentences,
    splitParagraphs,
    tokenize,
    wordCount,
    splitLines,
    mean,
    stddev,
    cv,
    typeTokenRatio
  };
})();

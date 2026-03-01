window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Three-Point: detects "rule of three" patterns that AI loves.
// Numbered lists of exactly 3, ordinal sequences (First... Second... Third...),
// triple adjectives, etc.
window.AIDetector.signals.threePoint = (text) => {
  const { splitLines } = window.AIDetector.textUtils;
  const { clamp01 } = window.AIDetector.scoring;

  const lines = splitLines(text);
  if (lines.length < 3) {
    return { score: 0, detail: 'Too short for three-point analysis' };
  }

  let threePointSignals = 0;
  const found = [];

  // 1. Numbered lists of exactly 3 (1. 2. 3. without 4.)
  const numberedLines = lines.filter(l => /^\s*\d+[\.\)]\s/.test(l));
  if (numberedLines.length === 3) {
    const nums = numberedLines.map(l => parseInt(l.match(/\d+/)[0]));
    if (nums[0] === 1 && nums[1] === 2 && nums[2] === 3) {
      threePointSignals += 0.5;
      found.push('numbered list of 3');
    }
  }

  // 2. Ordinal sequences: "First,... Second,... Third,..."
  const lower = text.toLowerCase();
  const hasFirst = /\bfirst(?:ly)?,?\s/i.test(text);
  const hasSecond = /\bsecond(?:ly)?,?\s/i.test(text);
  const hasThird = /\bthird(?:ly)?,?\s/i.test(text);
  const hasFourth = /\bfourth(?:ly)?,?\s/i.test(text);
  if (hasFirst && hasSecond && hasThird && !hasFourth) {
    threePointSignals += 0.5;
    found.push('ordinal sequence (First/Second/Third)');
  }

  // 3. Triple adjective/noun patterns: "X, Y, and Z" with single words
  const triplePattern = /\b(\w+),\s+(\w+),?\s+and\s+(\w+)\b/gi;
  let tripleMatches = 0;
  let match;
  while ((match = triplePattern.exec(text)) !== null) {
    // Check that each captured word is a single word (not a phrase)
    if (match[1].length < 20 && match[2].length < 20 && match[3].length < 20) {
      tripleMatches++;
    }
  }
  if (tripleMatches >= 2) {
    threePointSignals += 0.3;
    found.push(`${tripleMatches} triple patterns`);
  } else if (tripleMatches === 1) {
    threePointSignals += 0.1;
  }

  // 4. Bullet lists of exactly 3
  const bulletLines = lines.filter(l => /^\s*[•\-\*]\s/.test(l));
  if (bulletLines.length === 3) {
    threePointSignals += 0.4;
    found.push('bullet list of 3');
  }

  const score = clamp01(threePointSignals);
  const detail = found.length > 0
    ? `Rule of three: ${found.join(', ')}`
    : 'No three-point patterns detected';

  return { score, detail };
};

window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Structure: detects the clean "short hook → framework middle → short close" narrative arc.
// AI posts often follow: punchy 1-2 sentence opener, structured middle, call-to-action close.
window.AIDetector.signals.structure = (text) => {
  const { splitParagraphs, wordCount, splitSentences } = window.AIDetector.textUtils;
  const { clamp01 } = window.AIDetector.scoring;

  const paragraphs = splitParagraphs(text);
  if (paragraphs.length < 3) {
    return { score: 0, detail: 'Too few paragraphs for structure analysis' };
  }

  let structureScore = 0;
  const signals = [];

  // 1. Short hook opener (first paragraph is 1-2 sentences, under 30 words)
  const firstParaWords = wordCount(paragraphs[0]);
  const firstParaSentences = splitSentences(paragraphs[0]).length;
  if (firstParaWords <= 30 && firstParaSentences <= 2) {
    structureScore += 0.25;
    signals.push('short hook opener');
  }

  // 2. Short close (last paragraph is 1-2 sentences, under 30 words)
  const lastPara = paragraphs[paragraphs.length - 1];
  const lastParaWords = wordCount(lastPara);
  const lastParaSentences = splitSentences(lastPara).length;
  if (lastParaWords <= 30 && lastParaSentences <= 2) {
    structureScore += 0.20;
    signals.push('short close');
  }

  // 3. CTA in closing (question mark, "thoughts?", "agree?", "comment", etc.)
  const lowerLast = lastPara.toLowerCase();
  const ctaPatterns = ['?', 'thoughts', 'agree', 'comment', 'share', 'follow',
                       'what do you', 'let me know', 'repost'];
  const hasCTA = ctaPatterns.some(p => lowerLast.includes(p));
  if (hasCTA) {
    structureScore += 0.20;
    signals.push('CTA in close');
  }

  // 4. Middle section has framework markers (numbered items, colons, bold patterns)
  const middle = paragraphs.slice(1, -1).join('\n');
  const middleLower = middle.toLowerCase();
  const hasNumbering = /^\s*\d+[\.\)]/m.test(middle);
  const hasColonHeaders = /^[A-Z][^.!?]{2,30}:/m.test(middle);
  const hasBullets = /^\s*[•\-\*]\s/m.test(middle);
  const frameworkMarkers = [hasNumbering, hasColonHeaders, hasBullets].filter(Boolean).length;
  if (frameworkMarkers > 0) {
    structureScore += 0.15 * frameworkMarkers;
    signals.push('framework structure in middle');
  }

  // 5. Line breaks used for emphasis (single-sentence paragraphs)
  const singleSentenceParas = paragraphs.filter(p =>
    splitSentences(p).length === 1 && wordCount(p) < 15
  ).length;
  const emphasisRatio = singleSentenceParas / paragraphs.length;
  if (emphasisRatio > 0.3) {
    structureScore += 0.15;
    signals.push('emphasis line breaks');
  }

  const score = clamp01(structureScore);
  const detail = signals.length > 0
    ? `Clean arc: ${signals.join(', ')}`
    : 'No formulaic structure detected';

  return { score, detail };
};

window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Personal Specificity: detects vague AI anecdotes vs specific human details.
// AI generates generic stories ("a colleague once told me", "years ago I learned").
// Humans include specific details: names, dates, non-round numbers, proper nouns, places.
window.AIDetector.signals.personalSpecificity = (text) => {
  const { splitSentences } = window.AIDetector.textUtils;
  const { linearScale } = window.AIDetector.scoring;

  const sentences = splitSentences(text);
  if (sentences.length < 3) {
    return { score: 0, detail: 'Too few sentences to measure' };
  }

  // Vague AI anecdote patterns
  const vaguePatterns = [
    /\b(?:a|one) (?:colleague|friend|mentor|manager|leader|client|coworker|team member) (?:once |recently )?(?:told|said|shared|mentioned|asked|reminded)\b/i,
    /\byears ago,? I (?:learned|realized|discovered|understood)\b/i,
    /\bearly in my career\b/i,
    /\bI (?:once|recently) (?:had|met|spoke|talked|worked) (?:with|to) (?:a|an|some)\b/i,
    /\bI remember (?:a time|when|once)\b/i,
    /\bsomeone (?:once |recently )?(?:told|said|asked|shared)\b/i,
    /\bin my experience\b/i,
    /\bI've (?:seen|found|noticed|observed) (?:that )?(?:many|most|some|countless)\b/i,
    /\btime and (?:time )?again\b/i,
    /\bthroughout my (?:career|journey|experience)\b/i,
  ];

  // Specificity markers — signs of real human experience
  // Non-round numbers (e.g., "37 people", "$2,347", "14 months")
  const nonRoundNumbers = text.match(/\b\d*[13579]\d*\b/g) || [];
  // Proper nouns (capitalized words not at sentence start, excluding common words)
  const properNouns = text.match(/(?<=\s)[A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})*/g) || [];
  // Specific dates or years
  const dates = text.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?|\b(?:19|20)\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi) || [];
  // Quoted speech with specific attribution
  const quotedSpeech = text.match(/"[^"]{5,}"/g) || [];

  const specificityMarkers = nonRoundNumbers.length + properNouns.length + dates.length + quotedSpeech.length;
  const specificityPerSentence = specificityMarkers / sentences.length;

  // Count vague patterns
  let vagueCount = 0;
  const vagueFound = [];
  for (const pattern of vaguePatterns) {
    const matches = text.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      vagueCount += matches.length;
      if (vagueFound.length < 2) vagueFound.push(matches[0].trim().substring(0, 30));
    }
  }
  const vaguePerSentence = vagueCount / sentences.length;

  // High vagueness + low specificity = AI-like
  const vagueScore = linearScale(vaguePerSentence, 0.02, 0.15);
  const specificityDiscount = Math.min(specificityPerSentence * 0.3, 0.5);

  const score = Math.max(0, Math.min(1, vagueScore - specificityDiscount));

  const parts = [];
  if (vagueFound.length > 0) parts.push(`vague: "${vagueFound.join('", "')}"`);
  parts.push(`${specificityMarkers} specific detail${specificityMarkers !== 1 ? 's' : ''}`);

  return {
    score,
    detail: `${vagueCount} vague / ${specificityMarkers} specific (${parts.join('; ')})`
  };
};

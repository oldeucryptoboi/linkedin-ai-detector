window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Contractions: measures contraction rate.
// AI writes "does not" instead of "doesn't" in informal contexts like LinkedIn.
// Low contraction rate in informal writing is a strong AI signal.
window.AIDetector.signals.contractions = (text) => {
  const { inverseLinearScale } = window.AIDetector.scoring;
  const { commonContractions, expandedForms } = window.AIDetector.wordLists;

  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).length;
  if (words < 30) {
    return { score: 0, detail: 'Too short to measure' };
  }

  // Count contractions used
  let contractionCount = 0;
  const contractionsFound = [];
  for (const c of commonContractions) {
    const regex = new RegExp(`\\b${c.replace("'", "'")}\\b|\\b${c}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      contractionCount += matches.length;
      if (contractionsFound.length < 3 && !contractionsFound.includes(c)) {
        contractionsFound.push(c);
      }
    }
  }

  // Count expanded forms that could have been contractions
  let expandedCount = 0;
  const expandedFound = [];
  for (const { expanded, contracted } of expandedForms) {
    const regex = new RegExp(`\\b${expanded}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      expandedCount += matches.length;
      if (expandedFound.length < 3) {
        expandedFound.push(`${expanded} → ${contracted}`);
      }
    }
  }

  const totalOpportunities = contractionCount + expandedCount;
  if (totalOpportunities === 0) {
    return { score: 0, detail: 'No contraction opportunities found' };
  }

  const contractionRate = contractionCount / totalOpportunities;

  // Human informal writing: 60-90% contraction rate
  // AI writing: 10-40% contraction rate
  const score = inverseLinearScale(contractionRate, 0.2, 0.7);

  const parts = [];
  if (contractionsFound.length > 0) parts.push(`used: ${contractionsFound.join(', ')}`);
  if (expandedFound.length > 0) parts.push(`avoided: ${expandedFound.join(', ')}`);
  const examples = parts.length > 0 ? ` (${parts.join('; ')})` : '';

  return {
    score,
    detail: `${Math.round(contractionRate * 100)}% contraction rate${examples}`
  };
};

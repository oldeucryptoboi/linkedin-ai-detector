window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// Epistemic: detects flat epistemic texture.
// Human writers express genuine uncertainty ("i'm not sure", "idk", "i could be wrong").
// AI uses fake hedges that sound balanced but add no real uncertainty
// ("essentially", "it is important to note", "fundamentally").
window.AIDetector.signals.epistemic = (text) => {
  const { linearScale } = window.AIDetector.scoring;
  const { genuineHedges, fakeHedges } = window.AIDetector.wordLists;

  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).length;
  if (words < 20) {
    return { score: 0, detail: 'Too short to measure' };
  }

  // Count genuine hedges
  let genuineCount = 0;
  const genuineFound = [];
  for (const hedge of genuineHedges) {
    const matches = lower.split(hedge).length - 1;
    if (matches > 0) {
      genuineCount += matches;
      if (genuineFound.length < 3) genuineFound.push(hedge);
    }
  }

  // Count fake hedges
  let fakeCount = 0;
  const fakeFound = [];
  for (const hedge of fakeHedges) {
    const matches = lower.split(hedge).length - 1;
    if (matches > 0) {
      fakeCount += matches;
      if (fakeFound.length < 3) fakeFound.push(hedge);
    }
  }

  // Score: high fake hedges + low genuine hedges = AI-like
  // Normalize per 100 words
  const fakePer100 = (fakeCount / words) * 100;
  const genuinePer100 = (genuineCount / words) * 100;

  // Fake hedge density drives score up
  const fakeScore = linearScale(fakePer100, 0.3, 2.0);

  // Genuine hedges drive score down (humans hedge genuinely)
  const genuineDiscount = Math.min(genuineCount * 0.2, 0.6);

  const score = Math.max(0, Math.min(1, fakeScore - genuineDiscount));

  const parts = [];
  if (fakeFound.length > 0) parts.push(`fake: ${fakeFound.join(', ')}`);
  if (genuineFound.length > 0) parts.push(`genuine: ${genuineFound.join(', ')}`);
  const examples = parts.length > 0 ? ` (${parts.join('; ')})` : '';

  return {
    score,
    detail: `${fakeCount} fake / ${genuineCount} genuine hedges${examples}`
  };
};

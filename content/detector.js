window.AIDetector = window.AIDetector || {};

// Orchestrator: runs all 14 signal analyzers and computes weighted score
window.AIDetector.detector = (() => {
  const SIGNAL_CONFIG = [
    { key: 'burstiness',          fn: () => window.AIDetector.signals.burstiness,          weight: 0.10, label: 'Burstiness' },
    { key: 'abstraction',         fn: () => window.AIDetector.signals.abstraction,         weight: 0.09, label: 'Abstraction' },
    { key: 'genericPhrases',      fn: () => window.AIDetector.signals.genericPhrases,      weight: 0.09, label: 'Generic Phrases' },
    { key: 'emDash',              fn: () => window.AIDetector.signals.emDash,              weight: 0.08, label: 'Em Dash' },
    { key: 'epistemic',           fn: () => window.AIDetector.signals.epistemic,           weight: 0.08, label: 'Epistemic' },
    { key: 'transitions',         fn: () => window.AIDetector.signals.transitions,         weight: 0.07, label: 'Transitions' },
    { key: 'paragraphUniformity', fn: () => window.AIDetector.signals.paragraphUniformity, weight: 0.07, label: 'Paragraph Uniformity' },
    { key: 'structure',           fn: () => window.AIDetector.signals.structure,           weight: 0.07, label: 'Structure' },
    { key: 'contractions',        fn: () => window.AIDetector.signals.contractions,        weight: 0.06, label: 'Contractions' },
    { key: 'personalSpecificity', fn: () => window.AIDetector.signals.personalSpecificity, weight: 0.06, label: 'Specificity' },
    { key: 'cadence',             fn: () => window.AIDetector.signals.cadence,             weight: 0.06, label: 'Cadence' },
    { key: 'contrastHooks',       fn: () => window.AIDetector.signals.contrastHooks,       weight: 0.06, label: 'Contrast Hooks' },
    { key: 'listDensity',         fn: () => window.AIDetector.signals.listDensity,         weight: 0.06, label: 'List Density' },
    { key: 'threePoint',          fn: () => window.AIDetector.signals.threePoint,          weight: 0.05, label: 'Three-Point' }
  ];

  function analyze(text, sensitivity) {
    // sensitivity: 0-100, default 50.
    // 0 = all human (score → 0), 50 = neutral (unchanged), 100 = all AI (score → 1)
    const s = (sensitivity ?? 50) / 100; // normalize to 0-1

    const results = [];
    let weightedSum = 0;

    for (const config of SIGNAL_CONFIG) {
      try {
        const analyzerFn = config.fn();
        const result = analyzerFn(text);
        results.push({
          key: config.key,
          label: config.label,
          weight: config.weight,
          score: result.score,
          detail: result.detail
        });
        weightedSum += result.score * config.weight;
      } catch (e) {
        results.push({
          key: config.key,
          label: config.label,
          weight: config.weight,
          score: 0,
          detail: 'Error analyzing'
        });
      }
    }

    // Apply sensitivity: blend raw score toward 0 (left) or 1 (right)
    const rawScore = Math.max(0, Math.min(1, weightedSum));
    let finalScore;
    if (s <= 0.5) {
      // 0→all human (score*0), 0.5→neutral (score*1)
      finalScore = rawScore * (s / 0.5);
    } else {
      // 0.5→neutral (rawScore), 1→all AI (1.0)
      finalScore = rawScore + (1 - rawScore) * ((s - 0.5) / 0.5);
    }

    return {
      score: finalScore,
      label: window.AIDetector.scoring.getLabel(finalScore),
      color: window.AIDetector.scoring.getColor(finalScore),
      bgColor: window.AIDetector.scoring.getBgColor(finalScore),
      signals: results
    };
  }

  return { analyze, SIGNAL_CONFIG };
})();

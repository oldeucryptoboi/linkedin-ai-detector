window.AIDetector = window.AIDetector || {};

window.AIDetector.scoring = (() => {
  // Score labels with thresholds
  function getLabel(score) {
    if (score < 0.25) return 'Very Unlikely AI';
    if (score < 0.40) return 'Unlikely AI';
    if (score < 0.55) return 'Possibly AI';
    if (score < 0.70) return 'Likely AI';
    if (score < 0.85) return 'Very Likely AI';
    return 'Almost Certainly AI';
  }

  // Color for a given score (0-1)
  function getColor(score) {
    if (score < 0.40) return '#22c55e'; // green
    if (score < 0.70) return '#f59e0b'; // amber
    return '#ef4444'; // red
  }

  // Background color (lighter version)
  function getBgColor(score) {
    if (score < 0.40) return '#dcfce7';
    if (score < 0.70) return '#fef3c7';
    return '#fee2e2';
  }

  // Clamp a value between 0 and 1
  function clamp01(val) {
    return Math.max(0, Math.min(1, val));
  }

  // Map a raw value to a 0-1 signal strength using linear interpolation
  // between low (maps to 0) and high (maps to 1)
  function linearScale(value, low, high) {
    if (high === low) return value >= high ? 1 : 0;
    return clamp01((value - low) / (high - low));
  }

  // Inverse linear scale: high values map to 0, low values map to 1
  function inverseLinearScale(value, low, high) {
    return 1 - linearScale(value, low, high);
  }

  return {
    getLabel,
    getColor,
    getBgColor,
    clamp01,
    linearScale,
    inverseLinearScale
  };
})();

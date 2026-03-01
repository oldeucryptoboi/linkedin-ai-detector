window.AIDetector = window.AIDetector || {};
window.AIDetector.signals = window.AIDetector.signals || {};

// List Density: measures the ratio of list-formatted lines to total lines.
// AI-generated LinkedIn posts love lists (numbered, bulleted, emoji-prefixed).
window.AIDetector.signals.listDensity = (text) => {
  const { splitLines } = window.AIDetector.textUtils;
  const { linearScale } = window.AIDetector.scoring;

  const lines = splitLines(text);
  if (lines.length < 3) {
    return { score: 0, detail: 'Too few lines to measure' };
  }

  // Count lines that look like list items
  let listLines = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      /^\d+[\.\)]\s/.test(trimmed) ||           // 1. or 1)
      /^[•\-\*]\s/.test(trimmed) ||              // bullet
      /^[a-z][\.\)]\s/i.test(trimmed) ||         // a. or a)
      /^[\u2022\u25E6\u25AA\u25AB]\s/.test(trimmed) || // unicode bullets
      /^(?:\u2705|\u274C|\u2714|\u2716|\u27A1|\u2B50|[\u{1F300}-\u{1F9FF}])\s/u.test(trimmed) // emoji-prefixed
    ) {
      listLines++;
    }
  }

  const ratio = listLines / lines.length;

  // Normal human posts: 0-15% list lines
  // AI-heavy list posts: 40-70%+
  const score = linearScale(ratio, 0.10, 0.50);

  const pct = (ratio * 100).toFixed(0);

  return {
    score,
    detail: `${pct}% of lines are list items (${listLines}/${lines.length})`
  };
};

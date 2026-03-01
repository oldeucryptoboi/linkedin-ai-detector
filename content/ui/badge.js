window.AIDetector = window.AIDetector || {};

// Badge: 28px colored circle showing AI probability percentage
window.AIDetector.badge = (() => {
  function create(result) {
    const badge = document.createElement('div');
    badge.className = 'laid-badge';
    badge.style.backgroundColor = result.color;
    badge.textContent = Math.round(result.score * 100);
    badge.title = `Heuristic: ${result.label}`;
    badge.setAttribute('data-laid-score', result.score);
    return badge;
  }

  function createLoading() {
    const badge = document.createElement('div');
    badge.className = 'laid-badge laid-badge--loading laid-badge--claude';
    badge.title = 'Claude: Analyzing...';
    return badge;
  }

  function createClaude(result) {
    const badge = document.createElement('div');
    badge.className = 'laid-badge laid-badge--claude';
    const color = window.AIDetector.scoring.getColor(result.score);
    badge.style.backgroundColor = color;
    badge.textContent = Math.round(result.score * 100);
    badge.title = `Claude: ${window.AIDetector.scoring.getLabel(result.score)}`;
    badge.setAttribute('data-laid-claude-score', result.score);
    return badge;
  }

  return { create, createLoading, createClaude };
})();

window.AIDetector = window.AIDetector || {};

// Detail Panel: expandable breakdown showing each signal with colored bar + score + explanation
window.AIDetector.detailPanel = (() => {
  function create(result) {
    const panel = document.createElement('div');
    panel.className = 'laid-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'laid-panel-header';

    const title = document.createElement('span');
    title.className = 'laid-panel-title';
    title.textContent = 'AI Detection';

    const scoreBadge = document.createElement('span');
    scoreBadge.className = 'laid-panel-score';
    scoreBadge.style.backgroundColor = result.bgColor;
    scoreBadge.style.color = result.color;
    scoreBadge.textContent = `${Math.round(result.score * 100)}% — ${result.label}`;

    header.appendChild(title);
    header.appendChild(scoreBadge);
    panel.appendChild(header);

    // Signal rows
    for (const signal of result.signals) {
      const row = document.createElement('div');
      row.className = 'laid-signal-row';

      const label = document.createElement('span');
      label.className = 'laid-signal-label';
      label.textContent = signal.label;

      const barBg = document.createElement('div');
      barBg.className = 'laid-signal-bar-bg';

      const barFill = document.createElement('div');
      barFill.className = 'laid-signal-bar-fill';
      const barColor = window.AIDetector.scoring.getColor(signal.score);
      barFill.style.backgroundColor = barColor;
      barFill.style.width = `${Math.round(signal.score * 100)}%`;

      barBg.appendChild(barFill);

      const value = document.createElement('span');
      value.className = 'laid-signal-value';
      value.textContent = Math.round(signal.score * 100);

      row.appendChild(label);
      row.appendChild(barBg);
      row.appendChild(value);
      panel.appendChild(row);

      // Detail text
      if (signal.detail) {
        const detail = document.createElement('div');
        detail.className = 'laid-signal-detail';
        detail.textContent = signal.detail;
        panel.appendChild(detail);
      }
    }

    return panel;
  }

  function createClaude(result) {
    const panel = document.createElement('div');
    panel.className = 'laid-panel laid-panel--claude';

    // Header
    const header = document.createElement('div');
    header.className = 'laid-panel-header';

    const title = document.createElement('span');
    title.className = 'laid-panel-title';
    title.textContent = 'Claude AI Detection';

    const bgColor = window.AIDetector.scoring.getBgColor(result.score);
    const color = window.AIDetector.scoring.getColor(result.score);
    const label = window.AIDetector.scoring.getLabel(result.score);

    const scoreBadge = document.createElement('span');
    scoreBadge.className = 'laid-panel-score';
    scoreBadge.style.backgroundColor = bgColor;
    scoreBadge.style.color = color;
    scoreBadge.textContent = `${Math.round(result.score * 100)}% — ${label}`;

    header.appendChild(title);
    header.appendChild(scoreBadge);
    panel.appendChild(header);

    // Reasoning block
    const reasoning = document.createElement('div');
    reasoning.className = 'laid-panel-reasoning';
    reasoning.textContent = result.reasoning || 'No reasoning provided.';
    panel.appendChild(reasoning);

    return panel;
  }

  function toggle(panel) {
    panel.classList.toggle('laid-panel--open');
  }

  return { create, createClaude, toggle };
})();

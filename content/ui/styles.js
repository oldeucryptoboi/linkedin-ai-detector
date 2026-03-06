window.AIDetector = window.AIDetector || {};

// Injects scoped CSS with laid- prefix to avoid collisions with host page styles
window.AIDetector.styles = (() => {
  let injected = false;

  function inject() {
    if (injected) return;
    injected = true;

    const style = document.createElement('style');
    style.textContent = `
      .laid-badge {
        position: absolute;
        top: 0;
        right: 0;
        width: 36px;
        height: 36px;
        clip-path: polygon(0 0, 100% 0, 100% 100%);
        display: flex;
        align-items: flex-start;
        justify-content: flex-end;
        padding: 3px 4px 0 0;
        font-size: 11px;
        font-weight: 700;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #fff;
        cursor: pointer;
        user-select: none;
        line-height: 1;
        z-index: 10;
        transform-origin: top right;
        transition: transform 0.15s ease;
      }

      .laid-badge:hover {
        transform: scale(1.15);
      }

      .laid-badge--ai {
        font-size: 10px;
        letter-spacing: -0.5px;
      }

      .laid-badge--loading {
        background-color: #a78bfa;
      }

      @keyframes laid-spin {
        to { transform: rotate(360deg); }
      }

      .laid-badge--loading::after {
        content: '';
        position: absolute;
        top: 4px;
        right: 4px;
        width: 10px;
        height: 10px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: laid-spin 0.8s linear infinite;
      }

      .laid-panel {
        position: absolute;
        top: 36px;
        right: 0;
        width: 300px;
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        z-index: 11;
        padding: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        color: #333;
        display: none;
      }

      .laid-panel.laid-panel--open {
        display: block;
      }

      .laid-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid #eee;
      }

      .laid-panel-title {
        font-size: 13px;
        font-weight: 600;
        color: #111;
      }

      .laid-panel-score {
        font-size: 14px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .laid-signal-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }

      .laid-signal-label {
        width: 100px;
        font-size: 11px;
        color: #555;
        flex-shrink: 0;
        text-align: right;
      }

      .laid-signal-bar-bg {
        flex: 1;
        height: 6px;
        background: #f0f0f0;
        border-radius: 3px;
        overflow: hidden;
      }

      .laid-signal-bar-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      .laid-signal-value {
        width: 30px;
        font-size: 11px;
        color: #666;
        text-align: right;
        flex-shrink: 0;
      }

      .laid-signal-detail {
        font-size: 10px;
        color: #888;
        margin: -2px 0 6px 108px;
        line-height: 1.3;
      }

      .laid-panel--ai .laid-panel-header {
        border-bottom-color: #ede9fe;
      }

      .laid-panel-reasoning {
        font-size: 12px;
        color: #444;
        line-height: 1.5;
        margin-top: 8px;
        padding: 8px;
        background: #f8f7ff;
        border-radius: 6px;
        border-left: 3px solid #7c3aed;
      }
    `;
    document.head.appendChild(style);
  }

  return { inject };
})();

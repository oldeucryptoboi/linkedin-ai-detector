import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '..');

// Use actual Chrome user data dir to reuse existing sessions.
// Chrome must be fully closed before running this script.
const chromeUserDataDir = path.join(
  process.env.HOME,
  'Library/Application Support/Google/Chrome'
);

let browserClosed = false;

async function main() {
  console.log('Extension path:', extensionPath);
  console.log('Chrome profile dir:', chromeUserDataDir);
  console.log('Launching Chrome with Profile 1 + extension...');

  const context = await chromium.launchPersistentContext(chromeUserDataDir, {
    headless: false,
    channel: 'chrome',
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--disable-blink-features=AutomationControlled',
      '--profile-directory=Profile 1',
    ],
    viewport: { width: 1280, height: 900 },
  });

  context.on('close', () => {
    browserClosed = true;
    console.log('Browser was closed.');
  });

  const page = context.pages()[0] || await context.newPage();

  // Set Claude API key via extension service worker
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    console.log('Setting Claude API key in extension storage...');
    // Find the extension's background service worker target
    let swPage;
    for (const p of context.serviceWorkers()) {
      if (p.url().includes('service-worker')) {
        swPage = p;
        break;
      }
    }
    if (!swPage) {
      // Open extension page to trigger SW registration, then find it
      const extPage = await context.newPage();
      await extPage.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
      await sleep(2000);
      await extPage.close();
      for (const p of context.serviceWorkers()) {
        if (p.url().includes('service-worker')) {
          swPage = p;
          break;
        }
      }
    }
    if (swPage) {
      await swPage.evaluate((key) => {
        return new Promise(resolve => chrome.storage.sync.set({ claudeApiKey: key }, resolve));
      }, apiKey);
      console.log('API key set successfully.');
    } else {
      console.log('Could not find service worker — setting key via page instead.');
      await page.evaluate((key) => {
        return new Promise(resolve => chrome.storage.sync.set({ claudeApiKey: key }, resolve));
      }, apiKey);
    }
  } else {
    console.log('No ANTHROPIC_API_KEY in env — skipping Claude badge test.');
  }

  // Navigate to LinkedIn feed
  console.log('Navigating to LinkedIn feed...');
  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  console.log('Landed on:', page.url());

  // Wait for either feed posts or login form — whichever appears first
  console.log('Waiting for feed to load (or login page)...');
  const feedOrLogin = await Promise.race([
    page.waitForSelector('.feed-shared-update-v2', { timeout: 120_000 }).then(() => 'feed'),
    page.waitForSelector('#username, input[name="session_key"]', { timeout: 120_000 }).then(() => 'login'),
  ]).catch(() => 'unknown');

  if (feedOrLogin === 'login') {
    console.log('Login page detected. Please sign in manually in the browser.');
    console.log('Waiting up to 2 minutes for feed to appear after login...');
    try {
      await page.waitForSelector('.feed-shared-update-v2', { timeout: 120_000 });
      console.log('Login successful — feed loaded.');
    } catch {
      if (browserClosed) return;
      console.error('Timed out waiting for login. Leaving browser open.');
      await waitForClose(context);
      return;
    }
  } else if (feedOrLogin === 'feed') {
    console.log('Already logged in — feed loaded.');
  } else {
    console.log('Could not detect feed or login. Current URL:', page.url());
    console.log('Waiting 10s then continuing anyway...');
    await sleep(10_000);
  }

  // Reload to ensure content script picks up API key from storage
  if (apiKey) {
    console.log('Reloading page to pick up API key...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('.feed-shared-update-v2', { timeout: 30_000 });
    console.log('Page reloaded.');
  }

  // Capture extension-related console output for debugging
  page.on('console', msg => {
    if (msg.text().includes('[LAID]')) {
      console.log(`[BROWSER] ${msg.text()}`);
    }
  });

  // Scroll to trigger more posts + extension processing
  console.log('Scrolling feed to trigger extension analysis...');
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(1500);
  }

  // Wait for extension badges
  console.log('Waiting for .laid-badge elements...');
  const badgeSelector = '.laid-badge';
  try {
    await page.waitForSelector(badgeSelector, { timeout: 15_000 });
  } catch {
    console.log('No badges appeared within 15s. Extension may not have matched any posts.');
    console.log('Leaving browser open for manual inspection. Ctrl+C to exit.');
    await waitForClose(context);
    return;
  }

  // Log all heuristic badge scores
  const badges = await page.$$eval(badgeSelector, els =>
    els.map(el => ({
      score: el.getAttribute('data-laid-score'),
      text: el.textContent,
      label: el.title,
      isClaude: el.classList.contains('laid-badge--claude'),
      isLoading: el.classList.contains('laid-badge--loading'),
    }))
  );

  const heuristicBadges = badges.filter(b => !b.isClaude);
  const claudeBadges = badges.filter(b => b.isClaude && !b.isLoading);
  const loadingBadges = badges.filter(b => b.isLoading);

  console.log(`\nFound ${heuristicBadges.length} heuristic badge(s):`);
  for (const b of heuristicBadges) {
    console.log(`  ${b.text}% — ${b.label} (raw: ${b.score})`);
  }

  if (loadingBadges.length > 0) {
    console.log(`\n${loadingBadges.length} Claude badge(s) still loading...`);
    // Wait up to 30s for Claude badges to resolve
    try {
      await page.waitForSelector('.laid-badge--claude:not(.laid-badge--loading)', { timeout: 30_000 });
      await sleep(1000);
    } catch {
      console.log('Claude badges did not finish loading within 30s.');
    }
  }

  // Re-check Claude badges after loading
  const claudeFinal = await page.$$eval('.laid-badge--claude:not(.laid-badge--loading)', els =>
    els.map(el => ({
      score: el.getAttribute('data-laid-claude-score'),
      text: el.textContent,
      label: el.title,
    }))
  );

  if (claudeFinal.length > 0) {
    console.log(`\nFound ${claudeFinal.length} Claude badge(s):`);
    for (const b of claudeFinal) {
      console.log(`  ${b.text}% — ${b.label} (raw: ${b.score})`);
    }
  } else {
    console.log('\nNo Claude badges found (API key may not be configured).');
  }

  // Check badge groups
  const groupCount = await page.$$eval('.laid-badge-group', g => g.length);
  console.log(`\nBadge groups: ${groupCount}`);

  // Click first heuristic badge to open detail panel
  const firstBadge = page.locator(badgeSelector + ':not(.laid-badge--claude)').first();
  await firstBadge.click();
  await sleep(500);

  const panelOpen = await page.$('.laid-panel--open');
  if (panelOpen) {
    console.log('\nHeuristic detail panel opened successfully.');
    const signals = await page.$$eval('.laid-panel--open .laid-signal-row', rows =>
      rows.map(row => ({
        label: row.querySelector('.laid-signal-label')?.textContent,
        value: row.querySelector('.laid-signal-value')?.textContent,
      }))
    );
    for (const s of signals) {
      console.log(`  ${s.label}: ${s.value}%`);
    }
  } else {
    console.log('Panel did not open — click may not have reached badge.');
  }

  // Try clicking a Claude badge if present
  const claudeBadgeEl = page.locator('.laid-badge--claude:not(.laid-badge--loading)').first();
  if (await claudeBadgeEl.count() > 0) {
    // Close any open panel first
    await page.click('body');
    await sleep(300);
    await claudeBadgeEl.click();
    await sleep(500);
    const claudePanelOpen = await page.$('.laid-panel--claude.laid-panel--open');
    if (claudePanelOpen) {
      console.log('\nClaude detail panel opened successfully.');
      const reasoning = await page.$eval('.laid-panel--claude.laid-panel--open .laid-panel-reasoning', el => el.textContent);
      console.log(`  Reasoning: ${reasoning}`);
    }
  }

  // Screenshot
  const screenshotPath = path.resolve(__dirname, 'screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\nScreenshot saved to ${screenshotPath}`);

  // Leave browser open
  console.log('\nDone. Browser stays open for inspection. Ctrl+C to exit.');
  await waitForClose(context);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForClose(context) {
  if (browserClosed) return Promise.resolve();
  return new Promise((resolve) => {
    context.on('close', resolve);
    process.on('SIGINT', async () => {
      console.log('\nClosing browser...');
      await context.close().catch(() => {});
      resolve();
    });
  });
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

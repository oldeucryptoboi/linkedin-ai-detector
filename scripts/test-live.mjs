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

  // Set provider + API key via extension service worker
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  let provider = 'local';
  if (process.env.ANTHROPIC_API_KEY) provider = 'claude';
  else if (process.env.OPENAI_API_KEY) provider = 'openai';
  else if (process.env.GEMINI_API_KEY) provider = 'gemini';

  if (apiKey) {
    console.log(`Setting provider=${provider} and API key in extension storage...`);
    let swPage;
    for (const p of context.serviceWorkers()) {
      if (p.url().includes('service-worker')) {
        swPage = p;
        break;
      }
    }
    if (!swPage) {
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
    const storageData = { provider, apiKey };
    if (swPage) {
      await swPage.evaluate((data) => {
        return new Promise(resolve => chrome.storage.sync.set(data, resolve));
      }, storageData);
      console.log('Storage set successfully via service worker.');
    } else {
      console.log('Could not find service worker — setting via page instead.');
      await page.evaluate((data) => {
        return new Promise(resolve => chrome.storage.sync.set(data, resolve));
      }, storageData);
    }
  } else {
    console.log('No API key in env — testing local heuristic only.');
  }

  // Navigate to LinkedIn feed
  console.log('Navigating to LinkedIn feed...');
  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  console.log('Landed on:', page.url());

  // Wait for either feed posts or login form
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

  // Reload to ensure content script picks up settings from storage
  if (apiKey) {
    console.log('Reloading page to pick up settings...');
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

  // If API provider, wait for loading badges to resolve
  if (provider !== 'local') {
    const loadingCount = await page.$$eval('.laid-badge--loading', els => els.length);
    if (loadingCount > 0) {
      console.log(`${loadingCount} badge(s) still loading...`);
      try {
        await page.waitForSelector('.laid-badge--ai', { timeout: 30_000 });
        await sleep(1000);
      } catch {
        console.log('AI badges did not finish loading within 30s.');
      }
    }
  }

  // Log all badges
  const badges = await page.$$eval(badgeSelector, els =>
    els.map(el => ({
      score: el.getAttribute('data-laid-score'),
      text: el.textContent,
      label: el.title,
      isAI: el.classList.contains('laid-badge--ai'),
      isLoading: el.classList.contains('laid-badge--loading'),
    }))
  );

  const scoredBadges = badges.filter(b => !b.isLoading);
  console.log(`\nFound ${scoredBadges.length} badge(s) [provider: ${provider}]:`);
  for (const b of scoredBadges) {
    console.log(`  ${b.text}% — ${b.label} (raw: ${b.score})`);
  }

  // Click first badge to open detail panel
  const firstBadge = page.locator(badgeSelector + ':not(.laid-badge--loading)').first();
  await firstBadge.click();
  await sleep(500);

  const panelOpen = await page.$('.laid-panel--open');
  if (panelOpen) {
    console.log('\nDetail panel opened successfully.');

    if (provider === 'local') {
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
      const reasoning = await page.$eval('.laid-panel--open .laid-panel-reasoning', el => el.textContent).catch(() => null);
      if (reasoning) {
        console.log(`  Reasoning: ${reasoning}`);
      }
    }
  } else {
    console.log('Panel did not open — click may not have reached badge.');
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

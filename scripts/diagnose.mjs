/**
 * Diagnostic: tests the content script fetch path directly.
 *
 * 1. Launches Chrome with extension + user profile
 * 2. Reads stored API key from service worker
 * 3. Navigates to LinkedIn
 * 4. Verifies content script loaded (local badges appear)
 * 5. Sets provider=claude + apiKey in storage
 * 6. Reloads page so content script picks up Claude config
 * 7. Checks for Claude badges and captures console errors
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '..');
const chromeUserDataDir = path.join(
  process.env.HOME,
  'Library/Application Support/Google/Chrome'
);

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const INFO = '\x1b[36mINFO\x1b[0m';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== LAID Diagnostic ===\n');

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

  // --- Step 1: Find service worker and read storage ---
  console.log('--- Step 1: Extension + storage ---');
  let sw;
  for (const w of context.serviceWorkers()) {
    if (w.url().includes('service-worker')) { sw = w; break; }
  }
  if (!sw) {
    const p = await context.newPage();
    await p.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
    await sleep(3000);
    await p.close();
    for (const w of context.serviceWorkers()) {
      if (w.url().includes('service-worker')) { sw = w; break; }
    }
  }
  if (!sw) {
    console.log(`${FAIL} No service worker found`);
    return;
  }

  const extId = await sw.evaluate(() => chrome.runtime.id);
  console.log(`${PASS} Extension ID: ${extId}`);

  const storage = await sw.evaluate(() =>
    new Promise(r => chrome.storage.sync.get(null, r))
  );
  console.log(`${INFO} Storage:`, JSON.stringify(storage, null, 2));

  // Determine API key
  const apiKey = process.env.ANTHROPIC_API_KEY || storage.apiKey;
  if (!apiKey) {
    console.log(`${FAIL} No API key. Set ANTHROPIC_API_KEY env var or enter key in popup.`);
    await waitForClose(context);
    return;
  }
  console.log(`${PASS} API key: ${apiKey.substring(0, 12)}...`);

  // Set provider=claude and apiKey in storage
  await sw.evaluate((data) =>
    new Promise(r => chrome.storage.sync.set(data, r)),
    { provider: 'claude', apiKey }
  );
  console.log(`${PASS} Set provider=claude + apiKey in storage`);

  // --- Step 2: Navigate to LinkedIn ---
  console.log('\n--- Step 2: LinkedIn feed ---');
  const page = context.pages()[0] || await context.newPage();

  // Capture ALL console messages from the page
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (text.includes('[LAID]')) {
      console.log(`  ${INFO} [BROWSER] ${text}`);
    }
  });
  page.on('pageerror', err => {
    consoleLogs.push(`[pageerror] ${err.message}`);
  });

  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Handle login
  const feedOrLogin = await Promise.race([
    page.waitForSelector('.feed-shared-update-v2', { timeout: 60000 }).then(() => 'feed'),
    page.waitForSelector('#username, input[name="session_key"]', { timeout: 60000 }).then(() => 'login'),
  ]).catch(() => 'unknown');

  if (feedOrLogin === 'login') {
    console.log(`${INFO} Login required — please sign in manually...`);
    await page.waitForSelector('.feed-shared-update-v2', { timeout: 120000 });
  }
  console.log(`${PASS} Feed loaded`);

  // Scroll to load posts
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await sleep(1000);
  }

  // --- Step 3: Check for badges ---
  console.log('\n--- Step 3: Badge check ---');

  // Wait for either AI badges or loading badges
  try {
    await page.waitForSelector('.laid-badge', { timeout: 10000 });
  } catch {
    console.log(`${FAIL} No badges appeared at all within 10s`);
    console.log(`${INFO} Content script may not be running on this page`);
    dumpLogs(consoleLogs);
    await waitForClose(context);
    return;
  }

  // Check what kind of badges appeared
  const badges = await page.$$eval('.laid-badge', els =>
    els.map(el => ({
      classes: el.className,
      text: el.textContent,
      title: el.title,
      isLoading: el.classList.contains('laid-badge--loading'),
      isAI: el.classList.contains('laid-badge--ai'),
    }))
  );

  console.log(`${INFO} Found ${badges.length} badge(s):`);
  for (const b of badges) {
    const type = b.isLoading ? 'LOADING' : b.isAI ? 'AI' : 'HEURISTIC';
    console.log(`  [${type}] text="${b.text}" title="${b.title}"`);
  }

  const loadingBadges = badges.filter(b => b.isLoading);
  if (loadingBadges.length > 0) {
    console.log(`${INFO} ${loadingBadges.length} loading spinner(s) — waiting up to 30s for API responses...`);
    await sleep(15000);

    // Re-check
    const badgesAfter = await page.$$eval('.laid-badge', els =>
      els.map(el => ({
        classes: el.className,
        text: el.textContent,
        title: el.title,
        isLoading: el.classList.contains('laid-badge--loading'),
        isAI: el.classList.contains('laid-badge--ai'),
      }))
    );

    const aiCount = badgesAfter.filter(b => b.isAI).length;
    const stillLoading = badgesAfter.filter(b => b.isLoading).length;

    if (aiCount > 0) {
      console.log(`${PASS} ${aiCount} AI badge(s) appeared!`);
      for (const b of badgesAfter.filter(b => b.isAI)) {
        console.log(`  Score: ${b.text}% — ${b.title}`);
      }
    } else if (stillLoading > 0) {
      console.log(`${FAIL} Badges still loading after 15s — API might be slow or failing`);
    } else {
      console.log(`${FAIL} Loading spinners disappeared but no AI badges — API call returned null`);
    }
  }

  const heuristicBadges = badges.filter(b => !b.isLoading && !b.isAI);
  if (heuristicBadges.length > 0 && loadingBadges.length === 0) {
    console.log(`${FAIL} Only heuristic badges — provider may not be set to 'claude' in content script`);
  }

  // --- Step 4: Check network requests ---
  console.log('\n--- Step 4: Console/network analysis ---');
  const laidLogs = consoleLogs.filter(l => l.includes('[LAID]') || l.includes('anthropic'));
  if (laidLogs.length > 0) {
    console.log(`${INFO} LAID-related console output:`);
    for (const l of laidLogs) console.log(`  ${l}`);
  } else {
    console.log(`${INFO} No [LAID] console output captured`);
  }

  dumpLogs(consoleLogs);

  // Screenshot
  const screenshotPath = path.resolve(__dirname, 'diagnostic-screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\n${INFO} Screenshot: ${screenshotPath}`);

  console.log('\nBrowser open for inspection. Ctrl+C to exit.');
  await waitForClose(context);
}

function dumpLogs(logs) {
  const errors = logs.filter(l => l.includes('[error]') || l.includes('[pageerror]'));
  const warnings = logs.filter(l => l.includes('[warning]'));
  if (errors.length > 0) {
    console.log(`\n${FAIL} ${errors.length} error(s) in console:`);
    // Show unique errors only
    const unique = [...new Set(errors)].slice(0, 10);
    for (const e of unique) console.log(`  ${e}`);
  }
  if (warnings.length > 0) {
    console.log(`\n${INFO} ${warnings.length} warning(s) (showing first 5 unique):`);
    const unique = [...new Set(warnings)].slice(0, 5);
    for (const w of unique) console.log(`  ${w}`);
  }
}

function waitForClose(context) {
  return new Promise(resolve => {
    context.on('close', resolve);
    process.on('SIGINT', async () => {
      console.log('\nClosing...');
      await context.close().catch(() => {});
      resolve();
    });
  });
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

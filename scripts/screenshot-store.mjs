/**
 * Takes an anonymized screenshot of the LinkedIn feed with LAID badges.
 *
 * 1. Launches Chrome with the extension + user profile
 * 2. Navigates to LinkedIn feed, waits for posts and badges
 * 3. Replaces all profile photos with gray circles
 * 4. Replaces names and post text with fake content
 * 5. Takes a clean 1280x800 screenshot for Chrome Web Store
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const FAKE_NAMES = [
  'Alex Morgan', 'Jordan Chen', 'Sam Patel', 'Taylor Kim',
  'Robin Mueller', 'Casey Nakamura', 'Drew Campbell', 'Jamie Okoye',
];
const FAKE_TITLES = [
  'Product Manager at TechCorp',
  'Senior Engineer at CloudBase',
  'Marketing Director at GrowthLabs',
  'Data Scientist at AnalyticsHQ',
  'Founder & CEO at StartupX',
  'VP Engineering at ScaleSoft',
  'Head of Design at PixelCo',
  'Staff Engineer at DataStream',
];

async function main() {
  console.log('Launching Chrome with LAID extension...');

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
    viewport: { width: 1280, height: 800 },
  });

  const page = context.pages()[0] || await context.newPage();

  console.log('Navigating to LinkedIn feed...');
  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Handle login if needed
  const feedOrLogin = await Promise.race([
    page.waitForSelector('.feed-shared-update-v2', { timeout: 60000 }).then(() => 'feed'),
    page.waitForSelector('#username, input[name="session_key"]', { timeout: 60000 }).then(() => 'login'),
  ]).catch(() => 'unknown');

  if (feedOrLogin === 'login') {
    console.log('Login required — please sign in manually...');
    await page.waitForSelector('.feed-shared-update-v2', { timeout: 120000 });
  }

  console.log('Feed loaded. Scrolling to load posts...');
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(1500);
  }

  // Wait for badges to appear
  console.log('Waiting for LAID badges...');
  try {
    await page.waitForSelector('.laid-badge', { timeout: 15000 });
  } catch {
    console.log('No badges appeared — check extension is loaded.');
  }

  // Wait for loading spinners to resolve
  await sleep(8000);

  // Scroll to show 2-3 posts with badges visible
  // Find posts with badges and scroll to position the first one near the top
  await page.evaluate(() => {
    const badges = document.querySelectorAll('.laid-badge');
    if (badges.length > 0) {
      const firstBadge = badges[0];
      const post = firstBadge.closest('.feed-shared-update-v2');
      if (post) {
        const rect = post.getBoundingClientRect();
        window.scrollBy(0, rect.top - 80);
      }
    } else {
      window.scrollTo(0, 0);
    }
  });
  await sleep(1000);

  console.log('Anonymizing content...');
  await page.evaluate(({ names, titles }) => {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981', '#ef4444'];

    function makeSvgAvatar(size, initials, color) {
      return `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
        `<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${color}"/>` +
        `<text x="${size/2}" y="${size * 0.62}" text-anchor="middle" ` +
        `font-family="Arial" font-size="${size * 0.35}" fill="white" font-weight="600">` +
        `${initials}</text></svg>`
      )}`;
    }

    // 1. Replace ALL images that look like profile photos (broad selector)
    const allImgs = document.querySelectorAll('img');
    let avatarIdx = 0;
    allImgs.forEach(img => {
      const w = img.offsetWidth || img.width || 0;
      const h = img.offsetHeight || img.height || 0;
      // Profile photos are typically square-ish and small (24-100px)
      const isAvatar = (w > 20 && w < 120 && Math.abs(w - h) < 10) ||
        img.className.match(/avatar|photo|presence|EntityPhoto|member-photo/i) ||
        img.closest('[class*="actor__avatar"], [class*="identity"], [class*="member-photo"]');
      if (isAvatar) {
        const size = Math.max(w, h, 32);
        const initials = names[avatarIdx % names.length].split(' ').map(n => n[0]).join('');
        img.src = makeSvgAvatar(size, initials, colors[avatarIdx % colors.length]);
        avatarIdx++;
      }
    });

    // 2. Replace post author names — walk all text nodes inside actor containers
    const actorNames = document.querySelectorAll(
      '[class*="actor__name"], [class*="actor__title"] span'
    );
    let nameIdx = 0;
    actorNames.forEach(el => {
      // Find deepest text-containing span
      const spans = el.querySelectorAll('span');
      if (spans.length > 0) {
        spans.forEach(s => {
          if (s.children.length === 0 && s.textContent.trim().length > 0) {
            s.textContent = names[nameIdx % names.length];
            nameIdx++;
          }
        });
      } else if (el.textContent.trim().length > 0) {
        el.textContent = names[nameIdx % names.length];
        nameIdx++;
      }
    });

    // 3. Replace actor descriptions/subtitles
    const descEls = document.querySelectorAll(
      '[class*="actor__description"], [class*="actor__sub-description"]'
    );
    descEls.forEach((el, i) => {
      const spans = el.querySelectorAll('span');
      if (spans.length > 0) {
        spans.forEach(s => {
          if (s.children.length === 0 && s.textContent.trim().length > 1) {
            s.textContent = titles[i % titles.length];
          }
        });
      } else {
        el.textContent = titles[i % titles.length];
      }
    });

    // 4. Hide left sidebar entirely (contains real identity)
    const leftSidebar = document.querySelector('.scaffold-layout__sidebar');
    if (leftSidebar) leftSidebar.style.visibility = 'hidden';

    // Also hide the feed identity module specifically
    document.querySelectorAll('[class*="feed-identity"], [class*="identity-module"]').forEach(el => {
      el.style.visibility = 'hidden';
    });

    // 5. Hide right sidebar
    const rightSidebar = document.querySelector('.scaffold-layout__aside');
    if (rightSidebar) rightSidebar.style.display = 'none';

    // 6. Hide nav bar profile photo/name
    document.querySelectorAll(
      '[class*="global-nav__me"] img, [class*="nav-item__profile"] img'
    ).forEach(img => {
      img.src = makeSvgAvatar(28, 'U', '#6366f1');
    });

    // 7. Hide ALL elements between posts that contain real names
    // (follow suggestions, "X liked this", "X and Y follow Z", reaction attributions)
    // Use a broad text-content scan on small containers
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const el = walker.currentNode;
      const text = el.textContent || '';
      const cls = el.className || '';
      // Skip the main post text and badges
      if (el.closest('.feed-shared-update-v2__description, .feed-shared-text, .break-words, .laid-badge, .laid-panel')) continue;
      // Hide connection/follow/reaction attribution lines
      if (typeof cls === 'string' && (
        cls.match(/update-components-header|feed-shared-header|content-distribution/i) ||
        (text.match(/\b(follow|connection|liked|commented|reposted|celebrated)\b/i) &&
         el.offsetHeight < 40 && el.offsetHeight > 0)
      )) {
        el.style.visibility = 'hidden';
      }
    }

    // 8. Hide reaction attribution ("X and 4 others")
    document.querySelectorAll(
      '[class*="reactions-count"], [class*="social-counts"], ' +
      '[class*="social-details"], [class*="social-activity"]'
    ).forEach(el => {
      el.style.visibility = 'hidden';
    });

    // 9. Hide messaging widget
    document.querySelectorAll('[class*="msg-overlay"], [class*="messaging"]').forEach(el => {
      el.style.display = 'none';
    });

  }, { names: FAKE_NAMES, titles: FAKE_TITLES });

  await sleep(500);

  const screenshotPath = path.resolve(__dirname, '..', 'store-screenshot.png');
  await page.screenshot({ path: screenshotPath, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log(`Screenshot saved: ${screenshotPath}`);

  console.log('Browser open for inspection. Ctrl+C to exit.');
  await new Promise(resolve => {
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

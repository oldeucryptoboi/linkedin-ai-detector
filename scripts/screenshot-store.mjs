/**
 * Fully anonymized Chrome Web Store screenshot.
 *
 * Replaces ALL identifiable content: names, titles, post text,
 * shared articles, reposts, images, company names — everything.
 * Then clones posts so the extension re-analyzes the fake text.
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

const FAKE_POSTS = [
  // AI-like — should score RED
  `In today's rapidly evolving landscape, the intersection of AI and leadership has never been more critical. Let's dive in.

First, organizations need to leverage transformative technologies to stay ahead. Second, leaders must foster a culture of innovation that empowers teams. Third, the ability to navigate disruption is what separates good companies from great ones.

Moreover, the most successful leaders understand that digital transformation isn't just about technology — it's about mindset. Furthermore, building a robust ecosystem of stakeholders is essential for sustainable growth.

The question isn't whether AI will transform your industry. It's whether you'll be ready when it does.

What do you think? Drop a comment below.`,

  // Human-like — should score GREEN
  `shipped a side project last weekend. it's a chrome extension that spots AI-generated posts on linkedin

been noticing my feed is like 80% the same post rewritten slightly differently. "in today's rapidly evolving landscape" opener, three bullet points, "thoughts?" at the end. you know the ones

so I built a thing that checks for patterns like uniform sentence length, buzzword density, and those weird rhetorical hooks AI loves. runs entirely in your browser, no data sent anywhere

it's not perfect but it's fun watching the scores light up as you scroll. open source if anyone wants to poke at it`,

  // AI-like — should score RED/AMBER
  `The future of work isn't coming — it's already here. Here's what nobody talks about:

1. Remote work has fundamentally shifted the paradigm of organizational culture
2. Leaders who fail to adapt risk losing their best talent
3. The companies thriving are the ones that embrace flexibility

Additionally, research consistently demonstrates that empowered employees deliver superior outcomes. In fact, a recent study shows that organizations with strong alignment between leadership and workforce see 40% higher retention rates.

The bottom line? The question isn't whether to transform your workplace culture. It's how fast you can do it.

Agree or disagree? Let me know in the comments.`,

  // Human-like — should score GREEN
  `ok so I mass-applied to 47 jobs last month as an experiment. here's what actually happened:

- 23 never responded at all
- 12 sent automated rejections within 24hrs (one at 3am lol)
- 8 had me do a skills assessment
- 3 actual interviews
- 1 offer

the kicker? the offer came from the one company where I didn't use a template cover letter. I just wrote "hey I saw you're using postgres with redis for caching, I literally debugged that exact stack for 2 years at my last job, can we talk?"

idk what the takeaway is. maybe that being specific > being polished? or maybe I just got lucky`,

  // Mixed — should score AMBER
  `Something I've been thinking about a lot lately: we're training an entire generation of developers to be prompt engineers instead of problem solvers.

Don't get me wrong — AI tools are incredible. I use Copilot every day. But I've started noticing junior devs on my team who can't debug without asking ChatGPT first.

Moreover, the fundamentals still matter. Understanding how a database index works, why your API is slow, what happens when memory runs out — these aren't things you can outsource to an LLM.

Hot take: the best engineers in 5 years won't be the ones who are best at prompting. They'll be the ones who understand systems deeply enough to know when the AI is wrong.`,
];

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981', '#ef4444'];

function makeSvgAvatar(size, initials, color) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${color}"/>` +
    `<text x="${size/2}" y="${size * 0.62}" text-anchor="middle" ` +
    `font-family="Arial" font-size="${size * 0.35}" fill="white" font-weight="600">` +
    `${initials}</text></svg>`
  )}`;
}

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

  // Force local provider
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
  if (sw) {
    await sw.evaluate(() =>
      new Promise(r => chrome.storage.sync.set({ provider: 'local', enabled: true, sensitivity: 50 }, r))
    );
    console.log('Set provider=local, sensitivity=50');
  }

  const page = context.pages()[0] || await context.newPage();

  console.log('Navigating to LinkedIn feed...');
  await page.goto('https://www.linkedin.com/feed/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  const feedOrLogin = await Promise.race([
    page.waitForSelector('.feed-shared-update-v2', { timeout: 60000 }).then(() => 'feed'),
    page.waitForSelector('#username, input[name="session_key"]', { timeout: 60000 }).then(() => 'login'),
  ]).catch(() => 'unknown');

  if (feedOrLogin === 'login') {
    console.log('Login required — please sign in manually...');
    await page.waitForSelector('.feed-shared-update-v2', { timeout: 120000 });
  }

  console.log('Feed loaded. Scrolling...');
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(1500);
  }

  // Wait for initial badges so we know the extension is active
  try {
    await page.waitForSelector('.laid-badge', { timeout: 15000 });
  } catch {
    console.log('Warning: no initial badges detected');
  }
  await sleep(2000);

  // === ANONYMIZE EVERYTHING ===
  console.log('Anonymizing all content...');
  await page.evaluate(({ names, titles, posts, colors, makeSvg }) => {
    // Helper to make SVG data URIs in page context
    function avatar(size, initials, color) {
      return `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
        `<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${color}"/>` +
        `<text x="${size/2}" y="${size * 0.62}" text-anchor="middle" ` +
        `font-family="Arial" font-size="${size * 0.35}" fill="white" font-weight="600">` +
        `${initials}</text></svg>`
      )}`;
    }

    // ---- GLOBAL: Hide sidebars, messaging, nav identity ----

    // Left sidebar
    const left = document.querySelector('.scaffold-layout__sidebar');
    if (left) left.style.visibility = 'hidden';
    document.querySelectorAll('[class*="feed-identity"], [class*="identity-module"]').forEach(el => {
      el.style.visibility = 'hidden';
    });

    // Right sidebar
    const right = document.querySelector('.scaffold-layout__aside');
    if (right) right.style.display = 'none';

    // Messaging
    document.querySelectorAll('[class*="msg-overlay"], [class*="messaging"], [class*="msg-"]').forEach(el => {
      el.style.display = 'none';
    });

    // Nav profile photo
    document.querySelectorAll('[class*="global-nav__me"] img, [class*="nav-item__profile"] img').forEach(img => {
      img.src = avatar(28, 'U', '#6366f1');
    });

    // ---- Remove all existing badges ----
    document.querySelectorAll('.laid-badge, .laid-panel').forEach(el => el.remove());

    // ---- Process each post ----
    const postEls = [...document.querySelectorAll('.feed-shared-update-v2')];

    postEls.forEach((post, i) => {
      // === Replace ALL images in the post ===
      post.querySelectorAll('img').forEach(img => {
        const w = img.offsetWidth || img.width || 0;
        const h = img.offsetHeight || img.height || 0;
        const isSmall = w > 0 && w < 120 && h > 0 && h < 120;

        if (isSmall) {
          // Avatar-sized — replace with colored circle
          const size = Math.max(w, h, 32);
          const initials = names[i % names.length].split(' ').map(n => n[0]).join('');
          img.src = avatar(size, initials, colors[i % colors.length]);
        } else {
          // Large image (article preview, shared image) — replace with gray placeholder
          const pw = img.offsetWidth || 600;
          const ph = img.offsetHeight || 300;
          img.src = `data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}">` +
            `<rect width="${pw}" height="${ph}" fill="#e5e7eb"/>` +
            `</svg>`
          )}`;
        }
      });

      // === Replace post text ===
      if (i < posts.length) {
        const textEl = post.querySelector(
          '.feed-shared-inline-show-more-text, .feed-shared-update-v2__description, .feed-shared-text, .break-words'
        );
        if (textEl) {
          textEl.innerHTML = posts[i].split('\n').map(line =>
            line.trim() ? `<span dir="ltr">${line}</span>` : '<br>'
          ).join('');
        }
      }

      // === Replace author name (every span inside actor__name) ===
      post.querySelectorAll('[class*="actor__name"]').forEach(el => {
        const deepSpans = el.querySelectorAll('span');
        deepSpans.forEach(s => {
          if (s.children.length === 0 && s.textContent.trim().length > 0) {
            s.textContent = names[i % names.length];
          }
        });
        if (deepSpans.length === 0 && el.textContent.trim()) {
          el.textContent = names[i % names.length];
        }
      });

      // === Replace author title/description ===
      post.querySelectorAll('[class*="actor__description"], [class*="actor__sub-description"]').forEach(el => {
        const spans = el.querySelectorAll('span');
        spans.forEach(s => {
          if (s.children.length === 0 && s.textContent.trim().length > 1) {
            s.textContent = titles[i % titles.length];
          }
        });
        if (spans.length === 0 && el.textContent.trim()) {
          el.textContent = titles[i % titles.length];
        }
      });

      // === Hide shared article / document previews ===
      post.querySelectorAll(
        '[class*="article-card"], [class*="external-video"], [class*="mini-update"], ' +
        '[class*="document-card"], [class*="carousel"], [class*="poll"]'
      ).forEach(el => { el.style.display = 'none'; });

      // === Hide "See more" buttons ===
      post.querySelectorAll('[class*="see-more"], [class*="show-more"]').forEach(el => {
        el.style.display = 'none';
      });

      // === Replace repost header ("X reposted") ===
      post.querySelectorAll('[class*="update-components-header"], [class*="feed-shared-header"]').forEach(el => {
        const spans = el.querySelectorAll('span');
        spans.forEach(s => {
          if (s.children.length === 0 && s.textContent.trim().length > 0) {
            const text = s.textContent.trim();
            if (text.match(/reposted|liked|celebrated|commented|follow/i)) {
              s.textContent = names[(i + 3) % names.length] + ' reposted';
            } else if (!text.match(/^\d|^·|^hr|^min|^sec|^1st|^2nd|^3rd|^ago/i)) {
              // Looks like a name
              s.textContent = names[(i + 3) % names.length];
            }
          }
        });
      });

      // === Hide social counts / reactions / "X and 4 others" ===
      post.querySelectorAll(
        '[class*="social-counts"], [class*="social-details"], ' +
        '[class*="reactions-count"], [class*="social-activity"]'
      ).forEach(el => { el.style.visibility = 'hidden'; });

      // === Replace article link titles ===
      post.querySelectorAll(
        '[class*="article"] [class*="title"], [class*="article"] h3, ' +
        '[class*="update-components-text"] a'
      ).forEach(el => {
        el.textContent = '';
      });

      // === Hide promoted label / company names ===
      post.querySelectorAll('[class*="promoted"], [class*="ad-banner"]').forEach(el => {
        el.style.display = 'none';
      });

      // === Hide "+ Follow" buttons (they appear on promoted/suggested posts) ===
      post.querySelectorAll('[class*="follow-button"], button[aria-label*="Follow"]').forEach(el => {
        el.style.display = 'none';
      });
    });

    // ---- Global: hide anything between posts with real names ----
    // (connection notifications, "X and Y follow Z", etc.)
    document.querySelectorAll(
      '[class*="content-distribution"], [class*="feed-follows-module"], ' +
      '[class*="feed-new-update-pill"]'
    ).forEach(el => { el.style.display = 'none'; });

  }, { names: FAKE_NAMES, titles: FAKE_TITLES, posts: FAKE_POSTS, colors: COLORS });

  // === Clone posts to escape WeakSet — extension will re-process ===
  console.log('Cloning posts for re-scan...');
  await page.evaluate(() => {
    document.querySelectorAll('.feed-shared-update-v2').forEach(post => {
      const parent = post.parentNode;
      if (!parent) return;
      const clone = post.cloneNode(true);
      parent.replaceChild(clone, post);
    });
  });

  console.log('Waiting for badges on fake content...');
  await sleep(8000);

  // Scroll to first badge
  await page.evaluate(() => {
    const badges = document.querySelectorAll('.laid-badge');
    if (badges.length > 0) {
      const post = badges[0].closest('.feed-shared-update-v2');
      if (post) {
        const rect = post.getBoundingClientRect();
        window.scrollBy(0, rect.top - 60);
      }
    }
  });
  await sleep(1000);

  // Log results
  const badges = await page.$$eval('.laid-badge', els =>
    els.map(el => ({ text: el.textContent, title: el.title }))
  );
  console.log(`Found ${badges.length} badge(s):`);
  for (const b of badges) {
    console.log(`  Score: ${b.text}% — ${b.title}`);
  }

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

// Design audit harness: walks the core paths at desktop / tablet / phone widths, saves
// screenshots and reports correctness-floor measurements (overflow, small targets, focus trap).
// Usage: node scripts/design-audit.mjs <label> [baseUrl]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const label = process.argv[2] ?? 'run';
const base = process.argv[3] ?? 'http://localhost:3000';
const out = `screenshots/design-audit/${label}`;
mkdirSync(out, { recursive: true });

const VIEWPORTS = { desktop: [1440, 900], tablet: [768, 1024], phone: [390, 844] };
const findings = [];

const measure = (page) =>
  page.evaluate(() => {
    const small = [];
    for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]):not(.hidden), select, [role=button]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 24 || r.width < 24) small.push(`${(el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const unlabeled = [...document.querySelectorAll('button, a[href], input:not(.hidden), select')].filter(
      (el) => !(el.getAttribute('aria-label') || el.textContent.trim() || el.getAttribute('title') || el.labels?.length),
    ).length;
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      smallTargets: small,
      unlabeled,
    };
  });

async function shot(page, name, vp) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}-${vp}.png` });
  findings.push({ page: name, viewport: vp, ...(await measure(page)) });
}

const browser = await chromium.launch({ channel: 'chrome' });
for (const [vp, [width, height]] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: vp !== 'desktop' });
  const page = await ctx.newPage();
  await page.goto(`${base}/login`);
  await page.getByRole('button', { name: /Alice/ }).waitFor();
  await shot(page, 'login', vp);
  await page.getByRole('button', { name: /Alice/ }).click();
  await page.getByRole('button', { name: /New document/ }).waitFor();
  await shot(page, 'home', vp);
  await page.locator('a[href^="/docs/"]').first().click();
  await page.locator('.tiptap').waitFor();
  await page.waitForTimeout(1200);
  await shot(page, 'editor', vp);

  // Share dialog: screenshot + focus trap + focus return.
  const shareBtn = page.getByRole('button', { name: /^Share$/ });
  await shareBtn.click();
  await page.getByRole('dialog').waitFor();
  await shot(page, 'share', vp);
  let escaped = false;
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    if (!(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')))) escaped = true;
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const returned = await page.evaluate(() => /Share/.test(document.activeElement?.textContent ?? ''));
  findings.push({ page: 'share', viewport: vp, focusTrapHolds: !escaped, focusReturns: returned });

  // History.
  const more = page.getByRole('button', { name: 'More actions' });
  if (await more.count()) {
    await more.click();
    await shot(page, 'more-menu', vp);
    await page.getByRole('menuitem', { name: /history/i }).click();
  } else {
    await page.getByRole('button', { name: 'History' }).click();
  }
  await page.locator('[aria-label="Version history"]').waitFor();
  await page.waitForTimeout(1500);
  const first = page.locator('[aria-label="Version history"] li button').first();
  if (await first.count()) await first.click();
  await page.waitForTimeout(1200);
  await shot(page, 'history', vp);
  await page.keyboard.press('Escape');

  if (vp === 'desktop') {
    // 200% text zoom (rem-based UI scales with root font size).
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await shot(page, 'editor-zoom200', vp);
    await page.goto(`${base}/`);
    await page.getByRole('button', { name: /New document/ }).waitFor();
    await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await shot(page, 'home-zoom200', vp);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}/findings.json`, JSON.stringify(findings, null, 1));
for (const f of findings) {
  const { page, viewport, ...rest } = f;
  console.log(`${page.padEnd(16)} ${viewport.padEnd(8)} ${JSON.stringify(rest)}`);
}

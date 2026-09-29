const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

// Run against the local preview server. Reuse the SAME page between sizes:
// this catches resize regressions that fresh-page screenshots can conceal.
const origin = process.env.HERO_PREVIEW_URL || 'http://127.0.0.1:4173';
const output = path.resolve(__dirname, '../.artifacts/hero');
const sizes = [
  [1512, 909], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1536, 864],
  [1920, 1080], [1920, 900], [2560, 1440], [3440, 1440], [1920, 600], [1377, 769],
  [1512, 909],
];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
    args: ['--mute-audio'],
  });
  const results = [];
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      // Deliberately test with external font/media services unavailable.
      if (request.url().startsWith(origin) || request.url().startsWith('data:')) request.continue();
      else request.abort();
    });
    await page.setViewport({ width: 1512, height: 909 });
    await page.goto(`${origin}/duckpeon_latest.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('ready') && !document.getElementById('loader'));
    await page.evaluate(() => document.fonts.ready);

    for (let index = 0; index < sizes.length; index++) {
      const [width, height] = sizes[index];
      await page.setViewport({ width, height });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      // Allow Chromium's resized image raster to reach the compositor too.
      await new Promise(resolve => setTimeout(resolve, 250));
      const geometry = await page.evaluate(() => {
        const rect = selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
        };
        const image = document.getElementById('hero-img');
        return {
          hero: rect('.hero'), art: rect('.hero-media'), image: rect('#hero-img'), title: rect('.hero-hl'),
          mark: rect('.hero-wordmark'), socials: rect('.hdr-social'),
          heroScrollWidth: document.querySelector('.hero').scrollWidth,
          fontLoaded: document.fonts.check('600 88px "Inter Tight Local"'),
          imageLoaded: image.complete && image.naturalWidth === 4381,
          imagePosition: getComputedStyle(image).objectPosition,
          markRatio: getComputedStyle(document.querySelector('.hero-wordmark')).aspectRatio,
        };
      });
      assert.equal(geometry.hero.height, height, `${width}×${height}: hero must fill the viewport`);
      assert.equal(geometry.heroScrollWidth, width, `${width}×${height}: hero horizontal overflow`);
      assert(geometry.fontLoaded && geometry.imageLoaded, 'Local font and original artwork must load');
      assert.equal(geometry.imagePosition, '50% 85%', 'The artwork crop must remain stable after resizing');
      assert(Math.abs(geometry.image.height - (geometry.art.height - 3)) < 1,
        `${width}×${height}: image must fill the frame before object-fit crops it`);
      assert(Math.abs(geometry.mark.width - width) < 1, 'Wordmark must span both side borders');
      assert(Math.abs(geometry.mark.bottom - geometry.art.bottom - 1) < 1, 'Wordmark must overlap the cream footer by one pixel');
      assert(geometry.title.bottom < geometry.mark.y, `${width}×${height}: title overlaps wordmark`);
      assert(geometry.socials.right <= width && geometry.socials.y > 0, 'Social links must remain inside the frame');
      assert.equal(geometry.markRatio, '1512 / 188', 'Wordmark must scale without stretching');
      const filename = `${width}x${height}${index === sizes.length - 1 ? '-resized-back' : ''}.png`;
      const shot = await page.screenshot({ path: path.join(output, filename), encoding: 'base64', captureBeyondViewport: false });
      const seams = await page.evaluate(async ({ shot, geometry }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${shot}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const cream = (x, y) => {
          const [r, g, b] = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
          return r === 244 && g === 238 && b === 227;
        };
        const joinY = geometry.mark.y + geometry.mark.height * .3;
        const footerY = Math.ceil(geometry.art.bottom) + 2;
        let footerSolid = true;
        for (let x = 0; x < image.width; x++) {
          if (!cream(x, footerY)) { footerSolid = false; break; }
        }
        return {
          leftJoined: cream(geometry.art.x + 4, joinY),
          rightJoined: cream(geometry.art.right - 4, joinY),
          footerSolid,
        };
      }, { shot, geometry });
      assert(seams.leftJoined && seams.rightJoined && seams.footerSolid,
        `${width}×${height}: visible gap between lettering and frame`);
      results.push({ width, height, ...geometry });
    }

    // Both existing entry pages use the same desktop composition.
    await page.goto(`${origin}/duckpeon.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('ready') && !document.getElementById('loader'));
    await page.evaluate(() => document.fonts.ready);
    assert(await page.$eval('#hero-img', img => img.currentSrc.endsWith('/hero_art_full.png')));
    await page.screenshot({ path: path.join(output, 'duckpeon-entry.png') });

    // Fractional display scaling and Retina render the same CSS geometry.
    for (const deviceScaleFactor of [1.25, 2]) {
      await page.setViewport({ width: 1512, height: 909, deviceScaleFactor });
      await page.screenshot({ path: path.join(output, `1512x909-dpr-${deviceScaleFactor}.png`) });
      assert.equal(await page.$eval('.hero-wordmark', el => el.getBoundingClientRect().width), 1512);
    }

    // The existing smaller-screen branch remains available after a live resize.
    await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 });
    assert.equal(await page.$eval('.hero-wordmark', el => getComputedStyle(el).display), 'none');
    await page.setViewport({ width: 1512, height: 909 });
    assert.equal(await page.$eval('.hero-wordmark', el => getComputedStyle(el).display), 'block');
    assert.deepEqual(errors, [], 'Unexpected browser errors');
    fs.writeFileSync(path.join(output, 'geometry.json'), JSON.stringify(results, null, 2));
    console.log(`PASS: ${sizes.length} desktop resize/seam checks, both entry pages, 1.25×/2× displays, external services blocked.`);
    console.log(`Screenshots: ${output}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

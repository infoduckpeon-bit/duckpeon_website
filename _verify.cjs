/* Self-verification: drive the entry transition with wheel events in
   headless Edge and dump a frame sequence to inspect continuity. */
const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--window-size=1280,820', '--disable-gpu-vsync', '--mute-audio'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // block heavy external media so load is fast and deterministic
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.includes('mux.com') || u.includes('picsum.photos')) req.abort();
    else req.continue();
  });

  await page.goto('file:///E:/duckpeon/work3_improved.html', { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500)); // let init + fonts settle

  // position page so the services container top sits exactly one viewport below
  await page.evaluate(() => {
    const c = document.getElementById('services-scroll-container');
    window.scrollTo({ top: c.offsetTop + c.getBoundingClientRect().top + window.scrollY - window.innerHeight - (c.getBoundingClientRect().top + window.scrollY - c.offsetTop), behavior: 'instant' });
    // simpler & robust:
    const top = c.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top - window.innerHeight, behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 800));

  fs.mkdirSync('E:/duckpeon/_vframes', { recursive: true });
  let shot = 0;
  const snap = async () => page.screenshot({ path: `E:/duckpeon/_vframes/v${String(shot++).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 70 });

  // steady continuous wheel-down gesture: 36 notches, frame every 2 notches
  await page.mouse.move(640, 400);
  for (let i = 0; i < 36; i++) {
    await page.mouse.wheel({ deltaY: 120 });
    await new Promise(r => setTimeout(r, 90));
    if (i % 2 === 0) await snap();
  }
  // let momentum settle, capture tail
  for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 250)); await snap(); }

  // diagnostic numbers
  const diag = await page.evaluate(() => {
    const c = document.getElementById('services-scroll-container');
    return { secTop: c.getBoundingClientRect().top, scrollY: window.scrollY,
             counter: document.getElementById('svc-counter')?.textContent };
  });
  console.log('DIAG', JSON.stringify(diag));

  await browser.close();
  console.log('frames:', shot);
})().catch(e => { console.error(e); process.exit(1); });

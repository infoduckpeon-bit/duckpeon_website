/* Verify the entry transition in work3_transition_fix.html:
   steady wheel gesture, frame per notch through the entry zone. */
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

  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.includes('mux.com') || u.includes('picsum.photos')) req.abort();
    else req.continue();
  });

  await page.goto('file:///E:/duckpeon/work3_transition_fix.html', { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));

  await page.evaluate(() => {
    const c = document.getElementById('services-scroll-container');
    const top = c.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top - window.innerHeight, behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 800));

  fs.mkdirSync('E:/duckpeon/_vframes_fix', { recursive: true });
  let shot = 0;
  const snap = async () => page.screenshot({ path: `E:/duckpeon/_vframes_fix/f${String(shot++).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 70 });

  await page.mouse.move(640, 400);
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel({ deltaY: 120 });
    await new Promise(r => setTimeout(r, 110));
    await snap();
  }
  for (let i = 0; i < 8; i++) { await new Promise(r => setTimeout(r, 250)); await snap(); }

  const diag = await page.evaluate(() => {
    const c = document.getElementById('services-scroll-container');
    return { secTop: c.getBoundingClientRect().top, scrollY: window.scrollY,
             counter: document.getElementById('svc-counter')?.textContent };
  });
  console.log('DIAG', JSON.stringify(diag));

  await browser.close();
  console.log('frames:', shot);
})().catch(e => { console.error(e); process.exit(1); });

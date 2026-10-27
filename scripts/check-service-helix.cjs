// Scroll/state checks with DOM doubles; visual pinning requires a browser check.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'duckpeon_latest.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'asset/services/service-helix.js'), 'utf8');

class Element {
  constructor(text = '') {
    this.textContent = text;
    this.attrs = {};
    this.dataset = {};
    this.children = [];
    this.queries = {};
    this.listeners = {};
    this.style = { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key.startsWith('--') ? key : key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; } };
    const classes = new Set();
    this.classList = {
      add: name => classes.add(name), remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle: (name, state) => state ? classes.add(name) : classes.delete(name),
    };
  }
  querySelector(selector) { return this.queries[selector]; }
  querySelectorAll(selector) { return this.queries[selector] || []; }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key]; }
  removeAttribute(key) { delete this.attrs[key]; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  dispatch(type, payload = {}) {
    const event = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...payload };
    (this.listeners[type] || []).forEach(handler => handler(event));
    return event;
  }
  setPointerCapture(id) { this.capture = id; }
  hasPointerCapture(id) { return this.capture === id; }
  releasePointerCapture() { this.capture = null; }
}

const decode = text => text.replaceAll('&amp;', '&');
const cards = [...html.matchAll(/<article class="helix-card[^>]+>([\s\S]*?)<\/article>/g)].map(match => {
  const card = new Element();
  const content = match[1];
  card.queries['.helix-card__name'] = new Element(decode(content.match(/class="helix-card__name">(.*?)<\/span>/)[1]));
  card.queries['.helix-card__info p'] = new Element(decode(content.match(/<p>(.*?)<\/p>/)[1]));
  card.queries['.helix-card__info li'] = [...content.matchAll(/<li>(.*?)<\/li>/g)].map(m => new Element(decode(m[1])));
  assert(!content.includes('<button'), 'The scroll branch has no manual card buttons');
  return card;
});
assert.equal(cards.length, 6);
const section = new Element(), track = new Element(), pin = new Element(), space = new Element(), indexList = new Element(), detail = new Element();
space.clientWidth = 900; space.clientHeight = 550;
for (const selector of ['.helix-detail__index', 'h3', '.helix-detail__description', '.helix-detail__tags']) detail.queries[selector] = new Element();
const progress = new Element(), fill = new Element(), hint = new Element();
progress.queries.span = fill;
Object.assign(section.queries, { '.helix-track': track, '.helix-pin': pin, '.helix-space': space, '.helix-card': cards, '.helix-index': indexList, '.helix-detail': detail, '.helix-position': new Element(), '.helix-progress': progress, '#helix-hint': hint });
const document = new Element(), window = new Element(), preference = new Element();
document.queries['.services--helix'] = section;
document.createElement = () => new Element();
document.hidden = false;
window.scrollY = 0; window.innerHeight = 900;
const sectionTop = 4000;
track.getBoundingClientRect = () => ({ top: sectionTop - window.scrollY });
preference.matches = true;
const pending = new Map();
let frameId = 0, time = 0, intersection, resize, lastScrollRequest;
const to = top => { lastScrollRequest = top; window.scrollY = top; window.dispatch('scroll'); };
vm.runInNewContext(script, {
  document, window, Scroll: { to }, matchMedia: () => preference, CSS: { supports: () => true },
  requestAnimationFrame: callback => { pending.set(++frameId, callback); return frameId; },
  cancelAnimationFrame: id => pending.delete(id),
  IntersectionObserver: class { constructor(callback) { intersection = callback; } observe() {} },
  ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} },
});
const flush = () => {
  for (let i = 0; pending.size && i < 10; i++) {
    const jobs = [...pending.values()]; pending.clear(); time += 16;
    jobs.forEach(callback => callback(time));
  }
  assert.equal(pending.size, 0, 'No perpetual rendering when scrolling stops');
};
const checkSelected = index => {
  assert.equal(section.dataset.activeService, String(index));
  assert.equal(detail.queries.h3.textContent, cards[index].queries['.helix-card__name'].textContent);
  assert.equal(detail.queries['.helix-detail__description'].textContent, cards[index].queries['.helix-card__info p'].textContent);
  assert.equal(indexList.children.filter(item => item.attrs['aria-current'] === 'true').length, 1);
};
const travel = () => Number.parseFloat(section.style['--helix-travel']);
const scroll = y => { to(y); flush(); };
const cardY = index => sectionTop - window.innerHeight * .65 + index / 5 * (travel() + window.innerHeight * .95);
assert.equal(indexList.children.length, 6);
assert.equal(section.dataset.scrollPhase, 'before');
checkSelected(0);
intersection([{ isIntersecting: true }]); flush();
scroll(sectionTop); checkSelected(1);
assert.equal(section.dataset.scrollPhase, 'pinned');
assert(Number(progress.attrs['aria-valuenow']) > 10, 'The actual show must already be advancing when the scene pins');
assert(Number(cards[0].style.transform.match(/rotateY\(([-\d.]+)deg\)/)[1]) > 10, 'Do not settle the first card at zero rotation on pin entry');
for (let i = 0; i < 6; i++) { scroll(cardY(i)); checkSelected(i); }
// Rotation must respond throughout each transition, without the old dead zones.
let lastTransform;
for (let step = 1.02; step < 1.98; step += .04) {
  scroll(cardY(step));
  const transform = cards[1].style.transform;
  assert.notEqual(transform, lastTransform, 'Continuous scrolling should continuously rotate the helix');
  lastTransform = transform;
}
scroll(sectionTop);
assert(cards.filter(card => Number(card.style.opacity) > .1).length >= 5, 'Preserve the surrounding card arrangement at the first service');
scroll(sectionTop + travel()); checkSelected(5);
assert(Number(progress.attrs['aria-valuenow']) < 100, 'Keep the show moving through the release');
assert.equal(section.dataset.scrollPhase, 'leaving');
scroll(sectionTop + travel() + 400); checkSelected(5);
assert(hint.textContent.includes('continue'));
// The service sequence itself advances during entrance, not just a settling pose.
scroll(sectionTop - window.innerHeight * .4); checkSelected(0);
const entrancePose = cards[0].style.transform;
assert.equal(section.dataset.scrollPhase, 'entering');
scroll(sectionTop - window.innerHeight * .1); checkSelected(1);
assert.notEqual(cards[0].style.transform, entrancePose);
scroll(sectionTop + travel() + window.innerHeight * .1); checkSelected(5);
const exitPose = cards[5].style.transform;
scroll(sectionTop + travel() + window.innerHeight * .25); checkSelected(5);
assert.equal(section.dataset.scrollPhase, 'leaving');
assert.notEqual(cards[5].style.transform, exitPose);
// Speed remains continuous across both pin boundaries (including rounding).
for (const [boundary, cardIndex] of [[sectionTop, 0], [sectionTop + travel(), 5]]) {
  const poses = [-12, 0, 12].map(offset => {
    scroll(boundary + offset);
    return Number(cards[cardIndex].style.transform.match(/rotateY\(([-\d.]+)deg\)/)[1]);
  });
  const arrivingSpeed = (poses[1] - poses[0]) / 12;
  const leavingSpeed = (poses[2] - poses[1]) / 12;
  assert(arrivingSpeed > 0 && leavingSpeed > 0);
  assert(Math.abs(arrivingSpeed - leavingSpeed) / arrivingSpeed < .12, 'No rotation-speed jump at the pin boundary');
}
scroll(sectionTop - window.innerHeight);
assert.equal(section.dataset.scrollPhase, 'before');
scroll(sectionTop + travel() + window.innerHeight);
assert.equal(section.dataset.scrollPhase, 'after');
// Reenter from below, traverse all services in reverse, then release above.
for (let i = 5; i >= 0; i--) { scroll(cardY(i)); checkSelected(i); }
scroll(sectionTop - 200); checkSelected(1);
assert.equal(section.dataset.scrollPhase, 'entering');
assert(Number(progress.attrs['aria-valuenow']) > 0);
assert.equal(window.listeners.wheel, undefined, 'The helix must not trap wheel input');
assert.equal(space.listeners.pointerdown, undefined, 'No manual drag controller remains');
// Native keyboard gestures are translated through the existing page scroll engine.
scroll(sectionTop);
assert(space.dispatch('keydown', { key: 'End' }).prevented); flush(); checkSelected(5);
assert.equal(lastScrollRequest, sectionTop + travel() + window.innerHeight * .3);
space.dispatch('keydown', { key: 'ArrowDown' }); flush();
assert(lastScrollRequest > sectionTop + travel(), 'Keyboard can exit below the last card');
space.dispatch('keydown', { key: 'Home' }); flush(); checkSelected(0);
space.dispatch('keydown', { key: 'ArrowUp' }); flush();
assert(lastScrollRequest < sectionTop, 'Keyboard can exit above the first card');
assert(!space.dispatch('keydown', { key: 'Tab' }).prevented, 'Never trap focus');
assert(!space.dispatch('keydown', { key: 'Home', ctrlKey: true }).prevented);
// Stop animation work outside the section or when the document is hidden.
intersection([{ isIntersecting: false }]); to(cardY(2)); assert.equal(pending.size, 0);
intersection([{ isIntersecting: true }]); flush(); checkSelected(2);
document.hidden = true; document.dispatch('visibilitychange'); to(cardY(4));
assert.equal(pending.size, 0);
document.hidden = false; document.dispatch('visibilitychange'); flush(); checkSelected(4);
// Narrow, short, or reduced-motion viewports return to the complete static list.
preference.matches = false; preference.dispatch('change');
assert(!section.classList.contains('helix-enabled'));
assert.equal(section.style['--helix-travel'], undefined);
assert.equal(space.tabIndex, -1);
cards.forEach(card => {
  assert.equal(card.style.transform, undefined);
  assert.equal(card.attrs['aria-hidden'], undefined);
});
preference.matches = true; preference.dispatch('change'); flush(); checkSelected(4);
for (const [width, height] of [[490, 700], [720, 768], [900, 900], [1300, 1200]]) {
  space.clientWidth = width; window.innerHeight = height; resize();
  scroll(cardY(3)); checkSelected(3);
  cards.forEach(card => {
    assert(!/NaN|Infinity/.test(card.style.transform));
    assert(Number(card.style.opacity) >= 0 && Number(card.style.opacity) <= 1);
  });
}
// Fit both dimensions of real-world stage sizes, not just viewport width.
// The longest title uses two lines: allow 365 design pixels for its full card.
let previousCardWidth = 0;
const scaleResults = [];
for (const [width, height] of [[560, 500], [860, 580], [1260, 880], [1900, 1200]]) {
  space.clientWidth = width; space.clientHeight = height; resize();
  const scale = Number(space.style['--helix-scene-scale']);
  const projection = 1100 / (1100 - 45);
  const cardWidth = 400 * scale * projection;
  const cardHeight = 365 * scale * projection;
  assert(cardWidth > previousCardWidth, 'Cards must keep growing on larger monitors');
  assert(cardWidth < width * .55, 'Leave horizontal clearance for the neighboring cards');
  assert(cardHeight < height * .65, 'Keep the complete foreground card inside the laptop stage');
  previousCardWidth = cardWidth;
  scaleResults.push({ stage: `${width}x${height}`, foregroundWidth: Math.round(cardWidth) });
}
assert(previousCardWidth > 700, 'Large displays should no longer hit the old 420px cap');
console.log('Responsive geometry:', JSON.stringify(scaleResults));
console.log('PASS: all six services forward/backward, endpoint release, keyboard escape, no wheel/drag trap, visibility suspension, static fallback, resize progress.');
console.log('These checks cover scroll logic; browser visual verification is separate.');

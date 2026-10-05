// Interaction checks with small DOM/observer doubles; no browser rendering claims.
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
    this.style = { removeProperty(key) { delete this[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; } };
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
  card.queries['.helix-card__pick'] = new Element();
  card.queries['.helix-card__name'] = new Element(decode(content.match(/class="helix-card__name">(.*?)<\/span>/)[1]));
  card.queries['.helix-card__info p'] = new Element(decode(content.match(/<p>(.*?)<\/p>/)[1]));
  card.queries['.helix-card__info li'] = [...content.matchAll(/<li>(.*?)<\/li>/g)].map(m => new Element(decode(m[1])));
  assert(content.includes(' disabled>'), 'Cards remain noninteractive without JavaScript');
  return card;
});
assert.equal(cards.length, 6);
const section = new Element(), space = new Element(), nav = new Element(), detail = new Element();
space.clientWidth = 900; space.clientHeight = 680;
for (const selector of ['.helix-detail__index', 'h3', '.helix-detail__description', '.helix-detail__tags']) detail.queries[selector] = new Element();
const previous = new Element(), next = new Element();
previous.dataset.helixStep = '-1'; next.dataset.helixStep = '1';
Object.assign(section.queries, { '.helix-space': space, '.helix-card': cards, '.helix-nav': nav, '.helix-detail': detail, '.helix-position': new Element(), '[data-helix-step]': [previous, next] });
const document = new Element(), window = new Element(), preference = new Element();
document.queries['.services--helix'] = section;
document.createElement = () => new Element();
document.hidden = false;
preference.matches = true;
const pending = new Map(), timers = [];
let frameId = 0, time = 0, intersection, resize;
vm.runInNewContext(script, {
  document, window, matchMedia: () => preference, CSS: { supports: () => true },
  requestAnimationFrame: callback => { pending.set(++frameId, callback); return frameId; },
  cancelAnimationFrame: id => pending.delete(id), setTimeout: callback => timers.push(callback),
  IntersectionObserver: class { constructor(callback) { intersection = callback; } observe() {} },
  ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} },
});
const flush = () => {
  for (let i = 0; pending.size && i < 240; i++) {
    const jobs = [...pending.values()]; pending.clear(); time += 16;
    jobs.forEach(callback => callback(time));
  }
  assert.equal(pending.size, 0, 'Animation must settle instead of running indefinitely');
};
const checkSelected = index => {
  assert.equal(section.dataset.activeService, String(index));
  assert.equal(detail.queries.h3.textContent, cards[index].queries['.helix-card__name'].textContent);
  assert.equal(detail.queries['.helix-detail__description'].textContent, cards[index].queries['.helix-card__info p'].textContent);
  assert.equal(nav.children.filter(button => button.attrs['aria-pressed'] === 'true').length, 1);
};
intersection([{ isIntersecting: true }]); flush(); checkSelected(0);
assert.equal(nav.children.length, 6);
for (let i = 1; i <= 6; i++) { next.dispatch('click'); flush(); checkSelected(i % 6); }
previous.dispatch('click'); flush(); checkSelected(5);
nav.children[2].dispatch('click'); flush(); checkSelected(2);
assert(space.dispatch('keydown', { key: 'End' }).prevented); flush(); checkSelected(5);
space.dispatch('keydown', { key: 'Home' }); flush(); checkSelected(0);
assert(!space.dispatch('keydown', { key: 'ArrowDown' }).prevented, 'Vertical page navigation stays native');
space.dispatch('keydown', { key: 'ArrowLeft' }); flush(); checkSelected(5);
space.dispatch('keydown', { key: 'ArrowRight' }); flush(); checkSelected(0);
// A horizontal drag advances a card; its synthetic click must not select the old card.
space.dispatch('pointerdown', { pointerId: 1, button: 0, isPrimary: true, clientX: 400 });
space.dispatch('pointermove', { pointerId: 1, clientX: 150 }); flush();
space.dispatch('pointerup', { pointerId: 1 }); flush(); checkSelected(1);
assert(space.dispatch('click').prevented, 'Suppress click after dragging');
timers.splice(0).forEach(callback => callback());
assert(!space.dispatch('click').prevented, 'Do not swallow subsequent genuine clicks');
// Rendering pauses when offscreen and resumes on reentry.
intersection([{ isIntersecting: false }]); next.dispatch('click');
assert.equal(pending.size, 0);
intersection([{ isIntersecting: true }]); flush(); checkSelected(2);
document.hidden = true; document.dispatch('visibilitychange'); next.dispatch('click');
assert.equal(pending.size, 0);
document.hidden = false; document.dispatch('visibilitychange'); flush(); checkSelected(3);
// Motion/width changes remove every transform and expose the complete service copy.
preference.matches = false; preference.dispatch('change');
assert(!section.classList.contains('helix-enabled'));
cards.forEach(card => {
  assert.equal(card.style.transform, undefined);
  assert.equal(card.attrs['aria-hidden'], undefined);
  assert.equal(card.queries['.helix-card__pick'].disabled, true);
});
preference.matches = true; preference.dispatch('change'); flush(); checkSelected(3);
for (const width of [490, 720, 900, 1300]) {
  space.clientWidth = width; resize();
  cards.forEach(card => {
    assert(!/NaN|Infinity/.test(card.style.transform));
    assert(Number(card.style.opacity) >= 0 && Number(card.style.opacity) <= 1);
  });
}
console.log('PASS: all six services, next/previous wraparound, direct selection, keyboard, drag, offscreen suspension, motion/width fallback, resize geometry.');
console.log('These checks cover interaction logic; browser visual verification is separate.');

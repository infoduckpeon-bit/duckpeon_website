/* Finite, scroll-driven helix. CSS sticky holds the scene; no wheel trap is added. */
(() => {
  'use strict';
  const section = document.querySelector('.services--helix');
  if (!section) return;
  const pin = section.querySelector('.helix-pin');
  const track = section.querySelector('.helix-track');
  const space = section.querySelector('.helix-space');
  const cards = [...section.querySelectorAll('.helix-card')];
  const indexList = section.querySelector('.helix-index');
  const detail = section.querySelector('.helix-detail');
  const progressBar = section.querySelector('.helix-progress');
  const progressFill = progressBar.querySelector('span');
  const hint = section.querySelector('#helix-hint');
  const count = cards.length;
  const preference = matchMedia('(min-width: 961px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)');
  const services = cards.map(card => ({
    name: card.querySelector('.helix-card__name').textContent,
    description: card.querySelector('.helix-card__info p').textContent,
    tags: [...card.querySelectorAll('.helix-card__info li')].map(li => li.textContent),
  }));
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const number = n => String(n + 1).padStart(2, '0');
  const entryDistance = () => window.innerHeight * .65;
  const exitDistance = () => window.innerHeight * .3;
  let enabled = false;
  let visible = false;
  let selected = -1;
  let radius = 200;
  let pitch = 135;
  let depth = 240;
  let sceneScale = 1;
  let travel = 3000;
  let frameId = 0;

  const indexItems = services.map((service, index) => {
    const item = document.createElement('li');
    const ordinal = document.createElement('span');
    ordinal.textContent = number(index);
    const label = document.createElement('span');
    label.textContent = service.name;
    item.append(ordinal, label);
    indexList.append(item);
    return item;
  });

  function updateDetails(index) {
    if (index === selected) return;
    selected = index;
    const service = services[index];
    detail.querySelector('.helix-detail__index').textContent = `${number(index)} / ${number(count - 1)}`;
    detail.querySelector('h3').textContent = service.name;
    detail.querySelector('.helix-detail__description').textContent = service.description;
    detail.querySelector('.helix-detail__tags').replaceChildren(...service.tags.map(tag => {
      const li = document.createElement('li');
      li.textContent = tag;
      return li;
    }));
    section.querySelector('.helix-position').textContent = `${number(index)} / ${number(count - 1)}`;
    indexItems.forEach((item, i) => {
      if (i === index) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
      cards[i].classList.toggle('is-selected', i === index);
    });
    section.dataset.activeService = String(index);
  }

  function render(position) {
    cards.forEach((card, index) => {
      // Keep the manual version's surrounding spiral. The scroll timeline
      // still ends at service six; only the background card positions wrap.
      const distance = ((index - position + count / 2) % count + count) % count - count / 2;
      const angle = distance * 1.12;
      const x = Math.sin(angle) * radius;
      const y = distance * pitch;
      const z = (Math.cos(angle) - 1) * depth + 45 * sceneScale;
      const edge = clamp((3 - Math.abs(distance)) / .5, 0, 1);
      const opacity = (1 - Math.min(.36, Math.abs(distance) * .15)) * edge;
      card.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateY(${(-distance * 25).toFixed(2)}deg) rotateZ(${(distance * 2).toFixed(2)}deg)`;
      card.style.opacity = opacity.toFixed(3);
      card.setAttribute('aria-hidden', String(opacity <= .15));
    });
  }

  function readScroll() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    if (!enabled || document.hidden) return;
    // Read the live top: images/fonts above the section can change its offset.
    const top = track.getBoundingClientRect().top;
    // One timeline spans entry, pinning and departure. The first service is
    // already advancing before the scene pins: no separate settling motion.
    // Finish early in the departure so the last service is still in view.
    const entry = entryDistance();
    const exit = exitDistance();
    const progress = clamp((entry - top) / (entry + travel + exit), 0, 1);
    const position = progress * (count - 1);
    updateDetails(clamp(Math.round(position), 0, count - 1));
    render(position);
    progressFill.style.transform = `scaleX(${progress.toFixed(4)})`;
    const percent = Math.round(progress * 100);
    if (progressBar.getAttribute('aria-valuenow') !== String(percent)) {
      progressBar.setAttribute('aria-valuenow', String(percent));
    }
    hint.textContent = position >= count - 1 ? 'Keep scrolling to continue ↓' : 'Scroll to explore ↓';
    section.dataset.scrollPhase = top >= entry ? 'before'
      : top > 0 ? 'entering'
      : -top < travel ? 'pinned'
      : -top < travel + exit ? 'leaving' : 'after';
  }

  function schedule() {
    if (enabled && visible && !document.hidden && !frameId) frameId = requestAnimationFrame(readScroll);
  }

  function measure() {
    if (!enabled) return;
    travel = Math.round(Math.max(380, window.innerHeight * .55) * (count - 1 + .4));
    section.style.setProperty('--helix-travel', `${travel}px`);
    // Fit one composition to the actual stage in both dimensions. All card,
    // spacing and perspective measurements share this scale, with no desktop
    // pixel cap that leaves the cards stranded in a large monitor's viewport.
    sceneScale = Math.min(space.clientWidth / 900, space.clientHeight / 650);
    space.style.setProperty('--helix-scene-scale', String(sceneScale));
    radius = 270 * sceneScale;
    pitch = 136 * sceneScale;
    depth = 240 * sceneScale;
    readScroll();
  }

  function configure() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    enabled = preference.matches && CSS.supports('transform-style', 'preserve-3d');
    section.classList.toggle('helix-enabled', enabled);
    space.tabIndex = enabled ? 0 : -1;
    if (enabled) {
      space.setAttribute('role', 'region');
      space.setAttribute('aria-label', 'Services. Scroll or use up and down arrow keys to explore.');
      space.setAttribute('aria-describedby', 'helix-hint');
      measure();
    } else {
      section.style.removeProperty('--helix-travel');
      space.style.removeProperty('--helix-scene-scale');
      delete section.dataset.scrollPhase;
      space.removeAttribute('role');
      space.removeAttribute('aria-describedby');
      cards.forEach(card => {
        card.style.removeProperty('transform');
        card.style.removeProperty('opacity');
        card.removeAttribute('aria-hidden');
      });
    }
  }

  // Keyboard navigation uses the page's existing scroll controller, so its
  // wheel easing cannot pull the page back after a keyboard-initiated scroll.
  space.addEventListener('keydown', event => {
    if (!enabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const y = window.scrollY;
    const start = track.getBoundingClientRect().top + y;
    const steps = {
      ArrowDown: y + 140,
      ArrowUp: y - 140,
      PageDown: y + window.innerHeight * .8,
      PageUp: y - window.innerHeight * .8,
      ' ': y + (event.shiftKey ? -1 : 1) * window.innerHeight * .8,
      Home: start - entryDistance(),
      End: start + travel + exitDistance(),
    };
    if (!(event.key in steps)) return;
    event.preventDefault();
    const top = Math.max(0, steps[event.key]);
    if (typeof Scroll !== 'undefined') Scroll.to(top);
    else window.scrollTo({ top, behavior: 'auto' });
  });

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) schedule();
    else {
      cancelAnimationFrame(frameId);
      frameId = 0;
      // Resolve to the appropriate endpoint even on a scrollbar jump past it.
      readScroll();
    }
  }, { rootMargin: '100px' }).observe(track);
  const resize = new ResizeObserver(measure);
  resize.observe(space);
  resize.observe(pin);
  preference.addEventListener('change', configure);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; }
    else schedule();
  });
  if (document.fonts) document.fonts.ready.then(measure);
  updateDetails(0);
  configure();
})();

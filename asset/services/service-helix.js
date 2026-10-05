/* Service cards follow a helix in CSS 3D space. The page keeps native scrolling. */
(() => {
  'use strict';
  const section = document.querySelector('.services--helix');
  if (!section) return;
  const space = section.querySelector('.helix-space');
  const cards = [...section.querySelectorAll('.helix-card')];
  const picks = cards.map(card => card.querySelector('.helix-card__pick'));
  const nav = section.querySelector('.helix-nav');
  const detail = section.querySelector('.helix-detail');
  const count = cards.length;
  const preference = matchMedia('(min-width: 961px) and (prefers-reduced-motion: no-preference)');
  const services = cards.map(card => ({
    name: card.querySelector('.helix-card__name').textContent,
    description: card.querySelector('.helix-card__info p').textContent,
    tags: [...card.querySelectorAll('.helix-card__info li')].map(li => li.textContent),
  }));
  const wrap = n => ((n % count) + count) % count;
  const relative = n => wrap(n + count / 2) - count / 2;
  const number = n => String(n + 1).padStart(2, '0');
  let enabled = false;
  let visible = false;
  let selected = 0;
  let position = 0;
  let target = 0;
  let radius = 200;
  let pitch = 135;
  let depth = 240;
  let raf = 0;
  let previousTime = 0;
  let drag = null;
  let suppressClick = false;

  const choices = services.map((service, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-controls', 'helix-space helix-detail');
    const ordinal = document.createElement('span');
    ordinal.textContent = number(index);
    const label = document.createElement('span');
    label.textContent = service.name;
    const arrow = document.createElement('span');
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');
    button.append(ordinal, label, arrow);
    button.addEventListener('click', () => select(index));
    nav.append(button);
    return button;
  });

  function updateDetails(index) {
    selected = wrap(index);
    const service = services[selected];
    detail.querySelector('.helix-detail__index').textContent = `${number(selected)} / ${number(count - 1)}`;
    detail.querySelector('h3').textContent = service.name;
    detail.querySelector('.helix-detail__description').textContent = service.description;
    detail.querySelector('.helix-detail__tags').replaceChildren(...service.tags.map(tag => {
      const li = document.createElement('li');
      li.textContent = tag;
      return li;
    }));
    section.querySelector('.helix-position').textContent = `${number(selected)} / ${number(count - 1)}`;
    choices.forEach((button, i) => button.setAttribute('aria-pressed', String(i === selected)));
    picks.forEach((button, i) => {
      button.tabIndex = -1; // The six named service buttons provide the keyboard navigation.
      button.setAttribute('aria-pressed', String(i === selected));
      cards[i].classList.toggle('is-selected', i === selected);
    });
    section.dataset.activeService = String(selected);
  }

  function render() {
    if (!enabled) return;
    cards.forEach((card, index) => {
      const distance = relative(index - position);
      const angle = distance * 1.12;
      const x = Math.sin(angle) * radius;
      const y = distance * pitch;
      const z = (Math.cos(angle) - 1) * depth + 45;
      // Fade out before a card wraps from the bottom to the top of the helix.
      const edge = Math.max(0, Math.min(1, (3 - Math.abs(distance)) / .5));
      const opacity = (1 - Math.min(.36, Math.abs(distance) * .15)) * edge;
      card.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateY(${(-distance * 25).toFixed(2)}deg) rotateZ(${(distance * 2).toFixed(2)}deg)`;
      card.style.opacity = opacity.toFixed(3);
      card.style.pointerEvents = opacity > .15 ? '' : 'none';
      card.setAttribute('aria-hidden', String(opacity <= .15));
    });
  }

  function frame(time) {
    raf = 0;
    if (!enabled || !visible || document.hidden) return;
    const elapsed = previousTime ? Math.min(48, time - previousTime) : 16;
    previousTime = time;
    position += (target - position) * (1 - Math.exp(-elapsed / (drag ? 45 : 115)));
    if (Math.abs(target - position) < .0005) position = target;
    render();
    if (position !== target) raf = requestAnimationFrame(frame);
    else previousTime = 0;
  }

  function schedule() {
    if (enabled && visible && !document.hidden && !raf) raf = requestAnimationFrame(frame);
  }

  function select(index) {
    if (!enabled) return;
    target = Math.round(target) + relative(index - Math.round(target));
    updateDetails(wrap(Math.round(target)));
    schedule();
  }

  function measure() {
    if (!enabled) return;
    radius = Math.min(290, space.clientWidth * .28);
    pitch = Math.min(154, space.clientHeight * .205);
    depth = Math.min(280, space.clientWidth * .3);
    render();
  }

  function endDrag(event, cancelled = false) {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    const finished = drag;
    drag = null;
    space.classList.remove('is-dragging');
    if (space.hasPointerCapture(finished.id)) space.releasePointerCapture(finished.id);
    if (finished.moved) {
      suppressClick = true;
      // Pointer-generated click follows pointerup synchronously; don't swallow a later keyboard click.
      setTimeout(() => { suppressClick = false; }, 0);
      target = cancelled ? Math.round(finished.start) : Math.round(target);
      updateDetails(wrap(target));
      schedule();
    }
  }

  space.addEventListener('pointerdown', event => {
    if (!enabled || event.button !== 0 || !event.isPrimary) return;
    suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, start: position, moved: false };
  });
  space.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const delta = event.clientX - drag.x;
    if (!drag.moved && Math.abs(delta) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      space.setPointerCapture(event.pointerId);
      space.classList.add('is-dragging');
    }
    target = drag.start - delta / Math.max(130, space.clientWidth * .25);
    schedule();
  });
  space.addEventListener('pointerup', event => endDrag(event));
  space.addEventListener('pointercancel', event => endDrag(event, true));
  space.addEventListener('lostpointercapture', event => endDrag(event, true));
  space.addEventListener('pointerleave', event => {
    if (drag && !drag.moved) endDrag(event);
  });
  space.addEventListener('click', event => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  }, true);
  picks.forEach((button, index) => button.addEventListener('click', () => select(index)));
  section.querySelectorAll('[data-helix-step]').forEach(button => {
    button.addEventListener('click', () => select(Math.round(target) + Number(button.dataset.helixStep)));
  });
  space.addEventListener('keydown', event => {
    if (!enabled) return;
    const destination = {
      ArrowRight: Math.round(target) + 1,
      ArrowLeft: Math.round(target) - 1,
      Home: 0,
      End: count - 1,
    }[event.key];
    if (destination === undefined) return;
    event.preventDefault();
    select(destination);
  });

  function configure() {
    endDrag(null, true);
    enabled = preference.matches && CSS.supports('transform-style', 'preserve-3d');
    section.classList.toggle('helix-enabled', enabled);
    space.tabIndex = enabled ? 0 : -1;
    if (enabled) {
      space.setAttribute('role', 'region');
      space.setAttribute('aria-roledescription', 'carousel');
      space.setAttribute('aria-describedby', 'helix-hint');
    } else {
      space.removeAttribute('role');
      space.removeAttribute('aria-roledescription');
      space.removeAttribute('aria-describedby');
    }
    picks.forEach(button => { button.disabled = !enabled; });
    cancelAnimationFrame(raf);
    raf = 0;
    previousTime = 0;
    position = target = selected;
    if (enabled) measure();
    else cards.forEach(card => {
      card.style.removeProperty('transform');
      card.style.removeProperty('opacity');
      card.style.removeProperty('pointer-events');
      card.removeAttribute('aria-hidden');
    });
  }

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) schedule();
    else { cancelAnimationFrame(raf); raf = 0; previousTime = 0; }
  }, { rootMargin: '100px' }).observe(space);
  new ResizeObserver(measure).observe(space);
  preference.addEventListener('change', configure);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { endDrag(null, true); cancelAnimationFrame(raf); raf = 0; previousTime = 0; }
    else schedule();
  });
  window.addEventListener('blur', () => endDrag(null, true));
  updateDetails(0);
  configure();
})();

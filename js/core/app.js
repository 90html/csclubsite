/* Runs on every page: nav, scroll-reveal, footer year, toasts, iframe/embed
 * support, and the optional ?setup placeholder checklist. */
import CONFIG from '../../config.js';
import { initEmbed } from './embed.js';
import { icon } from './icons.js';
import { isPlaceholder, prefersReducedMotion } from './utils.js';

document.documentElement.classList.add('js');

/* ---------- Header: scrolled state, sliding indicator, mobile drawer ---------- */
function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Sliding pill that follows hover/focus and rests on the current page.
  const nav = header.querySelector('.nav-links');
  const pill = nav?.querySelector('.nav-pill');
  if (nav && pill) {
    const current = nav.querySelector('[aria-current="page"]');
    const moveTo = (el) => {
      if (!el) {
        pill.style.opacity = '0';
        return;
      }
      pill.style.opacity = '1';
      pill.style.width = `${el.offsetWidth}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    const rest = () => moveTo(current);
    requestAnimationFrame(() => {
      rest();
      requestAnimationFrame(() => pill.classList.add('is-ready'));
    });
    nav.addEventListener('pointerover', (e) => {
      const link = e.target.closest('a');
      if (link) moveTo(link);
    });
    nav.addEventListener('focusin', (e) => moveTo(e.target.closest('a')));
    nav.addEventListener('pointerleave', rest);
    nav.addEventListener('focusout', (e) => {
      if (!nav.contains(e.relatedTarget)) rest();
    });
    window.addEventListener('resize', rest);
    document.fonts?.ready.then(rest);
  }

  // Mobile drawer
  const toggle = header.querySelector('.nav-toggle');
  const drawer = document.getElementById('nav-drawer');
  if (!toggle || !drawer) return;
  const main = document.getElementById('main');
  const footer = document.querySelector('.site-footer');

  const focusables = () => [...drawer.querySelectorAll('a, button')];
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    drawer.hidden = !open;
    document.body.classList.toggle('drawer-open', open);
    main?.toggleAttribute('inert', open);
    footer?.toggleAttribute('inert', open);
    if (open) focusables()[0]?.focus();
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  drawer.addEventListener('click', (e) => {
    if (e.target === drawer || e.target.closest('[data-close-drawer]')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (drawer.hidden) return;
    if (e.key === 'Escape') {
      setOpen(false);
      toggle.focus();
    } else if (e.key === 'Tab') {
      // Keep focus inside the drawer + toggle button.
      const items = [toggle, ...focusables()];
      const i = items.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && i === items.length - 1) {
        e.preventDefault();
        items[0].focus();
      }
    }
  });
  matchMedia('(min-width: 60em)').addEventListener('change', (e) => e.matches && setOpen(false));
}

/* ---------- Scroll reveal ---------- */
export function observeReveal(root = document) {
  const items = root.querySelectorAll('[data-reveal]:not(.is-visible)');
  if (!items.length) return;
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  items.forEach((el, i) => {
    if (!el.style.getPropertyValue('--reveal-delay') && el.dataset.reveal === 'stagger') {
      el.style.setProperty('--reveal-delay', `${(i % 6) * 60}ms`);
    }
    io.observe(el);
  });
}

/* ---------- Toasts ---------- */
let toastRegion;
export function toast(message, kind = 'info') {
  if (!toastRegion) {
    toastRegion = document.createElement('div');
    toastRegion.className = 'toast-region';
    toastRegion.setAttribute('role', 'status');
    toastRegion.setAttribute('aria-live', 'polite');
    document.body.append(toastRegion);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.innerHTML = `${icon(kind === 'success' ? 'check' : 'info')}<span></span>`;
  el.querySelector('span').textContent = message;
  toastRegion.append(el);
  setTimeout(() => el.classList.add('is-leaving'), 3200);
  setTimeout(() => el.remove(), 3700);
}

/* ---------- Clipboard (with a fallback for older browsers / iframes) ---------- */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/* ---------- Config-driven bits shared by several pages ---------- */
function fillConfigSlots() {
  // Footer year
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  // Email links: hidden until CLUB_EMAIL is filled in.
  const email = CONFIG.CLUB_EMAIL;
  document.querySelectorAll('[data-club-email]').forEach((el) => {
    if (isPlaceholder(email)) {
      el.hidden = true;
      return;
    }
    if (el.tagName === 'A') el.href = `mailto:${email}`;
    const label = el.querySelector('[data-club-email-text]') || el;
    label.textContent = email;
    el.hidden = false;
  });

  // Social links: each <a data-social="instagram"> shows only when configured.
  document.querySelectorAll('[data-social]').forEach((el) => {
    const url = CONFIG.SOCIAL?.[el.dataset.social];
    if (isPlaceholder(url)) {
      el.hidden = true;
    } else {
      el.href = url;
      el.hidden = false;
    }
  });
  document.querySelectorAll('[data-social-list]').forEach((list) => {
    list.hidden = ![...list.querySelectorAll('[data-social]')].some((a) => !a.hidden);
  });

  // Meeting facts: each [data-meeting="day|time|room"] hides when unfilled.
  document.querySelectorAll('[data-meeting]').forEach((el) => {
    const value = CONFIG.MEETING?.[el.dataset.meeting];
    const holder = el.closest('[data-meeting-item]') || el;
    if (isPlaceholder(value)) {
      holder.hidden = true;
    } else {
      el.textContent = value;
      holder.hidden = false;
    }
  });
  document.querySelectorAll('[data-meeting-group]').forEach((group) => {
    group.hidden = ![...group.querySelectorAll('[data-meeting-item]')].some((i) => !i.hidden);
  });
}

async function maybeShowSetup() {
  const params = new URLSearchParams(location.search);
  if (!params.has('setup')) return;
  const { showSetupPanel } = await import('./setup.js');
  showSetupPanel();
}

export function initApp() {
  initEmbed();
  initHeader();
  fillConfigSlots();
  observeReveal();
  maybeShowSetup();
}

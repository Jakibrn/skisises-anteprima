// luxe-product.js: built 2026-10-03. Motion uses the theme's own vendor.min.js (Motion One).
import { SKS_FMT, SKS_CARD, $, $$, ROOT, BASE, MOTION_OK, FINE_POINTER, urlWritable, memory, store, announce, toast, REEL, rollText, spinText, DOODLES, doodle, CARDS, registerCards, productUrl, yieldToMain, deliveryWindow, trackingOK, openers, openDialog, closeDialog, PHONE_SHEET, sheetStops, snapSheet, popups, lookViewer, FREE_SHIPPING, MOCK_LATENCY, Cart, infoFromCard, renderCart, addWithFeedback, sizeSheet, whenShown, trackEvent, Wish, renderWishState, Recent, loadSlides, initRail, ForYou } from './luxe.js';
import { animate, inView, scroll, stagger, timeline, PhotoSwipeLightbox } from 'vendor';
/* ---------- product page ---------- */
(() => {
  const el = $('#product-json');
  if (!el) return;
  const P = JSON.parse(el.textContent);
  CARDS[P.handle] = CARDS[P.handle] || { t: P.title, b: P.brand, p: P.price, c: P.compareAt, i: P.image, s: P.sizes };
  const info = { handle: P.handle, title: P.title, brand: P.brand, price: P.price, compareAt: P.compareAt, image: P.image };
  const form = $('[data-product-form]');
  const chosen = $('[data-size-chosen]'), error = $('[data-size-error]');
  const selected = () => form && (form.querySelector('input[name="size"]:checked') || {}).value;

  // sticky bar sizes: the same sizes and counts as the picker above, kept in step both ways (as the theme's
  // assets/sticky-atc-sync.js does with the app's select). A sold-out size opens the back-in-stock form.
  const sheet = $('[data-sticky-sheet]'), toggle = $('[data-sticky-toggle]');
  const stickyValue = $('[data-sticky-value]'), stickyCount = $('[data-sticky-count]'), stickyHint = $('[data-sticky-hint]');
  const stickyPicks = $$('[data-sticky-pick]');
  let pendingAdd = false;
  const syncSticky = size => {
    stickyPicks.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.stickyPick === size)));
    const pick = stickyPicks.find(b => b.dataset.stickyPick === size);
    if (stickyValue && pick) stickyValue.textContent = size;
    if (stickyCount) stickyCount.textContent = pick ? (pick.querySelector('.size-option__stock') || {}).textContent || '' : '';
  };
  const openSheet = adding => {
    if (!sheet) return;
    pendingAdd = !!adding;
    sheet.hidden = false;
    toggle?.setAttribute('aria-expanded', 'true');
    if (stickyHint) stickyHint.hidden = !adding;
    (sheet.querySelector('[aria-pressed="true"]') || sheet.querySelector('.sticky-size'))?.focus();
  };
  const closeSheet = focusBack => {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    pendingAdd = false;
    toggle?.setAttribute('aria-expanded', 'false');
    if (focusBack) toggle?.focus();
  };
  // back in stock: the app's product-page popup (popups.js)
  const notify = (size, opener) => popups().then(m => m.open('notify', opener, size));
  toggle?.addEventListener('click', () => (sheet.hidden ? openSheet(false) : closeSheet(true)));
  sheet?.addEventListener('click', e => {
    if (e.target.closest('[data-sticky-close]')) { closeSheet(true); return; }
    const pick = e.target.closest('[data-sticky-pick]');
    if (pick) {
      const size = pick.dataset.stickyPick, adding = pendingAdd;
      const r = form && [...form.querySelectorAll('input[name="size"]')].find(i => i.value === size);
      if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      closeSheet(!adding);
      if (adding) addWithFeedback($('[data-sticky-add]'), info, size);
      else announce(`Taglia ${size} scelta.`);
      return;
    }
    const sold = e.target.closest('[data-notify-size]');
    if (sold) { closeSheet(false); notify(sold.dataset.notifySize, toggle); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet && !sheet.hidden) closeSheet(true); });
  document.addEventListener('pointerdown', e => { if (sheet && !sheet.hidden && !e.target.closest('[data-sticky-atc]')) closeSheet(false); });

  // the chosen size travels to the other colours (?taglia=), so a colour switch never resets it silently
  const carrySize = size => $$('.sibling[href]').forEach(a => { const u = new URL(a.href); size ? u.searchParams.set('taglia', size) : u.searchParams.delete('taglia'); a.href = u.pathname.split('/').pop() + u.search; });
  if (form) {
    const onSize = r => {
      syncSticky(r.value);
      if (chosen) { chosen.textContent = r.value; chosen.classList.remove('meta'); }
      error.hidden = true;
      form.querySelector('.size-picker').classList.remove('is-invalid');
      carrySize(r.value);
      // the size lives in the URL: Back and reload keep it (bfcache or not)
      const u = new URL(location.href); u.searchParams.set('taglia', r.value); if (urlWritable()) history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    };
    form.addEventListener('change', e => { if (e.target.name === 'size') onSize(e.target); });
    addEventListener('pageshow', () => { const r = form.querySelector('input[name="size"]:checked'); if (r) onSize(r); });
    const wanted = new URLSearchParams(location.search).get('taglia');
    if (wanted) {
      const r = [...form.querySelectorAll('input[name="size"]')].find(i => i.value === wanted);
      if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      else { error.hidden = false; error.classList.add('is-note'); error.textContent = `La taglia ${wanted} non è disponibile in questo colore: scegline un’altra.`; }
    }
    const needSize = () => {
      error.hidden = false;
      form.querySelector('.size-picker').classList.add('is-invalid');
      const first = form.querySelector('input[name="size"]');
      first && first.focus({ preventScroll: true });
      form.querySelector('.size-picker').scrollIntoView({ block: 'center', behavior: MOTION_OK() ? 'smooth' : 'auto' });
      announce('Seleziona taglia');
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      const size = selected();
      if (!size) { needSize(); return; }
      addWithFeedback(form.querySelector('[data-add-to-cart]'), info, size);
    });
    $('[data-sticky-add]')?.addEventListener('click', e => {
      const btn = e.currentTarget;
      // every size sold out: pick the one to be told about (or straight to the form with one size)
      if (btn.hasAttribute('data-sticky-notify')) { if (sheet) openSheet(false); else notify(P.sizes[0][0], btn); return; }
      const size = selected();
      // no size yet: the sizes open on the bar itself, and the pick adds to the cart
      if (!size) { if (sheet) openSheet(true); else needSize(); return; }
      addWithFeedback(btn, info, size);
    });
    // sold-out sizes: back-in-stock request (the app's button in the theme)
    form.addEventListener('click', e => {
      const n = e.target.closest('[data-notify-size]');
      if (n) notify(n.dataset.notifySize, n);
    });
  }

  // sticky add-to-cart once the main button has scrolled away (IntersectionObserver, no scroll listener)
  const sticky = $('[data-sticky-atc]'), main = $('[data-add-to-cart]');
  if (sticky && main) {
    sticky.hidden = false;
    // the floating buttons sit above the bar, whatever its height (the sale strip makes it taller on phones)
    const barHeight = () => ROOT.style.setProperty('--sticky-h', `${Math.ceil(sticky.getBoundingClientRect().height - parseFloat(getComputedStyle(sticky).paddingBottom)) + 24}px`);
    barHeight();
    addEventListener('resize', barHeight, { passive: true });
    new IntersectionObserver(([e]) => {
      const show = !e.isIntersecting && e.boundingClientRect.top < 0;
      sticky.classList.toggle('is-visible', show);
      sticky.setAttribute('aria-hidden', String(!show));
      sticky.inert = !show;
      if (!show) closeSheet(false);
    }).observe(main);
  }

  // delivery window: 1-3 working days from the next working day, in Italian
  const d = $('[data-delivery]');
  if (d) {
    d.textContent = deliveryWindow({ day: '2-digit', month: '2-digit' }, 'il '); // the live line: "tra il 05/10 e il 07/10"
    const copy = $('[data-delivery-copy]'); if (copy) copy.textContent = d.textContent;
  }

  // shipping line aware of the cart: free above 50 € (this product included), otherwise how much is missing
  const ship = $('[data-pdp-shipping]');
  const shipLine = () => {
    if (!ship) return;
    const total = Cart.subtotal() + (Cart.lines.some(l => l.handle === P.handle) ? 0 : P.price);
    // the live strings (product.shipping.free_shipping / add_for_free_shipping, amount without trailing zeros)
    const left = 50 - total, amount = Number.isInteger(left) ? `${left}€` : SKS_FMT.money(left), state = total >= 50 ? 'free' : 'left';
    // the amount rolls to its new value when the bag changes (owner, 03/10), once the bag is closed again
    if (state === 'left' && ship.dataset.state === 'left') { rollText(ship.querySelector('strong'), amount); return; }
    if (ship.dataset.state === state) return;
    ship.dataset.state = state;
    ship.innerHTML = state === 'free' ? '<strong>Spedizione gratuita</strong>' : 'Aggiungi <strong></strong> per la spedizione gratuita';
    if (state === 'left') rollText(ship.querySelector('strong'), amount);
  };
  shipLine();
  document.addEventListener('cart:rendered', shipLine);

  // gallery: PhotoSwipe from the theme (vendor + photoswipe import map entry), zoom 1.5 as live; on phones a
  // swipe carousel with dots (the live mobile_controls: dots)
  const gallery = $('[data-gallery]');
  if (gallery) {
    try {
      const lb = new PhotoSwipeLightbox({ gallery, children: 'a', pswpModule: () => import('photoswipe'), bgOpacity: 1, showHideAnimationType: MOTION_OK() ? 'zoom' : 'none', wheelToZoom: true });
      lb.init();
    } catch { /* links still open the full image */ }
    const dots = $$('[data-gallery-dot]');
    if (dots.length) {
      gallery.addEventListener('scroll', () => requestAnimationFrame(() => {
        const i = Math.round(gallery.scrollLeft / Math.max(1, gallery.clientWidth));
        dots.forEach((d, k) => d.toggleAttribute('aria-current', k === i));
      }), { passive: true });
      dots.forEach((d, k) => d.addEventListener('click', () => gallery.scrollTo({ left: k * gallery.clientWidth, behavior: MOTION_OK() ? 'smooth' : 'auto' })));
    }
  }

  // sale countdown (snippets/sale-countdown.liquid): one ticker for the line under the price and its copy in
  // the sticky bar; days-hours-minutes, then hours-minutes-seconds in the last day. Past the deadline the timer
  // goes and the sale line stays, as assets/sale-countdown.js does.
  const timers = $$('[data-sale-timer]');
  if (timers.length) {
    const ends = SKS_FMT.saleDeadline(Date.now());
    const label = 'L’offerta scade ' + new Date(ends).toLocaleString('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    timers.forEach(t => t.setAttribute('aria-label', label));
    let id = 0, step = 0;
    const paint = () => {
      const left = ends - Date.now();
      if (left <= 0) { clearInterval(id); timers.forEach(t => t.remove()); return 0; }
      const html = SKS_FMT.countdownParts(left).map(([v, u]) => `<span class="sale-line__part"><b>${v}</b> <span class="sale-line__unit">${u}</span></span>`).join(' ');
      timers.forEach(t => { if (t.innerHTML !== html) t.innerHTML = html; });
      return left < 86400000 ? 1000 : 30000;
    };
    const start = () => {
      clearInterval(id);
      step = paint();
      if (step) id = setInterval(() => { const next = paint(); if (next !== step) start(); }, step);
    };
    start();
    document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(id) : start()));
  }

  // recently viewed: shown under the product (the theme stored them without a section)
  const recent = Recent.list.filter(r => r.handle !== P.handle).slice(0, 4);
  whenShown(() => Recent.push({ handle: P.handle, title: P.title, brand: P.brand, price: P.price, compareAt: P.compareAt, images: P.images, image: P.image, sizes: P.sizes, priceVaries: P.priceVaries, isNew: P.isNew, archived: P.archived }));
  const sec = $('[data-recent-section]');
  if (sec && recent.length >= 2) {
    registerCards(recent.map(r => ({ ...r, images: r.images || [r.image] })));
    $('[data-recent-grid]', sec).innerHTML = recent.map(r => SKS_CARD.render({ ...r, images: r.images || [r.image], sizes: r.sizes || [] }, { base: BASE })).join('');
    sec.hidden = false;
    renderWishState();
  }
})();

/* the size advisor itself is in size-help.js (89-size-help.js), loaded on the first click */

/* ---------- size-help nudge (assets/size-help-nudge.js): after three different sizes, from the picker or the
   sticky bar, once per product per session. A line under the sizes, not the live modal: it never covers the
   buy box, and the shopper's last choice stays selected. ---------- */
(() => {
  const form = $('[data-product-form]'), nudge = $('[data-size-nudge]');
  if (!form || !nudge) return;
  const KEY = 'sks-size-help:2:' + location.pathname, help = $('.product__size-help', form);
  let done = false;
  try { done = sessionStorage.getItem(KEY) === '1'; } catch { /* storage blocked: the nudge may show again */ }
  const seen = new Set();
  form.addEventListener('change', e => {
    if (done || e.target.name !== 'size') return;
    seen.add(e.target.value);
    if (seen.size < 3) return;
    done = true;
    try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    nudge.hidden = false; if (help) help.hidden = true;
    announce('Stai confrontando più taglie? La guida ti consiglia la tua in due passi.');
  });
  const close = () => { nudge.hidden = true; if (help) help.hidden = false; };
  $('[data-nudge-close]', nudge).addEventListener('click', close);
  $('.size-nudge__cta', nudge).addEventListener('click', close);
})();

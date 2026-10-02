// luxe-product.js: built 2026-10-02. Motion uses the theme's own vendor.min.js (Motion One).
import { SKS_FMT, SKS_CARD, $, $$, ROOT, BASE, MOTION_OK, FINE_POINTER, memory, store, announce, toast, CARDS, registerCards, productUrl, yieldToMain, deliveryWindow, trackingOK, openers, openDialog, closeDialog, lookViewer, FREE_SHIPPING, MOCK_LATENCY, Cart, infoFromCard, renderCart, addWithFeedback, Wish, renderWishState, Recent, initRail, ForYou } from './luxe.js';
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
  const notify = (size, opener) => { const l = $('[data-notify-label]'); if (l) l.textContent = size; openDialog('notify-dialog', opener); };
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
      const u = new URL(location.href); u.searchParams.set('taglia', r.value); history.replaceState(history.state, '', u.pathname + u.search + u.hash);
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
      announce('Scegli una taglia per aggiungere al carrello.');
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
      if (!n) return;
      $('[data-notify-label]').textContent = n.dataset.notifySize;
      openDialog('notify-dialog', n);
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
    d.textContent = deliveryWindow();
    const copy = $('[data-delivery-copy]'); if (copy) copy.textContent = d.textContent;
  }

  // shipping line aware of the cart: free above 50 € (this product included), otherwise how much is missing
  const ship = $('[data-pdp-shipping]');
  const shipLine = () => {
    if (!ship) return;
    const total = Cart.subtotal() + (Cart.lines.some(l => l.handle === P.handle) ? 0 : P.price);
    ship.innerHTML = total >= 50 ? '<strong>Spedizione gratuita</strong> in Italia per questo ordine'
      : `Spedizione 5,90&nbsp;€ in Italia: <strong>ti mancano ${SKS_FMT.money(50 - total)}</strong> per averla gratis`;
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
  Recent.push({ handle: P.handle, title: P.title, brand: P.brand, price: P.price, compareAt: P.compareAt, images: P.images, image: P.image, sizes: P.sizes, priceVaries: P.priceVaries, isNew: P.isNew, archived: P.archived });
  const sec = $('[data-recent-section]');
  if (sec && recent.length >= 2) {
    registerCards(recent.map(r => ({ ...r, images: r.images || [r.image] })));
    $('[data-recent-grid]', sec).innerHTML = recent.map(r => SKS_CARD.render({ ...r, images: r.images || [r.image], sizes: r.sizes || [] }, { base: BASE })).join('');
    sec.hidden = false;
    renderWishState();
  }
})();



/* ---------- "Non sei sicuro della tua taglia?": the size-suggestions modal (integrated1 sizesuggestions) ----
   Live: two steps (usual size, height, weight; then body, belly, age, fit), then POST /api/recommend and
   "La tua taglia consigliata" with a compatibility score. The preview estimates on the device with the same
   inputs: chest from height and weight, the fit offsets the live info page states (slim -3 cm, relaxed
   +4 cm), the brand table when the service has one, else a generic table. Inputs stay in this browser. */
(() => {
  const form = $('[data-size-advisor]');
  const pj = $('#product-json');
  if (!form || !pj) return;
  const P = JSON.parse(pj.textContent);
  const KEY = 'sks-fit';
  const shoes = form.dataset.kind === 'shoes', female = form.dataset.gender === 'F';
  const steps = $$('[data-sz-step]', form), result = $('[data-sz-result]', form), err = $('[data-sz-error]', form);
  const bars = $$('.sz-progress span', form);
  // generic body-chest tables (cm) when the brand has none in the size service
  const GENERIC = female
    ? [['XS', 78, 82], ['S', 82, 86], ['M', 86, 92], ['L', 92, 98], ['XL', 98, 104], ['XXL', 104, 110]]
    : [['XS', 84, 88], ['S', 88, 94], ['M', 94, 100], ['L', 100, 106], ['XL', 106, 112], ['XXL', 112, 118]];
  const chart = form.dataset.chart ? JSON.parse(form.dataset.chart) : GENERIC;
  // Italian numeric sizes some brands use instead of letters
  const IT = female ? { XS: '38', S: '40', M: '42', L: '44', XL: '46', XXL: '48' } : { XS: '44', S: '46', M: '48', L: '50', XL: '52', XXL: '54' };
  const saved = store.get(KEY, {});
  const state = { usual: saved.usual ?? null, body: saved.body || 'regular', belly: saved.belly || 'average', age: saved.age || '26-40', fit: saved.fit || 'regular' };
  if (saved.height) form.height && (form.height.value = saved.height);
  if (saved.weight) form.weight && (form.weight.value = saved.weight);
  const press = (grp, val) => $$(`[data-grp="${grp}"]`, form).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.val === val)));
  ['body', 'belly', 'age', 'fit'].forEach(g => press(g, state[g]));
  if (state.usual != null) $$('[data-usual]', form).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.usual === state.usual)));

  function show(n) {
    steps.forEach(s => { s.hidden = s.dataset.szStep !== String(n); });
    result.hidden = n !== 'result';
    bars.forEach((b, i) => b.classList.toggle('is-active', n === 'result' || i === n - 1));
  }
  function fail(msg, field) { err.textContent = msg; err.hidden = false; field?.focus(); }
  const sizeOf = label => P.sizes.find(s => s[0] === label) || P.sizes.find(s => s[0] === IT[label]);

  function estimate() {
    if (shoes) {
      const n = state.usual;
      return { size: n, pct: form.ref_brand.value === 'Non lo so' ? 72 : 84, basis: `il tuo numero abituale${form.ref_brand.value !== 'Non lo so' ? ` in ${form.ref_brand.value}` : ''}` };
    }
    const h = +form.height.value, w = +form.weight.value;
    // chest from height and weight (fitted on ANSUR-like averages), then body, belly and fit
    let chest = 0.5 * w + 0.25 * h + (female ? 6 : 15);
    chest += { slim: -2, regular: 0, curvy: 3 }[state.body] + { flat: -1, average: 0, round: 2 }[state.belly];
    chest += { slim: -3, regular: 0, relaxed: 4 }[state.fit];
    let i = chart.findIndex(([, lo, hi]) => chest >= lo && chest < hi);
    if (i < 0) i = chest < chart[0][1] ? 0 : chart.length - 1;
    const u = chart.findIndex(r => r[0] === state.usual);
    if (u >= 0 && Math.abs(u - i) === 1) i = Math.round((i + u) / 2 + (state.fit === 'relaxed' ? 0.25 : -0.25)); // the usual size weighs in
    const [label, lo, hi] = chart[i];
    const mid = (lo + hi) / 2, half = (hi - lo) / 2;
    const off = Math.min(1.5, Math.abs(chest - mid) / half);
    const pct = Math.round(Math.max(45, 96 - off * 30 - (state.usual ? 0 : 6)));
    return { size: label, pct, basis: `altezza ${h} cm, peso ${w} kg${state.usual ? `, taglia abituale ${state.usual}` : ''}` };
  }

  function render(r) {
    const s = sizeOf(r.size);
    const label = s ? s[0] : r.size;
    const note = r.pct >= 90 ? 'misure al centro della taglia' : r.pct >= 70 ? 'buona vestibilità' : r.pct >= 50 ? 'valuta anche la taglia vicina' : 'stima indicativa';
    const dots = '●'.repeat(Math.round(r.pct / 25)).padEnd(4, '○');
    result.innerHTML = `<p class="sz-result__label">La tua taglia consigliata</p>
      <p class="sz-result__size">${SKS_FMT.esc(label)}</p>
      <p class="sz-result__conf"><span aria-hidden="true">${dots}</span> Compatibilità ${r.pct}%: ${note}</p>
      ${s && !s[1] ? `<p class="sz-result__warn">La taglia consigliata per te è ${SKS_FMT.esc(label)}, ma non è disponibile in questo colore.</p>
        <button type="button" class="button button--outline button--block" data-sz-notify="${SKS_FMT.esc(label)}">Avvisami quando torna la ${SKS_FMT.esc(label)}</button>`
      : s ? `<button type="button" class="button button--primary button--block" data-sz-add="${SKS_FMT.esc(label)}">Aggiungi la ${SKS_FMT.esc(label)} al carrello</button>`
      : `<p class="sz-result__warn">Questo modello non ha la ${SKS_FMT.esc(label)}: guarda le taglie disponibili o chiedici un consiglio.</p>`}
      <p class="meta">Basato su: ${SKS_FMT.esc(r.basis)}.</p>
      <p><button type="button" class="link-small" data-sz-restart>Rifai il test</button></p>`;
    show('result');
    result.querySelector('button')?.focus();
  }

  form.addEventListener('click', e => {
    const u = e.target.closest('[data-usual]');
    if (u) { state.usual = u.dataset.usual; $$('[data-usual]', form).forEach(b => b.setAttribute('aria-pressed', String(b === u))); err.hidden = true; return; }
    const g = e.target.closest('[data-grp]');
    if (g) { state[g.dataset.grp] = g.dataset.val; press(g.dataset.grp, g.dataset.val); return; }
    if (e.target.closest('[data-sz-next]')) {
      err.hidden = true;
      if (shoes) { if (!state.usual) return fail('Scegli il numero che porti di solito.', $('[data-usual]', form)); store.set(KEY, { ...store.get(KEY, {}), usual: state.usual }); return render(estimate()); }
      const h = +form.height.value, w = +form.weight.value;
      if (!(h >= 100 && h <= 250)) return fail('Scrivi l’altezza in centimetri, per esempio 175.', form.height);
      if (!(w >= 30 && w <= 250)) return fail('Scrivi il peso in chili, per esempio 70.', form.weight);
      show(2); $('[data-sz-step="2"] .sz-chip[aria-pressed="true"]', form)?.focus(); return;
    }
    if (e.target.closest('[data-sz-back]')) { show(1); return; }
    if (e.target.closest('[data-sz-restart]')) { show(1); return; }
    if (e.target.closest('[data-sz-forget]')) { store.set(KEY, {}); form.reset(); state.usual = null; $$('[data-usual]', form).forEach(b => b.setAttribute('aria-pressed', 'false')); show(1); toast('Dati della taglia cancellati da questo browser.'); return; }
    const how = e.target.closest('[data-sz-how]');
    if (how) { const box = $('#sz-how'); box.hidden = !box.hidden; how.setAttribute('aria-expanded', String(!box.hidden)); return; }
    const add = e.target.closest('[data-sz-add]');
    if (add) {
      // the buy box takes the size too, so the page and the cart agree
      const r = $$('input[name="size"]').find(i => i.value === add.dataset.szAdd);
      if (r && !r.checked) r.click();
      addWithFeedback(add, { handle: P.handle, title: P.title, brand: P.brand, price: P.price, compareAt: P.compareAt, image: P.image }, add.dataset.szAdd);
      return;
    }
    const nt = e.target.closest('[data-sz-notify]');
    if (nt) { closeDialog(form.closest('dialog')); const l = $('[data-notify-label]'); if (l) l.textContent = nt.dataset.szNotify; setTimeout(() => openDialog('notify-dialog'), 340); }
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    store.set(KEY, { usual: state.usual, height: form.height?.value, weight: form.weight?.value, body: state.body, belly: state.belly, age: state.age, fit: state.fit });
    render(estimate());
  });
  form.closest('dialog')?.addEventListener('dialog:open', () => { err.hidden = true; if (!result.hidden) return; show(1); });
})();

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

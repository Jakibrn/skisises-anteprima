// luxe.js: built 2026-10-01. Motion uses the theme's own vendor.min.js (Motion One).
import { animate, inView, scroll, stagger, timeline, PhotoSwipeLightbox } from 'vendor';
/* Shared by the Node build (evaluated in a vm sandbox) and the browser bundle: no imports, no DOM. */
var SKS_FMT = (function () {
  var moneyFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // "1.234,50 €" with a non-breaking space before the symbol, never wrapped
  function money(n) { return moneyFmt.format(n || 0).replace(/\s/g, ' '); }
  // Shopify CDN crop by URL (the shop's own image rule): width/height/crop added after ?v=, never forcing format
  function cdn(url, w, h, crop) {
    if (!url) return '';
    if (url.indexOf('cdn.shopify.com') < 0 && url.indexOf('/cdn/shop/') < 0) return url;
    var base = url.replace(/([?&])(width|height|crop)=[^&]*/g, '$1').replace(/[?&]+$/, '');
    var parts = [];
    if (w) parts.push('width=' + w);
    if (h) parts.push('height=' + h);
    if (h && crop !== false) parts.push('crop=' + (crop || 'center'));
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + parts.join('&');
  }
  // srcset capped at the native width when known; ratio = height / width for cropped renditions
  function srcset(url, widths, ratio, native, crop) {
    var list = widths.filter(function (w) { return !native || w <= native; });
    if (native && list.indexOf(native) < 0 && native < widths[widths.length - 1]) list.push(native);
    return list.map(function (w) { return cdn(url, w, ratio ? Math.round(w * ratio) : 0, crop) + ' ' + w + 'w'; }).join(', ');
  }
  // product images from /files/ are 2400px packshots; legacy /products/ uploads are smaller
  function nativeWidth(url) { return url && url.indexOf('/files/') >= 0 ? 2400 : 1000; }
  // "Taglia unica" for T.U., otherwise "Taglia 42"
  function sizeLabel(s) { return /^T\.?\s?U\.?$/i.test(String(s).trim()) ? 'Taglia unica' : 'Taglia ' + s; }
  function percentOff(p) { return p.compareAt ? Math.round((1 - p.price / p.compareAt) * 100) : 0; }
  function normalize(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  return { esc: esc, money: money, cdn: cdn, srcset: srcset, nativeWidth: nativeWidth, sizeLabel: sizeLabel, percentOff: percentOff, normalize: normalize };
})();

/* Product card markup, shared by the Node build and the browser (filters, search, wishlist,
   recently viewed). Mirrors snippets/product-card.liquid of the theme: same element and class roots.
   `o.base` is the relative path from the current page to the site root ("" or "../"). */
var SKS_CARD = (function (F) {
  var GENDER_WORD = /\s+(Uomo|Donna|Unisex|Bambino|Bambina|Junior)\b/;
  function splitTitle(t) {
    // "Giacca Ashby Wax Uomo Navy" -> ["Giacca Ashby Wax Uomo", "Navy"]
    var m = t.match(/^(.*?\b(?:Uomo|Donna|Unisex|Bambino|Bambina|Junior)\b)\s+(.+)$/);
    return m ? [m[1], m[2]] : [t, ''];
  }
  function priceHtml(p) {
    var from = p.priceVaries ? '<span class="price__from">da</span> ' : '';
    if (p.compareAt) {
      return '<p class="price-list">' +
        '<span class="price price--sale"><span class="visually-hidden">Prezzo scontato </span>' + from + F.money(p.price) + '</span> ' +
        '<s class="price price--compare"><span class="visually-hidden">Prezzo originale </span>' + F.money(p.compareAt) + '</s> ' +
        '<span class="price-list__off">−' + F.percentOff(p) + '%</span></p>';
    }
    return '<p class="price-list"><span class="price">' + from + F.money(p.price) + '</span></p>';
  }
  function badges(p) {
    var out = [];
    if (p.archived) out.push('<li class="badge badge--muted">Non più disponibile</li>');
    else {
      if (p.isNew) out.push('<li class="badge badge--new">Nuovo</li>');
      if (p.onlyOneSizeLeft) out.push('<li class="badge badge--outline">Ultima taglia</li>');
    }
    return out.length ? '<ul class="product-card__badges" role="list">' + out.slice(0, 2).join('') + '</ul>' : '';
  }
  function render(p, o) {
    o = o || {};
    var base = o.base || '';
    var url = base + 'products/' + encodeURIComponent(p.handle) + '.html';
    var t = splitTitle(p.title);
    var img0 = p.images[0], img1 = p.images[1];
    var native = F.nativeWidth(img0);
    var sizes = o.sizes || '(min-width: 1280px) 19vw, (min-width: 768px) 26vw, 40vw';
    var eager = o.eager ? ' fetchpriority="high"' : ' loading="lazy"';
    var avail = (p.sizes || []).filter(function (s) { return s[1]; });
    var quick = '';
    if (!p.archived && avail.length) {
      if (p.sizes.length === 1) {
        var only = p.sizes[0][0];
        var unica = /^(t\.?u\.?|tu|unica|taglia unica|os|one size)$/i.test(String(only).trim());
        quick = '<button type="button" class="product-card__quick-add" data-quick-add data-size="' + F.esc(only) + '">' +
          '<span>Aggiungi<span class="product-card__quick-hint">' + (unica ? ', taglia unica' : '') + '</span>' + (unica ? '' : ' taglia ' + F.esc(only)) + '</span></button>';
      } else {
        quick = '<div class="product-card__quick" data-quick>' +
          '<button type="button" class="product-card__quick-toggle" aria-expanded="false" data-quick-toggle>' +
          '<svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg><span>Aggiungi<span class="product-card__quick-hint">: scegli la taglia</span></span></button>' +
          '<div class="product-card__sizes" role="group" aria-label="Taglie disponibili per ' + F.esc(p.title) + '" hidden>' +
          p.sizes.map(function (s) {
            return '<button type="button" class="size-chip" data-quick-size="' + F.esc(s[0]) + '"' + (s[1] ? '' : ' disabled aria-disabled="true"') + '>' + F.esc(s[0]) + '</button>';
          }).join('') + '</div></div>';
      }
    }
    var swatches = '';
    if (p.swatches && p.swatches.length) {
      var shown = p.swatches.slice(0, 4);
      swatches = '<ul class="product-card__swatches" role="list" aria-label="Altri colori">' +
        '<li><span class="swatch is-current" style="--sw:' + (p.hex || '#ccc') + '" title="' + F.esc(t[1] || p.color || '') + '"></span></li>' +
        shown.map(function (s) {
          return '<li><a class="swatch" style="--sw:' + s[1] + '" href="' + base + 'products/' + encodeURIComponent(s[0]) + '.html" aria-label="' + F.esc(s[2]) + '" title="' + F.esc(s[2]) + '"></a></li>';
        }).join('') +
        (p.swatches.length > 4 ? '<li class="product-card__swatch-more">+' + (p.swatches.length - 4) + '</li>' : '') + '</ul>';
    }
    return '<product-card class="product-card' + (p.archived ? ' is-archived' : '') + '" data-handle="' + F.esc(p.handle) + '">' +
      '<div class="product-card__media" data-vt-media>' +
        '<a class="product-card__image-link" href="' + url + '" tabindex="-1" aria-hidden="true">' +
          '<img class="product-card__img product-card__img--primary" src="' + F.cdn(img0, 720) + '" srcset="' + F.srcset(img0, [360, 540, 720], 0, native) + '" sizes="' + sizes + '" width="1000" height="1000" alt="' + F.esc(p.title + ', ' + p.brand) + '"' + eager + ' decoding="async">' +
          (img1 ? '<img class="product-card__img product-card__img--secondary" src="' + F.cdn(img1, 720) + '" srcset="' + F.srcset(img1, [360, 540, 720], 0, F.nativeWidth(img1)) + '" sizes="' + sizes + '" width="1000" height="1000" alt="" loading="lazy" decoding="async">' : '') +
        '</a>' + badges(p) +
        '<button type="button" class="product-card__wish" data-wish="' + F.esc(p.handle) + '" aria-pressed="false" aria-label="Salva nei preferiti: ' + F.esc(p.title) + '">' +
          '<svg class="icon" aria-hidden="true"><use href="#i-heart"/></svg></button>' + quick +
      '</div>' +
      '<div class="product-card__info">' +
        '<p class="product-card__brand" translate="no">' + F.esc(p.brand) + '</p>' +
        '<h3 class="product-card__title"><a href="' + url + '"><span class="product-card__name">' + F.esc(t[0].replace(GENDER_WORD, ' $1')) + '</span>' + (t[1] ? '<span class="visually-hidden">, </span><span class="product-card__colour">' + F.esc(t[1]) + '</span>' : '') + '</a></h3>' +
        priceHtml(p) + swatches +
      '</div>' +
    '</product-card>';
  }
  return { render: render, splitTitle: splitTitle, priceHtml: priceHtml };
})(SKS_FMT);

/* ---------- utilities ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ROOT = document.documentElement;
const BASE = ROOT.dataset.base || '';
const MOTION_OK = () => !ROOT.classList.contains('reduce-motion');
const FINE_POINTER = matchMedia('(hover: hover) and (pointer: fine)');

// storage that never throws (private windows, blocked site data) and falls back to memory
const memory = {};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return k in memory ? memory[k] : d; } },
  set(k, v) { memory[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* memory only */ } }
};

function announce(msg) {
  const r = $('#live-region');
  if (!r) return;
  r.textContent = '';
  setTimeout(() => { r.textContent = msg; }, 60);
}

function toast(msg, action) {
  const region = $('#toast-region');
  if (!region) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${SKS_FMT.esc(msg)}</span>`;
  if (action) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = action.label;
    b.addEventListener('click', () => { action.run(); el.remove(); });
    el.append(b);
  }
  // a modal dialog puts everything else under it (top layer, inert): host the region in the open dialog
  const host = document.querySelector('dialog[open]') || document.body;
  if (region.parentElement !== host) host.append(region);
  region.append(el);
  announce(msg);
  // time to read it (and to reach "Annulla"); the countdown pauses while the pointer or focus is on it
  let left = action ? 10000 : Math.max(4000, msg.length * 60), start = 0, timer = 0, held = 0;
  const run = () => { if (held > 0 && --held > 0) return; start = Date.now(); timer = setTimeout(() => el.remove(), left); };
  const hold = () => { if (held++ === 0) { clearTimeout(timer); left -= Date.now() - start; } };
  el.addEventListener('pointerenter', hold); el.addEventListener('pointerleave', run);
  el.addEventListener('focusin', hold); el.addEventListener('focusout', run);
  run();
}

// card data registered by the build for every card on the page (+ cards rendered later)
const CARDS = (() => { try { return JSON.parse($('#cards-json')?.textContent || '{}'); } catch { return {}; } })();
function registerCards(list) { for (const p of list) CARDS[p.handle] = { t: p.title, b: p.brand, p: p.price, c: p.compareAt || 0, i: p.images[0], s: p.sizes }; }
const productUrl = h => `${BASE}products/${encodeURIComponent(h)}.html`;
const yieldToMain = () => (window.scheduler && scheduler.yield) ? scheduler.yield() : new Promise(r => setTimeout(r, 0));

// delivery window in Italy, as the shipping page states: 1-3 working days from the next working day
function deliveryWindow(fmt = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const add = (date, n) => { const x = new Date(date); while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) n--; } return x; };
  const now = new Date(), f = new Intl.DateTimeFormat('it-IT', fmt);
  return `tra ${f.format(add(now, 1))} e ${f.format(add(now, 3))}`;
}

// tracking consent from the cookie banner (97-floating.js): the for-you sources use the visitor's searches
// and viewed products only with it, as the live endpoint does (a/m consent flags)
function trackingOK() { const c = store.get('sks-consent', null); return c === 'all' || !!(c && typeof c === 'object' && (c.analytics || c.marketing || c.preferences)); }

/* ---------- dialogs: native <dialog> gives focus trap, Esc and an inert page; we return focus ---------- */
const openers = new WeakMap();
function openDialog(id, opener) {
  const d = document.getElementById(id);
  if (!d || d.open) return d;
  $$('dialog[open]').forEach(o => o !== d && closeDialog(o));
  openers.set(d, opener || document.activeElement);
  d.showModal();
  d.dispatchEvent(new CustomEvent('dialog:open'));
  return d;
}
function closeDialog(d) {
  if (!d || !d.open) return;
  d.close();
}
document.addEventListener('click', e => {
  const open = e.target.closest('[data-open-dialog]');
  if (open) { e.preventDefault(); openDialog(open.dataset.openDialog, open); return; }
  const close = e.target.closest('[data-close-dialog]');
  if (close) { closeDialog(close.closest('dialog')); return; }
  // click on the backdrop closes
  if (e.target.tagName === 'DIALOG' && e.target.open) {
    const r = e.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(e.target);
  }
});
document.addEventListener('close', e => {
  const d = e.target;
  if (d.tagName !== 'DIALOG') return;
  // focus goes back to the opener; if an add hid or disabled it (the size chip, the look button), to the
  // nearest control that still makes sense: the card's "+", the look form, or the page
  const o = openers.get(d);
  const can = el => el && el.isConnected && !el.disabled && el.getClientRects().length > 0;
  const back = can(o) ? o : o && (o.closest('product-card')?.querySelector('[data-quick-toggle], [data-quick-add], .product-card__title a') ||
    o.closest('form')?.querySelector('input:checked:not([disabled]), button:not([disabled]), a[href]'));
  (can(back) ? back : document.getElementById('main'))?.focus({ preventScroll: true });
  const region = d.querySelector('#toast-region');
  if (region) document.body.append(region);
  d.dispatchEvent(new CustomEvent('dialog:close'));
}, true);

/* mobile menu: second-level panels */
document.addEventListener('click', e => {
  const open = e.target.closest('[data-panel-open]');
  if (open) {
    const panel = document.getElementById(open.dataset.panelOpen);
    panel.hidden = false;
    panel.querySelector('[data-panel-close]').focus();
    panel._opener = open;
    return;
  }
  const back = e.target.closest('[data-panel-close]');
  if (back) {
    const panel = back.closest('.drawer-nav__panel');
    panel.hidden = true;
    panel._opener && panel._opener.focus();
  }
});
$('#drawer-menu')?.addEventListener('dialog:close', () => $$('.drawer-nav__panel').forEach(p => { p.hidden = true; }));

/* ---------- header: tone over the hero, hide on scroll (home and storia), mega menus ---------- */
(() => {
  const header = $('[data-header]');
  if (!header) return;
  // transparent over the hero until the sentinel leaves the viewport (no scroll listener)
  if (header.classList.contains('header--transparent')) {
    header.classList.add('is-over-hero');
    const sentinel = $('.header-sentinel');
    new IntersectionObserver(([e]) => header.classList.toggle('is-over-hero', e.isIntersecting), { rootMargin: '0px' }).observe(sentinel);
  }
  // Prestige's hide-on-scroll behaviour, limited to the pages that carry data-hide-on-scroll
  if (header.hasAttribute('data-hide-on-scroll')) {
    let last = scrollY, ticking = false;
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = scrollY;
        const open = header.querySelector('[aria-expanded="true"]');
        if (!open && Math.abs(y - last) > 6) header.classList.toggle('is-hidden', y > last && y > 240);
        last = y; ticking = false;
      });
    }, { passive: true });
  }

  // mega menus: hover intent (120ms) on fine pointers, click/tap and keyboard everywhere
  const items = $$('[data-mega]', header);
  let openItem = null, timer = 0;
  const panelOf = item => item.querySelector('.mega-menu');
  const btnOf = item => item.querySelector('.header__link');
  function open(item) {
    if (openItem === item) return;
    close(openItem, false);
    openItem = item;
    const p = panelOf(item);
    p.hidden = false;
    requestAnimationFrame(() => p.classList.add('is-open'));
    btnOf(item).setAttribute('aria-expanded', 'true');
  }
  function close(item, focus) {
    if (!item) return;
    const p = panelOf(item);
    p.classList.remove('is-open');
    btnOf(item).setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!p.classList.contains('is-open')) p.hidden = true; }, 170);
    if (focus) btnOf(item).focus();
    if (openItem === item) openItem = null;
  }
  for (const item of items) {
    const btn = btnOf(item);
    btn.addEventListener('click', () => (openItem === item ? close(item) : open(item)));
    item.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; clearTimeout(timer); timer = setTimeout(() => open(item), openItem ? 0 : 120); });
    item.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') return; clearTimeout(timer); timer = setTimeout(() => close(item), 160); });
    item.addEventListener('keydown', e => { if (e.key === 'Escape' && openItem === item) { e.stopPropagation(); close(item, true); } });
    item.addEventListener('focusout', e => { if (!item.contains(e.relatedTarget)) close(item); });
  }
  document.addEventListener('click', e => { if (openItem && !openItem.contains(e.target)) close(openItem); });
})();

// the live menu icons load with their menu: on the first hover or focus of the top item, before it opens
$$('.header__item[data-mega]').forEach(item => {
  const warm = () => $$('img[loading="lazy"]', item).forEach(i => { i.loading = 'eager'; });
  item.addEventListener('pointerenter', warm, { once: true });
  item.addEventListener('focusin', warm, { once: true });
});

/* ---------- Shopify's country and language selectors (header, mobile menu, footer) ----------
   In the theme these are Prestige's localization forms (POST /localization); in the preview a pick says
   what the site would do. */
(() => {
  const close = except => $$('.locale__btn[aria-expanded="true"]').forEach(b => {
    if (b === except) return;
    b.setAttribute('aria-expanded', 'false');
    document.getElementById(b.getAttribute('aria-controls')).hidden = true;
  });
  document.addEventListener('click', e => {
    const btn = e.target.closest('.locale__btn');
    if (btn) {
      const pop = document.getElementById(btn.getAttribute('aria-controls'));
      const open = btn.getAttribute('aria-expanded') !== 'true';
      close(btn);
      btn.setAttribute('aria-expanded', String(open));
      pop.hidden = !open;
      if (open) pop.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    const pick = e.target.closest('[data-locale-pick]');
    if (pick) {
      const lang = !!pick.closest('.locale__pop--lang');
      close();
      if (pick.getAttribute('aria-pressed') !== 'true') toast(lang ? `Anteprima: sul sito si apre la versione in ${pick.dataset.localePick}.` : `Anteprima: sul sito il negozio passa a ${pick.dataset.localePick}.`);
      return;
    }
    if (!e.target.closest('.locale__pop')) close();
  });
  document.addEventListener('keydown', e => {
    const open = $('.locale__btn[aria-expanded="true"]');
    if (e.key === 'Escape' && open) { close(); open.focus(); }
  });
})();

/* ---------- cart (proto-cart: stands in for Shopify's /cart/add.js; same UI states as the theme) ---------- */
const FREE_SHIPPING = 50;
const MOCK_LATENCY = 350;
const Cart = {
  get lines() { return store.get('sks-cart', []); },
  save(lines) { store.set('sks-cart', lines); document.dispatchEvent(new CustomEvent('cart:change')); },
  count() { return this.lines.reduce((n, l) => n + l.qty, 0); },
  subtotal() { return this.lines.reduce((n, l) => n + l.qty * l.price, 0); },
  add(info, size, qty = 1) {
    const lines = this.lines;
    const key = info.handle + '|' + size;
    const found = lines.find(l => l.key === key);
    if (found) found.qty += qty;
    else lines.unshift({ key, handle: info.handle, size, qty, title: info.title, brand: info.brand, price: info.price, compareAt: info.compareAt || 0, image: info.image });
    this.save(lines);
    return key;
  },
  setQty(key, qty) { const lines = this.lines; const l = lines.find(x => x.key === key); if (!l) return; l.qty = Math.max(1, Math.min(9, qty)); this.save(lines); },
  remove(key) { const lines = this.lines; const i = lines.findIndex(x => x.key === key); if (i < 0) return null; const [l] = lines.splice(i, 1); this.save(lines); return { line: l, index: i }; },
  restore({ line, index }) { const lines = this.lines; lines.splice(index, 0, line); this.save(lines); }
};

function infoFromCard(handle) {
  const c = CARDS[handle];
  return c ? { handle, title: c.t, brand: c.b, price: c.p, compareAt: c.c, image: c.i } : null;
}

function renderCart(newKey) {
  const lines = Cart.lines, count = Cart.count(), subtotal = Cart.subtotal();
  $$('[data-cart-count]').forEach(b => {
    b.hidden = !count;
    const changed = b.dataset.n !== undefined && b.dataset.n !== String(count);
    b.dataset.n = count; b.textContent = count;
    if (changed) { b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump'); }
  });
  const text = $('[data-cart-count-text]'); if (text) text.textContent = count ? `(${count})` : '';
  const left = Math.max(0, FREE_SHIPPING - subtotal);
  $$('[data-shipping-text]').forEach(t => {
    t.innerHTML = !count ? 'Spedizione gratuita in Italia da 50,00&nbsp;€'
      : left > 0 ? `Ti mancano <strong>${SKS_FMT.money(left)}</strong> per la spedizione gratuita in Italia`
      : '<strong>Spedizione gratuita</strong> in Italia: sbloccata';
  });
  $$('[data-shipping-bar]').forEach(b => b.style.setProperty('--pct', Math.min(1, subtotal / FREE_SHIPPING)));
  $$('[data-cart-subtotal]').forEach(s => { s.textContent = SKS_FMT.money(subtotal); });
  $$('[data-cart-shipping]').forEach(s => { s.textContent = !count ? '' : left > 0 ? '5,90\u00a0€ in Italia' : 'gratuita in Italia'; });
  document.dispatchEvent(new CustomEvent('cart:rendered', { detail: { subtotal } }));
  $$('[data-cart-lines]').forEach(list => {
    list.innerHTML = lines.map(l => `<li class="cart-line${l.key === newKey ? ' is-new' : ''}" data-key="${SKS_FMT.esc(l.key)}">
      <a class="cart-line__media" href="${productUrl(l.handle)}" tabindex="-1" aria-hidden="true"><img src="${SKS_FMT.cdn(l.image, 240)}" alt="" width="200" height="250" loading="lazy"></a>
      <div>
        <p class="cart-line__brand" translate="no">${SKS_FMT.esc(l.brand)}</p>
        <p class="cart-line__title"><a href="${productUrl(l.handle)}">${SKS_FMT.esc(l.title)}</a></p>
        <p class="cart-line__meta">${SKS_FMT.esc(SKS_FMT.sizeLabel(l.size))}</p>
        <div class="cart-line__actions">
          <div class="qty" role="group" aria-label="Quantità di ${SKS_FMT.esc(l.title)}">
            <button type="button" data-qty="-1" aria-label="Togli uno"><svg class="icon" aria-hidden="true"><use href="#i-minus"/></svg></button>
            <output aria-live="polite">${l.qty}</output>
            <button type="button" data-qty="1" aria-label="Aggiungi uno"><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg></button>
          </div>
          <button type="button" class="cart-line__remove" data-remove aria-label="Rimuovi ${SKS_FMT.esc(l.title)}, taglia ${SKS_FMT.esc(l.size)}">Rimuovi</button>
        </div>
      </div>
      <p class="cart-line__price">${SKS_FMT.money(l.price * l.qty)}${l.compareAt ? `<br><s class="price--compare">${SKS_FMT.money(l.compareAt * l.qty)}</s>` : ''}</p>
    </li>`).join('');
  });
  $$('[data-cart-empty]').forEach(e => { e.hidden = !!count; });
  $$('[data-cart-foot]').forEach(f => { f.hidden = !count; });
  $$('[data-cart-delivery]').forEach(d => { d.textContent = deliveryWindow({ weekday: 'short', day: 'numeric', month: 'short' }); });
}

document.addEventListener('click', e => {
  const line = e.target.closest('.cart-line');
  if (line) {
    const key = line.dataset.key;
    const q = e.target.closest('[data-qty]');
    if (q) { const l = Cart.lines.find(x => x.key === key); Cart.setQty(key, l.qty + +q.dataset.qty); return; }
    if (e.target.closest('[data-remove]')) {
      const removed = Cart.remove(key);
      toast(`Rimosso dal carrello: ${removed.line.title}`, { label: 'Annulla', run: () => Cart.restore(removed) });
      announce('Prodotto rimosso dal carrello');
      return;
    }
  }
  const sug = e.target.closest('[data-add-product]');
  if (sug) { addWithFeedback(sug, JSON.parse(sug.dataset.addProduct), sug.dataset.size, false); }
});

// the shared "add" feedback: label kept, spinner after 160ms (≥320ms), then "Aggiunto", drawer, live message
async function addWithFeedback(button, info, size, openDrawer = true) {
  if (button.getAttribute('aria-busy') === 'true') return;
  const label = button.innerHTML;
  const spin = setTimeout(() => button.setAttribute('aria-busy', 'true'), 160);
  const started = performance.now();
  await new Promise(r => setTimeout(r, MOCK_LATENCY));
  clearTimeout(spin);
  if (button.getAttribute('aria-busy') === 'true') await new Promise(r => setTimeout(r, Math.max(0, 480 - (performance.now() - started))));
  button.removeAttribute('aria-busy');
  const key = Cart.add(info, size);
  renderCart(key);
  announce(`${info.title}, taglia ${size}, aggiunto al carrello. Totale ${SKS_FMT.money(Cart.subtotal())}.`);
  if (button.dataset.addedLabel !== undefined || button.classList.contains('button--primary')) {
    button.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg> Aggiunto al carrello`;
    setTimeout(() => { button.innerHTML = label; }, 1800);
  }
  if (openDrawer) openDialog('cart-drawer', button);
}

// quick add from product cards: toggle opens the size row, a size adds; one-size products add directly
document.addEventListener('click', e => {
  const toggle = e.target.closest('[data-quick-toggle]');
  if (toggle) {
    const sizes = toggle.parentElement.querySelector('.product-card__sizes');
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    $$('[data-quick-toggle][aria-expanded="true"]').forEach(t => { if (t !== toggle) { t.setAttribute('aria-expanded', 'false'); t.parentElement.querySelector('.product-card__sizes').hidden = true; } });
    toggle.setAttribute('aria-expanded', String(open));
    sizes.hidden = !open;
    if (open) sizes.querySelector('button:not([disabled])')?.focus();
    return;
  }
  const size = e.target.closest('[data-quick-size], [data-quick-add]');
  if (size) {
    const card = size.closest('product-card');
    const info = infoFromCard(card.dataset.handle);
    if (!info) return;
    const s = size.dataset.quickSize || size.dataset.size;
    const wrap = size.closest('[data-quick]');
    addWithFeedback(size, info, s).then(() => {
      if (wrap) { wrap.querySelector('.product-card__sizes').hidden = true; wrap.querySelector('[data-quick-toggle]').setAttribute('aria-expanded', 'false'); }
    });
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const t = $('[data-quick-toggle][aria-expanded="true"]');
  if (t) { t.setAttribute('aria-expanded', 'false'); t.parentElement.querySelector('.product-card__sizes').hidden = true; t.focus(); }
});

document.addEventListener('cart:change', () => renderCart());
addEventListener('storage', e => { if (e.key === 'sks-cart') renderCart(); });
renderCart();

/* ---------- wishlist (stands in for the back-in-stock app's /apps/wishlist) ---------- */
const Wish = {
  get list() { return store.get('sks-wish', []); },
  has(h) { return this.list.some(x => x.handle === h); },
  toggle(h) {
    let list = this.list;
    const on = !list.some(x => x.handle === h);
    if (on) { const c = CARDS[h]; list.unshift({ handle: h, title: c?.t, brand: c?.b, price: c?.p, compareAt: c?.c, images: [c?.i], sizes: c?.s || [] }); }
    else list = list.filter(x => x.handle !== h);
    store.set('sks-wish', list);
    document.dispatchEvent(new CustomEvent('wish:change'));
    return on;
  }
};
function renderWishState() {
  const list = Wish.list;
  $$('[data-wish]').forEach(b => {
    const on = list.some(x => x.handle === b.dataset.wish);
    b.setAttribute('aria-pressed', String(on));
    if (b.classList.contains('product__wish')) b.setAttribute('aria-label', on ? 'Salvato nei preferiti: togli' : 'Salva nei preferiti');
  });
  $$('[data-wish-count]').forEach(c => { c.hidden = !list.length; c.textContent = list.length; });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-wish]');
  if (!b) return;
  e.preventDefault();
  const on = Wish.toggle(b.dataset.wish);
  const title = CARDS[b.dataset.wish]?.t || 'Prodotto';
  announce(on ? `${title} salvato nei preferiti` : `${title} tolto dai preferiti`);
  if (on) toast('Salvato nei preferiti', { label: 'Vedi', run: () => { location.href = `${BASE}pages/swym-wishlist.html`; } });
});
document.addEventListener('wish:change', renderWishState);
renderWishState();

/* ---------- recently viewed ---------- */
const Recent = {
  get list() { return store.get('sks-recent', []); },
  push(p) { const l = this.list.filter(x => x.handle !== p.handle); l.unshift(p); store.set('sks-recent', l.slice(0, 12)); }
};

/* ---------- predictive search: index loaded on the first open (keeps every page light) ---------- */
(() => {
  const dialog = $('#search-dialog');
  if (!dialog) return;
  const input = $('[data-search-input]', dialog);
  const idle = $('[data-search-idle]', dialog), out = $('[data-search-results]', dialog);
  let loading = null;
  const loadIndex = () => loading || (loading = new Promise((res, rej) => {
    if (window.SKS_SEARCH) return res(window.SKS_SEARCH);
    const s = document.createElement('script');
    s.src = `${BASE}assets/data/search.js`;
    s.onload = () => res(window.SKS_SEARCH); s.onerror = rej;
    document.head.append(s);
  }));
  const mark = (text, q) => {
    const n = SKS_FMT.normalize(text), i = n.indexOf(q);
    if (!q || i < 0) return SKS_FMT.esc(text);
    return SKS_FMT.esc(text.slice(0, i)) + '<mark>' + SKS_FMT.esc(text.slice(i, i + q.length)) + '</mark>' + SKS_FMT.esc(text.slice(i + q.length));
  };
  function search(index, raw) {
    const q = SKS_FMT.normalize(raw);
    if (!q) return null;
    const terms = q.split(' ');
    const score = hay => terms.every(t => hay.includes(t)) ? (hay.startsWith(terms[0]) ? 2 : 1) : 0;
    const products = index.products.map(p => [p, score(SKS_FMT.normalize(`${p[2]} ${p[1]} ${p[3]}`))]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    const brands = index.brands.filter(b => score(SKS_FMT.normalize(b[1])));
    const colls = index.collections.filter(c => score(SKS_FMT.normalize(c[1])));
    // the session's last search feeds "Scelti per te" (with tracking consent, as live)
    if (q.length >= 3 && products.length && trackingOK()) { try { sessionStorage.setItem('sks-last-q', raw.trim()); } catch { /* private mode */ } }
    return { q, products, brands, colls };
  }
  function renderIdle() {
    const recent = Recent.list.slice(0, 6);
    const wrap = $('[data-recent-wrap]', dialog);
    wrap.hidden = !recent.length;
    $('[data-recent]', dialog).innerHTML = recent.map(hit).join('');
  }
  const hit = p => `<a class="search-hit" href="${productUrl(p.handle)}"><span class="search-hit__media"><img src="${SKS_FMT.cdn(p.image || p.images?.[0], 300)}" alt="" loading="lazy" width="300" height="300"></span><span class="search-hit__brand" translate="no">${SKS_FMT.esc(p.brand)}</span><span>${SKS_FMT.esc(p.title)}</span><span class="tabular">${SKS_FMT.money(p.price)}</span></a>`;
  async function run() {
    const raw = input.value.trim();
    if (!raw) { out.hidden = true; idle.hidden = false; renderIdle(); return; }
    const index = await loadIndex();
    const r = search(index, raw);
    idle.hidden = true; out.hidden = false;
    const url = `${BASE}search.html?q=${encodeURIComponent(raw)}`;
    if (!r.products.length && !r.brands.length && !r.colls.length) {
      out.innerHTML = `<div class="search-empty"><h3>Nessun risultato per “${SKS_FMT.esc(raw)}”</h3><p class="muted">Prova con il nome della marca o del capo, per esempio “piumino” o “Barbour”. Oppure chiedi a noi in negozio: ${'+39 015 405464'}.</p><ul class="chips" role="list" style="margin-top:16px">${['Barbour', 'Piumino', 'Samba', 'Pedule'].map(s => `<li><button type="button" class="chip" data-search-suggest="${s}">${s}</button></li>`).join('')}</ul></div>`;
      return;
    }
    const products = r.products.slice(0, 8).map(p => ({ handle: p[0], title: p[1], brand: p[2], price: p[5], image: p[6] }));
    out.innerHTML = `<div class="search-results${r.brands.length || r.colls.length ? '' : ' search-results--single'}">
      <div class="search-results__side">
        ${r.brands.length ? `<h3>Marche</h3><ul role="list">${r.brands.slice(0, 5).map(b => `<li><a href="${BASE}collections/${b[0]}.html">${mark(b[1], r.q)} <span class="meta">${b[2]}</span></a></li>`).join('')}</ul>` : ''}
        ${r.colls.length ? `<h3>Categorie</h3><ul role="list">${r.colls.slice(0, 6).map(c => `<li><a href="${BASE}collections/${c[0]}.html">${mark(c[1], r.q)}</a></li>`).join('')}</ul>` : ''}
      </div>
      <div class="search-results__main">
        <h3>Prodotti <span class="meta">${r.products.length}</span></h3>
        <div class="search-results__grid">${products.map(hit).join('')}</div>
        <p class="search-results__all"><a class="button button--outline" href="${url}">Vedi tutti i ${r.products.length} risultati</a></p>
      </div></div>`;
  }
  let t = 0;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 120); });
  dialog.addEventListener('dialog:open', () => { loadIndex(); renderIdle(); setTimeout(() => input.focus(), 30); });
  dialog.addEventListener('click', e => { const s = e.target.closest('[data-search-suggest]'); if (s) { e.preventDefault(); input.value = s.dataset.searchSuggest; run(); input.focus(); } });
  // "/" opens search from anywhere (not while typing)
  document.addEventListener('keydown', e => { if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openDialog('search-dialog'); } });
  window.SKS_SEARCH_API = { loadIndex, search };
})();

/* ---------- rails: the live sliders' behaviour ("Prodotti simili", snippets/similar-products.liquid) over
   native scroll-snap: a page at a time, arrows over the photos disabled at the ends, swipe on touch, two
   cards per view on phones. A rail filled later (Scelti per te) sends "rail:update". ---------- */
function initRail(rail) {
  const track = $('.rail__track', rail), prev = $('[data-rail-prev]', rail), next = $('[data-rail-next]', rail), bar = $('.rail__progress span', rail);
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = track.scrollLeft >= max - 2;
    rail.classList.toggle('is-static', max <= 2);
    if (bar) { const vis = track.clientWidth / track.scrollWidth; bar.style.setProperty('--progress', Math.min(1, vis + (max > 0 ? (track.scrollLeft / max) * (1 - vis) : 1))); }
  };
  track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  addEventListener('resize', update, { passive: true });
  rail.addEventListener('rail:update', update);
  const page = dir => track.scrollBy({ left: dir * track.clientWidth, behavior: MOTION_OK() ? 'smooth' : 'auto' });
  prev?.addEventListener('click', () => page(-1));
  next?.addEventListener('click', () => page(1));
  update();
}
$$('[data-rail]').forEach(initRail);

/* ---------- footer motion switch (remembered, applied before paint by the inline <head> script) ---------- */
$$('[data-motion-toggle]').forEach(t => {
  const sync = () => t.setAttribute('aria-checked', String(MOTION_OK()));
  sync();
  t.addEventListener('click', () => {
    const off = MOTION_OK();
    ROOT.classList.toggle('reduce-motion', off);
    store.set('sks-motion', off ? 'off' : 'on');
    try { localStorage.setItem('sks-motion', off ? 'off' : 'on'); } catch { /* memory only */ }
    sync();
    announce(off ? 'Animazioni ridotte' : 'Animazioni attive');
  });
});

/* ---------- prototype forms: never submitted, they say so ---------- */
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-proto-form]');
  if (!f) return;
  e.preventDefault();
  const invalid = [...f.elements].find(el => el.willValidate && !el.checkValidity());
  if (invalid) { invalid.focus(); invalid.setAttribute('aria-invalid', 'true'); toast('Controlla il campo evidenziato'); return; }
  // close the dialog first, so the confirmation is shown on the page and nothing is reset before it is read
  const d = f.closest('dialog');
  if (d && f.hasAttribute('data-close-on-success')) d.close();
  toast(f.dataset.protoForm || 'Anteprima: il modulo non viene inviato.');
  f.reset();
});

/* ---------- luxe-motion: only the theme's Motion One (inView, scroll, animate) + CSS ---------- */
(() => {
  const mode = ROOT.dataset.mode;
  const rich = mode === 'persuade' || mode === 'experience';
  const reveal = $$('.mask-title, .reveal-image, .ridge');
  // elements already on screen are marked first, so adding .motion-ready never hides what is visible
  const vh = innerHeight;
  for (const el of reveal) { const r = el.getBoundingClientRect(); if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add('is-in'); }
  ROOT.classList.add('motion-ready');
  if (rich) {
    // one observer; anything scrolled past also reveals, and a single scrollend check catches
    // elements a fast jump skipped entirely, so nothing can stay hidden
    const show = el => { el.classList.add('is-in'); io.unobserve(el); };
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting || e.boundingClientRect.top < 0) show(e.target);
    }, { rootMargin: '0px 0px -8% 0px' });
    reveal.forEach(el => { if (!el.classList.contains('is-in')) io.observe(el); });
    addEventListener('scrollend', () => {
      for (const el of reveal) if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < innerHeight) show(el);
    }, { passive: true });
  } else {
    reveal.forEach(el => el.classList.add('is-in'));
  }

  // tabs (Nuovi arrivi): click and arrow keys, ARIA tabs pattern
  $$('[role="tablist"]').forEach(list => {
    const tabs = $$('[role="tab"]', list);
    const select = t => tabs.forEach(x => {
      const on = x === t;
      x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; x.classList.toggle('is-active', on);
      document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
      if (on) document.getElementById(x.getAttribute('aria-controls')).querySelector('.rail__track')?.dispatchEvent(new Event('scroll'));
    });
    list.addEventListener('click', e => { const t = e.target.closest('[role="tab"]'); if (t) select(t); });
    list.addEventListener('keydown', e => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0 || !['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      n.focus(); select(n);
    });
  });

  // 10. home looks rail: sticky container, horizontal travel linked to scroll (desktop, motion allowed)
  const rail = $('[data-looks-rail]');
  if (rail) {
    const track = $('.looks-rail__track', rail);
    let stop = null;
    const setup = () => {
      stop && stop(); stop = null;
      rail.classList.remove('is-pinned'); rail.style.height = ''; track.style.transform = '';
      if (!MOTION_OK() || !matchMedia('(min-width: 1024px)').matches) return;
      const distance = track.scrollWidth - document.documentElement.clientWidth;
      if (distance <= 40) return;
      rail.classList.add('is-pinned');
      rail.style.height = `calc(100svh + ${distance}px)`;
      const anim = animate(track, { transform: ['translateX(0px)', `translateX(${-distance}px)`] }, { easing: 'linear' });
      stop = scroll(anim, { target: rail, offset: ['start start', 'end end'] });
    };
    let t = 0;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(setup, 200); }, { passive: true });
    document.fonts?.ready.then(setup);
    setup();
    // keyboard users: focusing a card inside the pinned rail scrolls the page to it
    rail.addEventListener('focusin', e => {
      if (!rail.classList.contains('is-pinned')) return;
      const card = e.target.closest('.look-card'); if (!card) return;
      const i = $$('.look-card', rail).indexOf(card);
      const max = rail.offsetHeight - innerHeight;
      scrollTo({ top: rail.offsetTop + max * (i / Math.max(1, $$('.look-card', rail).length - 1)), behavior: 'auto' });
    });
  }
  window.SKS_MOTION = { scroll, animate, inView };
})();

/* ---------- luxe-transitions: cross-document View Transitions, card -> product image morph ----------
   One shared name per transition (product-media / look-media), set only on the clicked card in pageswap
   and on the arriving page's main media, so it is always unique. Back navigation morphs in reverse. */
(() => {
  let lastCard = null;
  document.addEventListener('pointerdown', e => {
    lastCard = e.target.closest('product-card, .look-card, .search-hit');
  }, { capture: true });
  document.addEventListener('keydown', e => { if (e.key === 'Enter') lastCard = document.activeElement?.closest?.('product-card, .look-card'); }, { capture: true });

  const mediaOf = el => el && (el.querySelector('[data-vt-media]') || el.querySelector('[data-vt-look]') || el.querySelector('.search-hit__media'));
  const nameFor = el => el && (el.querySelector('[data-vt-look]') ? 'look-media' : 'product-media');

  addEventListener('pageswap', e => {
    const vt = e.viewTransition;
    if (!vt) return;
    // a skipped transition rejects these: handle them on every path, not only when a name is set
    vt.ready.catch(() => {}); vt.updateCallbackDone.catch(() => {}); vt.finished.catch(() => {});
    if (ROOT.classList.contains('reduce-motion')) return;
    const media = mediaOf(lastCard);
    const target = e.activation?.entry?.url || '';
    if (!media || !lastCard) return;
    const link = lastCard.querySelector('a[href]');
    if (!link || new URL(link.href, location.href).pathname !== new URL(target, location.href).pathname) return;
    media.style.viewTransitionName = nameFor(lastCard);
    const clear = () => { media.style.viewTransitionName = ''; };
    e.viewTransition.finished.then(clear, clear);
  });

  addEventListener('pagereveal', e => {
    if (!e.viewTransition) return;
    e.viewTransition.ready.catch(() => {}); e.viewTransition.updateCallbackDone.catch(() => {}); e.viewTransition.finished.catch(() => {});
    if (ROOT.classList.contains('reduce-motion')) { e.viewTransition.skipTransition(); return; }
    // arriving on a product or look page: its main media carries the shared name
    const main = $('[data-vt-main]');
    if (main) { main.style.viewTransitionName = main.dataset.vtMain; const clear = () => { main.style.viewTransitionName = ''; }; e.viewTransition.finished.then(clear, clear); return; }
    // coming back to a listing: the card of the page we left morphs back into place
    const from = navigation?.activation?.from?.url;
    if (!from) return;
    const path = new URL(from).pathname;
    const card = $$('product-card, .look-card').find(c => { const a = c.querySelector('a[href]'); return a && new URL(a.href, location.href).pathname === path; });
    const media = mediaOf(card);
    if (media) { media.style.viewTransitionName = nameFor(card); const clear = () => { media.style.viewTransitionName = ''; }; e.viewTransition.finished.then(clear, clear); }
  });
})();

/* ---------- proto-facets: filters, sort, density, load more on the collection JSON ----------
   In the theme the grid is re-rendered by Prestige's facets (Section Rendering API); the UI, the URL
   state and the View Transition around the swap are what moves into the theme. */
(() => {
  const root = $('facet-filters');
  if (!root) return;
  const data = JSON.parse($('[data-collection-json]', root).textContent);
  registerCards(data);
  const perPage = +root.dataset.perPage || 24;
  const grid = $('[data-grid]', root), body = $('[data-facets-body]');
  const initialLooks = $$('.grid-look', grid).map(n => n.outerHTML);
  const params = new URLSearchParams(location.search);
  const state = {
    brand: new Set(params.getAll('marca')), size: new Set(params.getAll('taglia')), color: new Set(params.getAll('colore')),
    type: params.get('tipo') || '', gender: params.get('genere') || '', sale: params.get('saldi') === '1', min: +params.get('min') || 0, max: +params.get('max') || 0,
    sort: params.get('ordina') || 'evidenza', density: params.get('vista') || '', shown: Math.max(perPage, +params.get('n') || perPage)
  };
  const sizeOrder = l => { const s = l.toUpperCase(); const L = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL']; const li = L.indexOf(s); if (li >= 0) return 1000 + li; const m = s.match(/^(\d+(?:[.,]\d+)?)(?:\s+(\d)\/(\d))?/); if (m) return parseFloat(m[1].replace(',', '.')) + (m[2] ? m[2] / m[3] : 0); return /T\.?U/.test(s) ? 3000 : 2000; };
  const facetValues = () => {
    const brands = {}, sizes = {}, colors = {};
    for (const p of data) {
      brands[p.brand] = (brands[p.brand] || 0) + 1;
      for (const [l, a] of p.sizes) if (a) sizes[l] = (sizes[l] || 0) + 1;
      if (p.colorName) colors[p.colorName] = { n: ((colors[p.colorName] || {}).n || 0) + 1, hex: p.hex || '#ccc' };
    }
    return { brands, sizes, colors, prices: data.map(p => p.price) };
  };
  const V = facetValues();
  const priceMin = Math.floor(Math.min(...V.prices)), priceMax = Math.ceil(Math.max(...V.prices));

  function matches(p, skip) {
    if (skip !== 'brand' && state.brand.size && !state.brand.has(p.brand)) return false;
    if (skip !== 'size' && state.size.size && !p.sizes.some(([l, a]) => a && state.size.has(l))) return false;
    if (skip !== 'color' && state.color.size && !state.color.has(p.colorName)) return false;
    if (skip !== 'type' && state.type && p.type !== state.type) return false;
    if (skip !== 'gender' && state.gender && !(p.gender === state.gender || (p.gender === 'unisex' && state.gender !== 'junior'))) return false;
    if (state.sale && !p.compareAt) return false;
    if (state.min && p.price < state.min) return false;
    if (state.max && p.price > state.max) return false;
    return true;
  }
  const sorters = {
    evidenza: null,
    novita: (a, b) => (b.isNew - a.isNew),
    'prezzo-asc': (a, b) => a.price - b.price,
    'prezzo-desc': (a, b) => b.price - a.price
  };
  const activeCount = () => state.brand.size + state.size.size + state.color.size + (state.sale ? 1 : 0) + (state.min || state.max ? 1 : 0) + (state.gender ? 1 : 0);
  const syncGenderChips = () => $$('[data-gender-chip]').forEach(c => { const on = c.dataset.genderChip === state.gender; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
  // archived (no longer sold) items never lead a listing: stable partition after sorting
  const filtered = () => { const list = data.filter(p => matches(p)); const s = sorters[state.sort]; const sorted = s ? [...list].sort(s) : list; return [...sorted.filter(p => !p.archived), ...sorted.filter(p => p.archived)]; };

  function syncUrl() {
    const q = new URLSearchParams();
    state.brand.forEach(v => q.append('marca', v)); state.size.forEach(v => q.append('taglia', v)); state.color.forEach(v => q.append('colore', v));
    if (state.type) q.set('tipo', state.type); if (state.gender) q.set('genere', state.gender); if (state.sale) q.set('saldi', '1');
    if (state.min) q.set('min', state.min); if (state.max) q.set('max', state.max);
    if (state.sort !== 'evidenza') q.set('ordina', state.sort); if (state.density) q.set('vista', state.density);
    if (state.shown > perPage) q.set('n', state.shown);
    history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
  }

  function renderFacets() {
    const count = (key, val) => data.filter(p => matches(p, key) && (key === 'brand' ? p.brand === val : key === 'size' ? p.sizes.some(([l, a]) => a && l === val) : p.colorName === val)).length;
    const group = (title, inner, open) => `<details class="facet" ${open ? 'open' : ''}><summary>${title}<svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg></summary><div class="facet__body">${inner}</div></details>`;
    const brands = Object.keys(V.brands).sort((a, b) => a.localeCompare(b, 'it'));
    const sizes = Object.keys(V.sizes).sort((a, b) => sizeOrder(a) - sizeOrder(b));
    const colors = Object.keys(V.colors).sort((a, b) => a.localeCompare(b, 'it'));
    body.innerHTML =
      (brands.length > 1 ? group('Marca', `<ul class="facet__list" role="list">${brands.map(b => { const n = count('brand', b); return `<li><label class="check"><input type="checkbox" data-f="brand" value="${SKS_FMT.esc(b)}" ${state.brand.has(b) ? 'checked' : ''} ${n ? '' : 'disabled'}><span translate="no">${SKS_FMT.esc(b)}</span><span class="check__n">${n}</span></label></li>`; }).join('')}</ul>`, true) : '') +
      (sizes.length > 1 ? group('Taglia', `<div class="facet__sizes">${sizes.map(s => { const n = count('size', s); return `<label class="size-toggle"><input type="checkbox" data-f="size" value="${SKS_FMT.esc(s)}" ${state.size.has(s) ? 'checked' : ''} ${n ? '' : 'disabled'}><span>${SKS_FMT.esc(s)}</span></label>`; }).join('')}</div>`, true) : '') +
      (colors.length > 1 ? group('Colore', `<ul class="facet__list facet__list--colors" role="list">${colors.map(c => { const n = count('color', c); return `<li><label class="check"><input type="checkbox" data-f="color" value="${SKS_FMT.esc(c)}" ${state.color.has(c) ? 'checked' : ''} ${n ? '' : 'disabled'}><span class="swatch" style="--sw:${V.colors[c].hex}"></span><span>${SKS_FMT.esc(c)}</span><span class="check__n">${n}</span></label></li>`; }).join('')}</ul>`) : '') +
      group('Prezzo', `<div class="price-range"><label><span class="field__label">Da (€)</span><input class="field__input" type="number" inputmode="numeric" min="${priceMin}" max="${priceMax}" placeholder="${priceMin}" value="${state.min || ''}" data-f="min"></label><label><span class="field__label">A (€)</span><input class="field__input" type="number" inputmode="numeric" min="${priceMin}" max="${priceMax}" placeholder="${priceMax}" value="${state.max || ''}" data-f="max"></label></div>`) +
      (new Set(data.map(p => p.gender)).size > 1 ? group('Genere', `<div class="facet__sizes">${[['', 'Tutti'], ['uomo', 'Uomo'], ['donna', 'Donna'], ['junior', 'Bambini']].filter(([g]) => !g || data.some(p => p.gender === g)).map(([g, l]) => `<label class="size-toggle"><input type="radio" name="f-genere" data-f="gender" value="${g}" ${state.gender === g ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`, true) : '') +
      (data.some(p => p.compareAt) ? group('Saldi', `<label class="check"><input type="checkbox" data-f="sale" ${state.sale ? 'checked' : ''}><span>Solo capi in saldo</span><span class="check__n">${data.filter(p => p.compareAt).length}</span></label>`) : '');
  }

  function renderApplied() {
    const chips = [];
    state.brand.forEach(v => chips.push(['brand', v, v])); state.size.forEach(v => chips.push(['size', v, `Taglia ${v}`])); state.color.forEach(v => chips.push(['color', v, v]));
    if (state.sale) chips.push(['sale', '', 'In saldo']);
    if (state.gender) chips.push(['gender', '', { uomo: 'Uomo', donna: 'Donna', junior: 'Bambini' }[state.gender]]);
    if (state.min || state.max) chips.push(['price', '', `${state.min || priceMin}–${state.max || priceMax} €`]);
    $('[data-applied]', root).innerHTML = chips.map(([k, v, l]) => `<li><button type="button" class="chip chip--remove" data-remove-f="${k}" data-v="${SKS_FMT.esc(v)}" aria-label="Togli il filtro ${SKS_FMT.esc(l)}">${SKS_FMT.esc(l)}<svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button></li>`).join('');
    const n = activeCount();
    const badge = $('[data-active-count]', root); badge.hidden = !n; badge.textContent = n;
  }

  function renderGrid(list) {
    const shown = list.slice(0, state.shown);
    const pristine = !activeCount() && !state.type && state.sort === 'evidenza';
    let html = '';
    shown.forEach((p, i) => {
      html += SKS_CARD.render(p, { base: BASE });
      if (pristine && (i === 7 || i === 15) && initialLooks[i === 7 ? 0 : 1] && list.length > i + 4) html += initialLooks[i === 7 ? 0 : 1];
    });
    grid.innerHTML = html;
    // one size filtered: the product page opens with that size chosen (?taglia=)
    if (state.size.size === 1) { const t = [...state.size][0]; $$('product-card a[href]', grid).forEach(a => { const u = new URL(a.href); u.searchParams.set('taglia', t); a.href = u.href; }); }
    renderWishState();
    $$('[data-result-count]').forEach(e => { e.textContent = list.length; });
    $('[data-filter-empty]', root).hidden = !!list.length;
    const wrap = $('[data-load-more-wrap]', root);
    wrap.hidden = list.length <= state.shown;
    $('[data-shown]', root).textContent = Math.min(state.shown, list.length);
    $('[data-total]', root).textContent = list.length;
    $('[data-load-bar]', root).style.setProperty('--pct', Math.min(1, state.shown / Math.max(1, list.length)));
  }

  const forGender = (p, g) => !g || p.gender === g || (p.gender === 'unisex' && g !== 'junior');
  function syncChipCounts() {
    $$('[data-type-chip]').forEach(c => {
      const t = c.dataset.typeChip, n = data.filter(p => matches(p, 'type') && (!t || p.type === t)).length;
      $('.chip__count', c).textContent = c.classList.contains('type-tile') ? `${n} ${n === 1 ? 'prodotto' : 'prodotti'}` : n;
      c.parentElement.hidden = !n && !!t && state.type !== t;
    });
    $$('[data-gender-chip]').forEach(c => { $('.chip__count', c).textContent = data.filter(p => matches(p, 'gender') && forGender(p, c.dataset.genderChip)).length; });
  }

  function update({ animate = true, facets = true } = {}) {
    const list = filtered();
    const run = () => { renderGrid(list); renderApplied(); if (facets) renderFacets(); syncChipCounts(); syncUrl(); };
    if (animate && document.startViewTransition && MOTION_OK()) {
      // each card keeps its place in the transition: the grid reflows instead of blinking
      $$('product-card', grid).forEach((c, i) => { if (i < 16) c.style.viewTransitionName = 'card-' + i; });
      const t = document.startViewTransition(() => { run(); $$('product-card', grid).forEach((c, i) => { if (i < 16) c.style.viewTransitionName = 'card-' + i; }); });
      const clear = () => $$('product-card', grid).forEach(c => { c.style.viewTransitionName = ''; });
      t.ready.catch(() => {}); t.updateCallbackDone.catch(() => {}); t.finished.then(clear, clear);
    } else run();
    announce(`${list.length} prodotti`);
  }

  function setDensity(d) {
    state.density = d;
    grid.dataset.density = d || '';
    $$('[data-density]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.density === (d || (matchMedia('(min-width: 768px)').matches ? '4' : '2')))));
  }

  // events
  body.addEventListener('change', e => {
    const f = e.target.dataset.f;
    if (!f) return;
    if (['brand', 'size', 'color'].includes(f)) { const set = state[f]; e.target.checked ? set.add(e.target.value) : set.delete(e.target.value); }
    if (f === 'sale') state.sale = e.target.checked;
    if (f === 'gender') { state.gender = e.target.value; syncGenderChips(); }
    if (f === 'min' || f === 'max') state[f] = +e.target.value || 0;
    state.shown = perPage;
    update({ facets: false });
    renderFacets();
    const again = body.querySelector(`[data-f="${f}"][value="${CSS.escape(e.target.value || '')}"]`) || body.querySelector(`[data-f="${f}"]`);
    again && again.focus();
  });
  root.addEventListener('click', e => {
    const rm = e.target.closest('[data-remove-f]');
    if (rm) {
      const k = rm.dataset.removeF, v = rm.dataset.v;
      if (k === 'sale') state.sale = false; else if (k === 'gender') { state.gender = ''; syncGenderChips(); } else if (k === 'price') { state.min = 0; state.max = 0; } else state[k].delete(v);
      update(); return;
    }
    const d = e.target.closest('[data-density]');
    if (d) { setDensity(d.dataset.density); syncUrl(); return; }
    if (e.target.closest('[data-load-more]')) {
      const before = state.shown;
      state.shown += perPage;
      update({ animate: false, facets: false });
      const next = $$('product-card', grid)[before];
      next && next.querySelector('.product-card__title a')?.focus();
    }
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-clear-filters]')) {
      state.brand.clear(); state.size.clear(); state.color.clear(); state.sale = false; state.min = 0; state.max = 0; state.type = ''; state.gender = ''; syncGenderChips();
      $$('[data-type-chip]').forEach(c => { const on = c.dataset.typeChip === ''; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
      update();
    }
    const gchip = e.target.closest('[data-gender-chip]');
    if (gchip) { state.gender = gchip.dataset.genderChip; syncGenderChips(); state.shown = perPage; update(); return; }
    const chip = e.target.closest('[data-type-chip]');
    if (chip) {
      state.type = chip.dataset.typeChip;
      $$('[data-type-chip]').forEach(c => { const on = c === chip; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
      state.shown = perPage;
      update();
    }
  });
  $('[data-sort]', root).value = state.sort;
  $('[data-sort]', root).addEventListener('change', e => { state.sort = e.target.value; update(); });

  // restore from the URL (Back keeps filters, sort, density and how many were shown)
  setDensity(state.density);
  syncGenderChips();
  if (state.type) $$('[data-type-chip]').forEach(c => { const on = c.dataset.typeChip === state.type; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
  if (activeCount() || state.type || state.gender || state.sort !== 'evidenza' || state.shown > perPage) update({ animate: false });
  else { renderFacets(); renderApplied(); }
})();

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

  // the chosen size travels to the other colours (?taglia=), so a colour switch never resets it silently
  const carrySize = size => $$('.sibling[href]').forEach(a => { const u = new URL(a.href); size ? u.searchParams.set('taglia', size) : u.searchParams.delete('taglia'); a.href = u.pathname.split('/').pop() + u.search; });
  if (form) {
    const onSize = r => {
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
      const size = selected();
      if (!size) { needSize(); return; }
      addWithFeedback(e.currentTarget, info, size);
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
    new IntersectionObserver(([e]) => {
      const show = !e.isIntersecting && e.boundingClientRect.top < 0;
      sticky.classList.toggle('is-visible', show);
      sticky.setAttribute('aria-hidden', String(!show));
      sticky.inert = !show;
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

/* ---------- "Scelti per te": the sources of integrated1's for-you endpoint, on the device ----------
   Live (/apps/wishlist/for-you, platform/apps/back-in-stock/app/modules/for-you/picker.server.ts) the answer
   comes, in this order, from the session's last search (up to half), a recognised customer's own picks,
   pieces like the ones seen on this device, and the most wanted pieces in the page's context. The preview
   has no customers: search, then seen, then the fallback the page already shows. The same picks fill
   "Completa con" in the cart, with the cart's products excluded (owner, 01/10). */
const ForYou = (() => {
  let pool = null, loading = null;
  function load() {
    if (pool) return Promise.resolve(pool);
    return loading ||= new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = BASE + 'assets/data/for-you.js';
      s.onload = () => { pool = window.SKS_FORYOU || []; registerCards(pool); resolve(pool); };
      s.onerror = () => { loading = null; reject(new Error('for-you pool')); };
      document.head.append(s);
    });
  }
  const lastSearch = () => { try { return sessionStorage.getItem('sks-last-q') || ''; } catch { return ''; } };
  const signal = () => trackingOK() && !!(lastSearch() || Recent.list.length);
  function pick({ exclude = [], audience = '', limit = 8 } = {}) {
    const out = [], seen = new Set(exclude.filter(Boolean)), perBrand = {};
    const fits = p => !audience || p.gender === audience || p.gender === 'unisex';
    const add = (p, source) => {
      if (out.length >= limit || seen.has(p.handle) || !fits(p) || (perBrand[p.brand] || 0) >= 2) return;
      perBrand[p.brand] = (perBrand[p.brand] || 0) + 1; seen.add(p.handle); out.push({ p, source });
    };
    const tracked = trackingOK();
    const words = tracked ? SKS_FMT.normalize(lastSearch()).split(' ').filter(w => w.length > 2) : [];
    if (words.length) pool.filter(p => { const t = SKS_FMT.normalize(`${p.title} ${p.brand}`); return words.every(w => t.includes(w)); })
      .slice(0, Math.ceil(limit / 2)).forEach(p => add(p, 'search'));
    const viewed = tracked ? Recent.list.slice(0, 6).map(r => pool.find(p => p.handle === r.handle) || r) : [];
    viewed.forEach(v => seen.add(v.handle));
    if (viewed.length) {
      const score = p => Math.max(...viewed.map(v => (p.typeKey && p.typeKey === v.typeKey ? 3 : 0) + (p.brand === v.brand ? 2 : 0) + (v.gender && p.gender === v.gender ? 1 : 0)));
      pool.map(p => [p, score(p)]).filter(([, s]) => s >= 2).sort((a, b) => b[1] - a[1] || a[0].rank - b[0].rank).forEach(([p]) => add(p, 'similar'));
    }
    pool.forEach(p => add(p, 'popular'));
    return out;
  }
  return { load, pick, signal };
})();

// home and product page: swap the fallback for the visitor's picks before the rail comes into view
$$('[data-for-you]').forEach(sec => {
  if (!ForYou.signal()) return; // nothing known about this visit: the page's list is already the answer
  const track = $('.rail__track', sec), lead = $('[data-for-you-lead]', sec);
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    if (sec.getBoundingClientRect().top < innerHeight) return; // already on screen: keep it still
    ForYou.load().then(() => {
      const picks = ForYou.pick({ exclude: [sec.dataset.exclude, ...Cart.lines.map(l => l.handle)], audience: sec.dataset.audience, limit: 10 });
      if (!picks.some(x => x.source !== 'popular') || sec.getBoundingClientRect().top < innerHeight) return;
      track.innerHTML = picks.map(({ p }) => SKS_CARD.render(p, { base: BASE, sizes: '(min-width: 1201px) 206px, (min-width: 901px) 180px, (min-width: 601px) 160px, 40vw' })).join('');
      lead.textContent = picks[0].source === 'search' ? 'Scelti in base alla tua ultima ricerca.' : 'Scelti in base ai capi che hai guardato.';
      renderWishState();
      $('[data-rail]', sec)?.dispatchEvent(new Event('rail:update'));
    }).catch(() => {});
  }, { rootMargin: '0px 0px 700px 0px' });
  io.observe(sec);
});

// cart: "Completa con" from the same picks, the cart's products excluded, its audience kept
(() => {
  const box = $('[data-cart-suggest]');
  if (!box) return;
  const list = $('[data-cart-suggest-list]', box), why = $('[data-cart-suggest-why]', box);
  let signature = '';
  function render() {
    const lines = Cart.lines;
    const sig = lines.map(l => l.handle).sort().join(',');
    if (sig === signature) return;
    signature = sig;
    if (!lines.length) { box.hidden = true; return; }
    ForYou.load().then(pool => {
      const genders = lines.map(l => (pool.find(p => p.handle === l.handle) || {}).gender).filter(g => g && g !== 'unisex');
      const audience = genders.length && genders.every(g => g === genders[0]) ? genders[0] : '';
      const picks = ForYou.pick({ exclude: lines.map(l => l.handle), audience, limit: 4 });
      list.innerHTML = picks.map(({ p }) => {
        const avail = p.sizes.filter(s => s[1]);
        const info = SKS_FMT.esc(JSON.stringify({ handle: p.handle, title: p.title, brand: p.brand, price: p.price, compareAt: p.compareAt || 0, image: p.images[0] }));
        const one = avail.length === 1;
        return `<li class="mini-card">
          <a class="mini-card__media" href="${productUrl(p.handle)}" tabindex="-1" aria-hidden="true"><img src="${SKS_FMT.cdn(p.images[0], 160)}" srcset="${SKS_FMT.srcset(p.images[0], [120, 160, 240], 0, SKS_FMT.nativeWidth(p.images[0]))}" sizes="80px" width="80" height="80" alt="" loading="lazy"></a>
          <div class="mini-card__info">
            <p class="mini-card__brand" translate="no">${SKS_FMT.esc(p.brand)}</p>
            <p class="mini-card__title"><a href="${productUrl(p.handle)}">${SKS_FMT.esc(SKS_CARD.splitTitle(p.title)[0])}</a></p>
            <p class="mini-card__price">${SKS_FMT.money(p.price)}</p>
          </div>
          ${one ? `<button type="button" class="button button--small button--outline" data-add-product="${info}" data-size="${SKS_FMT.esc(avail[0][0])}" aria-label="Aggiungi ${SKS_FMT.esc(p.title)}, ${SKS_FMT.esc(SKS_FMT.sizeLabel(avail[0][0]).toLowerCase())}">Aggiungi</button>`
            : `<button type="button" class="button button--small button--outline" data-suggest-sizes aria-expanded="false">Scegli la taglia</button>
          <div class="mini-card__sizes" role="group" aria-label="Taglie di ${SKS_FMT.esc(p.title)}" hidden>${avail.map(s => `<button type="button" class="size-chip" data-add-product="${info}" data-size="${SKS_FMT.esc(s[0])}" aria-label="Aggiungi la taglia ${SKS_FMT.esc(s[0])}">${SKS_FMT.esc(s[0])}</button>`).join('')}</div>`}
        </li>`;
      }).join('');
      why.textContent = picks.some(x => x.source === 'similar' || x.source === 'search') ? 'Scelti per te, in base a quello che hai guardato.' : 'Scelti per te tra i capi più richiesti.';
      box.hidden = !picks.length;
    }).catch(() => { box.hidden = true; });
  }
  // only while the drawer is open: the pool is never fetched on a plain page load (bandwidth for the LCP)
  const drawer = document.getElementById('cart-drawer');
  document.addEventListener('cart:rendered', () => { if (drawer?.open) render(); });
  drawer?.addEventListener('dialog:open', render);
  box.addEventListener('click', e => {
    const t = e.target.closest('[data-suggest-sizes]');
    if (!t) return;
    const sizes = t.nextElementSibling, open = sizes.hidden;
    sizes.hidden = !open; t.setAttribute('aria-expanded', String(open));
    if (open) sizes.querySelector('button')?.focus();
  });
})();

/* ---------- cart page, checkout summary, wishlist, search results ---------- */
(() => {
  // checkout summary lines
  const lines = $('[data-checkout-lines]');
  if (lines) {
    const render = () => {
      const l = Cart.lines;
      lines.innerHTML = l.length ? l.map(x => `<li class="checkout-line"><img src="${SKS_FMT.cdn(x.image, 160)}" width="64" height="64" alt="" loading="lazy"><span><span class="meta" translate="no">${SKS_FMT.esc(x.brand)}</span><br>${SKS_FMT.esc(x.title)}<br><span class="meta">${SKS_FMT.esc(SKS_FMT.sizeLabel(x.size))} · quantità ${x.qty}</span></span><span class="tabular">${SKS_FMT.money(x.price * x.qty)}</span></li>`).join('')
        : `<li class="muted">Il carrello è vuoto. <a href="${BASE}index.html">Torna alla home</a></li>`;
    };
    document.addEventListener('cart:change', render); render();
  }
  // wishlist page
  const wg = $('[data-wish-grid]');
  if (wg) {
    const render = () => {
      const list = Wish.list.filter(x => x.title);
      $('[data-wish-empty]').hidden = !!list.length;
      registerCards(list.map(x => ({ ...x, images: x.images || [] })));
      wg.innerHTML = list.map(x => {
        // every size, the sold-out ones struck through with "Avvisami", as on the product page
        const all = x.sizes || [], sizes = all.filter(s => s[1]), sold = all.length - sizes.length;
        const card = SKS_CARD.render({ ...x, images: (x.images || []).filter(Boolean), sizes: [], swatches: [] }, { base: BASE });
        const buy = sizes.length
          ? `<form class="wish-buy" data-wish-buy="${SKS_FMT.esc(x.handle)}" novalidate><fieldset class="look-sizes"><legend class="visually-hidden">Taglia</legend>${all.map(s => `<label class="look-size${s[1] ? '' : ' is-sold'}"><input type="radio" name="w-${SKS_FMT.esc(x.handle)}" value="${SKS_FMT.esc(s[0])}" ${s[1] ? (sizes.length === 1 ? 'checked' : '') : 'disabled'}><span>${SKS_FMT.esc(s[0])}</span></label>`).join('')}</fieldset><p class="field__error" data-wish-error hidden>Scegli una taglia.</p>${sold ? `<p class="meta">Taglia esaurita? <button type="button" class="link-small" data-wish-notify>Avvisami</button></p>` : ''}<button type="submit" class="button button--primary button--small">Aggiungi al carrello</button></form>`
          : `<p class="meta wish-buy">Esaurito in tutte le taglie. <button type="button" class="link-small" data-wish-notify>Avvisami</button></p>`;
        return `<div class="wish-item">${card}${buy}</div>`;
      }).join('');
      renderWishState();
    };
    document.addEventListener('wish:change', render); render();
    wg.addEventListener('submit', e => {
      const f = e.target.closest('[data-wish-buy]'); if (!f) return;
      e.preventDefault();
      const size = (f.querySelector('input:checked') || {}).value;
      const err = f.querySelector('[data-wish-error]');
      if (!size) { err.hidden = false; f.querySelector('input:not([disabled])')?.focus(); return; }
      addWithFeedback(f.querySelector('button'), infoFromCard(f.dataset.wishBuy), size);
    });
    wg.addEventListener('change', e => { const err = e.target.closest('[data-wish-buy]')?.querySelector('[data-wish-error]'); if (err) err.hidden = true; });
    wg.addEventListener('click', e => { if (e.target.closest('[data-wish-notify]')) toast('Anteprima: sul sito ti avvisiamo quando torna disponibile.'); });
  }
  // search results page
  const sp = $('[data-search-page]');
  if (sp) {
    const q = new URLSearchParams(location.search).get('q') || '';
    const input = $('#search-page-input'); input.value = q;
    if (!q) { $('[data-search-page-count]').textContent = 'Scrivi cosa cerchi: un capo, una marca, una categoria.'; return; }
    if (trackingOK()) { try { sessionStorage.setItem('sks-last-q', q); } catch { /* private mode */ } }
    $('[data-search-title]').textContent = `Risultati per “${q}”`;
    document.title = `Risultati per “${q}” | Ski Sises`;
    window.SKS_SEARCH_API.loadIndex().then(index => {
      const r = window.SKS_SEARCH_API.search(index, q);
      const items = r.products.slice(0, 48).map(p => ({ handle: p[0], title: p[1], brand: p[2], price: p[5], compareAt: p[7] || 0, images: [p[6]], sizes: [], swatches: [] }));
      registerCards(items);
      $('[data-search-page-count]').textContent = `${r.products.length} prodotti`;
      $('[data-search-page-grid]').innerHTML = items.map(p => SKS_CARD.render(p, { base: BASE })).join('');
      $('[data-search-page-side]').innerHTML = [
        r.brands.length ? `<p class="meta">Marche</p><ul class="chips" role="list">${r.brands.slice(0, 8).map(b => `<li><a class="chip" href="${BASE}collections/${b[0]}.html">${SKS_FMT.esc(b[1])} <span class="chip__count">${b[2]}</span></a></li>`).join('')}</ul>` : '',
        r.colls.length ? `<p class="meta">Categorie</p><ul class="chips" role="list">${r.colls.slice(0, 8).map(c => `<li><a class="chip" href="${BASE}collections/${c[0]}.html">${SKS_FMT.esc(c[1])}</a></li>`).join('')}</ul>` : ''
      ].join('');
      $('[data-search-page-empty]').hidden = !!(r.products.length || r.brands.length || r.colls.length);
      renderWishState();
    });
  }
})();

/* ---------- brand A-Z filter ---------- */
(() => {
  const input = $('[data-brand-filter]');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = SKS_FMT.normalize(input.value);
    let shown = 0;
    $$('[data-brand-name]').forEach(li => { const on = !q || li.dataset.brandName.includes(q); li.hidden = !on; if (on) shown++; });
    $$('.brands-group').forEach(g => { g.hidden = !g.querySelector('[data-brand-name]:not([hidden])'); });
    $('[data-brand-empty]').hidden = !!shown;
    announce(`${shown} marche`);
  });
})();

/* ---------- look page: each piece its size (chips), the button says how many it adds, added rows are marked ---------- */
(() => {
  const form = $('[data-look-form]');
  if (!form) return;
  const btn = $('[data-add-look]', form), status = $('[data-look-status]', form);
  if (!btn) return; // every piece is sold out: the page says so, nothing to add
  const rows = () => $$('[data-piece]', form).filter(li => !li.classList.contains('is-unavailable'));
  const chosen = li => (li.querySelector('input[type="radio"]:checked') || {}).value;
  const pending = () => rows().filter(li => chosen(li) && li.dataset.added !== chosen(li));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  function sync() {
    const p = pending(), missing = rows().filter(li => !chosen(li)).length;
    const changes = p.filter(li => li.dataset.added).length, adds = p.length - changes, someAdded = rows().some(li => li.dataset.added);
    btn.disabled = !p.length;
    btn.textContent = p.length
      ? (!changes ? `Aggiungi ${adds === 1 ? 'il capo' : `i ${adds} capi`} al carrello`
        : !adds ? `Cambia ${changes === 1 ? 'la taglia' : `le ${changes} taglie`} nel carrello`
        : `Aggiungi ${plural(adds, 'capo', 'capi')} e cambia ${changes === 1 ? 'una taglia' : `${changes} taglie`}`)
      : !missing && someAdded ? 'Tutto nel carrello'
      : someAdded ? `Scegli la taglia ${missing === 1 ? 'del capo rimanente' : `dei ${missing} capi rimanenti`}` : 'Scegli le taglie';
    if (status && !status.dataset.sticky) status.textContent = missing ? `${plural(missing, 'capo', 'capi')} senza taglia: ${missing === 1 ? 'sceglila per aggiungerlo' : 'sceglila per aggiungerli'}.` : 'Tutte le taglie scelte.';
  }
  form.addEventListener('change', () => { if (status) delete status.dataset.sticky; sync(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const add = pending();
    if (!add.length) return;
    const items = add.map(li => [infoFromCard(li.dataset.piece), chosen(li), li]).filter(x => x[0]);
    // a piece already in the bag in another size: that line is replaced, never doubled
    const changed = items.filter(([info, , li]) => li.dataset.added && Cart.remove(info.handle + '|' + li.dataset.added));
    const [first, ...rest] = items;
    for (const [info, size] of rest) Cart.add(info, size);
    await addWithFeedback(btn, first[0], first[1]);
    for (const [, size, li] of items) { li.dataset.added = size; li.classList.add('is-added'); const t = li.querySelector('.look-piece__title'); if (t) t.dataset.added = size; }
    const missing = rows().filter(li => !chosen(li)).length, added = items.length - changed.length;
    if (status) {
      status.dataset.sticky = '1';
      status.textContent = [added ? `${plural(added, 'capo aggiunto', 'capi aggiunti')} al carrello.` : '', changed.length ? `${changed.length === 1 ? 'Taglia cambiata' : `${changed.length} taglie cambiate`} nel carrello.` : '', missing ? `${plural(missing, 'capo', 'capi')} senza taglia.` : ''].filter(Boolean).join(' ');
    }
    sync();
    setTimeout(sync, 1900); // after the shared "Aggiunto" feedback restores its label
  });
  sync();
})();

/* ---------- storia: one pinned timeline, the year column and the ski track in the same scroll() ---------- */
(() => {
  const root = $('[data-storia]');
  if (!root) return;
  const year = $('[data-storia-year]', root), path = $('.storia__track path', root);
  const chapters = $$('.chapter', root);
  // the visible year follows the chapter crossing the middle of the screen (IntersectionObserver)
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting && year.textContent !== e.target.dataset.year) {
      year.textContent = e.target.dataset.year;
      if (MOTION_OK()) animate(year, { opacity: [0, 1], transform: ['translateY(12px)', 'none'] }, { duration: 0.48, easing: [0.16, 1, 0.3, 1] });
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  chapters.forEach(c => io.observe(c));
  if (MOTION_OK() && matchMedia('(min-width: 1024px)').matches) {
    path.style.strokeDasharray = '1';
    scroll(animate(path, { strokeDashoffset: [1, 0] }, { easing: 'linear' }), { target: root, offset: ['start center', 'end end'] });
  }
})();

/* ---------- rental quote: tariffs and cost logic of noleggio-simulatore-preventivo.liquid ---------- */
(() => {
  const el = $('rental-quote');
  if (!el || !window.SKS_RENTAL) return;
  const D = window.SKS_RENTAL;
  const s = { cat: 'sci', who: 'adulto', vi: 0, mode: 'day', days: 1, qty: 1, si: 0 };
  const sel = n => el.querySelector(`[data-rq="${n}"]`);
  const variants = () => D[s.cat].variants[s.who] || [];
  const v = () => variants()[s.vi];
  const hasDay = x => x && x.d && Object.values(x.d).some(p => p != null);
  // minimum cost covering at least `days` using the available brackets (same dynamic programme as the live page)
  function dayPrice(d, days) {
    const br = Object.entries(d).filter(([, p]) => p != null).map(([g, p]) => ({ g: +g, p: +p }));
    if (!br.length) return null;
    const dp = [0];
    for (let n = 1; n <= days; n++) { let best = Infinity; for (const b of br) best = Math.min(best, b.p + dp[Math.max(0, n - b.g)]); dp[n] = best; }
    return dp[days];
  }
  function fill() {
    sel('cat').innerHTML = Object.entries(D).map(([k, c]) => `<option value="${k}" ${k === s.cat ? 'selected' : ''}>${c.label}</option>`).join('');
    const both = !!(D[s.cat].variants.adulto && D[s.cat].variants.bambino);
    $('[data-rq-who-wrap]', el).hidden = !both;
    if (!both) s.who = D[s.cat].variants.adulto ? 'adulto' : 'bambino';
    $$('[data-rq-who]', el).forEach(b => b.setAttribute('aria-checked', String(b.dataset.rqWho === s.who)));
    sel('variant').innerHTML = variants().map((x, i) => `<option value="${i}" ${i === s.vi ? 'selected' : ''}>${x.name}</option>`).join('');
    const cur = v();
    const canDay = hasDay(cur), canSeason = !!(cur && cur.s && cur.s.length);
    if (s.mode === 'day' && !canDay) s.mode = 'season';
    if (s.mode === 'season' && !canSeason) s.mode = 'day';
    $$('[data-rq-mode]', el).forEach(b => { const m = b.dataset.rqMode; b.disabled = m === 'day' ? !canDay : !canSeason; b.setAttribute('aria-checked', String(m === s.mode)); });
    $('[data-rq-days-wrap]', el).hidden = s.mode !== 'day';
    $('[data-rq-season-wrap]', el).hidden = s.mode !== 'season';
    if (canSeason) sel('season').innerHTML = cur.s.map((x, i) => `<option value="${i}" ${i === s.si ? 'selected' : ''}>${x.n} · ${SKS_FMT.money(x.p)}</option>`).join('');
    compute();
  }
  const lines = [];
  // "Casco", not "Casco Casco"; "Scarponi da sci", not "Scarponi Sci" (same rule as the price list)
  const itemName = (label, name) => name.toLowerCase().startsWith(label.toLowerCase()) ? name : label === 'Scarponi' ? `Scarponi da ${name.charAt(0).toLowerCase()}${name.slice(1)}` : `${label} ${name}`;
  const fmtDate = v => v ? new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date(v + 'T12:00:00')) : '';
  // the line being prepared: same tariff logic as the live simulator
  function current() {
    const cur = v(); if (!cur) return null;
    let unit, label, note = '';
    if (s.mode === 'season') { const x = cur.s[s.si] || cur.s[0]; unit = x.p; label = x.n; }
    else {
      unit = dayPrice(cur.d, s.days); label = `${s.days} ${s.days === 1 ? 'giorno' : 'giorni'}`;
      const seasonMin = cur.s && cur.s.length ? Math.min(...cur.s.map(x => x.p)) : null;
      if (seasonMin != null && unit > seasonMin) {
        if (cur.s.length === 1) { note = `Per ${s.days} giorni conviene la stagionale: applichiamo ${SKS_FMT.money(seasonMin)} invece di ${SKS_FMT.money(unit)}.`; unit = seasonMin; label += ' · tariffa stagionale'; }
        else note = `Per ${s.days} giorni conviene una tariffa stagionale, da ${SKS_FMT.money(seasonMin)}.`;
      }
    }
    const who = $('[data-rq-who-wrap]', el).hidden ? '' : (s.who === 'bambino' ? 'Bambino · ' : 'Adulto · ');
    const key = [s.cat, s.who, s.vi, s.mode, s.mode === 'day' ? s.days : s.si].join('|');
    return { key, cat: s.cat, who: s.who, title: itemName(D[s.cat].label, cur.name), sub: `${who}${label}${s.qty > 1 ? ` · ×${s.qty}` : ''}`, unit, qty: s.qty, total: unit * s.qty, note };
  }
  function compute() {
    const c = current(); if (!c) return;
    $('[data-rq-out="days"]', el).textContent = s.days;
    $('[data-rq-out="qty"]', el).textContent = s.qty;
    $('[data-rq-line]', el).textContent = `${c.title} · ${c.sub}: ${SKS_FMT.money(c.total)}`;
    const n = $('[data-rq-note]', el); n.hidden = !c.note; n.textContent = c.note;
    const list = $('[data-rq-lines]', el);
    list.innerHTML = lines.map((l, i) => `<li class="rq-line"><span><strong>${SKS_FMT.esc(l.title)}</strong><br><span class="meta">${SKS_FMT.esc(l.sub)}</span></span><span class="tabular">${SKS_FMT.money(l.total)}</span><button type="button" class="icon-button" data-rq-remove="${i}" aria-label="Togli ${SKS_FMT.esc(l.title)} dal preventivo"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button></li>`).join('');
    const total = lines.length ? lines.reduce((t, l) => t + l.total, 0) : c.total;
    $('[data-rq-total]', el).textContent = SKS_FMT.money(total);
    const d = el.querySelector('[data-rq-date]')?.value, p = $('[data-rq-pickup]', el);
    p.hidden = !d; p.textContent = d ? `Ritiro in negozio: ${fmtDate(d)}` : '';
  }
  // the same item for the same duration is one line: adding it again updates it (journey: skis counted twice)
  function addLine() {
    const c = current(); if (!c) return;
    const i = lines.findIndex(l => l.key === c.key);
    if (i >= 0) { lines[i] = c; compute(); toast(`${c.title} è già nel preventivo: riga aggiornata.`); return; }
    lines.push(c); compute(); announce(`${c.title} aggiunto al preventivo`);
  }
  function pack() {
    const keep = { ...s }, skipped = [];
    const items = s.who === 'bambino'
      ? [['sci', 'bambino', 0], ['scarponi', 'bambino', 0], ['casco', 'bambino', 0]]
      : [['sci', 'adulto', 0], ['scarponi', 'adulto', 0], ['casco', 'adulto', 0]];
    for (const [cat, who, vi] of items) {
      if (lines.some(l => l.cat === cat && l.who === who)) { skipped.push(D[cat].label.toLowerCase()); continue; }
      s.cat = cat; s.who = who; s.vi = vi; s.si = 0; if (!hasDay(v())) s.mode = 'season'; const c = current(); if (c) lines.push(c);
    }
    Object.assign(s, keep);
    fill();
    if (skipped.length) toast(`Pacchetto sci aggiunto. Già nel preventivo: ${skipped.join(', ')}.`);
    else announce('Pacchetto sci aggiunto al preventivo');
  }
  el.addEventListener('change', e => {
    const k = e.target.dataset.rq; if (!k) return;
    if (k === 'cat') { s.cat = e.target.value; s.vi = 0; s.si = 0; s.who = 'adulto'; }
    if (k === 'variant') { s.vi = +e.target.value; s.si = 0; }
    if (k === 'season') s.si = +e.target.value;
    fill();
  });
  el.addEventListener('click', e => {
    const w = e.target.closest('[data-rq-who]'); if (w) { s.who = w.dataset.rqWho; s.vi = 0; s.si = 0; fill(); return; }
    const m = e.target.closest('[data-rq-mode]'); if (m && !m.disabled) { s.mode = m.dataset.rqMode; fill(); return; }
    const st = e.target.closest('[data-rq-step]');
    if (st) { const k = st.dataset.rqStep; s[k] = Math.max(1, Math.min(k === 'days' ? 30 : 10, s[k] + +st.dataset.dir)); compute(); return; }
    if (e.target.closest('[data-rq-add]')) { addLine(); return; }
    if (e.target.closest('[data-rq-pack]')) { pack(); return; }
    const rm = e.target.closest('[data-rq-remove]'); if (rm) { lines.splice(+rm.dataset.rqRemove, 1); compute(); return; }
    if (e.target.closest('[data-rq-send]')) {
      const d = el.querySelector('[data-rq-date]').value;
      toast(`Anteprima: sul sito si apre WhatsApp con il preventivo già scritto${d ? ' e la data di ritiro' : ''}. Nessun messaggio inviato.`);
    }
  });
  const dateIn = el.querySelector('[data-rq-date]');
  if (dateIn) {
    dateIn.min = new Date().toISOString().slice(0, 10);
    dateIn.addEventListener('change', () => {
      if (dateIn.value && new Date(dateIn.value + 'T12:00:00').getDay() === 0) { dateIn.value = ''; toast('La domenica il negozio è chiuso: scegli un altro giorno.'); }
      compute();
    });
  }
  fill();
})();

/* ---------- cookie choice, then the -10% teaser ----------
   In the theme the banner is Shopify's customer privacy banner (its choice goes to the Customer Privacy API)
   and the teaser is Prestige's newsletter popup collapsed; here the choice stays on the device. */
(() => {
  const banner = $('[data-cookie-banner]'), teaser = $('[data-nl-teaser]');
  const consent = () => store.get('sks-consent', null);
  function showTeaser() {
    if (!teaser || store.get('sks-nl-dismissed', false)) return;
    teaser.hidden = false;
  }
  function decide(value) {
    store.set('sks-consent', value);
    if (banner) banner.hidden = true;
    ROOT.classList.remove('has-cookie-banner');
    announce(value === 'all' ? 'Cookie accettati' : 'Scelta salvata: solo i cookie necessari e quelli che hai scelto');
    setTimeout(showTeaser, 1200);
  }
  if (banner && consent() == null) {
    banner.hidden = false;
    ROOT.classList.add('has-cookie-banner');
    banner.addEventListener('click', e => {
      const b = e.target.closest('[data-cookie]');
      if (!b) return;
      const what = b.dataset.cookie;
      if (what === 'accept') decide('all');
      else if (what === 'reject') decide('necessary');
      else if (what === 'prefs') { $('[data-cookie-main]', banner).hidden = true; const f = $('[data-cookie-prefs]', banner); f.hidden = false; f.querySelector('input:not([disabled])')?.focus(); }
    });
    $('[data-cookie-prefs]', banner).addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      decide({ analytics: f.analytics.checked, marketing: f.marketing.checked, preferences: f.preferences.checked });
    });
  } else setTimeout(showTeaser, 1500);
  if (teaser) teaser.addEventListener('click', e => {
    if (e.target.closest('[data-nl-dismiss]')) { teaser.hidden = true; store.set('sks-nl-dismissed', true); }
  });
  // a completed sign-up retires the teaser
  document.addEventListener('submit', e => { if (e.target.closest('[data-nl-form]') && e.target.checkValidity()) { store.set('sks-nl-dismissed', true); if (teaser) teaser.hidden = true; } }, true);
})();

/* ---------- design comments (prototype only, never ported to the theme) ----------
   "Commenta", then a tap on any spot: the note is pinned there with the section it belongs to. Notes stay
   on the device (localStorage) and leave in one WhatsApp message or e-mail, page by page, with links. */
(() => {
  const KEY = 'sks-comments';
  const bar = $('[data-comment-bar]'), pins = $('[data-comment-pins]');
  const dlg = document.getElementById('comment-dialog'), list = document.getElementById('comments-drawer');
  if (!bar || !pins || !dlg || !list) return;
  const form = $('[data-comment-form]', dlg), area = $('textarea', dlg), where = $('[data-comment-where]', dlg), err = $('[data-comment-error]', dlg);
  const esc = SKS_FMT.esc;
  const load = () => store.get(KEY, []);
  const page = location.pathname;
  const title = () => ROOT.dataset.template === 'index' ? 'Home' : document.title.replace(/ \| Ski Sises$/, '');
  let on = false, draft = null, opener = null;

  // where the tap landed, in words: the section (its label or heading) and the element when it is short
  const clean = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  function describe(el) {
    const t = title().toLowerCase();
    const sec = el.closest('section, header, footer, nav, aside, [role="region"], main');
    let s = '';
    if (sec) {
      const by = sec.getAttribute('aria-labelledby');
      s = sec.getAttribute('aria-label') || (by && document.getElementById(by.split(' ')[0])?.textContent) ||
        sec.querySelector('h1, h2, h3')?.textContent || ({ HEADER: 'Intestazione', FOOTER: 'Fondo pagina', NAV: 'Menu', MAIN: 'Pagina' }[sec.tagName] || '');
    }
    const own = el.closest('a, button, label, img, h1, h2, h3, h4, p, li, figure');
    let o = own ? clean(own.getAttribute('aria-label') || own.getAttribute('alt') || own.textContent, 60) : '';
    if (own && own.tagName === 'IMG') o = o ? 'foto: ' + o : 'foto';
    s = clean(s, 50);
    // no repeats: the page name is already in the message, and a heading says itself
    if (s && t.includes(s.toLowerCase())) s = '';
    if (o && (o === s || t === o.toLowerCase())) o = '';
    return [s, o ? `«${o}»` : ''].filter(Boolean).join(' · ');
  }

  function sync() {
    const all = load();
    $$('[data-comment-count]').forEach(n => { n.textContent = all.length; n.hidden = !all.length; });
    $$('[data-comment-total]').forEach(n => { n.textContent = all.length; });
    pins.innerHTML = all.map((c, i) => c.page !== page ? '' :
      `<button type="button" class="comment-pin" style="left:${c.x}%;top:${c.y}px" data-comment-pin="${i}" aria-label="Commento ${i + 1}: ${esc(c.text)}" title="${esc(c.text)}">${i + 1}</button>`).join('');
  }
  function start() { on = true; ROOT.classList.add('is-commenting'); bar.hidden = false; announce('Tocca il punto della pagina da commentare. Esc per uscire.'); }
  function stop() { on = false; ROOT.classList.remove('is-commenting'); bar.hidden = true; }

  function place(target, x, y) {
    draft = { page, url: location.href.split('#')[0], title: title(), where: describe(target), x: +(x / document.documentElement.clientWidth * 100).toFixed(2), y: Math.round(y), device: innerWidth < 768 ? 'telefono' : 'computer' };
    where.textContent = draft.where ? `${draft.title} · ${draft.where}` : draft.title;
    area.value = ''; err.hidden = true;
    openDialog('comment-dialog', opener);
    setTimeout(() => area.focus(), 50);
  }

  // in comment mode a tap pins a note instead of following links or pressing buttons
  document.addEventListener('click', e => {
    if (!on || e.target.closest('[data-comment-bar], .preview-chip, .comment-fab, .comment-pin, dialog')) return;
    e.preventDefault(); e.stopPropagation();
    place(e.target, e.pageX, e.pageY);
  }, true);
  document.addEventListener('keydown', e => {
    if (!on || $('dialog[open]')) return;
    if (e.key === 'Escape') { stop(); return; }
    // keyboard: Enter on the focused element pins the note there
    if (e.key === 'Enter' && !e.target.closest('[data-comment-bar], .preview-chip, .comment-fab, .comment-pin')) {
      e.preventDefault(); e.stopPropagation();
      const r = e.target.getBoundingClientRect();
      place(e.target, r.left + r.width / 2 + scrollX, r.top + r.height / 2 + scrollY);
    }
  }, true);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = area.value.trim();
    if (!text) { err.hidden = false; area.focus(); return; }
    const all = load();
    all.push({ ...draft, text, at: new Date().toISOString() });
    store.set(KEY, all);
    sync();
    closeDialog(dlg);
    stop();
    toast(`Commento ${all.length} salvato. Puoi aggiungerne altri, anche su altre pagine.`, { label: 'Manda', run: openList });
  });
  area.addEventListener('input', () => { err.hidden = true; });

  // the list: every note of every page, and one message with all of them
  function message(all) {
    return `Commenti sull’anteprima del sito Ski Sises (${all.length})\n\n` +
      all.map((c, i) => `${i + 1}. ${c.title}${c.where ? ' · ' + c.where : ''} (${c.device})\n${c.text}\n${c.url}`).join('\n\n');
  }
  function renderList() {
    const all = load();
    $('[data-comments-body]', list).innerHTML = all.length
      ? `<ol class="comment-list" role="list">${all.map((c, i) => `<li class="comment-item" id="comment-${i}">
          <p class="comment-item__where"><span class="comment-item__n">${i + 1}</span> <a href="${esc(c.url)}">${esc(c.title)}</a>${c.where ? ` · ${esc(c.where)}` : ''} <span class="meta">(${esc(c.device)})</span></p>
          <p class="comment-item__text">${esc(c.text)}</p>
          <button type="button" class="link-small" data-comment-del="${i}">Elimina</button></li>`).join('')}</ol>`
      : `<p class="muted">Ancora nessun commento. Tocca «Commenta», poi il punto della pagina che vuoi commentare.</p>`;
    $('[data-comments-foot]', list).hidden = !all.length;
    const msg = message(all);
    $('[data-comments-send="whatsapp"]', list).href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    $('[data-comments-send="email"]', list).href = 'mailto:?subject=' + encodeURIComponent('Commenti sull’anteprima del sito Ski Sises') + '&body=' + encodeURIComponent(msg);
    const clear = $('[data-comments-clear]', list); clear.textContent = 'Cancella tutti'; delete clear.dataset.armed;
  }
  function openList(focusIndex) {
    stop();
    renderList();
    openDialog('comments-drawer', opener);
    if (focusIndex != null) document.getElementById('comment-' + focusIndex)?.scrollIntoView({ block: 'center' });
  }

  document.addEventListener('click', e => {
    const s = e.target.closest('[data-comment-start]');
    if (s) { opener = s; on ? stop() : start(); return; }
    if (e.target.closest('[data-comment-exit]')) { stop(); return; }
    if (e.target.closest('[data-comment-list]')) { opener = e.target.closest('button'); openList(); return; }
    const pin = e.target.closest('[data-comment-pin]');
    if (pin) { opener = pin; openList(+pin.dataset.commentPin); return; }
    const del = e.target.closest('[data-comment-del]');
    if (del) { const all = load(); all.splice(+del.dataset.commentDel, 1); store.set(KEY, all); sync(); renderList(); announce('Commento eliminato'); return; }
    const clear = e.target.closest('[data-comments-clear]');
    if (clear) {
      // two steps: the first tap asks, the second deletes
      if (!clear.dataset.armed) { clear.dataset.armed = '1'; clear.textContent = 'Tocca di nuovo per cancellarli tutti'; return; }
      store.set(KEY, []); sync(); renderList(); announce('Commenti cancellati'); return;
    }
    if (e.target.closest('[data-comments-copy]')) {
      const msg = message(load());
      const done = () => toast('Testo copiato: incollalo dove vuoi.');
      (navigator.clipboard?.writeText(msg) || Promise.reject()).then(done, () => {
        const t = document.createElement('textarea'); t.value = msg; list.append(t); t.select();
        try { document.execCommand('copy'); done(); } catch { toast('Non riesco a copiare: usa WhatsApp o email.'); }
        t.remove();
      });
    }
  });

  sync();
  // pins follow the layout when the width changes (they are stored as a share of the page width)
  addEventListener('resize', () => { clearTimeout(sync.t); sync.t = setTimeout(sync, 200); });
  // first visit on this device: say once how commenting works, after the first scroll
  // (never over an open dialog or while commenting: it waits for the next scroll)
  const hint = () => setTimeout(() => {
    if (store.get('sks-comments-hint', false) || load().length) return;
    if (on || $('dialog[open]')) { addEventListener('scroll', hint, { once: true, passive: true }); return; }
    store.set('sks-comments-hint', true);
    toast('Anteprima di design: per lasciare un commento tocca «Commenta», poi il punto della pagina.');
  }, 1200);
  if (!store.get('sks-comments-hint', false)) addEventListener('scroll', hint, { once: true, passive: true });
})();

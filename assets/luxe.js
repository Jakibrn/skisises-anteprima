// luxe.js (core): built 2026-10-02. Motion uses the theme's own vendor.min.js (Motion One).
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
  // The sale countdown of snippets/sale-countdown.liquid: with no date in the settings and no seasonal window
  // (shop.metafields.custom.sale_window is {} on 02/10), the weekly reset, Monday at 23:59 in Rome (theme
  // defaults sale_weekly_day 1, sale_weekly_time 23:59). Worked out from the Rome wall clock, as Liquid does.
  function saleDeadline(now) {
    now = now || Date.now();
    var parts = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short', hourCycle: 'h23' })
      .formatToParts(now).forEach(function (x) { parts[x.type] = x.value; });
    var local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    var offset = local - Math.floor(now / 1000) * 1000;
    var weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    var midnight = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
    var target = midnight + ((1 - weekday + 7) % 7) * 86400000 + (23 * 3600 + 59 * 60) * 1000;
    if (target <= local) target += 7 * 86400000;
    return target - offset;
  }
  // days, hours and minutes while more than a day is left; hours, minutes and seconds in the last day
  // (the theme's units: "g", "ore", "min", "sec")
  function countdownParts(ms) {
    var s = Math.max(0, Math.floor(ms / 1000)), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    return d >= 1 ? [[pad(d), 'g'], [pad(h), 'ore'], [pad(m), 'min']] : [[pad(h), 'ore'], [pad(m), 'min'], [pad(sec), 'sec']];
  }
  // Ski Sises Club (platform/apps/back-in-stock/app/modules/loyalty/math.ts): the Member level earns 3% of the paid
  // product subtotal as point value, one point is worth 0,05 €
  function clubPoints(eur) { return Math.floor(Math.floor(Math.round(eur * 100) * 300 / 10000) / 5); }
  return { esc: esc, money: money, cdn: cdn, srcset: srcset, nativeWidth: nativeWidth, sizeLabel: sizeLabel, percentOff: percentOff, normalize: normalize, saleDeadline: saleDeadline, countdownParts: countdownParts, clubPoints: clubPoints };
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
        '<span class="price-list__off">Risparmia ' + F.percentOff(p) + '%</span></p>'; // the live badge text (product.badge.sale)
    }
    return '<p class="price-list"><span class="price">' + from + F.money(p.price) + '</span></p>';
  }
  // snippets/product-badges.liquid: sale, bestseller, new arrival, low stock, back in stock, in this order, two per card.
  // The sale badge is the "Risparmia 30%" of the price line (the live text), so a discounted card keeps one slot for the others.
  function badgeList(p, max) {
    if (p.archived) return ['<li class="badge badge--muted">Non più disponibile</li>'];
    // an active product with no size left: the live "Esaurito" badge (show_sold_out_badge, on by default)
    if (p.sizes && p.sizes.length && !p.sizes.some(function (s) { return s[1]; })) return ['<li class="badge badge--muted">Esaurito</li>'];
    var out = [];
    if (p.bestseller) out.push('<li class="badge badge--best">Bestseller</li>');
    if (p.isNew) out.push('<li class="badge badge--new">Nuovo</li>');
    if (p.lowStock) out.push('<li class="badge badge--outline">Ultimi pezzi</li>');
    if (p.backInStock) out.push('<li class="badge badge--new">Di nuovo disponibile</li>');
    max = max || 2;
    return out.slice(0, p.compareAt ? max - 1 : max);
  }
  function badges(p) {
    var out = badgeList(p);
    return out.length ? '<ul class="product-card__badges" role="list">' + out.join('') + '</ul>' : '';
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
    // snippets/card-color-swatches.liquid (live): a thumbnail of each colour of the model, the current one marked;
    // a pointer or focus on one shows its photo in the card (luxe.js), a click opens it. The row is always there,
    // so brand, name and price line up across a grid row
    var swatches = '';
    if (p.swatches && p.swatches.length > 1) {
      swatches = '<ul class="card-swatches" role="list" aria-label="Colori disponibili">' + p.swatches.map(function (s) {
        var cur = s[0] === p.handle, thumb = function (w) { return F.cdn(s[1], w, w); };
        return '<li><a class="card-swatches__link' + (cur ? ' is-selected' : '') + '" href="' + base + 'products/' + encodeURIComponent(s[0]) + '.html"' +
          ' data-preview-image="' + F.cdn(s[1], 720) + '" data-preview-srcset="' + F.esc(F.srcset(s[1], [360, 540, 720], 0, F.nativeWidth(s[1]))) + '"' +
          (cur ? ' aria-current="true"' : '') + ' title="' + F.esc(s[2]) + '">' +
          '<img src="' + thumb(96) + '" srcset="' + thumb(48) + ' 48w, ' + thumb(72) + ' 72w, ' + thumb(96) + ' 96w" sizes="28px" width="28" height="28" alt="' + F.esc(s[2] || 'Altro colore') + '" loading="lazy" decoding="async"></a></li>';
      }).join('') + '</ul>';
    }
    // the model's own Judge.me rating (the product page's), as the live card's badge: stars and count
    var rating = '';
    if (p.rating) {
      var v = p.rating[0], n = p.rating[1], txt = String(v.toFixed(1)).replace('.', ',');
      var star5 = new Array(6).join('<svg class="icon" aria-hidden="true"><use href="#i-star"/></svg>');
      rating = '<p class="product-card__rating"><span class="rating-stars" style="--fill:' + (Math.round(v / 5 * 1000) / 10) + '%" aria-hidden="true">' +
        '<span class="rating-stars__base">' + star5 + '</span><span class="rating-stars__fill">' + star5 + '</span></span>' +
        '<span class="visually-hidden">Valutazione ' + txt + ' su 5, ' + n + (n === 1 ? ' recensione' : ' recensioni') + '</span>' +
        '<span aria-hidden="true">' + txt + ' (' + n + ')</span></p>';
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
        '<div class="card-swatches-wrapper">' + swatches + '</div>' +
        '<p class="product-card__brand" translate="no">' + F.esc(p.brand) + '</p>' +
        '<h3 class="product-card__title"><a href="' + url + '"><span class="product-card__name">' + F.esc(t[0].replace(GENDER_WORD, ' $1')) + '</span>' + (t[1] ? '<span class="visually-hidden">, </span><span class="product-card__colour">' + F.esc(t[1]) + '</span>' : '') + '</a></h3>' +
        rating + priceHtml(p) +
      '</div>' +
    '</product-card>';
  }
  return { render: render, splitTitle: splitTitle, priceHtml: priceHtml, badgeList: badgeList };
})(SKS_FMT);

/* ---------- utilities ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ROOT = document.documentElement;
const BASE = ROOT.dataset.base || '';
const MOTION_OK = () => !ROOT.classList.contains('reduce-motion');
const FINE_POINTER = matchMedia('(hover: hover) and (pointer: fine)');

// the CRM's e-mail links carry ?crm_link=, which the tracker redeems against the exact landing URL: no script
// rewrites the URL while it is there (CHANGES §11)
const urlWritable = () => !new URLSearchParams(location.search).has('crm_link');

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
function deliveryWindow(fmt = { weekday: 'long', day: 'numeric', month: 'long' }, art = '') {
  const add = (date, n) => { const x = new Date(date); while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) n--; } return x; };
  const now = new Date(), f = new Intl.DateTimeFormat('it-IT', fmt);
  return `tra ${art}${f.format(add(now, 1))} e ${art}${f.format(add(now, 3))}`;
}

// tracking consent from the cookie banner (97-floating.js): the for-you sources use the visitor's searches
// and viewed products only with it, as the live endpoint does (a/m consent flags)
function trackingOK() { const c = store.get('sks-consent', null); return c === 'all' || !!(c && typeof c === 'object' && (c.analytics || c.marketing || c.preferences)); }

/* ---------- dialogs: native <dialog> gives focus trap, Esc and an inert page; we return focus ---------- */
const openers = new WeakMap();
// keep: a dialog that stays open under this one (the look viewer under a piece's size guide)
function openDialog(id, opener, keep) {
  const d = document.getElementById(id);
  if (!d || d.open) return d;
  $$('dialog[open]').forEach(o => o !== d && o !== keep && closeDialog(o));
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

/* ---------- product popups (popups.js): the wishlist heart's modal, "Guida taglie", "Non sei sicuro della tua
   taglia?" and "Avvisami" load on the first click; pointing at one starts the download ---------- */
const popups = () => import(new URL('popups.js', import.meta.url).href);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-size-help]');
  if (!b) return;
  e.preventDefault();
  popups().then(m => m.open(b.dataset.sizeHelp, b)).catch(() => toast('La guida alle taglie non si è caricata: riprova tra poco.'));
});
['pointerover', 'focusin'].forEach(t => document.addEventListener(t, e => { if (e.target.closest?.('[data-size-help]')) popups(); }, { passive: true }));

/* ---------- the look viewer (look-viewer.js) loads on the first look a shopper opens; a #look-<id> link opens it
   on that look when the page shows it. Without JavaScript the card goes to the look page. ---------- */
const lookViewer = () => import(new URL('look-viewer.js', import.meta.url).href);
document.addEventListener('click', e => {
  const link = e.target.closest('[data-look-viewer]');
  if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  lookViewer().then(m => m.openLook(link)).catch(() => { location.href = link.href; });
});
{
  const m = location.hash.match(/^#look-([\w-]+)$/), link = m && $(`[data-look-viewer="${m[1]}"]`);
  // the URL stays as it arrived until the shopper acts: the CRM's e-mail links (crm_link) need it exact
  if (link) lookViewer().then(v => v.openLook(link, { landed: true }));
}

/* "Condividi" (the live share block of the product and article pages): the phone's share sheet, else the four links */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-share-toggle]');
  if (!b) return;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title: b.dataset.shareTitle, url: b.dataset.shareUrl }); return; } catch (err) { if (err.name === 'AbortError') return; }
  }
  const list = document.getElementById(b.getAttribute('aria-controls')), open = b.getAttribute('aria-expanded') !== 'true';
  b.setAttribute('aria-expanded', String(open)); list.hidden = !open;
});

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
    else lines.unshift({ key, handle: info.handle, size, qty, title: info.title, brand: info.brand, price: info.price, compareAt: info.compareAt || 0, image: info.image, ...(info.meta ? { meta: info.meta } : {}) });
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
    if (changed) { b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump'); b.addEventListener('animationend', () => b.classList.remove('is-bump'), { once: true }); }
  });
  const text = $('[data-cart-count-text]'); if (text) text.textContent = count ? `(${count})` : '';
  const left = Math.max(0, FREE_SHIPPING - subtotal);
  $$('[data-shipping-text]').forEach(t => {
    t.innerHTML = !count ? 'Spedizione gratuita in Italia per ordini superiori a €50'
      : left > 0 ? `Ti mancano <strong>${SKS_FMT.money(left)}</strong> per ottenere la spedizione gratuita!`
      : 'Hai diritto alla spedizione gratuita!';
  });
  $$('[data-shipping-bar]').forEach(b => b.style.setProperty('--pct', Math.min(1, subtotal / FREE_SHIPPING)));
  $$('[data-cart-subtotal]').forEach(s => { s.textContent = SKS_FMT.money(subtotal); });
  // the loyalty widget's cart line ("Accedi per usare i tuoi punti sui prodotti non scontati.") when the cart earns points
  $$('[data-club-cart]').forEach(el => { el.hidden = !count || !SKS_FMT.clubPoints(subtotal); });
  $$('[data-cart-shipping]').forEach(s => { s.textContent = !count ? '' : left > 0 ? '5,90\u00a0€ in Italia' : 'gratuita in Italia'; });
  document.dispatchEvent(new CustomEvent('cart:rendered', { detail: { subtotal } }));
  $$('[data-cart-lines]').forEach(list => {
    list.innerHTML = lines.map(l => `<li class="cart-line${l.key === newKey ? ' is-new' : ''}" data-key="${SKS_FMT.esc(l.key)}">
      <a class="cart-line__media" href="${productUrl(l.handle)}" tabindex="-1" aria-hidden="true"><img src="${SKS_FMT.cdn(l.image, 240)}" alt="" width="200" height="250" loading="lazy"></a>
      <div>
        <p class="cart-line__brand" translate="no">${SKS_FMT.esc(l.brand)}</p>
        <p class="cart-line__title"><a href="${productUrl(l.handle)}">${SKS_FMT.esc(l.title)}</a></p>
        ${l.meta ? l.meta.map(m => `<p class="cart-line__meta">${SKS_FMT.esc(m)}</p>`).join('') : `<p class="cart-line__meta">${SKS_FMT.esc(SKS_FMT.sizeLabel(l.size))}</p>`}
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
  announce(`${info.title}, ${info.meta ? info.meta[0] : `taglia ${size}`}, aggiunto al carrello. Totale ${SKS_FMT.money(Cart.subtotal())}.`);
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

/* ---------- tracking stand-in: the events the live apps record for the CRM (wishlist, back in stock, product
   intent, the look pages' dataLayer), logged here because the preview sends nothing: read them in the console
   ([tracking]) or in window.sksTracking. In the theme the apps keep sending them (CHANGES.md §11). ---------- */
// a page prerendered by the Speculation Rules has not been seen yet: what it records waits until it is shown, and
// never happens for a page the shopper does not open (CHANGES §11: recently viewed, persona, attribution, views)
const whenShown = fn => { if (document.prerendering) document.addEventListener('prerenderingchange', fn, { once: true }); else fn(); };
function trackEvent(type, data = {}) {
  if (document.prerendering) { whenShown(() => trackEvent(type, data)); return; }
  (window.sksTracking ||= []).push({ type, ...data, at: new Date().toISOString() });
  console.debug('[tracking]', type, data);
}

// product-intent-tracker.js's engagement signals on the product page, with its own selectors (the theme keeps the
// markup they match: CHANGES §11); [data-notify-size] is the one selector the port adds to the tracker
if ($('#product-json')) {
  const SIGNALS = [['size_chart_opened', "[href*='size'], [data-size-chart], button[class*='size']"], ['reviews_clicked', "[href*='review'], [data-review], .jdgm, .reviews"],
    ['description_opened', "details, [aria-controls*='description'], [data-accordion]"], ['materials_shipping_clicked', "[href*='shipping'], [href*='material'], [data-shipping], [data-material]"],
    ['add_to_cart_hover_or_click', "form[action*='/cart/add'] button[type='submit'], button[name='add']"], ['wishlist_clicked', ".integrated-wishlist-heart, [data-wishlist], [aria-label*='wishlist' i]"],
    ['back_in_stock_clicked', '[data-back-in-stock-button], .bis-widget-button, [data-notify-size]']];
  document.addEventListener('click', e => { for (const [name, sel] of SIGNALS) if (e.target.closest?.(sel)) trackEvent(`product_intent:${name}`); }, true);
}
document.addEventListener('product-intent:size-test-completed', e => trackEvent('product_intent:size_test_completed', e.detail));
// proposals (02/10, CRM): contact clicks and shares as actions (/apps/intent/action CONTACT_CLICKED, SHARE_CLICKED),
// gated by the cookie choice in the theme; logged here with the "proposal:" prefix, they are not live events
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="tel:"], a[href*="wa.me/"], a[href^="mailto:"], a[href*="google.com/maps"]');
  if (a && !a.closest('.share__list')) trackEvent('proposal:CONTACT_CLICKED', { channel: a.href.startsWith('tel:') ? 'phone' : a.href.includes('wa.me') ? 'whatsapp' : a.href.startsWith('mailto:') ? 'email' : 'map', page: location.pathname });
  const sh = e.target.closest('[data-share-toggle], [data-reel-share], .share__list a');
  if (sh) trackEvent('proposal:SHARE_CLICKED', { channel: sh.closest('.share__list') ? sh.textContent.trim().toLowerCase() : 'share', page: location.pathname });
}, true);

/* ---------- wishlist (stands in for the back-in-stock app's /apps/wishlist): a heart opens the app's modal
   (popups.js, loaded on the first heart; pointing at one starts the download) ---------- */
const Wish = {
  get list() { return store.get('sks-wish', []); },
  has(h) { return this.list.some(x => x.handle === h); },
  // the size the shopper chose travels with the item, and a sold-out size carries its stock alert
  add(P, size, stockAlert) {
    const list = this.list.filter(x => x.handle !== P.handle);
    list.unshift({ handle: P.handle, title: P.title, brand: P.brand, price: P.price, compareAt: P.compareAt || 0, images: [P.image], sizes: P.sizes || [], size: size || null, stockAlert: !!stockAlert });
    this.save(list);
  },
  remove(h) { this.save(this.list.filter(x => x.handle !== h)); },
  save(list) { store.set('sks-wish', list); document.dispatchEvent(new CustomEvent('wish:change')); }
};
function renderWishState() {
  const list = Wish.list;
  $$('[data-wish]').forEach(b => {
    const on = list.some(x => x.handle === b.dataset.wish);
    b.setAttribute('aria-pressed', String(on));
    // the app's labels: "Aggiungi alla wishlist" / "Rimuovi dalla wishlist"
    b.setAttribute('aria-label', on ? 'Rimuovi dalla wishlist' : 'Aggiungi alla wishlist');
    b.title = on ? 'Rimuovi dalla wishlist' : 'Aggiungi alla wishlist';
  });
  $$('[data-wish-count]').forEach(c => { c.hidden = !list.length; c.textContent = list.length; });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-wish]');
  if (!b) return;
  e.preventDefault();
  popups().then(m => m.wish(b)).catch(() => toast('La wishlist non si è caricata: riprova tra poco.'));
});
['pointerover', 'focusin'].forEach(t => document.addEventListener(t, e => { if (e.target.closest?.('[data-wish]')) popups(); }, { passive: true }));
document.addEventListener('wish:change', renderWishState);
renderWishState();
// the app counts one view of its hearts per page (WISHLIST_ICON_VIEWED)
if ($('[data-wish]')) trackEvent('WISHLIST_ICON_VIEWED', { source: $('#product-json') ? 'product_page' : 'collection' });

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
    const products = index.products.map(p => [p, score(SKS_FMT.normalize(`${p[2]} ${p[1]} ${p[3]} ${p[12] || ''} ${p[14] || ''}`))]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    const brands = index.brands.filter(b => score(SKS_FMT.normalize(b[1])));
    const colls = index.collections.filter(c => score(SKS_FMT.normalize(c[1])));
    const articles = (index.articles || []).map(a => [a, score(SKS_FMT.normalize(`${a[2]} ${a[3]}`))]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    const pages = (index.pages || []).filter(pg => score(SKS_FMT.normalize(`${pg[1]} ${pg[2]}`)));
    // the session's last search feeds "Scelti per te" (with tracking consent, as live)
    if (q.length >= 3 && products.length && trackingOK()) { try { sessionStorage.setItem('sks-last-q', raw.trim()); } catch { /* private mode */ } }
    return { q, products, brands, colls, articles, pages };
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
    if (!r.products.length && !r.brands.length && !r.colls.length && !r.articles.length && !r.pages.length) {
      out.innerHTML = `<div class="search-empty"><h3>Non sono stati trovati risultati per "${SKS_FMT.esc(raw)}"</h3><ul class="chips" role="list" style="margin-top:16px">${['Barbour', 'Piumino', 'Samba', 'Pedule'].map(s => `<li><button type="button" class="chip" data-search-suggest="${s}">${s}</button></li>`).join('')}</ul></div>`;
      return;
    }
    const products = r.products.slice(0, 8).map(p => ({ handle: p[0], title: p[1], brand: p[2], price: p[5], image: p[6] }));
    // "Suggerimenti" (Shopify's query suggestions): the searches the results suggest, type and brand + type
    const sugg = [];
    for (const p of r.products.slice(0, 40)) for (const t of [p[12], `${p[2]} ${p[12]}`]) {
      if (t && !sugg.includes(t) && SKS_FMT.normalize(t) !== r.q) sugg.push(t);
      if (sugg.length >= 4) break;
    }
    const side = r.brands.length || r.colls.length || r.articles.length || r.pages.length;
    out.innerHTML = `${sugg.length ? `<div class="search-suggest"><h3 class="visually-hidden">Suggerimenti</h3><ul class="chips" role="list">${sugg.slice(0, 4).map(t => `<li><a class="chip" href="${BASE}search.html?q=${encodeURIComponent(t)}" data-search-suggest="${SKS_FMT.esc(t)}">${mark(t, r.q)}</a></li>`).join('')}</ul></div>` : ''}
      <div class="search-results${side ? '' : ' search-results--single'}">
      <div class="search-results__side">
        ${r.brands.length ? `<h3>Marche</h3><ul role="list">${r.brands.slice(0, 5).map(b => `<li><a href="${BASE}collections/${b[0]}.html">${mark(b[1], r.q)} <span class="meta">${b[2]}</span></a></li>`).join('')}</ul>` : ''}
        ${r.colls.length ? `<h3>Categorie</h3><ul role="list">${r.colls.slice(0, 6).map(c => `<li><a href="${BASE}collections/${c[0]}.html">${mark(c[1], r.q)}</a></li>`).join('')}</ul>` : ''}
        ${r.articles.length ? `<h3>Articoli del blog</h3><ul role="list">${r.articles.slice(0, 3).map(a => `<li><a href="${BASE}blogs/${a[0]}/${a[1]}.html">${mark(a[2], r.q)}</a></li>`).join('')}</ul>` : ''}
        ${r.pages.length ? `<h3>Pagine</h3><ul role="list">${r.pages.slice(0, 4).map(pg => `<li><a href="${BASE}${pg[0].slice(1)}.html">${mark(pg[1], r.q)}</a></li>`).join('')}</ul>` : ''}
      </div>
      <div class="search-results__main">
        ${r.products.length ? `<h3>Prodotti <span class="meta">${r.products.length}</span></h3>` : ''}
        <div class="search-results__grid">${products.map(hit).join('')}</div>
        <p class="search-results__all"><a class="button button--outline" href="${url}">Vedi tutti i risultati</a></p>
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

/* ---------- prototype stand-ins for widgets a third party draws (Shop's follow button): they say so ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-proto-note]');
  if (b) toast(b.dataset.protoNote);
});

/* ---------- colour thumbnails on cards (assets/card-color-swatches.js): a pointer or focus on a colour shows its
   photo in the card; leaving the card or the row puts the card's own photo back ---------- */
(() => {
  const saved = new WeakMap();
  const primary = card => card && $('.product-card__img--primary', card);
  function preview(link) {
    const card = link.closest('product-card'), img = primary(card);
    if (!img || !link.dataset.previewImage) return;
    if (!saved.has(card)) saved.set(card, { src: img.getAttribute('src'), srcset: img.getAttribute('srcset') });
    card.classList.add('is-color-previewing');
    if (link.dataset.previewSrcset) img.setAttribute('srcset', link.dataset.previewSrcset); else img.removeAttribute('srcset');
    img.setAttribute('src', link.dataset.previewImage);
  }
  function restore(card) {
    const s = card && saved.get(card), img = primary(card);
    if (!s || !img) return;
    img.setAttribute('src', s.src);
    if (s.srcset) img.setAttribute('srcset', s.srcset); else img.removeAttribute('srcset');
    card.classList.remove('is-color-previewing');
    saved.delete(card);
  }
  document.addEventListener('pointerover', e => { const l = e.target.closest('.card-swatches__link'); if (l && e.pointerType !== 'touch') preview(l); });
  document.addEventListener('focusin', e => { const l = e.target.closest('.card-swatches__link'); if (l) preview(l); });
  document.addEventListener('pointerout', e => {
    const card = e.target.closest('product-card'), row = e.target.closest('.card-swatches-wrapper');
    if (card && !card.contains(e.relatedTarget)) restore(card);
    else if (row && !row.contains(e.relatedTarget)) restore(row.closest('product-card'));
  });
  document.addEventListener('focusout', e => {
    const card = e.target.closest('product-card');
    requestAnimationFrame(() => { if (card && !card.contains(document.activeElement)) restore(card); });
  });
})();

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
      // the live section's reasons (sections/for-you.liquid)
      lead.textContent = picks[0].source === 'search' ? 'In base alla tua ricerca' : 'Simili a quelli che hai visto';
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
      // the live section's reasons (sections/for-you.liquid)
      why.textContent = picks.some(x => x.source === 'similar' || x.source === 'search') ? 'Simili a quelli che hai visto' : 'I più amati del momento';
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

/* ---------- FAQ: "Mostra altre domande" (the app block shows five) and the FAQ page's search ---------- */
document.addEventListener('click', e => {
  const more = e.target.closest('[data-faq-more]');
  if (!more) return;
  const list = more.previousElementSibling;
  const hidden = $$('[data-faq-more-item]', list);
  hidden.forEach(d => { d.hidden = false; d.removeAttribute('data-faq-more-item'); });
  hidden[0]?.querySelector('summary')?.focus();
  more.remove();
});

(() => {
  const input = $('[data-faq-search]');
  if (!input) return;
  const groups = $$('.faq-page__group'), none = $('[data-faq-none]');
  const items = groups.flatMap(g => $$('details', g).map(d => ({ d, g, text: SKS_FMT.normalize(d.textContent) })));
  let opened = [];
  input.addEventListener('input', () => {
    const words = SKS_FMT.normalize(input.value).split(' ').filter(w => w.length > 1);
    opened.forEach(d => { d.open = false; }); opened = [];
    let shown = 0;
    items.forEach(({ d, text }) => { const ok = !words.length || words.every(w => text.includes(w)); d.hidden = !ok; if (ok) shown++; });
    groups.forEach(g => { g.hidden = !$$('details', g).some(d => !d.hidden); });
    none.hidden = shown > 0;
    // a few matches open by themselves: the answer is what was searched for
    if (words.length && shown <= 3) items.forEach(({ d }) => { if (!d.hidden) { d.open = true; opened.push(d); } });
  });
})();

/* ---------- cookie choice, then the -10% newsletter popup ----------
   In the theme the banner is Shopify's customer privacy banner (its choice goes to the Customer Privacy API).
   The popup is sections/newsletter-popup.liquid with its live behaviour (owner, 02/10: "nasce aperto, poi si
   riduce da solo e poi si riapre al click"), restyled: it opens 5 seconds into the visit (here 5 seconds after
   the cookie choice, so the two never share the screen), shrinks after 20 seconds or at the first scroll of
   16px, unless the shopper is using its form, and a tap opens it again (and arms the shrink again); its "–"
   shrinks it, its x retires it for good. In the same tab the next pages show it already shrunk. Not on the
   cart, checkout and account pages; it waits while a dialog is open. The live keys: localStorage
   theme:popup-filled and nlp:dismissed-permanent, sessionStorage nlp:shown, nlp:collapsed, nlp:dismissed.
   The sign-up goes to /apps/intent/newsletter-identify (CRM: NEWSLETTER_IDENTIFIED, source
   newsletter_popup_welcome10); here it is logged, as the other events. */
(() => {
  const banner = $('[data-cookie-banner]'), pop = $('[data-nl-pop]');
  const consent = () => store.get('sks-consent', null);
  const raw = area => ({
    get: k => { try { return window[area].getItem(k); } catch { return null; } },
    set: (k, v) => { try { window[area].setItem(k, v); } catch { /* storage blocked */ } },
    del: k => { try { window[area].removeItem(k); } catch { /* storage blocked */ } }
  });
  const ls = raw('localStorage'), ss = raw('sessionStorage');
  const DELAY = 5000, SHRINK = 20000;
  let timer = 0, armedAt = 0, y0 = 0;

  function setState(state, reason) {
    pop.dataset.state = state;
    $$('[data-nl-toggle]', pop).forEach(b => b.setAttribute('aria-expanded', String(state === 'open')));
    const t = $('.nl-pop__toggle', pop);
    t.setAttribute('aria-label', state === 'open' ? 'Riduci popup newsletter' : 'Apri popup newsletter');
    if (state === 'collapsed') { ss.set('nlp:collapsed', '1'); pop.dataset.reason = reason || ''; disarm(); }
    else ss.del('nlp:collapsed');
  }
  const onScroll = () => {
    if (performance.now() - armedAt < 500) { y0 = scrollY; return; }
    if (Math.abs(scrollY - y0) >= 16) setState('collapsed', 'scroll');
  };
  function arm() {
    disarm();
    if ('formActive' in pop.dataset) return;
    armedAt = performance.now(); y0 = scrollY;
    timer = setTimeout(() => setState('collapsed', 'timer'), SHRINK);
    addEventListener('scroll', onScroll, { passive: true });
  }
  function disarm() { clearTimeout(timer); removeEventListener('scroll', onScroll); }
  function show(state) {
    pop.hidden = false;
    ss.set('nlp:shown', '1');
    setState(state);
    if (state === 'open') arm();
  }
  function start() {
    if (!pop || pop.hidden === false) return;
    if (ls.get('theme:popup-filled') || ls.get('nlp:dismissed-permanent') || ss.get('nlp:dismissed')) return;
    if (/^template-(cart|checkout|customers)/.test(document.body.className)) return;
    // the next page of the same tab: already shrunk, at once
    if (ss.get('nlp:shown') && ss.get('nlp:collapsed')) { show('collapsed'); return; }
    const attempt = () => {
      if (document.querySelector('dialog[open], .drawer[open]')) { setTimeout(attempt, DELAY); return; }
      show('open');
    };
    setTimeout(attempt, DELAY);
  }
  function decide(value) {
    store.set('sks-consent', value);
    if (banner) banner.hidden = true;
    ROOT.classList.remove('has-cookie-banner');
    announce(value === 'all' ? 'Cookie accettati' : 'Scelta salvata: solo i cookie necessari e quelli che hai scelto');
    start();
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
  } else start();

  if (!pop) return;
  // using the form stops the shrink for this page
  const active = e => { if (e.target.closest('[data-nl-form]')) { pop.dataset.formActive = ''; disarm(); } };
  pop.addEventListener('focusin', active);
  pop.addEventListener('pointerdown', active);
  pop.addEventListener('click', async e => {
    if (e.target.closest('[data-nl-dismiss]')) {
      pop.hidden = true; disarm();
      ss.set('nlp:dismissed', '1'); ss.del('nlp:collapsed'); ls.set('nlp:dismissed-permanent', '1');
      return;
    }
    // shrunk on desktop, the whole title bar opens it
    const t = e.target.closest('[data-nl-toggle]') || (pop.dataset.state === 'collapsed' && e.target.closest('.nl-pop__head'));
    if (t) {
      if (pop.dataset.state === 'open') setState('collapsed', 'manual');
      else { setState('open'); arm(); $('[data-nl-form] input', pop)?.focus({ preventScroll: true }); }
      return;
    }
    const copy = e.target.closest('[data-nl-copy]');
    if (copy) {
      try { await navigator.clipboard.writeText('WELCOME10'); } catch { /* the code stays on screen */ }
      copy.textContent = 'Copiato';
      setTimeout(() => { copy.textContent = 'Copia codice'; }, 1500);
    }
  });
  // the sign-up: the live popup shows its success at once ("Iscrizione completata", the code) and stays open
  $('[data-nl-form]', pop).addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    if (!form.reportValidity()) return;
    trackEvent('request:apps/intent/newsletter-identify', { source: 'newsletter_popup_welcome10', marketingConsent: true });
    trackEvent('server:NEWSLETTER_IDENTIFIED', { source: 'newsletter_popup_welcome10' });
    ls.set('theme:popup-filled', 'true');
    disarm();
    $('[data-nl-title]', pop).textContent = 'Iscrizione completata';
    $('[data-nl-start]', pop).hidden = true;
    $('[data-nl-done]', pop).hidden = false;
    $('[data-nl-copy]', pop).focus({ preventScroll: true });
  });
  // a sign-up from the footer retires the popup too
  document.addEventListener('submit', e => { if (e.target.closest('.newsletter-form') && e.target.checkValidity()) { ls.set('theme:popup-filled', 'true'); pop.hidden = true; disarm(); } }, true);
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

export { SKS_FMT, SKS_CARD, $, $$, ROOT, BASE, MOTION_OK, FINE_POINTER, urlWritable, memory, store, announce, toast, CARDS, registerCards, productUrl, yieldToMain, deliveryWindow, trackingOK, openers, openDialog, closeDialog, popups, lookViewer, FREE_SHIPPING, MOCK_LATENCY, Cart, infoFromCard, renderCart, addWithFeedback, whenShown, trackEvent, Wish, renderWishState, Recent, initRail, ForYou };
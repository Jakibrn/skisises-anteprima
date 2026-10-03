// luxe-collection.js: built 2026-10-03. Motion uses the theme's own vendor.min.js (Motion One).
import { SKS_FMT, SKS_CARD, $, $$, ROOT, BASE, MOTION_OK, FINE_POINTER, urlWritable, memory, store, announce, toast, REEL, rollText, spinText, DOODLES, doodle, CARDS, registerCards, productUrl, yieldToMain, deliveryWindow, trackingOK, openers, openDialog, closeDialog, PHONE_SHEET, sheetStops, snapSheet, popups, lookViewer, FREE_SHIPPING, MOCK_LATENCY, Cart, infoFromCard, renderCart, addWithFeedback, sizeSheet, whenShown, trackEvent, Wish, renderWishState, Recent, loadSlides, initRail, ForYou } from './luxe.js';
import { animate, inView, scroll, stagger, timeline, PhotoSwipeLightbox } from 'vendor';
/* ---------- proto-facets: filters, sort, density and the infinite scroll on the collection JSON ----------
   In the theme the grid is re-rendered by Prestige's facets (Section Rendering API); the UI, the URL
   state and the View Transition around the swap are what moves into the theme.
   Infinite scroll, the theme's own in place of the Infinite Scroll app (owner, 02/10): pages of 8 as live,
   the next one requested when the end of the grid is 1200px away, so it is there before the shopper is;
   only the new cards are appended (no grid re-render, focus and loaded images stay); ?page=N kept in the
   URL, so Back lands on the same product. In the theme the page comes from
   fetch(`${nextUrl}&section_id=main-collection`): the section's HTML only, never the whole page. */
(() => {
  const root = $('facet-filters');
  if (!root) return;
  const data = JSON.parse($('[data-collection-json]', root).textContent);
  registerCards(data);
  const perPage = +root.dataset.perPage || 8;
  const grid = $('[data-grid]', root), body = $('[data-facets-body]');
  // the looks woven in after each page of 8: the first is in the HTML, the next ones in a template
  const tpl = $('[data-grid-looks]', root);
  const looksPool = [...$$('.grid-look', grid).map(n => n.outerHTML), ...(tpl ? [...tpl.content.children].map(n => n.outerHTML) : [])];
  // the Gift Card tile, sixth while no filter or sort is applied (main-collection.mjs)
  const giftTile = $('.grid-gift', grid)?.outerHTML || '';
  const params = new URLSearchParams(location.search);
  const state = {
    brand: new Set(params.getAll('marca')), size: new Set(params.getAll('taglia')), color: new Set(params.getAll('colore')),
    type: params.get('tipo') || '', gender: params.get('genere') || '', sale: params.get('saldi') === '1', min: +params.get('min') || 0, max: +params.get('max') || 0,
    sort: params.get('ordina') || 'evidenza', density: '', shown: Math.max(1, +params.get('page') || 1) * perPage
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

  // the theme's gender pills (templates/collection.json): unisex counts for Uomo and Donna, junior unisex for
  // Bambino and Bambina; "junior" (Bambini) takes every kid
  const AUD = { uomo: ['uomo', 'unisex'], donna: ['donna', 'unisex'], bambino: ['bambino', 'junior'], bambina: ['bambina', 'junior'], junior: ['bambino', 'bambina', 'junior'] };
  const forGender = (p, g) => !g || (AUD[g] || [g]).includes(p.audience || p.gender);
  const GENDER_LABEL = { uomo: 'Uomo', donna: 'Donna', bambino: 'Bambino', bambina: 'Bambina', junior: 'Bambini' };
  function matches(p, skip) {
    if (skip !== 'brand' && state.brand.size && !state.brand.has(p.brand)) return false;
    if (skip !== 'size' && state.size.size && !p.sizes.some(([l, a]) => a && state.size.has(l))) return false;
    if (skip !== 'color' && state.color.size && !state.color.has(p.colorName)) return false;
    if (skip !== 'type' && state.type && p.type !== state.type) return false;
    if (skip !== 'gender' && !forGender(p, state.gender)) return false;
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

  // only the facets' own keys are rewritten: utm_*, gclid, fbclid, gbraid, wbraid, sks_rec and any other parameter
  // stay as they arrived (the Ads Pulse UTM report and the pixels read them from the page URL; CHANGES §11)
  const OWN = ['marca', 'taglia', 'colore', 'tipo', 'genere', 'saldi', 'min', 'max', 'ordina', 'vista', 'page'];
  function syncUrl() {
    const q = new URLSearchParams(location.search);
    OWN.forEach(k => q.delete(k));
    state.brand.forEach(v => q.append('marca', v)); state.size.forEach(v => q.append('taglia', v)); state.color.forEach(v => q.append('colore', v));
    if (state.type) q.set('tipo', state.type); if (state.gender) q.set('genere', state.gender); if (state.sale) q.set('saldi', '1');
    if (state.min) q.set('min', state.min); if (state.max) q.set('max', state.max);
    if (state.sort !== 'evidenza') q.set('ordina', state.sort); if (state.density) q.set('vista', state.density);
    if (state.shown > perPage) q.set('page', Math.ceil(state.shown / perPage));
    if (urlWritable()) history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
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
      (['uomo', 'donna', 'bambino', 'bambina'].filter(g => data.some(p => forGender(p, g))).length > 1 ? group('Genere', `<div class="facet__sizes">${[['', 'Tutti'], ['uomo', 'Uomo'], ['donna', 'Donna'], ['bambino', 'Bambino'], ['bambina', 'Bambina']].filter(([g]) => !g || data.some(p => forGender(p, g))).map(([g, l]) => `<label class="size-toggle"><input type="radio" name="f-genere" data-f="gender" value="${g}" ${state.gender === g ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`, true) : '') +
      (data.some(p => p.compareAt) ? group('Saldi', `<label class="check"><input type="checkbox" data-f="sale" ${state.sale ? 'checked' : ''}><span>Solo capi in saldo</span><span class="check__n">${data.filter(p => p.compareAt).length}</span></label>`) : '');
  }

  function renderApplied() {
    const chips = [];
    state.brand.forEach(v => chips.push(['brand', v, v])); state.size.forEach(v => chips.push(['size', v, `Taglia ${v}`])); state.color.forEach(v => chips.push(['color', v, v]));
    if (state.sale) chips.push(['sale', '', 'In saldo']);
    if (state.gender) chips.push(['gender', '', GENDER_LABEL[state.gender] || state.gender]);
    if (state.min || state.max) chips.push(['price', '', `${state.min || priceMin}–${state.max || priceMax} €`]);
    $('[data-applied]', root).innerHTML = chips.map(([k, v, l]) => `<li><button type="button" class="chip chip--remove" data-remove-f="${k}" data-v="${SKS_FMT.esc(v)}" aria-label="Togli il filtro ${SKS_FMT.esc(l)}">${SKS_FMT.esc(l)}<svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button></li>`).join('');
    const n = activeCount();
    const badge = $('[data-active-count]', root); badge.hidden = !n; badge.textContent = n;
  }

  let current = data;
  const pristine = () => !activeCount() && !state.type && state.sort === 'evidenza';
  // cards from..to, with a look after every full page of 8 while products follow (as the server renders it)
  function cardsHtml(list, from, to) {
    let html = '';
    const looks = pristine();
    for (let i = from; i < to; i++) {
      html += SKS_CARD.render(list[i], { base: BASE });
      if (looks && i === 5 && giftTile && list.length > 6) html += giftTile;
      const pageEnd = (i + 1) % perPage === 0, look = looksPool[(i + 1) / perPage - 1];
      if (looks && pageEnd && look && list.length > i + 1) html += look;
    }
    return html;
  }
  function renderGrid(list) {
    current = list;
    grid.innerHTML = cardsHtml(list, 0, Math.min(state.shown, list.length));
    // one size filtered: the product page opens with that size chosen (?taglia=)
    if (state.size.size === 1) { const t = [...state.size][0]; $$('product-card a[href]', grid).forEach(a => { const u = new URL(a.href); u.searchParams.set('taglia', t); a.href = u.href; }); }
    renderWishState();
    $$('[data-result-count]').forEach(e => { e.textContent = list.length; });
    $('[data-filter-empty]', root).hidden = !!list.length;
    status();
    watch();
  }
  function status() {
    const list = current, shown = Math.min(state.shown, list.length);
    $('[data-load-more-wrap]', root).hidden = list.length <= state.shown;
    $('[data-shown]', root).textContent = shown;
    $('[data-total]', root).textContent = list.length;
    $('[data-load-bar]', root).style.setProperty('--pct', Math.min(1, shown / Math.max(1, list.length)));
    const next = $('[data-load-more]', root);
    if (next) next.href = `?page=${Math.floor(shown / perPage) + 1}`;
  }

  // the next page of 8, appended: the cards already on screen are not touched
  function appendPage() {
    const from = state.shown, to = Math.min(from + perPage, current.length);
    if (from >= to) return false;
    grid.insertAdjacentHTML('beforeend', cardsHtml(current, from, to));
    state.shown = to;
    // the wishlist app's hearts and the CRM's page count listen for this (CHANGES §11)
    document.dispatchEvent(new CustomEvent('infinite-scroll:loaded', { detail: { page: Math.ceil(to / perPage) } }));
    renderWishState();
    status();
    syncUrl();
    return true;
  }
  const sentinel = $('[data-load-sentinel]', root);
  const io = 'IntersectionObserver' in window && sentinel ? new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    // re-observing gives a fresh reading: a short page keeps loading until the end is far enough again
    if (appendPage()) requestAnimationFrame(() => { io.unobserve(sentinel); if (state.shown < current.length) io.observe(sentinel); });
  }, { rootMargin: '0px 0px 1200px 0px' }) : null;
  function watch() {
    if (!io) return;
    io.unobserve(sentinel);
    if (state.shown < current.length) io.observe(sentinel);
  }
  // with the automatic scroll the link is only for crawlers and no JavaScript
  if (io) $('[data-load-more]', root)?.setAttribute('hidden', '');

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
      state.shown = perPage; update(); return;
    }
    const d = e.target.closest('[data-density]');
    if (d) { setDensity(d.dataset.density); syncUrl(); return; }
    if (e.target.closest('[data-load-more]')) {
      e.preventDefault();
      const before = state.shown;
      if (appendPage()) $$('product-card', grid)[before]?.querySelector('a[href]')?.focus();
    }
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-clear-filters]')) {
      state.brand.clear(); state.size.clear(); state.color.clear(); state.sale = false; state.min = 0; state.max = 0; state.type = ''; state.gender = ''; state.shown = perPage; syncGenderChips();
      $$('[data-type-chip]').forEach(c => { const on = c.dataset.typeChip === ''; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
      update();
    }
    const gchip = e.target.closest('[data-gender-chip]');
    if (gchip) { const g = gchip.dataset.genderChip; state.gender = g && state.gender === g && gchip.classList.contains('audience-pill') ? '' : g; syncGenderChips(); state.shown = perPage; update(); return; }
    const chip = e.target.closest('[data-type-chip]');
    if (chip) {
      state.type = chip.dataset.typeChip;
      $$('[data-type-chip]').forEach(c => { const on = c === chip; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
      state.shown = perPage;
      update();
    }
  });
  $('[data-sort]', root).value = state.sort;
  $('[data-sort]', root).addEventListener('change', e => { state.sort = e.target.value; state.shown = perPage; update(); });

  // restore from the URL (Back keeps filters, sort, density and how many were shown)
  setDensity(state.density);
  syncGenderChips();
  if (state.type) $$('[data-type-chip]').forEach(c => { const on = c.dataset.typeChip === state.type; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
  if (activeCount() || state.type || state.gender || state.sort !== 'evidenza' || state.shown > perPage) update({ animate: false });
  else { renderFacets(); renderApplied(); status(); watch(); }
})();

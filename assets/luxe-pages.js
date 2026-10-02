// luxe-pages.js: built 2026-10-02. Motion uses the theme's own vendor.min.js (Motion One).
import { SKS_FMT, SKS_CARD, $, $$, ROOT, BASE, MOTION_OK, FINE_POINTER, urlWritable, memory, store, announce, toast, CARDS, registerCards, productUrl, yieldToMain, deliveryWindow, trackingOK, openers, openDialog, closeDialog, popups, lookViewer, FREE_SHIPPING, MOCK_LATENCY, Cart, infoFromCard, renderCart, addWithFeedback, trackEvent, Wish, renderWishState, Recent, initRail, ForYou } from './luxe.js';
import { animate, inView, scroll, stagger, timeline, PhotoSwipeLightbox } from 'vendor';
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
        // every size, the sold-out ones struck through with "Avvisami", as on the product page; the size chosen in
        // the heart's modal comes preselected
        const all = x.sizes || [], sizes = all.filter(s => s[1]), sold = all.length - sizes.length;
        const card = SKS_CARD.render({ ...x, images: (x.images || []).filter(Boolean), sizes: [], swatches: [] }, { base: BASE });
        const buy = sizes.length
          ? `<form class="wish-buy" data-wish-buy="${SKS_FMT.esc(x.handle)}" novalidate><fieldset class="look-sizes"><legend class="visually-hidden">Taglia</legend>${all.map(s => `<label class="look-size${s[1] ? '' : ' is-sold'}"><input type="radio" name="w-${SKS_FMT.esc(x.handle)}" value="${SKS_FMT.esc(s[0])}" ${s[1] ? (sizes.length === 1 || s[0] === x.size ? 'checked' : '') : 'disabled'}><span>${SKS_FMT.esc(s[0])}</span></label>`).join('')}</fieldset><p class="field__error" data-wish-error hidden>Scegli una taglia.</p>${sold ? `<p class="meta">Taglia esaurita? <button type="button" class="link-small" data-wish-notify>Avvisami</button></p>` : ''}<button type="submit" class="button button--primary button--small">Aggiungi al carrello</button></form>`
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
  // search results page: sections/main-search.liquid, see the block below
})();

/* ---------- withdrawal form (sections/withdrawal-form.liquid): data, then the declaration to confirm ---------- */
(() => {
  const form = $('[data-withdrawal]');
  if (!form) return;
  const step = name => {
    $$('[data-wd-step]', form).forEach(s => { s.hidden = s.dataset.wdStep !== name; });
    $$('[data-wd-dot]').forEach(d => d.toggleAttribute('aria-current', d.dataset.wdDot === name || (name === 'done' && d.dataset.wdDot === 'confirm')));
    const head = $(`[data-wd-step="${name}"] h3`, form);
    if (head) head.focus(); else $('input', form).focus();
  };
  const fail = (el, msg) => {
    const err = $(`#${el.id}-err`);
    el.setAttribute('aria-invalid', String(!!msg));
    err.textContent = msg || ''; err.hidden = !msg;
    return !msg;
  };
  form.addEventListener('submit', e => {
    e.preventDefault();
    let first = null;
    for (const el of form.elements) {
      if (!el.name || !el.closest('[data-wd-step="form"]')) continue;
      const v = el.value.trim();
      const msg = el.required && !v ? 'Questo campo serve per la dichiarazione.'
        : el.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Controlla l’indirizzo: manca la @ o il dominio.' : '';
      if (!fail(el, msg) && !first) first = el;
    }
    if (first) { first.focus(); return; }
    const v = n => form.elements[n].value.trim();
    const row = (k, val) => `<div><dt>${k}</dt><dd>${SKS_FMT.esc(val)}</dd></div>`;
    $('[data-wd-declaration]', form).innerHTML =
      `<p>Con la presente comunico il recesso dal mio contratto di vendita dei seguenti beni:</p><p class="withdrawal__goods">${SKS_FMT.esc(v('products')).replace(/\n/g, '<br>')}</p>` +
      `<dl>${row('Ordine n.', v('order_number'))}${row('Data dell’ordine o di ricezione', v('order_date') || 'non indicata')}${row('Nome del consumatore', v('name'))}${row('Indirizzo e-mail', v('email'))}</dl>`;
    step('confirm');
  });
  $('[data-wd-edit]', form).addEventListener('click', () => step('form'));
  $('[data-wd-confirm]', form).addEventListener('click', e => {
    const b = e.currentTarget;
    b.disabled = true; b.textContent = 'Invio in corso…';
    setTimeout(() => {
      $('[data-wd-when]', form).textContent = new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date()).replace(',', ' alle');
      b.disabled = false; b.textContent = 'Conferma il recesso';
      step('done');
    }, 600);
  });
})();

/* ---------- search results page (sections/main-search.liquid): tabs, gender pills, type tiles, a look after
   every 8 products, 24 products at a time as the shopper scrolls ---------- */
(() => {
  const sp = $('[data-search-page]');
  if (!sp) return;
  const q = new URLSearchParams(location.search).get('q') || '';
  const input = $('#search-page-input'); input.value = q;
  const count = $('[data-search-page-count]');
  if (!q) { count.textContent = 'Scrivi cosa cerchi: un capo, una marca, una categoria.'; return; }
  if (trackingOK()) { try { sessionStorage.setItem('sks-last-q', q); } catch { /* private mode */ } }
  $('[data-search-title]').textContent = `Risultati per “${q}”`;
  document.title = `Risultati per “${q}” | Ski Sises`;
  const AUD = { uomo: ['uomo', 'unisex'], donna: ['donna', 'unisex'], bambino: ['bambino', 'junior'], bambina: ['bambina', 'junior'] };
  const PILLS = [['uomo', 'Uomo', 'male', 'm'], ['donna', 'Donna', 'female', 'f'], ['bambino', 'Bambino', 'male', 'm'], ['bambina', 'Bambina', 'female', 'f']];
  const icon = n => `<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const STEP = 24, LOOK_EVERY = 8, MAX_LOOKS = 6;
  window.SKS_SEARCH_API.loadIndex().then(index => {
    const r = window.SKS_SEARCH_API.search(index, q);
    const all = r.products.map(p => ({ handle: p[0], title: p[1], brand: p[2], price: p[5], compareAt: p[7] || 0, images: [p[6], p[8]].filter(Boolean),
      sizes: p[9] || [], audience: p[10], isNew: !!(p[11] & 1), bestseller: !!(p[11] & 2), lowStock: !!(p[11] & 4), backInStock: !!(p[11] & 8),
      type: p[12], priceVaries: !!p[13], swatches: [] }));
    const total = all.length + r.articles.length + r.pages.length;
    count.textContent = total ? `${total} ${total === 1 ? 'risultato' : 'risultati'} per “${q}”` : '';
    $('[data-search-page-empty]').hidden = !!(total || r.brands.length || r.colls.length);
    $('[data-search-page-side]').innerHTML = [
      r.brands.length ? `<p class="meta">Marche</p><ul class="chips" role="list">${r.brands.slice(0, 8).map(b => `<li><a class="chip" href="${BASE}collections/${b[0]}.html">${SKS_FMT.esc(b[1])} <span class="chip__count">${b[2]}</span></a></li>`).join('')}</ul>` : '',
      r.colls.length ? `<p class="meta">Categorie</p><ul class="chips" role="list">${r.colls.slice(0, 8).map(c => `<li><a class="chip" href="${BASE}collections/${c[0]}.html">${SKS_FMT.esc(c[1])}</a></li>`).join('')}</ul>` : ''
    ].join('');

    // tabs, only when more than one kind has results (live)
    const kinds = { products: all.length, articles: r.articles.length, pages: r.pages.length };
    const present = Object.keys(kinds).filter(k => kinds[k]);
    const tabs = $('[data-search-tabs]');
    const select = kind => {
      $$('[data-search-tab]', tabs).forEach(t => { const on = t.dataset.searchTab === kind; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      $$('[data-search-panel]').forEach(pn => { pn.hidden = pn.dataset.searchPanel !== kind; });
    };
    $$('[data-search-tab]', tabs).forEach(t => { const k = t.dataset.searchTab; t.hidden = !kinds[k]; $(`[data-tab-count="${k}"]`, tabs).textContent = kinds[k]; });
    tabs.hidden = present.length < 2;
    if (present.length) select(present[0]); else $$('[data-search-panel]').forEach(pn => { pn.hidden = true; });
    tabs.addEventListener('click', e => { const t = e.target.closest('[data-search-tab]'); if (t) select(t.dataset.searchTab); });
    tabs.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const vis = $$('[data-search-tab]', tabs).filter(t => !t.hidden), i = vis.indexOf(document.activeElement);
      const next = vis[(i + (e.key === 'ArrowRight' ? 1 : -1) + vis.length) % vis.length];
      next.focus(); select(next.dataset.searchTab);
    });

    // articles and pages
    $('[data-search-articles]').innerHTML = r.articles.map(a => {
      const url = `${BASE}blogs/${a[0]}/${a[1]}.html`;
      return `<article class="article-card">${a[4] ? `<a class="article-card__media-link" href="${url}" tabindex="-1" aria-hidden="true"><span class="article-card__media"><img src="${SKS_FMT.cdn(a[4], 720, 540)}" alt="" loading="lazy" width="720" height="540"></span></a>` : ''}
        <p class="meta"><time datetime="${a[5]}">${new Date(a[5] + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</time></p>
        <h3 class="d5 article-card__title"><a href="${url}">${SKS_FMT.esc(a[2])}</a></h3><p class="muted article-card__excerpt">${SKS_FMT.esc(a[3])}</p></article>`;
    }).join('');
    $('[data-search-pages]').innerHTML = r.pages.map(pg => `<li><a href="${BASE}${pg[0].slice(1)}.html">${SKS_FMT.esc(pg[1])}</a></li>`).join('');

    // products: gender pills and type tiles (the live custom block), then the grid
    const state = { aud: '', type: '', shown: 0, list: [], looks: [] };
    const words = SKS_FMT.normalize(q).split(' ').filter(w => w.length >= 3);
    const month = new Date().getMonth() + 1, season = month >= 9 || month <= 2 ? ['fall', 'winter'] : ['spring', 'summer'];
    const filtered = () => all.filter(p => (!state.aud || AUD[state.aud].includes(p.audience)) && (!state.type || p.type === state.type));
    // snippets/look-rank.liquid: a look with a piece among the first results or named by the query, gender as the
    // pill; in season first, then a piece among the results, then the most pieces available
    const rankLooks = list => {
      const top = new Set(list.slice(0, 50).map(p => p.handle));
      const gender = state.aud === 'uomo' || state.aud === 'donna' ? state.aud : '';
      return index.looks.map(l => ({ l, hit: l[4].some(h => top.has(h)), named: words.some(w => SKS_FMT.normalize(l[5]).includes(w)), inSeason: !l[8] || season.includes(l[8]) }))
        .filter(x => (x.hit || x.named) && (!gender || x.l[2] === gender))
        .sort((a, b) => (b.inSeason - a.inSeason) || (b.hit - a.hit) || (b.l[6] - a.l[6])).slice(0, MAX_LOOKS).map(x => x.l);
    };
    const lookHtml = l => `<div class="grid-look"><article class="look-card"><a class="look-card__link" href="${BASE}pages/outfits/${l[0]}.html" data-look-viewer="${l[0]}"><span class="look-card__media" data-vt-look><img src="${SKS_FMT.cdn(l[3], 720, 900, 'top')}" srcset="${SKS_FMT.srcset(l[3], [360, 540, 720], 1.25, 941, 'top')}" sizes="(min-width: 1024px) 44vw, 92vw" alt="" loading="lazy" width="720" height="900"></span><span class="look-card__title">${SKS_FMT.esc(l[1])}</span></a><p class="look-card__meta"><span>Scopri il Look · ${l[6]}</span></p></article></div>`;
    const grid = $('[data-search-page-grid]'), more = $('[data-search-more]'), sentinel = $('[data-search-sentinel]');
    const page = () => {
      const from = state.shown, to = Math.min(state.list.length, from + STEP), slice = state.list.slice(from, to);
      registerCards(slice);
      let html = '';
      slice.forEach((p, i) => {
        html += SKS_CARD.render(p, { base: BASE });
        const n = from + i + 1;
        if (n % LOOK_EVERY === 0 && n < state.list.length && state.looks[n / LOOK_EVERY - 1]) html += lookHtml(state.looks[n / LOOK_EVERY - 1]);
      });
      grid.insertAdjacentHTML('beforeend', html);
      state.shown = to;
      more.hidden = io ? true : to >= state.list.length;
      renderWishState();
    };
    const filters = $('[data-search-filters]');
    const renderFilters = () => {
      const base = all.filter(p => !state.aud || AUD[state.aud].includes(p.audience));
      const pills = PILLS.map(([g, l, ic, s]) => [g, l, ic, s, all.filter(p => (!state.type || p.type === state.type) && AUD[g].includes(p.audience)).length]).filter(x => x[4]);
      const types = {}; for (const p of base) types[p.type] = (types[p.type] || 0) + 1;
      const tlist = Object.entries(types).sort((a, b) => b[1] - a[1]);
      filters.innerHTML =
        (pills.length > 1 ? `<ul class="audience-pills" role="list" aria-label="Per chi">${pills.map(([g, l, ic, s, n]) => `<li><button type="button" class="audience-pill audience-pill--${s}" data-s-aud="${g}" aria-pressed="${state.aud === g}"><span class="audience-pill__icon" aria-hidden="true">${icon(ic)}</span>${l} <span class="chip__count">${n}</span></button></li>`).join('')}</ul>` : '') +
        (tlist.length > 1 ? `<ul class="type-chips chips search-page__types" role="list" aria-label="Tipo di capo" data-s-types>${tlist.map(([t, n], i) => `<li${i >= 8 && state.type !== t ? ' data-s-extra hidden' : ''}><button type="button" class="chip${state.type === t ? ' is-active' : ''}" data-s-type="${SKS_FMT.esc(t)}" aria-pressed="${state.type === t}">${SKS_FMT.esc(t)} <span class="chip__count">${n} ${n === 1 ? 'prodotto' : 'prodotti'}</span></button></li>`).join('')}${tlist.length > 8 ? '<li><button type="button" class="chip chip--ghost" data-s-more aria-expanded="false">Mostra altri</button></li>' : ''}</ul>` : '') +
        (state.aud || state.type ? '<p><button type="button" class="link-small" data-s-reset>Azzera filtri</button></p>' : '');
    };
    const apply = () => {
      state.list = filtered(); state.looks = rankLooks(state.list); state.shown = 0;
      grid.innerHTML = ''; page(); renderFilters();
      $('[data-tab-count="products"]').textContent = state.list.length;
      announce(`${state.list.length} prodotti`);
    };
    filters.addEventListener('click', e => {
      const a = e.target.closest('[data-s-aud]'), t = e.target.closest('[data-s-type]'), m = e.target.closest('[data-s-more]');
      if (a) { state.aud = state.aud === a.dataset.sAud ? '' : a.dataset.sAud; apply(); }
      else if (t) { state.type = state.type === t.dataset.sType ? '' : t.dataset.sType; apply(); }
      else if (e.target.closest('[data-s-reset]')) { state.aud = ''; state.type = ''; apply(); }
      else if (m) { const open = m.getAttribute('aria-expanded') !== 'true'; $$('[data-s-extra]', filters).forEach(li => { li.hidden = !open; }); m.setAttribute('aria-expanded', String(open)); m.textContent = open ? 'Mostra meno' : 'Mostra altri'; }
    });
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { if (es.some(x => x.isIntersecting) && state.shown < state.list.length) page(); }, { rootMargin: '0px 0px 1200px 0px' }) : null;
    if (io) io.observe(sentinel);
    $('button', more).addEventListener('click', page);
    apply();
  });
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

/* ---------- look page: each piece its size (chips) and its own button, "Aggiungi" or, on a sold-out size,
   "Avvisami" (as outfit-product-card.liquid); "Aggiungi tutto" says how many it adds; added rows are marked ---------- */
(() => {
  const form = $('[data-look-form]');
  if (!form) return;
  const btn = $('[data-add-look]', form);
  const rows = () => $$('[data-piece]', form).filter(li => !li.classList.contains('is-unavailable'));
  // only an available size counts: a sold-out pick is for "Avvisami"
  const chosen = li => (li.querySelector('input[type="radio"]:checked:not([data-sold])') || {}).value;
  const pending = () => rows().filter(li => chosen(li) && li.dataset.added !== chosen(li));
  const bell = '<svg class="icon" aria-hidden="true"><use href="#i-bell"/></svg>';
  // the piece's own button follows its size: sold out asks to be told, otherwise it adds
  function syncPiece(li) {
    const b = $('[data-piece-add]', li), input = li.querySelector('input[type="radio"]:checked');
    if (!b || b.getAttribute('aria-busy') === 'true') return;
    const notify = input ? 'sold' in input.dataset : li.classList.contains('is-soldout');
    b.innerHTML = notify ? `${bell} Avvisami` : 'Aggiungi';
    b.classList.toggle('is-notify', notify);
  }
  function mark(li, size) {
    li.dataset.added = size; li.classList.add('is-added');
    const t = li.querySelector('.look-piece__title'); if (t) t.dataset.added = size;
  }
  // the button keeps the live label, "Aggiungi tutto"; what it adds is what has an available size chosen
  function sync() { if (btn) btn.disabled = false; }
  form.addEventListener('change', e => {
    const li = e.target.closest('[data-piece]');
    if (li) { syncPiece(li); const h = $('[data-piece-hint]', li); if (h) h.hidden = true; li.classList.remove('is-missing'); }
    sync();
  });
  // one piece: its size, or the hint; a sold-out size opens the back-in-stock request
  form.addEventListener('click', async e => {
    const b = e.target.closest('[data-piece-add]');
    if (!b) return;
    const li = b.closest('[data-piece]'), input = li.querySelector('input[type="radio"]:checked');
    if (!input) {
      li.classList.add('is-missing'); $('[data-piece-hint]', li).hidden = false;
      (li.querySelector('input[type="radio"]:not([data-sold])') || li.querySelector('input[type="radio"]'))?.focus();
      return;
    }
    if ('sold' in input.dataset) { popups().then(m => m.open('notify', b, input.value)); return; }
    const info = infoFromCard(li.dataset.piece), size = input.value;
    if (!info) return;
    // the same piece in another size: that line is replaced, never doubled
    if (li.dataset.added && li.dataset.added !== size) Cart.remove(info.handle + '|' + li.dataset.added);
    await addWithFeedback(b, info, size, false);
    mark(li, size);
    sync();
    setTimeout(() => syncPiece(li), 1900); // after the shared "Aggiunto" feedback restores its label
  });
  // the size advisor added the size it advised
  form.addEventListener('size-help:added', e => { const li = e.target.closest('[data-piece]'); if (li) { mark(li, e.detail.size); sync(); } });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const add = pending();
    if (!add.length) {
      const missing = rows().filter(li => !chosen(li) && !li.dataset.added);
      missing.forEach(li => { li.classList.add('is-missing'); $('[data-piece-hint]', li).hidden = false; });
      missing[0]?.querySelector('input[type="radio"]:not([data-sold])')?.focus();
      return;
    }
    const items = add.map(li => [infoFromCard(li.dataset.piece), chosen(li), li]).filter(x => x[0]);
    // a piece already in the bag in another size: that line is replaced, never doubled
    items.filter(([info, , li]) => li.dataset.added && Cart.remove(info.handle + '|' + li.dataset.added));
    const [first, ...rest] = items;
    for (const [info, size] of rest) Cart.add(info, size);
    await addWithFeedback(btn, first[0], first[1]);
    for (const [, size, li] of items) mark(li, size);
    rows().filter(li => !chosen(li) && !li.dataset.added).forEach(li => { li.classList.add('is-missing'); $('[data-piece-hint]', li).hidden = false; });
  });
  sync();
})();

/* ---------- design proposals (prototype only): "Altri look" as the current rail or as polaroids; the pick is
   remembered in this browser and travels in the link (?stile=polaroid) ---------- */
(() => {
  const box = $('[data-looks-style]'), sw = $('[data-proto-switch]');
  if (!box || !sw) return;
  const set = (style, save) => {
    box.classList.toggle('is-polaroid', style === 'polaroid');
    $$('[data-style]', sw).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.style === style)));
    if (!save) return;
    store.set('sks-proto-looks-style', style);
    const u = new URL(location.href);
    style ? u.searchParams.set('stile', style) : u.searchParams.delete('stile');
    history.replaceState(history.state, '', u);
  };
  const fromUrl = new URLSearchParams(location.search).get('stile');
  set(fromUrl ?? store.get('sks-proto-looks-style', ''), false);
  sw.addEventListener('click', e => { const b = e.target.closest('[data-style]'); if (b) set(b.dataset.style, true); });
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
        // the live simulator's prompt
        if (cur.s.length === 1) { unit = seasonMin; label += ' · Stagionale'; }
        note = 'Conviene la stagionale';
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
    list.innerHTML = !lines.length ? '<li class="rq-empty meta">Nessun articolo aggiunto. Componi il noleggio qui accanto e premi “Aggiungi al preventivo”.</li>' : lines.map((l, i) => `<li class="rq-line"><span><strong>${SKS_FMT.esc(l.title)}</strong><br><span class="meta">${SKS_FMT.esc(l.sub)}</span></span><span class="tabular">${SKS_FMT.money(l.total)}</span><button type="button" class="icon-button" data-rq-remove="${i}" aria-label="Togli ${SKS_FMT.esc(l.title)} dal preventivo"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button></li>`).join('');
    const total = lines.length ? lines.reduce((t, l) => t + l.total, 0) : c.total;
    $('[data-rq-total]', el).textContent = SKS_FMT.money(total);
    const d = el.querySelector('[data-rq-date]')?.value, p = $('[data-rq-pickup]', el);
    p.hidden = !d; p.textContent = d ? `Data di ritiro: ${fmtDate(d)}` : '';
  }
  // the same item for the same duration is one line: adding it again updates it (journey: skis counted twice)
  function addLine() {
    const c = current(); if (!c) return;
    const i = lines.findIndex(l => l.key === c.key);
    if (i >= 0) { lines[i] = c; compute(); toast(`${c.title} è già nel preventivo: riga aggiornata.`); return; }
    lines.push(c); compute(); announce(`${c.title} aggiunto al preventivo`);
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

/* ---------- territory articles: the departure map loads Google Maps only when the reader asks. The theme's
   Liquid turns the agent's iframe src into data-src; this puts a button in the agent's frame's place ---------- */
$$('iframe[data-sks-map]').forEach(map => {
  const frame = map.parentElement;
  const facade = document.createElement('div');
  facade.className = 'map-facade';
  facade.innerHTML = `<p class="map-facade__place"><svg class="icon" aria-hidden="true"><use href="#i-pin"/></svg><span>${SKS_FMT.esc((map.title || '').replace(/^[^:]*:\s*/, ''))}</span></p>
    <p class="map-facade__note">La mappa è di Google: si carica solo se la apri.</p>
    <button type="button" class="button button--secondary">Mostra la mappa</button>`;
  frame.hidden = true;
  frame.before(facade);
  $('button', facade).addEventListener('click', () => {
    map.src = map.dataset.src;
    frame.hidden = false;
    facade.remove();
    map.focus();
  });
});

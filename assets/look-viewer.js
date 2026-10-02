// look-viewer.js: built 2026-10-02. Motion uses the theme's own vendor.min.js (Motion One).
import { SKS_FMT, SKS_CARD, $, $$, ROOT, BASE, MOTION_OK, FINE_POINTER, urlWritable, memory, store, announce, toast, CARDS, registerCards, productUrl, yieldToMain, deliveryWindow, trackingOK, openers, openDialog, closeDialog, popups, lookViewer, FREE_SHIPPING, MOCK_LATENCY, Cart, infoFromCard, renderCart, addWithFeedback, whenShown, trackEvent, Wish, renderWishState, Recent, initRail, ForYou } from './luxe.js';
import { animate, inView, scroll, stagger, timeline, PhotoSwipeLightbox } from 'vendor';
/* ---------- look viewer (assets/native-imm.js of the update): a look card opens the look over the page, the
   look page stays for the menu, the hero and the lookbook. Kept from live: the deck is the cards next to the
   one clicked, each piece with its sizes, add all. Changed: a real dialog (focus moves in and comes back, Esc,
   Back closes it), sizes as chips (a sold-out one opens the back-in-stock popup), the add stays in the viewer
   instead of opening the drawer. Each piece as on the look page: its sizes, "Guida taglie", "Non sei sicuro
   della tua taglia?" with the three-sizes banner, "Aggiungi al carrello", "Vedi prodotto", the heart; the size
   dialogs (size-help.js) open over the viewer. Data: one file on the first open (live: one
   /products/<handle>.js per piece).
   Two layouts, chosen when a look opens:
   - from 760px, a panel: the photo beside the pieces, arrows, keys and a swipe on the photo move through the deck;
   - phones, the reel (live's vertical, full-screen idea, owner 02/10): one look per screen, a vertical swipe
     moves one look (native scroll-snap), the pieces in a strip over the photo and, on a tap, in a sheet from
     the bottom with the sizes; Back closes the sheet first. ---------- */
let looks = null, loading = null, deck = [], at = 0, pushed = false, landed = false, dialog = null, mode = '';
let sheetPushed = false, skipPop = false, after = null, io = null, panelFor = null, seenLooks = new Set();
  const PHONE = matchMedia('(max-width: 759px)');
  const icon = n => `<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const still = () => ROOT.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const load = () => loading || (loading = new Promise((res, rej) => {
    if (window.SKS_LOOKS) return res(window.SKS_LOOKS);
    const s = document.createElement('script');
    s.src = `${BASE}assets/data/looks.js`;
    s.onload = () => res(window.SKS_LOOKS); s.onerror = rej;
    document.head.append(s);
  }));
  // the pieces of the current look and the buttons under them: the panel's right column, the reel's sheet
  const piecesMarkup = closeButton => `<header class="look-viewer__head">
          <p class="meta look-viewer__count" data-lv-count></p>
          <h2 class="d4" id="lv-title" data-lv-title></h2>
          ${closeButton}
        </header>
        <ul class="look-viewer__pieces" role="list" data-lv-pieces></ul>
        <footer class="look-viewer__foot">
          <button type="button" class="button button--primary button--block" data-lv-add></button>
          <p class="look-viewer__status" role="status" data-lv-status></p>
          <p class="look-viewer__links"><a class="link-arrow" data-lv-page href="#"><span>Vedi più dettagli</span> ${icon('arrow-right')}</a></p>
        </footer>`;
  function build(m) {
    if (dialog && mode === m) return;
    if (dialog) { io?.disconnect(); dialog.remove(); }
    mode = m; panelFor = null;
    dialog = document.createElement('dialog');
    dialog.id = 'look-viewer';
    if (m === 'reel') {
      dialog.className = 'look-reel';
      dialog.setAttribute('aria-label', 'Look');
      dialog.innerHTML = `<div class="look-reel__track" data-reel-track></div>
      <div class="look-reel__top" data-reel-top>
        <p class="look-reel__count" data-reel-count aria-hidden="true"></p>
        <a class="look-reel__logo" href="${BASE}index.html" aria-label="Fabbrica Ski Sises, home"><img src="https://skisises.com/cdn/shop/files/download.svg" alt="" width="117" height="24"></a>
        <button type="button" class="icon-button look-reel__close" data-close-dialog aria-label="Chiudi il look" autofocus>${icon('close')}</button>
      </div>
      <ol class="look-reel__progress" data-reel-progress aria-hidden="true"></ol>
      <div class="look-reel__scrim" data-reel-scrim hidden></div>
      <section class="look-reel__sheet" data-reel-sheet aria-labelledby="lv-title" inert>
        <div class="look-reel__grab" data-reel-grab aria-hidden="true"></div>
        ${piecesMarkup(`<button type="button" class="icon-button look-reel__sheet-close" data-reel-sheet-close aria-label="Chiudi">${icon('close')}</button>`)}
      </section>`;
    } else {
      dialog.className = 'look-viewer';
      dialog.setAttribute('aria-labelledby', 'lv-title');
      dialog.innerHTML = `<div class="look-viewer__inner">
      <figure class="look-viewer__media" data-lv-media><img alt="" data-lv-img>
        <button type="button" class="icon-button look-viewer__nav look-viewer__nav--prev" data-lv-step="-1" aria-label="Look precedente">${icon('chevron-left')}</button>
        <button type="button" class="icon-button look-viewer__nav look-viewer__nav--next" data-lv-step="1" aria-label="Look successivo">${icon('chevron-right')}</button>
      </figure>
      <div class="look-viewer__panel">
        ${piecesMarkup(`<button type="button" class="icon-button look-viewer__close" data-close-dialog aria-label="Chiudi il look" autofocus>${icon('close')}</button>`)}
      </div>
    </div>`;
    }
    document.body.append(dialog);
    dialog.addEventListener('click', onClick);
    dialog.addEventListener('change', e => { if (e.target.matches('[data-lv-size]')) { const li = e.target.closest('[data-lv-piece]'); li.classList.remove('is-missing'); nudge(li, e.target.value); sync(); } });
    // the size advisor added the size it advised
    dialog.addEventListener('size-help:added', e => { e.target.closest('[data-lv-piece]')?.classList.add('is-added'); sync(); });
    dialog.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea')) return;
      const back = mode === 'reel' ? ['ArrowUp', 'PageUp'] : ['ArrowLeft'], fwd = mode === 'reel' ? ['ArrowDown', 'PageDown'] : ['ArrowRight'];
      if (mode === 'reel' && dialog.classList.contains('is-sheet')) return;
      if (back.includes(e.key) && !e.target.matches('[type=radio]')) { e.preventDefault(); step(-1); }
      if (fwd.includes(e.key) && !e.target.matches('[type=radio]')) { e.preventDefault(); step(1); }
    });
    // Esc (and Android's back gesture, which reaches an open dialog as "cancel") closes the sheet first
    dialog.addEventListener('cancel', e => { if (mode === 'reel' && dialog.classList.contains('is-sheet')) { e.preventDefault(); closeSheet(); } });
    dialog.addEventListener('close', () => {
      $$('dialog[data-size-help-dialog][open]').forEach(closeDialog);
      if (mode === 'reel') setSheet(false, null, true);
      // the history entries the viewer added go with it; a #look-<id> link the shopper arrived on loses its hash
      const steps = (sheetPushed ? 1 : 0) + (pushed ? 1 : 0);
      sheetPushed = false; pushed = false;
      const strip = () => { if (landed) { landed = false; if (urlWritable()) history.replaceState(null, '', location.pathname + location.search); } };
      if (steps) { after = strip; history.go(-steps); } else strip();
    });
    if (m === 'reel') wireReel();
    else {
      // a horizontal swipe on the photo moves through the deck
      const media = $('[data-lv-media]', dialog);
      let x0 = null;
      media.addEventListener('pointerdown', e => { x0 = e.clientX; });
      media.addEventListener('pointerup', e => { if (x0 !== null && Math.abs(e.clientX - x0) > 50) step(e.clientX < x0 ? 1 : -1); x0 = null; });
    }
  }
  const ONE = /^(t\.?u\.?|tu|unica|os)$/i, esc = s => SKS_FMT.esc(s);
  const priceHtml = p => p.compareAt > p.price
    ? `<span class="price price--sale">${SKS_FMT.money(p.price)}</span> <s class="price price--compare">${SKS_FMT.money(p.compareAt)}</s>`
    : `<span class="price">${SKS_FMT.money(p.price)}</span>`;
  // each piece as the look page draws it (owner, 02/10): its sizes, a sold-out one opens the back-in-stock popup,
  // the size guide and advisor (size-help.js) with the three-sizes banner, "Aggiungi al carrello", "Vedi prodotto"
  const pieceRow = (p, i) => {
    const url = `${BASE}products/${encodeURIComponent(p.handle)}.html`;
    const gone = !p.sizes.length, avail = p.sizes.some(s => s[1]);
    const lab = (l, one) => one && ONE.test(l) ? 'Taglia unica' : esc(l);
    const chip = ([l, a], one) => a
      ? `<label class="size-chip${one ? ' is-single' : ''}"><input type="radio" name="lv-size-${i}" value="${esc(l)}" data-lv-size${one ? ' checked' : ''}><span>${lab(l, one)}</span></label>`
      : `<button type="button" class="size-chip is-sold" data-notify-size="${esc(l)}" aria-label="Taglia ${esc(l)} esaurita: avvisami quando torna"><span>${lab(l, one)}</span>${icon('bell')}</button>`;
    const sizes = p.sizes.length === 1 ? `<div class="look-viewer__sizes">${chip(p.sizes[0], true)}</div>`
      : `<fieldset class="look-viewer__sizes"><legend class="visually-hidden">Taglia di ${esc(p.title)}</legend>${p.sizes.map(s => chip(s, false)).join('')}</fieldset>`;
    const view = label => `<a class="link-arrow look-viewer__view" href="${url}"><span>${label}</span> ${icon('arrow-right')}</a>`;
    return `<li class="look-viewer__piece${avail ? '' : gone ? ' is-gone' : ' is-soldout'}" data-lv-piece="${i}"${gone ? '' : ` data-size-fit="${esc(JSON.stringify(p))}"`}>
      <a class="look-viewer__thumb" href="${url}" tabindex="-1" aria-hidden="true"><img src="${SKS_FMT.cdn(p.image, 160, 200)}" alt="" width="80" height="100" loading="lazy"></a>
      <div class="look-viewer__info">
        <p class="look-viewer__brand" translate="no">${esc(p.brand)}</p>
        <p class="look-viewer__name"><a href="${url}">${esc(p.title)}</a></p>
        <p class="look-viewer__price">${priceHtml(p)}</p>
      </div>
      ${gone ? '' : `<button type="button" class="icon-button look-viewer__wish" data-wish="${esc(p.handle)}" aria-pressed="false" aria-label="Salva ${esc(p.title)} nei preferiti">${icon('heart')}</button>`}
      <div class="look-viewer__buy">
        ${gone ? `<p class="look-viewer__sold">Esaurito</p><div class="look-viewer__actions">${view('Vedi prodotto')}</div>` : `${sizes}
        <p class="look-viewer__hint" data-lv-hint>Seleziona taglia</p>
        ${p.sizes.length > 1 ? `<p class="look-viewer__help"><button type="button" class="link-small" data-size-help="guide">${icon('ruler')} Guida taglie</button><button type="button" class="link-small product__size-help" data-size-help="advisor">${icon('hanger')}<span>Non sei sicuro della tua taglia?</span></button></p>
        <div class="size-nudge look-viewer__nudge" data-piece-nudge hidden>${icon('hanger')}<p><strong>Non sei sicuro della tua taglia?</strong></p><button type="button" class="button button--secondary size-nudge__cta" data-size-help="advisor">Guida alle taglie</button><button type="button" class="icon-button size-nudge__close" data-nudge-close aria-label="Chiudi il suggerimento">${icon('close')}</button></div>` : ''}
        <div class="look-viewer__actions">
          <button type="button" class="button button--primary button--small look-viewer__add" data-piece-add${avail ? '' : ' disabled'}>${avail ? 'Aggiungi al carrello' : 'Esaurito'}</button>
          ${view('Vedi prodotto')}
        </div>`}
      </div>
    </li>`;
  };
  // the size-help banner (assets/size-help-nudge.js): after three different sizes of a piece, once per product per
  // session, as on the product page
  const seen = new WeakMap();
  function nudge(li, size) {
    const n = $('[data-piece-nudge]', li); if (!n) return;
    const p = current().pieces[+li.dataset.lvPiece], KEY = 'sks-size-help:2:/products/' + p.handle;
    let done = false; try { done = sessionStorage.getItem(KEY) === '1'; } catch { /* storage blocked */ }
    if (done) return;
    const set = seen.get(li) || new Set(); set.add(size); seen.set(li, set);
    if (set.size < 3) return;
    try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    n.hidden = false; const help = $('.look-viewer__help', li); if (help) help.hidden = true;
    announce('Non sei sicuro della tua taglia?');
  }

  const chosen = () => $$('[data-lv-piece]', dialog).map(li => {
    const p = current().pieces[+li.dataset.lvPiece], input = li.querySelector('[data-lv-size]:checked');
    return { p, li, size: input ? input.value : null, buyable: p.sizes.some(s => s[1]) };
  });
  const current = () => looks[deck[at].id];
  // the live viewer's button, "Aggiungi tutto al carrello" (no sums: owner, 02/10)
  function sync() {
    const btn = $('[data-lv-add]', dialog);
    btn.hidden = !chosen().some(r => r.buyable);
    btn.textContent = 'Aggiungi tutto al carrello';
  }
  // the pieces of the current look (both layouts)
  function renderPieces() {
    const l = current();
    $('[data-lv-title]', dialog).textContent = l.display;
    $('[data-lv-count]', dialog).textContent = deck.length > 1 ? `${at + 1} / ${deck.length}` : '';
    $('[data-lv-pieces]', dialog).innerHTML = l.pieces.map(pieceRow).join('');
    $('[data-lv-page]', dialog).href = deck[at].href;
    $('[data-lv-status]', dialog).textContent = '';
    panelFor = deck[at].id;
    renderWishState(); sync();
  }
  function render() {
    const l = current();
    const img = $('[data-lv-img]', dialog);
    img.src = SKS_FMT.cdn(l.photo, 900, 1125, 'top');
    img.srcset = SKS_FMT.srcset(l.photo, [480, 720, 900], 1.25, 941, 'top');
    img.sizes = '(min-width: 760px) 46vw, 100vw';
    img.alt = l.caption || l.display;
    $$('[data-lv-step]', dialog).forEach(b => { b.hidden = deck.length < 2; });
    renderPieces();
  }
  function step(d) {
    if (deck.length < 2) return;
    if (mode === 'reel') {
      // from the last screen (the lookbook) one step up is the last look
      const track = $('[data-reel-track]', dialog), from = dialog.classList.contains('is-end') ? deck.length : at;
      const to = Math.min(deck.length, Math.max(0, from + d));
      track.scrollTo({ top: to * track.clientHeight, behavior: still() ? 'auto' : 'smooth' });
      return;
    }
    at = (at + d + deck.length) % deck.length;
    render();
    if ((pushed || landed) && urlWritable()) history.replaceState({ lookViewer: deck[at].id }, '', `#look-${deck[at].id}`);
    announce(`${current().display}, look ${at + 1} di ${deck.length}`);
    viewed(at);
  }

  /* ---------- the reel (phones) ---------- */
  // a look: the photo fills the screen above the panel and ends where the panel starts, so the shoes are never
  // under it (live sets the photo's bottom on its tray); the panel: the look's name with "Condividi" and
  // "Salva il look", its pieces as a strip of packshots with their prices (a tap opens that piece in the sheet),
  // "Scopri N prodotti" (live's pill). A double tap on the photo saves the look, as live
  function slide(d, i) {
    const l = looks[d.id], near = Math.abs(i - at) <= 1, n = l.pieces.length;
    const src = SKS_FMT.cdn(l.photo, 720), set = SKS_FMT.srcset(l.photo, [480, 720, 941], 0, 941);
    const pic = `<img class="look-reel__photo" ${near ? 'src' : 'data-src'}="${src}" ${near ? 'srcset' : 'data-srcset'}="${set}" sizes="100vw" alt="${esc(l.caption || l.display)}" decoding="async"${i === at ? ' fetchpriority="high"' : ''}>`;
    const thumbs = l.pieces.map((p, k) => {
      const out = !p.sizes.some(s => s[1]);
      return `<li><button type="button" class="look-reel__piece${out ? ' is-out' : ''}" data-reel-piece="${k}" aria-label="${esc(p.brand)} ${esc(p.title)}, ${out ? 'Esaurito' : SKS_FMT.money(p.price)}">
        <span class="look-reel__piece-img"><img ${near ? 'src' : 'data-src'}="${SKS_FMT.cdn(p.image, 128, 160)}" alt="" width="64" height="80"></span>
        <span class="look-reel__piece-price">${out ? 'Esaurito' : SKS_FMT.money(p.price)}</span></button></li>`;
    }).join('');
    return `<section class="look-reel__slide" data-reel-slide="${i}" aria-roledescription="slide" aria-label="${i + 1} / ${deck.length}">
      <div class="look-reel__media" data-reel-media>${pic}<span class="look-reel__burst" aria-hidden="true">${icon('heart')}</span></div>
      <div class="look-reel__info">
        <div class="look-reel__head">
          <h2 class="look-reel__title">${esc(l.display)}</h2>
          <button type="button" class="icon-button look-reel__icon" data-reel-share aria-label="Condividi">${icon('share')}</button>
          <button type="button" class="icon-button look-reel__icon" data-reel-save aria-pressed="false" aria-label="Salva il look">${icon('heart')}</button>
        </div>
        <ul class="look-reel__strip" role="list" aria-label="${n} ${n === 1 ? 'prodotto' : 'prodotti'} nel look">${thumbs}</ul>
        <button type="button" class="button button--primary look-reel__shop" data-reel-shop>Scopri ${n} ${n === 1 ? 'prodotto' : 'prodotti'}</button>
      </div>
    </section>`;
  }
  // after the last look, the lookbook (the home's own link)
  const endSlide = () => `<section class="look-reel__slide look-reel__end" data-reel-end>
      <h2 class="d3">LookBook</h2>
      <a class="button button--on-dark" href="${BASE}pages/lookbook.html">Esplora i look</a>
    </section>`;
  function renderReel() {
    const track = $('[data-reel-track]', dialog);
    track.innerHTML = deck.map(slide).join('') + endSlide();
    $('[data-reel-progress]', dialog).innerHTML = deck.length > 1 ? deck.map(() => '<li></li>').join('') : '';
    io?.disconnect();
    io = new IntersectionObserver(list => {
      for (const e of list) if (e.isIntersecting) {
        if ('reelEnd' in e.target.dataset) dialog.classList.add('is-end');
        else { dialog.classList.remove('is-end'); setCurrent(+e.target.dataset.reelSlide); }
      }
    }, { root: track, threshold: 0.6 });
    $$('.look-reel__slide', track).forEach(s => io.observe(s));
  }
  // the look in view: its photo settles, the next ones load, the count, the dashes and the #look-<id> follow
  function setCurrent(i, opening = false) {
    if (i === at && !opening) return;
    at = i;
    $$('[data-reel-slide]', dialog).forEach((s, k) => s.classList.toggle('is-current', k === i));
    for (const k of [i - 1, i, i + 1, i + 2]) $$(`[data-reel-slide="${k}"] img[data-src]`, dialog).forEach(img => {
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.src = img.dataset.src; img.removeAttribute('data-src'); img.removeAttribute('data-srcset');
    });
    $('[data-reel-count]', dialog).textContent = deck.length > 1 ? `${i + 1} / ${deck.length}` : '';
    $$('[data-reel-progress] li', dialog).forEach((li, k) => li.classList.toggle('is-current', k === i));
    viewed(i);
    if (opening) return;
    if ((pushed || landed) && urlWritable()) history.replaceState({ lookViewer: deck[i].id }, '', `#look-${deck[i].id}`);
    announce(`${current().display}, look ${i + 1} di ${deck.length}`);
  }
  // the sheet with the pieces: over the photo, which stays in sight above it; Back, Esc, the x, a tap above it or
  // a pull down close it
  function setSheet(open, piece, quiet = false) {
    const sheet = $('[data-reel-sheet]', dialog);
    if (open) {
      if (panelFor !== deck[at].id) renderPieces();
      dialog.classList.add('is-sheet');
      sheet.inert = false; $('[data-reel-scrim]', dialog).hidden = false;
      $('[data-reel-track]', dialog).inert = true; $('[data-reel-top]', dialog).inert = true;
      const li = piece == null ? null : $(`[data-lv-piece="${piece}"]`, sheet);
      $('[data-lv-pieces]', sheet).scrollTop = li ? li.offsetTop - $('[data-lv-pieces]', sheet).offsetTop : 0;
      (li?.querySelector('input, button') || $('[data-reel-sheet-close]', sheet)).focus({ preventScroll: true });
      return;
    }
    if (!dialog.classList.contains('is-sheet')) return;
    dialog.classList.remove('is-sheet');
    sheet.inert = true; $('[data-reel-scrim]', dialog).hidden = true;
    $('[data-reel-track]', dialog).inert = false; $('[data-reel-top]', dialog).inert = false;
    if (!quiet) $(`[data-reel-slide="${at}"] [data-reel-shop]`, dialog)?.focus({ preventScroll: true });
  }
  function openSheet(piece) {
    setSheet(true, piece);
    trackEvent('dataLayer:look_tray_open', { source: 'look_immersive', device: 'mobile', look_id: deck[at].id, index: at, piece_index: piece ?? null, item_id: piece == null ? null : current().pieces[piece].handle });
    // a history entry, so Back closes the sheet before the reel
    if (!sheetPushed && (pushed || landed) && urlWritable()) { history.pushState({ lookViewer: deck[at].id, lookSheet: 1 }, ''); sheetPushed = true; }
  }
  function closeSheet() {
    setSheet(false);
    if (sheetPushed) { sheetPushed = false; skipPop = true; history.back(); }
  }
  function wireReel() {
    const sheet = $('[data-reel-sheet]', dialog), track = $('[data-reel-track]', dialog);
    let tap = { t: 0, x: 0, y: 0 };
    track.addEventListener('pointerup', e => {
      const media = e.target.closest('[data-reel-media]');
      if (!media) return;
      if (e.timeStamp - tap.t < 320 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 30) {
        tap.t = 0; burst(media);
        const save = media.closest('[data-reel-slide]').querySelector('[data-reel-save]');
        if (save.getAttribute('aria-pressed') !== 'true') saveLook(save);
      } else tap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    });
    $('[data-reel-scrim]', dialog).addEventListener('click', closeSheet);
    // pull the sheet down by its handle or its title
    let y0 = null, dy = 0;
    const down = e => { if (e.target.closest('button, a') || !dialog.classList.contains('is-sheet')) return; y0 = e.clientY; dy = 0; sheet.classList.add('is-dragging'); e.currentTarget.setPointerCapture(e.pointerId); };
    const move = e => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); sheet.style.translate = `0 ${dy}px`; };
    const up = () => { if (y0 === null) return; y0 = null; sheet.classList.remove('is-dragging'); sheet.style.translate = ''; if (dy > 80) closeSheet(); };
    for (const el of [$('[data-reel-grab]', sheet), $('.look-viewer__head', sheet)]) {
      el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    }
  }
  // the first look of a session shows that the next one is under it: both rise a little and settle back
  function peek() {
    if (deck.length < 2 || at >= deck.length - 1 || still()) return;
    try { if (sessionStorage.getItem('sks-reel-peek')) return; sessionStorage.setItem('sks-reel-peek', '1'); } catch { return; }
    const move = [{ transform: 'none' }, { transform: 'translateY(-14%)', offset: 0.45 }, { transform: 'none' }];
    for (const k of [at, at + 1]) $(`[data-reel-slide="${k}"]`, dialog)?.animate(move, { duration: 1200, delay: 700, easing: 'cubic-bezier(.32,.72,0,1)' });
  }

  // "Condividi" (live): the look page's address, through the phone's share sheet or copied ("Link copiato")
  async function share() {
    const url = new URL(deck[at].href, location.href).href;
    if (navigator.share) { try { await navigator.share({ title: current().display, url }); return; } catch (err) { if (err.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); toast('Link copiato'); } catch { toast(url); }
  }
  // "Salva il look" (live): the wishlist app's addItems for every piece (88-wishlist.js saveLook)
  function saveLook(btn) {
    const i = +(btn.closest('[data-reel-slide]')?.dataset.reelSlide ?? at);
    popups().then(m => m.saveLook(looks[deck[i].id].pieces, btn)).then(ok => { if (ok) btn.setAttribute('aria-pressed', 'true'); }).catch(() => {});
  }
  function burst(media) {
    media.classList.remove('is-burst'); void media.offsetWidth; media.classList.add('is-burst');
  }
  // tracked by the owner's decision (02/10; live measures no step inside the viewer): each look seen, once per
  // opening of the viewer (scrolling back to it does not count it again), and each opening of a look's pieces
  function viewed(i) {
    if (seenLooks.has(deck[i].id)) return;
    seenLooks.add(deck[i].id);
    trackEvent('dataLayer:look_carousel_view', { source: 'look_immersive', device: mode === 'reel' ? 'mobile' : 'desktop', look_id: deck[i].id, index: i, items: deck.length });
  }

  async function onClick(e) {
    if (e.target.closest('[data-lv-step]')) { step(+e.target.closest('[data-lv-step]').dataset.lvStep); return; }
    const piece = e.target.closest('[data-reel-piece]');
    if (piece) { openSheet(+piece.dataset.reelPiece); return; }
    if (e.target.closest('[data-reel-shop]')) { openSheet(); return; }
    if (e.target.closest('[data-reel-sheet-close]')) { closeSheet(); return; }
    if (e.target.closest('[data-reel-share]')) { share(); return; }
    const save = e.target.closest('[data-reel-save]');
    if (save) { saveLook(save); return; }
    const sold = e.target.closest('[data-notify-size]');
    if (sold) { popups().then(m => m.open('notify', sold, sold.dataset.notifySize)); return; }
    const nclose = e.target.closest('[data-nudge-close], .size-nudge__cta');
    if (nclose) { const li = nclose.closest('[data-lv-piece]'); $('[data-piece-nudge]', li).hidden = true; const help = $('.look-viewer__help', li); if (help) help.hidden = false; if (!nclose.matches('.size-nudge__cta')) return; }
    const one = e.target.closest('[data-piece-add]');
    if (one) {
      const li = one.closest('[data-lv-piece]'), p = current().pieces[+li.dataset.lvPiece], input = li.querySelector('[data-lv-size]:checked');
      if (!input) { li.classList.add('is-missing'); (li.querySelector('[data-lv-size]:not([data-sold])') || li.querySelector('[data-lv-size]'))?.focus(); return; }
      trackEvent('dataLayer:add_to_cart', { source: 'look_immersive', item_id: p.handle, variant_id: input.value, item_name: p.title });
      await addWithFeedback(one, { handle: p.handle, title: p.title, brand: p.brand, price: p.price, compareAt: p.compareAt, image: p.image }, input.value, false);
      li.classList.add('is-added');
      $('[data-lv-status]', dialog).textContent = 'Aggiunto ✓';
      return;
    }
    const add = e.target.closest('[data-lv-add]');
    if (!add) return;
    const rows = chosen(), ready = rows.filter(r => r.size);
    if (!ready.length) {
      rows.filter(r => r.buyable && !r.size).forEach(r => r.li.classList.add('is-missing'));
      rows.find(r => r.buyable && !r.size)?.li.querySelector('input:not(:disabled)')?.focus();
      return;
    }
    const info = r => ({ handle: r.p.handle, title: r.p.title, brand: r.p.brand, price: r.p.price, compareAt: r.p.compareAt, image: r.p.image });
    trackEvent('dataLayer:add_look_to_cart', { source: 'look_immersive', products: ready.length });
    const [first, ...rest] = ready;
    for (const r of rest) Cart.add(info(r), r.size);
    await addWithFeedback(add, info(first), first.size, false);
    $('[data-lv-status]', dialog).textContent = 'Aggiunto ✓';
  }
  export async function openLook(link, { landed: arrived = false } = {}) {
    const scope = link.closest('section, .collection-page, main') || document;
    const cards = $$('[data-look-viewer]', scope);
    deck = cards.map(a => ({ id: a.dataset.lookViewer, href: a.getAttribute('href') }));
    try { looks = await load(); } catch { location.href = link.href; return; }
    deck = deck.filter((d, i, all) => looks[d.id] && all.findIndex(x => x.id === d.id) === i);
    if (!deck.length) { location.href = link.href; return; }
    at = Math.max(0, deck.findIndex(d => d.id === link.dataset.lookViewer));
    build(PHONE.matches ? 'reel' : 'panel');
    seenLooks = new Set();
    if (mode === 'reel') { panelFor = null; renderReel(); } else render();
    openDialog('look-viewer', link);
    trackEvent('dataLayer:look_carousel_open', { source: 'look_immersive', device: mode === 'reel' ? 'mobile' : 'desktop', items: deck.length, start_index: at });
    // opened from a #look-<id> link: that entry is the look already; otherwise a new entry, so Back closes it
    if (arrived) landed = true;
    else if (!pushed && !landed && urlWritable()) { history.pushState({ lookViewer: deck[at].id }, '', `#look-${deck[at].id}`); pushed = true; }
    if (mode === 'reel') {
      const track = $('[data-reel-track]', dialog);
      track.scrollTop = at * track.clientHeight;
      setCurrent(at, true);
      peek();
    } else viewed(at);
  }
  // Back closes the sheet, then the viewer; the entries the viewer itself takes back are not a Back
  addEventListener('popstate', () => {
    if (after) { const f = after; after = null; f(); }
    if (skipPop) { skipPop = false; return; }
    if (!dialog?.open) return;
    if (sheetPushed) { sheetPushed = false; setSheet(false); return; }
    pushed = false; closeDialog(dialog);
  });

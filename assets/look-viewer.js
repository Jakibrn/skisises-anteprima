// look-viewer.js: built 2026-10-02. Motion uses the theme's own vendor.min.js (Motion One).
import { SKS_FMT, SKS_CARD, $, $$, ROOT, BASE, MOTION_OK, FINE_POINTER, urlWritable, memory, store, announce, toast, CARDS, registerCards, productUrl, yieldToMain, deliveryWindow, trackingOK, openers, openDialog, closeDialog, popups, lookViewer, FREE_SHIPPING, MOCK_LATENCY, Cart, infoFromCard, renderCart, addWithFeedback, trackEvent, Wish, renderWishState, Recent, initRail, ForYou } from './luxe.js';
import { animate, inView, scroll, stagger, timeline, PhotoSwipeLightbox } from 'vendor';
/* ---------- look viewer (assets/native-imm.js of the update): a look card opens the look over the page, the
   look page stays for the menu, the hero and the lookbook. Kept from live: the deck is the cards next to the
   one clicked, arrows and swipe move through it, each piece with its sizes, the look total and the saving, add
   all. Changed: a real dialog (focus moves in and comes back, Esc, Back closes it), sizes as chips with the
   sold-out ones marked (no extra confirmation popup), the add stays in the viewer instead of opening the
   drawer, 14-day returns in the trust line (live says 15). Each piece keeps live's own "+ Aggiungi" / "Avvisami",
   "Guida taglie" and "Vedi prodotto", and gets "Non sei sicuro della tua taglia?"; the size dialogs (size-help.js)
   open over the viewer. Data: one file on the first open (live: one /products/<handle>.js per piece). ---------- */
let looks = null, loading = null, deck = [], at = 0, pushed = false, landed = false, dialog = null;
  const icon = n => `<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const load = () => loading || (loading = new Promise((res, rej) => {
    if (window.SKS_LOOKS) return res(window.SKS_LOOKS);
    const s = document.createElement('script');
    s.src = `${BASE}assets/data/looks.js`;
    s.onload = () => res(window.SKS_LOOKS); s.onerror = rej;
    document.head.append(s);
  }));
  function build() {
    dialog = document.createElement('dialog');
    dialog.id = 'look-viewer'; dialog.className = 'look-viewer';
    dialog.setAttribute('aria-labelledby', 'lv-title');
    dialog.innerHTML = `<div class="look-viewer__inner">
      <figure class="look-viewer__media" data-lv-media><img alt="" data-lv-img>
        <button type="button" class="icon-button look-viewer__nav look-viewer__nav--prev" data-lv-step="-1" aria-label="Look precedente">${icon('chevron-left')}</button>
        <button type="button" class="icon-button look-viewer__nav look-viewer__nav--next" data-lv-step="1" aria-label="Look successivo">${icon('chevron-right')}</button>
      </figure>
      <div class="look-viewer__panel">
        <header class="look-viewer__head">
          <p class="meta look-viewer__count" data-lv-count></p>
          <h2 class="d4" id="lv-title" data-lv-title></h2>
          <button type="button" class="icon-button look-viewer__close" data-close-dialog aria-label="Chiudi il look" autofocus>${icon('close')}</button>
        </header>
        <ul class="look-viewer__pieces" role="list" data-lv-pieces></ul>
        <footer class="look-viewer__foot">
          <p class="look-viewer__total" data-lv-total></p>
          <button type="button" class="button button--primary button--block" data-lv-add></button>
          <p class="look-viewer__status" role="status" data-lv-status></p>
          <p class="look-viewer__links"><a class="link-arrow" data-lv-page href="#"><span>Vedi la pagina del look</span> ${icon('arrow-right')}</a></p>
          <p class="look-viewer__trust">Spedizione gratuita in Italia da 50,00&nbsp;€ · Reso entro 14 giorni</p>
        </footer>
      </div>
    </div>`;
    document.body.append(dialog);
    dialog.addEventListener('click', onClick);
    dialog.addEventListener('change', e => { if (e.target.matches('[data-lv-size]')) { const li = e.target.closest('[data-lv-piece]'); li.classList.remove('is-missing'); syncPiece(li); sync(); } });
    // the size advisor added the size it advised
    dialog.addEventListener('size-help:added', e => { e.target.closest('[data-lv-piece]')?.classList.add('is-added'); sync(); });
    dialog.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea')) return;
      if (e.key === 'ArrowLeft' && !e.target.matches('[type=radio]')) { e.preventDefault(); step(-1); }
      if (e.key === 'ArrowRight' && !e.target.matches('[type=radio]')) { e.preventDefault(); step(1); }
    });
    dialog.addEventListener('close', () => {
      $$('dialog[data-size-help-dialog][open]').forEach(closeDialog);
      if (pushed) { pushed = false; history.back(); }
      else if (landed) { landed = false; if (urlWritable()) history.replaceState(null, '', location.pathname + location.search); }
    });
    // a horizontal swipe on the photo moves through the deck
    const media = $('[data-lv-media]', dialog);
    let x0 = null;
    media.addEventListener('pointerdown', e => { x0 = e.clientX; });
    media.addEventListener('pointerup', e => { if (x0 !== null && Math.abs(e.clientX - x0) > 50) step(e.clientX < x0 ? 1 : -1); x0 = null; });
  }
  const ONE = /^(t\.?u\.?|tu|unica|os)$/i, esc = s => SKS_FMT.esc(s);
  // each piece as the look page draws it: every size can be picked (a sold-out one is for "Avvisami"), the size
  // guide and advisor (size-help.js), its own "Aggiungi" or "Avvisami", "Vedi prodotto"
  const pieceRow = (p, i) => {
    const url = `${BASE}products/${encodeURIComponent(p.handle)}.html`;
    const gone = !p.sizes.length, avail = p.sizes.some(s => s[1]);
    const price = p.compareAt > p.price
      ? `<span class="price price--sale">${SKS_FMT.money(p.price)}</span> <s class="price price--compare">${SKS_FMT.money(p.compareAt)}</s>`
      : `<span class="price">${SKS_FMT.money(p.price)}</span>`;
    const chip = ([l, a], one) => `<label class="size-chip${a ? '' : ' is-sold'}${one ? ' is-single' : ''}"><input type="radio" name="lv-size-${i}" value="${esc(l)}" data-lv-size${one ? ' checked' : ''}${a ? '' : ' data-sold'}><span>${one && ONE.test(l) ? 'Taglia unica' : esc(l)}</span>${a ? '' : '<span class="visually-hidden"> esaurita</span>'}</label>`;
    const sizes = p.sizes.length === 1 ? `<div class="look-viewer__sizes">${chip(p.sizes[0], true)}</div>`
      : `<fieldset class="look-viewer__sizes"><legend class="visually-hidden">Taglia di ${esc(p.title)}</legend>${p.sizes.map(s => chip(s, false)).join('')}</fieldset>`;
    const view = label => `<a class="link-arrow look-viewer__view" href="${url}"><span>${label}</span> ${icon('arrow-right')}</a>`;
    return `<li class="look-viewer__piece${avail ? '' : gone ? ' is-gone' : ' is-soldout'}" data-lv-piece="${i}"${gone ? '' : ` data-size-fit="${esc(JSON.stringify(p))}"`}>
      <a class="look-viewer__thumb" href="${url}" tabindex="-1" aria-hidden="true"><img src="${SKS_FMT.cdn(p.image, 160, 200)}" alt="" width="80" height="100" loading="lazy"></a>
      <div class="look-viewer__info">
        <p class="look-viewer__brand" translate="no">${esc(p.brand)}</p>
        <p class="look-viewer__name"><a href="${url}">${esc(p.title)}</a></p>
        <p class="look-viewer__price">${price}</p>
      </div>
      ${gone ? '' : `<button type="button" class="icon-button look-viewer__wish" data-wish="${esc(p.handle)}" aria-pressed="false" aria-label="Salva ${esc(p.title)} nei preferiti">${icon('heart')}</button>`}
      <div class="look-viewer__buy">
        ${gone ? `<p class="look-viewer__sold">Non più disponibile</p><div class="look-viewer__actions">${view('Vedi i simili')}</div>` : `${sizes}
        <p class="look-viewer__hint" data-lv-hint>${avail ? 'Scegli la taglia' : 'Scegli la taglia da farti avvisare'}</p>
        ${p.sizes.length > 1 ? `<p class="look-viewer__help"><button type="button" class="link-small" data-size-help="guide">${icon('ruler')} Guida taglie</button><button type="button" class="link-small product__size-help" data-size-help="advisor">${icon('hanger')}<span>Non sei sicuro della tua taglia?</span></button></p>` : ''}
        <div class="look-viewer__actions">
          <button type="button" class="button button--outline button--small look-viewer__add${avail ? '' : ' is-notify'}" data-piece-add data-added-label>${avail ? 'Aggiungi' : `${icon('bell')} Avvisami`}</button>
          ${view('Vedi prodotto')}
        </div>`}
      </div>
    </li>`;
  };
  // the piece's own button follows its size: sold out asks to be told, otherwise it adds
  function syncPiece(li) {
    const b = $('[data-piece-add]', li), input = li.querySelector('[data-lv-size]:checked');
    if (!b || b.getAttribute('aria-busy') === 'true') return;
    const notify = input ? 'sold' in input.dataset : li.classList.contains('is-soldout');
    b.innerHTML = notify ? `${icon('bell')} Avvisami` : 'Aggiungi';
    b.classList.toggle('is-notify', notify);
  }
  const chosen = () => $$('[data-lv-piece]', dialog).map(li => {
    const p = current().pieces[+li.dataset.lvPiece], input = li.querySelector('[data-lv-size]:checked:not([data-sold])');
    return { p, li, size: input ? input.value : null, buyable: p.sizes.some(s => s[1]) };
  });
  const current = () => looks[deck[at].id];
  function sync() {
    const rows = chosen(), ready = rows.filter(r => r.size), buyable = rows.filter(r => r.buyable);
    const sum = arr => arr.reduce((n, r) => n + r.p.price, 0);
    const save = buyable.reduce((n, r) => n + Math.max(0, r.p.compareAt - r.p.price), 0);
    $('[data-lv-total]', dialog).innerHTML = buyable.length ? `Totale look <strong>${SKS_FMT.money(sum(buyable))}</strong>${save ? ` <span class="look-viewer__save">risparmi ${SKS_FMT.money(save)}</span>` : ''}` : '';
    const btn = $('[data-lv-add]', dialog);
    btn.hidden = !buyable.length;
    btn.textContent = !ready.length ? 'Scegli le taglie per aggiungere'
      : ready.length === buyable.length ? `Aggiungi ${ready.length === 1 ? 'il capo' : `i ${ready.length} capi`} al carrello · ${SKS_FMT.money(sum(ready))}`
      : `Aggiungi ${ready.length === 1 ? 'il capo scelto' : `i ${ready.length} capi scelti`} · ${SKS_FMT.money(sum(ready))}`;
    btn.setAttribute('aria-disabled', String(!ready.length));
  }
  function render() {
    const l = current();
    const img = $('[data-lv-img]', dialog);
    img.src = SKS_FMT.cdn(l.photo, 900, 1125, 'top');
    img.srcset = SKS_FMT.srcset(l.photo, [480, 720, 900], 1.25, 941, 'top');
    img.sizes = '(min-width: 760px) 46vw, 100vw';
    img.alt = l.caption || l.display;
    $('[data-lv-title]', dialog).textContent = l.display;
    $('[data-lv-count]', dialog).textContent = deck.length > 1 ? `Look ${at + 1} di ${deck.length}` : 'Look';
    $('[data-lv-pieces]', dialog).innerHTML = l.pieces.map(pieceRow).join('');
    $('[data-lv-page]', dialog).href = deck[at].href;
    $('[data-lv-status]', dialog).textContent = '';
    $$('[data-lv-step]', dialog).forEach(b => { b.hidden = deck.length < 2; });
    renderWishState(); sync();
  }
  function step(d) {
    if (deck.length < 2) return;
    at = (at + d + deck.length) % deck.length;
    render();
    if ((pushed || landed) && urlWritable()) history.replaceState({ lookViewer: deck[at].id }, '', `#look-${deck[at].id}`);
    announce(`${current().display}, look ${at + 1} di ${deck.length}`);
  }
  async function onClick(e) {
    if (e.target.closest('[data-lv-step]')) { step(+e.target.closest('[data-lv-step]').dataset.lvStep); return; }
    const one = e.target.closest('[data-piece-add]');
    if (one) {
      const li = one.closest('[data-lv-piece]'), p = current().pieces[+li.dataset.lvPiece], input = li.querySelector('[data-lv-size]:checked');
      if (!input) { li.classList.add('is-missing'); (li.querySelector('[data-lv-size]:not([data-sold])') || li.querySelector('[data-lv-size]'))?.focus(); return; }
      if ('sold' in input.dataset) { popups().then(m => m.open('notify', one, input.value)); return; }
      await addWithFeedback(one, { handle: p.handle, title: p.title, brand: p.brand, price: p.price, compareAt: p.compareAt, image: p.image }, input.value, false);
      li.classList.add('is-added');
      $('[data-lv-status]', dialog).innerHTML = `${esc(p.title)}, taglia ${esc(input.value)}: nel carrello. <button type="button" class="link-small" data-open-dialog="cart-drawer">Vai al carrello</button>`;
      setTimeout(() => syncPiece(li), 1900);
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
    const [first, ...rest] = ready;
    for (const r of rest) Cart.add(info(r), r.size);
    await addWithFeedback(add, info(first), first.size, false);
    const left = rows.filter(r => r.buyable && !r.size).length;
    $('[data-lv-status]', dialog).innerHTML = `${ready.length === 1 ? 'Un capo aggiunto' : `${ready.length} capi aggiunti`} al carrello${left ? `, ${left === 1 ? 'uno' : left} senza taglia` : ''}. <button type="button" class="link-small" data-open-dialog="cart-drawer">Vai al carrello</button>`;
  }
  export async function openLook(link, { landed: arrived = false } = {}) {
    const scope = link.closest('section, .collection-page, main') || document;
    const cards = $$('[data-look-viewer]', scope);
    deck = cards.map(a => ({ id: a.dataset.lookViewer, href: a.getAttribute('href') }));
    if (!dialog) build();
    try { looks = await load(); } catch { location.href = link.href; return; }
    deck = deck.filter(d => looks[d.id]);
    if (!deck.length) { location.href = link.href; return; }
    at = Math.max(0, deck.findIndex(d => d.id === link.dataset.lookViewer));
    render();
    openDialog('look-viewer', link);
    // opened from a #look-<id> link: that entry is the look already; otherwise a new entry, so Back closes it
    if (arrived) landed = true;
    else if (!pushed && !landed && urlWritable()) { history.pushState({ lookViewer: deck[at].id }, '', `#look-${deck[at].id}`); pushed = true; }
  }
  // Back closes the viewer
  addEventListener('popstate', () => { if (dialog?.open) { pushed = false; closeDialog(dialog); } });

// popups.js: built 2026-10-02. Motion uses the theme's own vendor.min.js (Motion One).
import { SKS_FMT, SKS_CARD, $, $$, ROOT, BASE, MOTION_OK, FINE_POINTER, urlWritable, memory, store, announce, toast, CARDS, registerCards, productUrl, yieldToMain, deliveryWindow, trackingOK, openers, openDialog, closeDialog, popups, lookViewer, FREE_SHIPPING, MOCK_LATENCY, Cart, infoFromCard, renderCart, addWithFeedback, trackEvent, Wish, renderWishState, Recent, initRail, ForYou } from './luxe.js';
import { animate, inView, scroll, stagger, timeline, PhotoSwipeLightbox } from 'vendor';
/* ---------- wishlist heart (stands in for the back-in-stock app's wishlist-heart.js, block wishlist-app-embed):
   the live flow and copy. A heart opens one modal with the product, its sizes ("Disponibile", or a bell and
   "Avvisami" on a sold-out size, which stays selectable and saves the item with a stock alert), the e-mail for
   guests, the disclaimer and "Aggiungi alla wishlist"; then "Prodotto salvato" / "Richiesta ricevuta" /
   "Già nella tua wishlist" with "Visualizza wishlist" and "Chiudi". A saved heart opens "Già nella tua
   wishlist" with "Rimuovi" (live setting existing_item_click_action: modal). In the theme the app keeps drawing
   and running all of this (requests, events, e-mails): the theme only restyles it. Every step logs the event
   the app records (trackEvent() in luxe.js), so the preview shows that nothing is lost. ---------- */
const WISH_EMAIL = 'integratedWishlistEmail';
const SOURCE = { 'product-card__wish': 'collection', product__wish: 'product_page', 'look-piece__wish': 'outfit_page', 'look-viewer__wish': 'look_immersive' };
const sourceOf = b => Object.entries(SOURCE).find(([c]) => b.classList.contains(c))?.[1] || 'collection';
const wishPage = () => `${BASE}pages/swym-wishlist.html`;

// the product of a heart: a look piece's record, the product page's, or the card data of the page
function wishRecord(b) {
  const h = b.dataset.wish, s = b.closest('[data-size-fit]');
  if (s) return JSON.parse(s.dataset.sizeFit);
  const pj = document.getElementById('product-json');
  if (pj) { const P = JSON.parse(pj.textContent); if (P.handle === h) return P; }
  const c = CARDS[h];
  return c ? { handle: h, title: c.t, brand: c.b, price: c.p, compareAt: c.c, image: c.i, sizes: c.s || [] } : null;
}

export function wish(b) {
  const P = wishRecord(b);
  if (!P) return;
  const src = sourceOf(b);
  const d = b.closest('dialog');
  if (!d || !('sizeHelpDialog' in d.dataset)) host = d && d.open ? d : null;
  // the look page and the look viewer also send their own save_product (outfit-page.js, native-imm.js)
  if (src === 'outfit_page' || src === 'look_immersive') trackEvent('dataLayer:save_product', { source: src, item_id: P.handle });
  const m = dialogFor('wish-dialog', 'modal wish-modal', 'wish-title');
  // as live: a saved heart on a card or the product page opens "Già nella tua wishlist"; the look pages call
  // IntegratedWishlist.open(), which goes straight to the add modal (the answer is then "Già nella tua wishlist")
  if (Wish.has(P.handle) && (src === 'collection' || src === 'product_page')) existing(m, P, b); else add(m, P, b, src);
}

function productBlock(P) {
  return `<div class="wish-modal__product">
      <img src="${SKS_FMT.cdn(P.image, 160)}" alt="" width="80" height="100">
      <div><p class="wish-modal__brand" translate="no">${esc(P.brand)}</p><h2 class="wish-modal__title" id="wish-title">${esc(P.title)}</h2><p class="wish-modal__price">${SKS_FMT.money(P.price)}</p></div>
      <button type="button" class="icon-button wish-modal__close" aria-label="Chiudi" data-close-dialog>${icon('close')}</button>
    </div>`;
}

function add(m, P, opener, src) {
  const many = P.sizes.length > 1;
  m.innerHTML = `<div class="modal__inner">
    ${productBlock(P)}
    <form class="wish-modal__form" data-wish-form novalidate>
      ${many ? `<fieldset class="wish-sizes"><legend class="wish-sizes__label">Taglia</legend><div class="wish-sizes__grid">${P.sizes.map(([l, a]) => `<label class="wish-size${a ? '' : ' is-sold'}"><input type="radio" name="wish-size" value="${esc(l)}"><span class="wish-size__label">${esc(l)}</span><span class="wish-size__sub">${a ? 'Disponibile' : `${icon('bell')} Avvisami`}</span></label>`).join('')}</div></fieldset>` : ''}
      <div class="wish-modal__email"><label class="field__label" for="wish-email">Email</label><input class="field__input" id="wish-email" type="email" autocomplete="email" inputmode="email"></div>
      <p class="wish-modal__note">Procedendo riceverai email relative alla wishlist e alla disponibilità stock. Puoi disiscriverti in qualsiasi momento.</p>
      <p class="field__error" data-wish-error hidden role="alert"></p>
      <button type="submit" class="button button--primary button--block" data-wish-submit>Aggiungi alla wishlist</button>
    </form>
  </div>`;
  const form = $('[data-wish-form]', m), err = $('[data-wish-error]', m);
  form.addEventListener('change', e => { if (e.target.name === 'wish-size') { err.hidden = true; trackEvent('WISHLIST_SIZE_SELECTED', { handle: P.handle, selectedSize: e.target.value, source: src }); } });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const pick = form.querySelector('input[name="wish-size"]:checked');
    const size = many ? pick?.value : P.sizes[0]?.[0];
    const fail = (msg, el) => { err.textContent = msg; err.hidden = false; el?.focus(); };
    if (many && !size) return fail('Seleziona una taglia.', form.querySelector('input[name="wish-size"]'));
    const email = form['wish-email'].value.trim();
    if (!email) return fail('Inserisci la tua email.', form['wish-email']);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Inserisci un indirizzo email valido.', form['wish-email']);
    err.hidden = true;
    trackEvent('WISHLIST_EMAIL_SUBMITTED', { handle: P.handle, source: src });
    const btn = $('[data-wish-submit]', m);
    btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Salvataggio...';
    err.className = 'wish-modal__saving'; err.textContent = 'Stiamo salvando il prodotto nella tua wishlist.'; err.hidden = false;
    await new Promise(r => setTimeout(r, 450));
    const sold = !!P.sizes.find(s => s[0] === size && !s[1]);
    const already = Wish.has(P.handle);
    Wish.add(P, size, sold);
    store.set(WISH_EMAIL, email);
    // what the app's server records on this add (apps.wishlist.add.ts), shown here because nothing is sent
    trackEvent('server:WISHLIST_ITEM_ADDED', { handle: P.handle, selectedSize: size, source: src, stockStatus: sold ? 'OUT_OF_STOCK' : 'IN_STOCK' });
    if (sold) trackEvent('server:BACK_IN_STOCK_SUBSCRIBED', { handle: P.handle, selectedSize: size, source: 'wishlist' });
    done(m, P, size, already ? 'existing' : sold ? 'stock' : 'saved');
  });
  trackEvent('WISHLIST_MODAL_OPENED', { handle: P.handle, source: src });
  show(m, opener);
}

function done(m, P, size, kind) {
  const T = {
    saved: ['Prodotto salvato', 'Abbiamo aggiunto il prodotto alla tua wishlist.'],
    stock: ['Richiesta ricevuta', 'Abbiamo salvato il prodotto nella tua wishlist e attivato l’avviso stock. Ti avviseremo appena tornerà disponibile.'],
    existing: ['Già nella tua wishlist', 'Questo prodotto era già salvato nella tua wishlist.']
  }[kind];
  $('.modal__inner', m).innerHTML = `<div class="wish-modal__done">
    <span class="wish-modal__icon" aria-hidden="true">${icon('check')}</span>
    <h2 class="d4" id="wish-title">${T[0]}</h2>
    <p>${T[1]}</p>
    ${kind === 'stock' ? '<p class="wish-modal__badge">Avviso stock attivo</p>' : ''}
    <p class="meta">${esc(P.title)}${size ? ` · Taglia: ${esc(size)}` : ''}</p>
    <p class="meta">Anteprima: nessuna email inviata.</p>
    <div class="modal__actions"><a class="button button--outline" href="${wishPage()}">Visualizza wishlist</a><button type="button" class="button button--primary" data-close-dialog>Chiudi</button></div>
  </div>`;
  $('[data-close-dialog].button--primary', m).focus();
}

function existing(m, P, opener) {
  m.innerHTML = `<div class="modal__inner">
    <button type="button" class="icon-button wish-modal__close wish-modal__close--corner" aria-label="Chiudi" data-close-dialog>${icon('close')}</button>
    <div class="wish-modal__done">
      <span class="wish-modal__icon wish-modal__icon--heart" aria-hidden="true">${icon('heart')}</span>
      <h2 class="d4" id="wish-title">Già nella tua wishlist</h2>
      <p>Questo prodotto è già stato salvato.</p>
      <p class="meta"><span translate="no">${esc(P.brand)}</span> ${esc(P.title)}</p>
      <div class="modal__actions"><button type="button" class="button button--outline" data-wish-remove>Rimuovi</button><a class="button button--primary" href="${wishPage()}">Visualizza wishlist</a></div>
    </div>
  </div>`;
  $('[data-wish-remove]', m).addEventListener('click', async e => {
    const b = e.currentTarget;
    b.setAttribute('aria-busy', 'true'); b.textContent = 'Rimozione...';
    await new Promise(r => setTimeout(r, 350));
    Wish.remove(P.handle);
    trackEvent('request:wishlist/remove', { handle: P.handle });
    closeDialog(m);
    toast('Rimosso dalla wishlist');
  });
  show(m, opener);
}

/* ---------- size help (assets/size-help.js of the update): "Guida taglie", "Non sei sicuro della tua taglia?" and
   "Avvisami" for any product, loaded on the first click (a hover starts the download). One code path for the
   product page, every piece of a look page and the look viewer. The record (sizes, kind of guide, the brand
   table of the size service) comes from the closest [data-size-fit] (a look piece) or from #product-json (the
   product page). Over the look viewer the dialogs stack instead of closing it. Live: a size chart per piece in
   the look (size-charts API), the advisor (snippets/size-suggestions.liquid) only on the product page. The
   advisor: two steps (usual size, height, weight; then body, belly, age, fit), then "La tua taglia consigliata"
   with a compatibility score; the preview estimates on the device with the live inputs (chest from height and
   weight, the fit offsets of the live info page: slim -3 cm, relaxed +4 cm), the brand table when the service
   has one, else a generic table. Inputs stay in this browser. ---------- */
const icon = n => `<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const esc = s => SKS_FMT.esc(s);
const ONE = /^(t\.?u\.?|tu|unica|os)$/i;
// the shop's contacts (sections/footer: SHOP)
const PHONE = '+39 015 405464', PHONE_HREF = 'tel:+39015405464', WHATSAPP = 'https://wa.me/39015405464';
const HOW = {
  shoes: '<ul><li>Misura la sera, quando il piede è più gonfio, con la calza che userai.</li><li>Appoggia il tallone al muro su un foglio e segna la punta dell’alluce più lungo: la distanza in centimetri è la lunghezza del piede.</li><li>Misura entrambi i piedi e tieni il valore più lungo.</li></ul>',
  apparel: '<ul><li><strong>Torace</strong>: nel punto più ampio, sotto le ascelle, con il metro orizzontale.</li><li><strong>Vita</strong>: nel punto più stretto, sopra l’ombelico.</li><li><strong>Manica</strong>: dalla spalla al polso, con il braccio leggermente piegato.</li><li><strong>Collo</strong>: alla base, con un dito tra metro e collo.</li></ul>'
};
const KEY = 'sks-fit';
let cur = null, scope = null, host = null, advisorFor = null;

function recordFor(el) {
  const s = el.closest('[data-size-fit]');
  if (s) return [JSON.parse(s.dataset.sizeFit), s];
  const pj = document.getElementById('product-json');
  return [pj ? JSON.parse(pj.textContent) : null, $('[data-product-form]')];
}
function dialogFor(id, cls, labelledby) {
  let d = document.getElementById(id);
  if (!d) {
    d = document.createElement('dialog');
    d.id = id; d.className = cls; d.dataset.sizeHelpDialog = '';
    d.setAttribute('aria-labelledby', labelledby);
    document.body.append(d);
  }
  return d;
}
// the look viewer under the dialog stays open; another size dialog gives way
const show = (d, opener) => openDialog(d.id, opener, host);
const head = (id, title, P) => `<div class="size-modal__head"><div><h2 class="d4" id="${id}">${title}</h2><p class="size-modal__product"><span translate="no">${esc(P.brand)}</span> ${esc(P.title)}</p></div><button type="button" class="icon-button" aria-label="Chiudi" data-close-dialog>${icon('close')}</button></div>`;

/* the size guide: the brand table when the size service has one, else the sizes and their stock */
function openGuide(opener) {
  const P = cur, shoe = P.kind === 'shoes', chart = P.chart;
  const sold = new Set(P.sizes.filter(s => !s[1]).map(s => s[0]));
  const d = dialogFor('size-guide', 'modal size-modal', 'size-guide-title');
  d.innerHTML = `<div class="modal__inner">
    ${head('size-guide-title', chart ? esc(chart.name) : 'Guida alle taglie', P)}
    ${chart ? `<div class="size-modal__table"><table><thead><tr>${chart.headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${chart.rows.map(r => `<tr${sold.has(r[0]) ? ' class="is-sold"' : ''}>${r.map((c, i) => i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="meta">Misure del corpo in centimetri, dalla tabella della marca. Le taglie barrate sono esaurite in questo colore.</p>`
    : `<p>${shoe ? 'Numeri di questo modello' : 'Taglie di questo capo'} e disponibilità in questo momento:</p>
    <div class="size-modal__table"><table><thead><tr><th scope="col">${shoe ? 'Numero' : 'Taglia'}</th><th scope="col">Disponibilità</th></tr></thead><tbody>${P.sizes.map(s => `<tr><th scope="row">${esc(s[0])}</th><td>${s[1] ? (s[1] === 2 ? 'Ultimo pezzo' : 'Disponibile') : 'Esaurita'}</td></tr>`).join('')}</tbody></table></div>
    <p class="meta">Nel tema la tabella delle misure di ${esc(P.brand)} arriva dal servizio delle taglie (size-suggestions); nell’anteprima c’è solo per Barbour uomo.</p>`}
    <details class="size-modal__how"><summary>${shoe ? 'Come misurare il piede' : 'Come prendere le misure'}</summary>${HOW[shoe ? 'shoes' : 'apparel']}</details>
    <p><button type="button" class="link-small product__size-help" data-sh-advisor>${icon('hanger')}<span>Non sei sicuro della tua taglia? Trova la tua in due passi</span></button></p>
  </div>`;
  if (!d.dataset.bound) { d.dataset.bound = '1'; d.addEventListener('click', e => { const b = e.target.closest('[data-sh-advisor]'); if (b) openAdvisor(b); }); }
  show(d, opener);
}

/* the advisor: the form is drawn for the product (shoes ask for the usual number, the rest for height and weight) */
function advisorHtml(P) {
  const shoe = P.kind === 'shoes', female = P.g === 'F';
  return `<form class="modal__inner" data-size-advisor novalidate>
    ${head('sz-title', 'Trova la taglia giusta', P)}
    <div class="sz-progress" aria-hidden="true"><span class="is-active"></span><span></span></div>
    <div class="sz-step" data-sz-step="1">
      ${shoe ? `<fieldset class="sz-field"><legend class="sz-label">Il numero che porti di solito</legend><div class="sz-chips">${['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'].map(n => `<button type="button" class="sz-chip" data-usual="${n}" aria-pressed="false">${n}</button>`).join('')}</div></fieldset>
      <label class="sz-field"><span class="sz-label">In quale marca?</span><select class="field__input" name="ref_brand">${['Non lo so', 'Adidas', 'New Balance', 'Nike', 'Salomon', 'Hoka', 'On', 'La Sportiva', 'Birkenstock'].map(b => `<option>${b}</option>`).join('')}</select></label>`
      : `<fieldset class="sz-field"><legend class="sz-label">Taglia abituale</legend><div class="sz-chips">${['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(n => `<button type="button" class="sz-chip" data-usual="${n}" aria-pressed="false">${n}</button>`).join('')}<button type="button" class="sz-chip" data-usual="" aria-pressed="false" aria-label="Non so">?</button></div></fieldset>
      <div class="sz-grid-2">
        <label class="sz-field"><span class="sz-label">Altezza</span><span class="sz-input"><input class="field__input" name="height" type="number" inputmode="numeric" min="100" max="250" placeholder="170"><span>cm</span></span></label>
        <label class="sz-field"><span class="sz-label">Peso</span><span class="sz-input"><input class="field__input" name="weight" type="number" inputmode="decimal" min="30" max="250" placeholder="65"><span>kg</span></span></label>
      </div>`}
      <p class="field__error" data-sz-error hidden></p>
      <button type="button" class="button button--primary button--block" data-sz-next>${shoe ? 'Trova il mio numero' : 'Continua'}</button>
    </div>
    <div class="sz-step" data-sz-step="2" hidden>
      ${female ? `<fieldset class="sz-field"><legend class="sz-label">Corporatura</legend><div class="sz-chips sz-chips--cards">${[['slim', 'Slanciata', 'diritta'], ['regular', 'Normale', 'media'], ['curvy', 'Formosa', 'curve']].map(([v, l, sub], i) => `<button type="button" class="sz-chip" data-grp="body" data-val="${v}" aria-pressed="${i === 1}"><strong>${l}</strong><span>${sub}</span></button>`).join('')}</div></fieldset>` : ''}
      <fieldset class="sz-field"><legend class="sz-label">Addome</legend><div class="sz-chips">${[['flat', 'Piatto'], ['average', 'Normale'], ['round', 'Tondo']].map(([v, l], i) => `<button type="button" class="sz-chip" data-grp="belly" data-val="${v}" aria-pressed="${i === 1}">${l}</button>`).join('')}</div></fieldset>
      <fieldset class="sz-field"><legend class="sz-label">Età</legend><div class="sz-chips">${['18-25', '26-40', '41-55', '56+'].map((v, i) => `<button type="button" class="sz-chip" data-grp="age" data-val="${v}" aria-pressed="${i === 1}">${v.replace('-', '–')}</button>`).join('')}</div></fieldset>
      <fieldset class="sz-field"><legend class="sz-label">Vestibilità</legend><div class="sz-chips">${[['slim', 'Aderente'], ['regular', 'Normale'], ['relaxed', 'Comoda']].map(([v, l], i) => `<button type="button" class="sz-chip" data-grp="fit" data-val="${v}" aria-pressed="${i === 1}">${l}</button>`).join('')}</div></fieldset>
      <div class="modal__actions"><button type="button" class="button button--outline" data-sz-back>Indietro</button><button type="submit" class="button button--primary">Trova la mia taglia</button></div>
    </div>
    <div class="sz-result" data-sz-result hidden aria-live="polite"></div>
    <p class="sz-disclaimer meta">Stima indicativa · dati salvati solo in questo browser. <button type="button" class="link-small" data-sz-forget>Dimentica</button> · <button type="button" class="link-small" data-sz-how aria-expanded="false" aria-controls="sz-how">Come funziona?</button></p>
    <div class="sz-how meta" id="sz-how" hidden>
      <p>Altezza, peso e corporatura servono a stimare torace, vita e fianchi con formule antropometriche (ANSUR, NHANES); la stima si confronta con la tabella della marca.</p>
      <p><strong>Compatibilità</strong>: 90-100% misure al centro della taglia; 70-89% buona vestibilità; 50-69% valuta la taglia vicina; sotto il 50% stima indicativa.</p>
      <p><strong>Vestibilità</strong>: aderente toglie 3 cm al torace, comoda ne aggiunge 4.</p>
      <p><strong>Privacy</strong>: i dati restano nel tuo browser; al servizio vanno solo le misure e il prodotto.</p>
    </div>
    <p class="sz-help meta">Preferisci chiederlo a noi? <a href="${WHATSAPP}" target="_blank" rel="noopener">WhatsApp</a> · <a href="${PHONE_HREF}">${PHONE}</a></p>
  </form>`;
}

function mountAdvisor(d, P) {
  const form = $('[data-size-advisor]', d);
  const shoes = P.kind === 'shoes', female = P.g === 'F';
  const steps = $$('[data-sz-step]', form), result = $('[data-sz-result]', form), err = $('[data-sz-error]', form);
  const bars = $$('.sz-progress span', form);
  // generic body-chest tables (cm) when the brand has none in the size service
  const GENERIC = female
    ? [['XS', 78, 82], ['S', 82, 86], ['M', 86, 92], ['L', 92, 98], ['XL', 98, 104], ['XXL', 104, 110]]
    : [['XS', 84, 88], ['S', 88, 94], ['M', 94, 100], ['L', 100, 106], ['XL', 106, 112], ['XXL', 112, 118]];
  const chart = P.chart ? P.chart.rows.map(r => [r[0], ...r[1].split('–').map(Number)]) : GENERIC;
  // Italian numeric sizes some brands use instead of letters
  const IT = female ? { XS: '38', S: '40', M: '42', L: '44', XL: '46', XXL: '48' } : { XS: '44', S: '46', M: '48', L: '50', XL: '52', XXL: '54' };
  const saved = store.get(KEY, {});
  const state = { usual: saved.usual ?? null, body: saved.body || 'regular', belly: saved.belly || 'average', age: saved.age || '26-40', fit: saved.fit || 'regular' };
  if (saved.height && form.height) form.height.value = saved.height;
  if (saved.weight && form.weight) form.weight.value = saved.weight;
  const press = (grp, val) => $$(`[data-grp="${grp}"]`, form).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.val === val)));
  ['body', 'belly', 'age', 'fit'].forEach(g => press(g, state[g]));
  if (state.usual != null) $$('[data-usual]', form).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.usual === state.usual)));

  function step(n) {
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
      <p class="sz-result__size">${esc(label)}</p>
      <p class="sz-result__conf"><span aria-hidden="true">${dots}</span> Compatibilità ${r.pct}%: ${note}</p>
      ${s && !s[1] ? `<p class="sz-result__warn">La taglia consigliata per te è ${esc(label)}, ma non è disponibile in questo colore.</p>
        <button type="button" class="button button--outline button--block" data-sz-notify="${esc(label)}">Avvisami quando torna la ${esc(label)}</button>`
      : s ? `<button type="button" class="button button--primary button--block" data-sz-add="${esc(label)}">Aggiungi la ${esc(label)} al carrello</button>`
      : `<p class="sz-result__warn">Questo modello non ha la ${esc(label)}: guarda le taglie disponibili o chiedici un consiglio.</p>`}
      <p class="meta">Basato su: ${esc(r.basis)}.</p>
      <p><button type="button" class="link-small" data-sz-restart>Rifai il test</button></p>`;
    step('result');
    result.querySelector('button')?.focus();
    // as the size service's script: the tracker turns it into the size-test signal and the stored size
    document.dispatchEvent(new CustomEvent('product-intent:size-test-completed', { detail: { productHandle: P.handle, size: label, confidence: r.pct } }));
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
      step(2); $('[data-sz-step="2"] .sz-chip[aria-pressed="true"]', form)?.focus(); return;
    }
    if (e.target.closest('[data-sz-back]') || e.target.closest('[data-sz-restart]')) { step(1); return; }
    if (e.target.closest('[data-sz-forget]')) { store.set(KEY, {}); form.reset(); state.usual = null; $$('[data-usual]', form).forEach(b => b.setAttribute('aria-pressed', 'false')); step(1); toast('Dati della taglia cancellati da questo browser.'); return; }
    const how = e.target.closest('[data-sz-how]');
    if (how) { const box = $('.sz-how', form); box.hidden = !box.hidden; how.setAttribute('aria-expanded', String(!box.hidden)); return; }
    const add = e.target.closest('[data-sz-add]');
    if (add) { addSize(add, add.dataset.szAdd); return; }
    const nt = e.target.closest('[data-sz-notify]');
    if (nt) openNotify(nt, nt.dataset.szNotify);
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    store.set(KEY, { usual: state.usual, height: form.height?.value, weight: form.weight?.value, body: state.body, belly: state.belly, age: state.age, fit: state.fit });
    render(estimate());
  });
  // reopened: a shown result stays, otherwise the first step
  d._onOpen = () => { err.hidden = true; if (result.hidden) step(1); };
}
function openAdvisor(opener) {
  const d = dialogFor('size-advisor', 'modal size-modal size-advisor', 'sz-title');
  if (!d.dataset.bound) { d.dataset.bound = '1'; d.addEventListener('dialog:open', () => d._onOpen?.()); }
  if (advisorFor !== cur) { d.innerHTML = advisorHtml(cur); mountAdvisor(d, cur); advisorFor = cur; }
  show(d, opener);
}

// the advised size: the page takes it too (the buy box, the look piece), so page and cart agree; the product
// page opens the bag as its own button does, a look stays where it is
async function addSize(btn, size) {
  const P = cur, sc = scope;
  const r = sc && $$('input[type="radio"]', sc).find(i => i.value === size);
  if (r && !r.checked) r.click();
  await addWithFeedback(btn, { handle: P.handle, title: P.title, brand: P.brand, price: P.price, compareAt: P.compareAt, image: P.image }, size, !!sc?.matches('[data-product-form]'));
  sc?.dispatchEvent(new CustomEvent('size-help:added', { bubbles: true, detail: { handle: P.handle, size } }));
}

/* back in stock: the app's two popups with their live copy. The product page's (back-in-stock-widget.js, opened
   by window.SkiSisesBackInStockOpen) and the looks' (bis-mini.js, window.SkiSisesBisMini.open). In the theme the
   app keeps both, requests and events included; the theme only restyles them. */
const BIS = {
  product_page: { title: P => esc(P.title), lead: 'Inserisci la tua email. Ti invieremo un solo avviso quando la variante sarà disponibile.',
    label: 'Indirizzo email', note: 'Iscrivendoti alla lista, accetti di ricevere da Ski Sises una notifica via email quando questo prodotto torna disponibile.',
    send: 'Iscrivimi', sending: 'Invio...', doneTitle: 'Richiesta ricevuta', done: 'Grazie, abbiamo ricevuto la tua richiesta. Ti avviseremo il prima possibile, non appena tornerà in magazzino.' },
  look: { title: () => 'Avvisami quando disponibile', lead: 'Inserisci la tua email. Ti invieremo un solo avviso quando questa taglia torna disponibile.',
    label: 'Indirizzo email', placeholder: 'Indirizzo email', note: 'Iscrivendoti, accetti di ricevere una notifica via email quando questo prodotto torna disponibile.',
    send: 'Iscrivimi alla lista', sending: 'Invio…', doneTitle: '', done: 'Perfetto! Ti avviseremo via email quando torna disponibile.' }
};
function openNotify(opener, size) {
  // the surface is the piece or the product the size help was opened for (the advisor's own "Avvisami" too)
  const P = cur, page = !scope?.matches('[data-size-fit]');
  const src = page ? 'product_page' : scope.closest('.look-viewer') ? 'look_immersive' : 'outfit_page';
  const T = BIS[page ? 'product_page' : 'look'];
  const one = P.sizes.length === 1 || ONE.test(size || '');
  // the looks' callers send back_in_stock_open to the dataLayer (outfit-page.js, native-imm.js); on the product
  // page the tracker counts the click itself (40-wishlist-search.js)
  if (!page) trackEvent('dataLayer:back_in_stock_open', { source: src, item_id: P.handle, variant: size || null });
  const d = dialogFor('notify-dialog', 'modal bis-modal', 'notify-title');
  d.innerHTML = `<form class="modal__inner" novalidate data-bis-form>
    <div class="bis-modal__head">
      <img src="${SKS_FMT.cdn(P.image, 160)}" alt="" width="64" height="80">
      <div>${page ? '' : `<h2 class="d4" id="notify-title">${T.title(P)}</h2>`}
        <p class="bis-modal__product">${page ? `<strong id="notify-title">${T.title(P)}</strong>` : esc(P.title)}</p>
        ${one ? '' : `<p class="bis-modal__variant">Taglia ${esc(size)}</p>`}</div>
      <button type="button" class="icon-button" aria-label="Chiudi" data-close-dialog>${icon('close')}</button>
    </div>
    <p>${T.lead}</p>
    <div><label class="field__label${T.placeholder ? ' visually-hidden' : ''}" for="notify-email">${T.label}</label>
      <input class="field__input" id="notify-email" type="email" autocomplete="email" inputmode="email"${T.placeholder ? ` placeholder="${T.placeholder}"` : ''} required></div>
    <p class="field__error" data-bis-error hidden role="alert"></p>
    ${page ? `<p class="bis-modal__note">${T.note}</p><button type="submit" class="button button--primary button--block" data-bis-send>${T.send}</button>`
      : `<button type="submit" class="button button--primary button--block" data-bis-send>${T.send}</button><p class="bis-modal__note">${T.note}</p>`}
  </form>`;
  const form = $('[data-bis-form]', d), err = $('[data-bis-error]', d);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = form['notify-email'].value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Inserisci un indirizzo email valido.'; err.hidden = false; form['notify-email'].focus(); return; }
    err.hidden = true;
    const btn = $('[data-bis-send]', d);
    btn.setAttribute('aria-busy', 'true'); btn.textContent = T.sending;
    await new Promise(r => setTimeout(r, 450));
    // what the app's server records (api.public.back-in-stock.intents): the request, the product intent, the e-mail
    trackEvent('request:back-in-stock/intents', { handle: P.handle, variant: size || null, source: src });
    trackEvent('server:BACK_IN_STOCK_SUBSCRIBED', { handle: P.handle, variant: size || null, source: 'back_in_stock_signup' });
    form.outerHTML = `<div class="modal__inner bis-modal__done">
      <span class="wish-modal__icon" aria-hidden="true">${icon('check')}</span>
      ${T.doneTitle ? `<h2 class="d4" id="notify-title">${T.doneTitle}</h2>` : ''}
      <p>${T.done}</p>
      <p class="meta">Anteprima: nessuna email inviata.</p>
      <div class="modal__actions"><button type="button" class="button button--primary" data-close-dialog>Chiudi</button></div>
    </div>`;
    $('[data-close-dialog].button--primary', d).focus();
  });
  show(d, opener);
  setTimeout(() => form['notify-email']?.focus(), 50);
}

export function open(what, el, size) {
  const [rec, sc] = recordFor(el);
  if (!rec) return;
  cur = rec; scope = sc;
  // the look viewer under a piece stays open
  const d = el.closest('dialog');
  if (!d || !('sizeHelpDialog' in d.dataset)) host = d && d.open ? d : null;
  if (what === 'guide') openGuide(el);
  else if (what === 'advisor') openAdvisor(el);
  else openNotify(el, size);
}

/* Motor de render compartido. Ambos modos (bloques de sección desglosados y
   tarjetas curadas data-driven) consumen el "contexto de tema" (ctx) que aporta
   cada manifiesto:
     ctx = { sections, source, labelFor(key), keySplit:'first'|'last',
             sourceDigitFallback, specialTags?, external? } */
import { anchorId, config } from '../config.js';

export function linkify(text, refs){
  if(!refs || !text) return text;
  refs.forEach(r => {
    text = text.replace(r.t, '<button class="ref-tag" data-ref="' + r.r + '" type="button">→ ' + r.t + '</button>');
  });
  return text;
}

/* ---- Modo bloques: secciones con apartados desglosados y etiquetas ----
   Etiqueta especial (genérica): si el apartado/sección trae `tags` y el tema
   declara `specialTags`, se pinta un chip con icono + label corto. El SDK no
   conoce ninguna etiqueta concreta: icono y label los aporta siempre la app. */
export function specialTagChip(ctx, dataRef, holder){
  if(!holder.tags || !ctx.specialTags) return '';
  const defs = holder.tags.map(k => ctx.specialTags[k]).filter(Boolean);
  if(!defs.length) return '';
  const icon = defs[0].icon || '🏷';
  const labels = defs.map(d => d.chip).filter(Boolean).join(' · ');
  return '<button class="susp-tag" data-ref="' + dataRef + '" type="button" aria-label="Ver etiqueta"><span class="ico">' + icon + '</span>' + labels + '</button>';
}

export function renderArticleBlock(ctx, num){
  const art = ctx.sections[String(num)];
  if(!art) return '';
  let apsHtml, noAp = false;
  if(art.apartados){
    apsHtml = art.apartados.map(ap =>
      '<div class="apartado" id="' + anchorId(num, ap.n) + '"><button class="ap-n" data-ref="' + num + '.' + ap.n + '" type="button" title="Ver texto literal">' + ap.n + '</button><span class="ap-txt">' + linkify(ap.text, ap.refs) + '</span>' + specialTagChip(ctx, num + '.' + ap.n, ap) + '</div>'
    ).join('');
  } else {
    noAp = true;
    apsHtml = '<div class="apartado"><span class="ap-txt">' + linkify(art.text, art.refs) + '</span>' + specialTagChip(ctx, String(num), art) + '</div>';
  }
  return '<div class="art-block' + (noAp ? ' no-ap' : '') + '" id="' + anchorId(num) + '">'
    + '<div class="art-block-head"><button class="art-num" data-ref="' + num + '" type="button" title="Ver texto literal">' + num + '</button><span class="art-title">' + art.title + '</span></div>'
    + '<div class="apartados">' + apsHtml + '</div>'
    + '</div>';
}

export function renderSectionsInto(root, ctx, sections){
  for(const [containerId, nums] of Object.entries(sections)){
    const el = root.querySelector('#' + containerId);
    if(el) el.innerHTML = nums.map(n => renderArticleBlock(ctx, n)).join('');
  }
}

/* ---- Tema 2 (y temas futuros): tarjetas curadas data-driven ---- */
export function renderArtRow(ctx, key){
  const art = ctx.sections[key];
  if(!art) return '';
  const label = ctx.labelFor(key);
  if(art.apartados){
    return art.apartados.map(ap =>
      '<div class="art" id="' + anchorId(key, ap.n) + '"><button class="anum" data-ref="' + key + '.' + ap.n + '" type="button" title="Ver texto literal">' + label + '.' + ap.n + '</button><span class="atxt">' + linkify(ap.text, ap.refs) + '</span></div>'
    ).join('');
  }
  return '<div class="art" id="' + anchorId(key) + '"><button class="anum" data-ref="' + key + '" type="button" title="Ver texto literal">' + label + '</button><span class="atxt"><b>' + art.title + '.</b> ' + linkify(art.text, art.refs) + '</span></div>';
}

export function renderCard(ctx, card, cls){
  const hasDetail = card.artNums && card.artNums.length;
  const n = hasDetail ? card.artNums.length : 0;
  const discLabel = config().detailLabel
    ? config().detailLabel(n)
    : (n === 1 ? 'Ver el detalle' : 'Ver los ' + n + ' detalles');
  const detail = hasDetail
    ? '<button class="disclosure"><span class="chev">▸</span> ' + discLabel + '</button><div class="det"><div class="det-inner">' + card.artNums.map(k => renderArtRow(ctx, k)).join('') + '</div></div>'
    : '';
  const markId = hasDetail ? card.artNums[0] : card.sig;   // id estable para "marcar importante"
  return '<div class="node reveal"><div class="card ' + cls + '" data-mark-id="' + markId + '">'
    + '<div class="card-head"><div class="body">'
    + '<div class="row1"><span class="sig">' + card.sig + '</span><span class="name">' + card.name + '</span></div>'
    + '<p class="desc">' + card.desc + '</p>'
    + '<p class="truco"><span class="bulb">' + (card.trucoIcon || '💡') + '</span><span>' + card.truco + '</span></p>'
    + '</div>'
    + '<div class="illus" aria-hidden="true">' + card.illus + '</div>'
    + '</div>'
    + detail
    + (card.extra || '')
    + '</div></div>';
}

export function renderCardTreesInto(root, ctx, groups){
  for(const g of groups){
    const el = root.querySelector('#' + g.containerId);
    if(el) el.innerHTML = g.cards.map(c => renderCard(ctx, c, g.cls)).join('');
  }
}

/* ---- Interacción común de tarjetas (disclosure, repaso, desplegar todo) ---- */
export function bindCardInteractions(root, { signal } = {}){
  root.addEventListener('click', (e) => {
    if(e.target.closest('.mark-btn')) return;   // la estrella de "importante" no despliega/revela
    const d = e.target.closest('.disclosure');
    if(d){ e.stopPropagation(); d.closest('.card').classList.toggle('open'); return; }
    const head = e.target.closest('.card-head');
    if(head && document.body.classList.contains('repaso')){
      head.closest('.card').classList.toggle('revealed');
    }
  }, { signal });
}

export function bindToggleAll(btn, root, { signal } = {}){
  let allOpen = false;
  btn.addEventListener('click', () => {
    allOpen = !allOpen;
    root.querySelectorAll('.card .disclosure').forEach(d => d.closest('.card').classList.toggle('open', allOpen));
    btn.classList.toggle('on', allOpen);
    btn.lastChild.textContent = allOpen ? ' Plegar todo' : ' Desplegar todo';
  }, { signal });
}

export function bindRepaso(btn, root, { signal } = {}){
  btn.addEventListener('click', () => {
    const on = document.body.classList.toggle('repaso');
    btn.classList.toggle('on', on);
    btn.lastChild.textContent = on ? ' Repaso activo' : ' Activar repaso';
    if(!on) root.querySelectorAll('.card').forEach(c => c.classList.remove('revealed'));
  }, { signal });
}

/* Motor de render compartido. Ambos modos (bloques de sección desglosados y
   tarjetas curadas data-driven) consumen el "contexto de tema" (ctx) que aporta
   cada manifiesto:
     ctx = { sections, source, labelFor(key), keySplit:'first'|'last',
             sourceDigitFallback, specialTags?, external? } */
import { anchorId, config } from '../config.js';
import { listData } from './enum-list.js';

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

/* Cuerpo de teoría: si el párrafo lleva una enumeración a) b) c)…, se trocea
   en lista. Tres cuidados que vienen del formato real:
     · Se trocea DESPUÉS de `linkify`, sobre el HTML ya generado. Hacerlo antes
       obligaría a repartir `refs` por ítem, y el marcador nunca cae dentro de
       una etiqueta con el contenido actual.
     · El contenedor pasa de `<span>` a `<div>` cuando hay lista: un `<ul>`
       dentro de un inline es anidamiento inválido y el navegador lo reordena.
       Sin lista se queda en `<span>`, para no cambiar lo que ya funciona.
     · La lista es COMPACTA, distinta de la del panel literal: aquí los ítems
       son resúmenes de una línea, no párrafos de ley. */
function cuerpoApartado(html, cls = 'ap-txt', pre = ''){
  const list = listData(html);
  if(!list) return '<span class="' + cls + '">' + pre + html + '</span>';
  return '<div class="' + cls + '">'
    + (pre || list.intro ? '<span class="ap-intro">' + pre + list.intro + '</span>' : '')
    + '<ol class="ap-abc">'
    + list.items.map(it => '<li><span class="ap-m">' + it.disp + '</span>' + it.text + '</li>').join('')
    + '</ol></div>';
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
    apsHtml = '<div class="apartado">' + cuerpoApartado(linkify(art.text, art.refs)) + specialTagChip(ctx, String(num), art) + '</div>';
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
    /* Cabecera por artículo (nº + título) para que dentro de un rango cada
       artículo se distinga; los apartados cuelgan debajo mostrando solo su nº. */
    const head = '<div class="art-hd">'
      + '<button class="art-hd-num" data-ref="' + key + '" type="button" title="Ver texto literal">' + label + '</button>'
      + '<span class="art-hd-title">' + art.title + '</span></div>';
    const rows = art.apartados.map(ap =>
      '<div class="art" id="' + anchorId(key, ap.n) + '"><button class="anum" data-ref="' + key + '.' + ap.n + '" type="button" title="Ver texto literal">' + ap.n + '</button>' + cuerpoApartado(linkify(ap.text, ap.refs), 'atxt') + '</div>'
    ).join('');
    return '<div class="art-group" id="' + anchorId(key) + '">' + head + rows + '</div>';
  }
  return '<div class="art" id="' + anchorId(key) + '"><button class="anum" data-ref="' + key + '" type="button" title="Ver texto literal">' + label + '</button>' + cuerpoApartado(linkify(art.text, art.refs), 'atxt', '<b>' + art.title + '.</b> ') + '</div>';
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
  /* Identidad de la tarjeta (marcas, prioridad, subrayados). Sale del número de
     artículo o del numeral, no del título, así que renombrar no la rompe. Aun
     así `markId` manda: si un día cambia el numeral de una tarjeta publicada,
     es la única forma de conservar lo que el usuario tenía guardado. */
  const markId = card.markId || (hasDetail ? card.artNums[0] : card.sig);
  /* `prioridad` la declara el AUTOR y vale como defecto de esa tarjeta, no como
     imposición: en cuanto el usuario la toca, manda lo suyo. Nace de temarios
     anotados a mano donde el propio opositor ya decidió qué se salta. */
  const prioOk = ['omitir', 'baja', 'media', 'alta'];
  const prioVal = String(card.prioridad || '').toLowerCase();
  /* Vocabulario CERRADO: se valida en vez de escapar. Un valor inventado no se
     pinta —mejor que salga el defecto que un atributo que nadie interpreta— y
     así tampoco hay nada del autor que llegue crudo al HTML. */
  const prio = prioOk.includes(prioVal) ? ' data-prio="' + prioVal + '"' : '';
  return '<div class="node reveal"><div class="card ' + cls + '" data-mark-id="' + markId + '"' + prio + '>'
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

/* ---- Claves estables de tarjeta (temas escritos a mano) ----
   La clave de una tarjeta (`data-mark-id`) es su IDENTIDAD: bajo ella se guardan
   la importancia (marks), la prioridad del plan de estudio, los subrayados y el
   marcapáginas. Derivarla del TÍTULO parece cómodo, pero ata la identidad al
   texto: al renombrar la tarjeta, todo eso queda huérfano bajo la clave vieja y
   la tarjeta aparece virgen. Pasó de verdad («Software de E/S y técnicas» →
   «Técnicas de E/S»).
   Por eso: si la tarjeta DECLARA `data-mark-id` en su HTML, manda. El slug del
   título es solo el valor por defecto para las tarjetas que no lo declaran. */

/* Título limpio de una tarjeta. Quita el numeral de esquema (`.secn`), que se
   inyecta DESPUÉS del render: así la clave no depende de cuándo se llame. */
export function cardTitle(card){
  const el = card.querySelector('.card-head .name, .card-head .label');
  if(!el) return '';
  const c = el.cloneNode(true);
  c.querySelectorAll('.secn').forEach(x => x.remove());
  return (c.textContent || '').replace(/\s+/g, ' ').trim();
}

export const slugify = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* Da clave y ancla a las tarjetas de un contenido escrito a mano. Por cada
   `.card` que no sea un agrupador estructural (las que anidan otras tarjetas o
   artículos no se marcan: solo pliegan):
     · clave = su `data-mark-id` declarado; si no lo hay, el slug del título
     · ancla = `<anchorPrefix><clave>` en el `.node` que la envuelve, si no tiene
   Idempotente y seguro sobre cualquier tema: las tarjetas de `renderCard` ya
   traen clave y salen intactas. Dos cautelas para no tocar temas que no lo
   piden — ambas contrastadas contra las 254 tarjetas reales de la app:
     · el ancla solo se pone si la clave YA tiene forma de slug. Las claves de
       `renderCard` salen de `sig` y pueden ser cualquier cosa («2015 · ONU»):
       un `id="sec-2015 · ONU"` no es seleccionable.
     · y solo si ese id está libre. Una tarjeta con `artNums:['97']` ya contiene
       un `#sec-97` propio; duplicarlo mandaría los deep-links al sitio erróneo.
   NO desambigua claves repetidas a propósito: dos tarjetas con la misma clave
   comparten marca y prioridad, y eso debe verse (lo caza `apuntes-verify`), no
   taparse con un sufijo que además volvería a ser inestable.

   El ancla usa el `anchorPrefix` de la app, que es UNO para toda ella. Un tema
   cuyas anclas publicadas usen otro prefijo las vería cambiar de nombre en
   silencio, y con ellas los deep-links y marcadores que el usuario tuviera
   guardados. Por eso se puede fijar el prefijo (`anchorPrefix: 'sec-'`) o
   desactivar el ancla entera (`anchor: false`) y seguir usando el helper solo
   para las claves, que es su parte irrenunciable.

   CLAVE Y ANCLA SON DOS IDENTIDADES CON VIDAS DISTINTAS, y en una tarjeta
   renombrada divergen: la clave se congela en el nombre viejo a propósito (es
   la convención que salva las marcas), mientras que el ancla puede querer
   seguir al título actual para que el deep-link diga lo que la tarjeta dice
   hoy. Derivar el ancla de la clave las ata y resucita el nombre viejo.
   Ninguna de las dos opciones es gratis, así que se elige con `anchorFrom`:
     · `'key'` (por defecto) — el ancla NO cambia al renombrar: los deep-links
       y marcadores guardados siguen valiendo, a cambio de arrastrar el nombre
       viejo en la URL.
     · `'title'` — el ancla es legible y va con el título de hoy, pero cada
       renombrado la cambia y deja **sin efecto el marcapáginas** que el usuario
       tuviera en esa tarjeta (se guarda por id de ancla, y al no encontrarlo no
       restaura posición: falla en silencio, como la marca huérfana).
     · una función `(card, key) => id` para lo que no cubran las dos anteriores.
   Y como ninguna regla derivada cubre todos los casos —medido sobre 169 anclas
   reales: derivar de la clave cambia las tarjetas renombradas, y derivar del
   título rompe la que tiene clave propia porque su título es ambiguo («Árbol B+»
   slugifica igual que «Árbol B»)—, la tarjeta puede DECLARAR su ancla con
   `data-anchor-id`, igual que declara su clave. Lo declarado siempre manda.
   Devuelve las claves asignadas, en orden de documento. */
export function assignCardKeys(root, { slugify: slug = slugify, anchor = true, anchorPrefix, anchorFrom = 'key' } = {}){
  const keys = [];
  const usados = new Set([...root.querySelectorAll('[id]')].map(e => e.id));
  const conPrefijo = (base) => anchorPrefix != null ? anchorPrefix + base : anchorId(base);
  const anclaDe = (card, key) => card.getAttribute('data-anchor-id')
    || (typeof anchorFrom === 'function'
      ? anchorFrom(card, key)
      : conPrefijo(anchorFrom === 'title' ? slug(cardTitle(card)) : key));
  root.querySelectorAll('.card').forEach(card => {
    if(card.querySelector('.card, .art-block[id]')) return;   // agrupador: sin clave propia
    const key = card.getAttribute('data-mark-id') || slug(cardTitle(card));
    if(!key) return;
    card.setAttribute('data-mark-id', key);
    const node = card.closest('.node') || card;
    const id = anchor ? anclaDe(card, key) : null;
    /* El ancla solo se pone si es un id usable como selector y está libre: las
       claves de `renderCard` salen de `sig` y pueden ser cualquier cosa
       («2015 · ONU»), y una tarjeta con `artNums` ya trae su propia ancla. */
    if(id && !node.id && /^[A-Za-z][\w-]*$/.test(id) && !usados.has(id)){
      node.id = id; usados.add(id);
    }
    keys.push(key);
  });
  return keys;
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

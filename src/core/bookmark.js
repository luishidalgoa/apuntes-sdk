/* Marcapáginas (app de un solo usuario → localStorage), rediseño v0.1.28:
   - UNO POR TEMA: cada tema recuerda su marcador; el hub enseña el más reciente.
   - La marca es una PESTAÑITA elegante colgada del borde superior-derecho de la
     tarjeta marcada (color de acento del tema, cola de milano). Si el marcador
     apunta a un subpunto interno (apartado), un TALLO fino se estira por el
     borde derecho de la tarjeta hasta la altura exacta de ese subpunto.
   - Un CHIP flotante "volver al marcador" (abajo-derecha) aparece SOLO cuando
     la marca está fuera de pantalla; tap → scroll suave hasta ella. En móvil
     este chip es lo que hace visible al marcapáginas.
   Sustituye a la cinta de página completa con física de cuerda (retirada). */
import { temaById } from '../registry.js';
import { revealAnchor } from './panels.js';
import { config } from '../config.js';

const KEY = 'tai-bookmarks';        // { [temaId]: { anchor, ts } }
const OLD_KEY = 'tai-bookmark';     // legado: { temaId, anchor, ts }
const OLD_ANIM_KEY = 'tai-bookmark-anim';   // legado: ajuste de animación de la cinta

/* Migración silenciosa del formato antiguo (un marcador global) al nuevo
   (uno por tema). Se ejecuta perezosamente en la primera lectura. */
function readAll(){
  try{
    const old = localStorage.getItem(OLD_KEY);
    if(old){
      const b = JSON.parse(old);
      const map = b && b.temaId ? { [b.temaId]: { anchor: b.anchor, ts: b.ts || Date.now() } } : {};
      localStorage.setItem(KEY, JSON.stringify(map));
      localStorage.removeItem(OLD_KEY);
      localStorage.removeItem(OLD_ANIM_KEY);
      return map;
    }
    return JSON.parse(localStorage.getItem(KEY)) || {};
  }catch(e){ return {}; }
}
function writeAll(map){ try{ localStorage.setItem(KEY, JSON.stringify(map)); }catch(e){} }

export function getBookmark(temaId){
  const map = readAll();
  const b = map[temaId];
  return (b && b.anchor && temaById(temaId)) ? { temaId, anchor: b.anchor, ts: b.ts } : null;
}
/* El más reciente entre todos los temas (para la tarjeta del hub). */
export function getLatestBookmark(){
  const map = readAll();
  let best = null;
  for(const temaId of Object.keys(map)){
    const b = map[temaId];
    if(!b || !b.anchor || !temaById(temaId)) continue;
    if(!best || (b.ts || 0) > (best.ts || 0)) best = { temaId, anchor: b.anchor, ts: b.ts };
  }
  return best;
}
export function markAnchor(temaId, anchor){
  if(!anchor) return null;
  const map = readAll();
  map[temaId] = { anchor, ts: Date.now() };
  writeAll(map);
  return anchor;
}
export function clearBookmark(temaId){
  const map = readAll();
  if(temaId in map){ delete map[temaId]; writeAll(map); }
}

/* ancla '<prefix>113-2' o '<prefix>CE-159-3' → etiqueta legible ('Art. 113.2', '159.3') */
export function anchorLabel(temaId, anchor){
  const prefix = config().anchorPrefix;
  if(!anchor || anchor.indexOf(prefix) !== 0) return '';
  const tema = temaById(temaId);
  const rest = anchor.slice(prefix.length);
  if(!tema) return rest;
  const art = tema.engine.sections;
  if(art[rest]) return tema.engine.labelFor(rest);
  const cut = rest.lastIndexOf('-');
  if(cut === -1) return rest;
  const base = rest.slice(0, cut), ap = rest.slice(cut + 1);
  if(art[base]) return tema.engine.labelFor(base) + '.' + ap;
  return rest;
}

export function relTime(ts){
  const mins = Math.round((Date.now() - ts) / 60000);
  if(mins < 2) return 'hace un momento';
  if(mins < 60) return 'hace ' + mins + ' min';
  const h = Math.round(mins / 60);
  if(h < 24) return 'hace ' + h + ' h';
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : 'hace ' + d + ' días';
}

/* Pestañita SVG: banderín con cola de milano (26×34). Hereda color por
   currentColor (el CSS le da el acento del tema). */
const TAB_SVG = '<svg viewBox="0 0 26 34" aria-hidden="true">'
  + '<path d="M2 0 H24 V30 L13 23.5 L2 30 Z" fill="currentColor"/>'
  + '<path d="M2 0 H24 V30 L13 23.5 L2 30 Z" fill="#fff" opacity=".16" transform="translate(-1.4 -1)"/>'
  + '</svg>';

/* ---------- UI del marcapáginas dentro de la vista de tema ----------
   root: raíz de la vista · temaId · onTabClick: abrir el modo cambiar/quitar. */
export function createBookmarkUI(root, temaId, { onTabClick } = {}){
  const wrap = root.querySelector('.wrap');
  const content = wrap && wrap.querySelector('#temaContent');
  if(!wrap || !content) return null;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* pestañita + tallo (se insertan en la tarjeta marcada) */
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'bm-tab';
  tab.title = 'Tu marcapáginas — toca para cambiarlo o quitarlo';
  tab.setAttribute('aria-label', 'Tu marcapáginas: cambiar o quitar');
  tab.innerHTML = TAB_SVG;
  const stem = document.createElement('span');
  stem.className = 'bm-stem';
  stem.setAttribute('aria-hidden', 'true');

  /* chip flotante "volver al marcador" (vive en el wrap, posición fija) */
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'bm-chip';
  chip.hidden = true;
  wrap.appendChild(chip);

  let anchorId = null;
  let cardEl = null;
  let io = null;         // IntersectionObserver del ancla (visibilidad del chip)
  let ro = null;         // ResizeObserver de la tarjeta (recolocar el tallo)
  let watchAC = null;    // aborta los listeners de transitionend/scroll

  tab.addEventListener('click', (e) => { e.stopPropagation(); if(onTabClick) onTabClick(); });
  chip.addEventListener('click', () => { if(anchorId) revealAnchor(anchorId); });

  /* El tallo se estira desde la pestañita hasta la altura del subpunto marcado
     (jerarquía). Si el marcador es la tarjeta/artículo entero, o el subpunto
     está oculto (tarjeta plegada), el tallo se recoge. */
  function layoutStem(){
    if(!cardEl){ return; }
    const el = document.getElementById(anchorId);
    if(!el || el === cardEl || !el.offsetParent){ stem.style.height = '0px'; stem.classList.add('bm-none'); return; }
    const cardBox = cardEl.getBoundingClientRect();
    const elBox = el.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(stem).top) || 0;
    const target = Math.max(0, (elBox.top - cardBox.top) + Math.min(18, elBox.height / 2) - top);
    stem.style.height = target.toFixed(0) + 'px';
    stem.classList.toggle('bm-none', target < 6);
  }
  /* rect: boundingClientRect del propio evento IO (autoritativo en el momento
     del callback; releer el layout aquí puede pillar el scroll a medias). */
  function chipLabel(rect){
    const below = rect ? rect.top > innerHeight / 2 : true;
    const label = anchorLabel(temaId, anchorId) || 'tu marcador';
    chip.innerHTML = '<span class="bm-chip-ico">🔖</span> ' + label + ' <span class="bm-chip-dir">' + (below ? '↓' : '↑') + '</span>';
  }

  function show(id, { animate = false } = {}){
    hide();
    anchorId = id;
    const el = document.getElementById(id);
    if(!el) return;
    cardEl = el.closest('.card, .node') || el;
    watchAC = new AbortController();
    cardEl.classList.add('bm-host');
    cardEl.appendChild(stem);
    cardEl.appendChild(tab);
    if(animate && !reduce){
      tab.classList.add('bm-drop');
      stem.classList.add('bm-grow');
      setTimeout(() => { tab.classList.remove('bm-drop'); stem.classList.remove('bm-grow'); }, 700);
    }
    layoutStem();
    /* recolocar el tallo si la tarjeta cambia de tamaño (desplegar/plegar,
       resize, fuentes) — barato: solo altura de un span. El scroll-reveal (.sr)
       mueve el contenido con transform SIN cambiar el alto de la tarjeta, así
       que además re-medimos al asentarse esas transiciones (transitionend
       burbujea desde los hijos) y en scroll (throttled por rAF). */
    ro = new ResizeObserver(layoutStem);
    ro.observe(cardEl);
    cardEl.addEventListener('transitionend', layoutStem, { signal: watchAC.signal });
    let ticking = false;
    window.addEventListener('scroll', () => {
      if(ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; layoutStem(); });
    }, { passive: true, signal: watchAC.signal });
    /* chip visible solo con la marca fuera de pantalla */
    io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      if(e && e.isIntersecting){ chip.hidden = true; }
      else { chipLabel(e && e.boundingClientRect); chip.hidden = false; }
    }, { rootMargin: '-8% 0px -8% 0px' });
    io.observe(el);
  }
  function hide(){
    anchorId = null;
    if(io){ io.disconnect(); io = null; }
    if(ro){ ro.disconnect(); ro = null; }
    if(watchAC){ watchAC.abort(); watchAC = null; }
    if(cardEl){ cardEl.classList.remove('bm-host'); cardEl = null; }
    tab.remove(); stem.remove();
    chip.hidden = true;
  }
  function destroy(){ hide(); chip.remove(); }

  return { show, hide, destroy, get anchor(){ return anchorId; } };
}

/* Dado un elemento clicado, devuelve el ancla de artículo más apropiada:
   el artículo/apartado clicado, o el primero de la tarjeta si se toca su
   cabecera. */
export function anchorFromClick(target){
  if(!target) return null;
  const sel = '[id^="' + config().anchorPrefix + '"]';
  const direct = target.closest('#temaContent ' + sel);
  if(direct) return direct.id;
  const card = target.closest('.card, .node');
  if(card){
    const first = card.querySelector(sel);
    if(first) return first.id;
    /* Layout de árbol: la tarjeta puede tener sus anclas como HERMANAS dentro
       del .node contenedor (p.ej. card "Capítulo II" + innernote#art-14 al
       lado). Si dentro de la tarjeta no hay nada, buscamos en el nodo. */
    const node = card.closest('.node');
    if(node && node !== card){
      const near = node.querySelector(sel);
      if(near) return near.id;
    }
  }
  return null;
}

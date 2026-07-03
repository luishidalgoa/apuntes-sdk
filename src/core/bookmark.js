/* Marcador manual "marcapáginas de tela" (app de un solo usuario → localStorage).
   El usuario pulsa "Marcar aquí" y una cinta de paja trenzada CAE desde el
   borde superior de la página hasta el artículo visible, quedando clavada
   (cola de milano en la punta). Vuelve a pulsar y se recoge. El hub muestra
   además una tarjeta "seguir donde lo dejaste" que apunta al mismo marcador. */
import { temaById } from '../registry.js';
import { revealAnchor } from './panels.js';
import { config } from '../config.js';

const KEY = 'tai-bookmark';

/* Textura de paja trenzada (SVG): trama DIAGONAL (patternTransform rotate 45),
   cada hilo con degradado 3D, valles oscuros y sombras en los cruces. Se pinta
   UNA vez (capa cacheada); la animación es solo transform GPU, sin re-render. */
const WEAVE_SVG = `<svg class="br-weave" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="brWarp" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8a6a2e"/><stop offset=".18" stop-color="#c7a458"/>
      <stop offset=".5" stop-color="#f2e3b6"/><stop offset=".82" stop-color="#c19d52"/>
      <stop offset="1" stop-color="#836528"/>
    </linearGradient>
    <linearGradient id="brWeft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#93712f"/><stop offset=".2" stop-color="#cdaa5c"/>
      <stop offset=".5" stop-color="#ecdcac"/><stop offset=".8" stop-color="#b18f47"/>
      <stop offset="1" stop-color="#79591f"/>
    </linearGradient>
    <pattern id="brStraw" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="26" height="26" fill="#5f4a20"/>
      <g>
        <rect x="1" y="-1" width="10.5" height="28" rx="3.4" fill="url(#brWarp)"/>
        <rect x="14.5" y="-1" width="10.5" height="28" rx="3.4" fill="url(#brWarp)"/>
        <rect x="-1" y="1" width="12" height="10.5" rx="3.4" fill="url(#brWeft)"/>
        <rect x="14" y="14.5" width="13" height="10.5" rx="3.4" fill="url(#brWeft)"/>
        <g fill="#4c3a18" opacity=".55">
          <rect x="12.2" y="0" width="1.6" height="26"/>
          <rect x="0" y="12.2" width="12" height="1.6"/>
          <rect x="14" y="12.2" width="12" height="1.6"/>
        </g>
        <g fill="#000" opacity=".18">
          <rect x="11.5" y="1" width="2.6" height="10.5"/>
          <rect x="1" y="11.6" width="10.5" height="2.6"/>
        </g>
      </g>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#brStraw)"/>
</svg>`;

export function getBookmark(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return null;
    const b = JSON.parse(raw);
    if(!b || !b.temaId || !temaById(b.temaId)) return null;
    return b;
  }catch(e){ return null; }
}
export function clearBookmark(){ try{ localStorage.removeItem(KEY); }catch(e){} }
function save(b){ try{ localStorage.setItem(KEY, JSON.stringify(b)); }catch(e){} }

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

/* ---------- la cinta de tela con física de "cuerda" (muelle por transform) ----------
   La textura se pinta UNA sola vez (capa estática cacheada). La animación no
   re-renderiza nada: es solo `transform` (compuesto en GPU), así que va fluida
   por larga que sea la cinta. Física de péndulo amortiguado:
     · `off` = desplazamiento horizontal de la PUNTA en px, oscila y se asienta.
     · el giro es `asin(off / H)` alrededor del borde superior → la punta se
       mueve SIEMPRE los mismos px oscile lo que oscile la cinta: cuanto más
       larga (marcador lejano), menor el ángulo, nunca el arco brusco de antes.
     · un segundo muelle `lag` va por detrás de `off` y su desfase se pinta como
       `skewX` → la cola "late" con retardo, dando el flexo de cuerda (no rígido). */
export function createRibbon(root){
  const wrap = root.querySelector('.wrap');
  const content = wrap && wrap.querySelector('#temaContent');
  if(!wrap || !content) return null;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  const ribbon = document.createElement('button');
  ribbon.type = 'button';
  ribbon.className = 'bookmark-ribbon';
  ribbon.setAttribute('aria-label', 'Ir a tu marcador');
  ribbon.hidden = true;
  ribbon.innerHTML = '<span class="br-cloth">' + WEAVE_SVG + '</span>';
  wrap.appendChild(ribbon);

  let anchorId = null;
  let ro = null;
  let raf = 0;
  let H = 0;

  function withinWrapTop(el){
    return el.getBoundingClientRect().top - wrap.getBoundingClientRect().top;
  }
  function geom(){
    const el = document.getElementById(anchorId);
    if(!el) return null;
    const start = Math.max(0, withinWrapTop(content) - 6);
    const tip = withinWrapTop(el) + 20;
    return { start, height: Math.max(60, tip - start) };
  }
  function applyBox(g){
    ribbon.style.top = g.start + 'px';
    ribbon.style.height = g.height + 'px';
    H = g.height;
  }

  /* Muelle amortiguado: la punta arranca separada (A0 px, siempre la misma) y
     oscila de vuelta a la vertical. El ángulo se deriva de la longitud viva,
     así que basta con actualizar H al hacer scroll/resize para que se recalibre. */
  const A0 = 46;           // amplitud inicial de la punta (px) — fija, acota el arco
  const K = 0.045, C = 0.11;      // rigidez / amortiguación del péndulo
  const K2 = 0.05, C2 = 0.14;     // segundo muelle (retardo de la cola → skew)
  function paint(off, lag, energy){
    const h = Math.max(60, H);
    const ang = Math.asin(Math.max(-0.6, Math.min(0.6, off / h)));   // rad; acotado
    const skew = Math.max(-0.11, Math.min(0.11, (off - lag) * 0.006));// rad; late la cola
    const sy = 1 - 0.06 * energy;   // desenrolla al caer (leve estiramiento vertical)
    ribbon.style.transform =
      'rotate(' + ang.toFixed(4) + 'rad) skewX(' + skew.toFixed(4) + 'rad) scaleY(' + sy.toFixed(4) + ')';
  }
  function animate(){
    let off = A0, vel = 0, lag = A0, lagVel = 0;
    const loop = () => {
      vel += -K * off - C * vel;   off += vel;
      lagVel += -K2 * (lag - off) - C2 * lagVel;   lag += lagVel;
      paint(off, lag, Math.abs(off) / A0);
      if(Math.abs(off) > 0.15 || Math.abs(vel) > 0.15 || Math.abs(off - lag) > 0.3){
        raf = requestAnimationFrame(loop);
      } else { ribbon.style.transform = ''; raf = 0; }   // en reposo: perfectamente vertical
    };
    raf = requestAnimationFrame(loop);
  }

  /* Al hacer scroll/resize solo recolocamos la caja (top/H). Si hay una
     oscilación en curso, el ángulo se recalcula con la H nueva en el próximo
     frame; si está en reposo, sigue clavada y vertical. */
  function reposition(){
    if(!anchorId || ribbon.hidden) return;
    const g = geom();
    if(!g){ hide(); return; }
    applyBox(g);
  }

  ribbon.addEventListener('click', () => { if(anchorId) revealAnchor(anchorId); });

  function show(id, { animate: doAnim } = {}){
    anchorId = id;
    ribbon.hidden = false;
    const g = geom();
    if(!g){ hide(); return; }
    applyBox(g);
    if(raf){ cancelAnimationFrame(raf); raf = 0; }
    if(doAnim && !reduce) animate();
    else ribbon.style.transform = '';
    if(!ro){ ro = new ResizeObserver(reposition); ro.observe(content); }
    window.addEventListener('resize', reposition);
  }
  function hide(){
    anchorId = null;
    ribbon.hidden = true;
    ribbon.style.transform = '';
    if(raf){ cancelAnimationFrame(raf); raf = 0; }
    if(ro){ ro.disconnect(); ro = null; }
    window.removeEventListener('resize', reposition);
  }
  function destroy(){ hide(); ribbon.remove(); }

  return { show, hide, destroy, get anchor(){ return anchorId; } };
}

/* Fija el marcador en un artículo concreto (elegido por el usuario). */
export function markAnchor(temaId, anchor){
  if(!anchor) return null;
  save({ temaId, anchor, ts: Date.now() });
  return anchor;
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
  }
  return null;
}

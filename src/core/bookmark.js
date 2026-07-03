/* Marcador manual "marcapáginas de tela" (app de un solo usuario → localStorage).
   El usuario pulsa "Marcar aquí" y una cinta de paja trenzada CAE desde el
   borde superior de la página hasta el artículo visible, quedando clavada
   (cola de milano en la punta). Vuelve a pulsar y se recoge. El hub muestra
   además una tarjeta "seguir donde lo dejaste" que apunta al mismo marcador. */
import { temaById } from '../registry.js';
import { revealAnchor } from './panels.js';
import { config } from '../config.js';

const KEY = 'tai-bookmark';

/* Textura de paja trenzada (defs SVG): trama DIAGONAL (patternTransform rotate
   45), cada hilo con degradado 3D, valles oscuros y sombras en los cruces. Se
   usa como relleno del <path> de la cuerda (fill=url(#brStraw)). */
const WEAVE_DEFS = `
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
    </pattern>`;

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

/* ---------- la cinta de tela con física de cuerda (verlet de vértices) ----------
   16 vértices con gravedad + restricciones de segmento (verlet). El contorno de
   la cinta (banda + cola de milano) se dibuja como un <path> relleno con la
   trama; por frame SOLO se re-escribe el atributo `d` (16 puntos), sin capas de
   ruido ni clip-path (que era el coste que congelaba antes). Al soltar cae y
   ondula como una cuerda y se asienta recta; en reposo no hay bucle. */
const R_W = 56, R_CX = 30, R_HW = 14, R_NOTCH = 15, R_N = 16;

/* Tramo bézier suave (Catmull-Rom → cúbicas) que pasa por una lista de puntos.
   Asume que el llamante ya hizo el `M` sobre pp[0]. Es lo que da el aspecto
   FLEXIBLE: aunque los vértices se muevan poco, la curva se ve como tela, no
   como una polilínea angular. */
function bez(pp){
  let d = '';
  for(let i = 0; i < pp.length - 1; i++){
    const p0 = pp[i - 1] || pp[i], p1 = pp[i], p2 = pp[i + 1], p3 = pp[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ' C ' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1)
       + ' ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
  }
  return d;
}

/* Contorno de la cinta como banda FLEXIBLE: desplaza cada vértice ±R_HW por la
   perpendicular a la cuerda (así la banda sigue la curva), baja suave por el
   borde izquierdo, hace la cola de milano en la punta y sube suave por el
   derecho. Curvas bézier en ambos bordes → tela que se dobla, no palo. */
function ribbonPath(pts){
  const n = pts.length, hw = R_HW, left = [], right = [];
  for(let i = 0; i < n; i++){
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
    const nx = -ty, ny = tx;                       // perpendicular unitaria
    left.push({ x: pts[i].x + nx * hw, y: pts[i].y + ny * hw });
    right.push({ x: pts[i].x - nx * hw, y: pts[i].y - ny * hw });
  }
  const tip = pts[n - 1];
  let d = 'M ' + left[0].x.toFixed(1) + ' ' + left[0].y.toFixed(1);
  d += bez(left);                                  // borde izquierdo (suave)
  d += ' L ' + tip.x.toFixed(1) + ' ' + (tip.y - R_NOTCH).toFixed(1);   // muesca cola de milano
  d += ' L ' + right[n - 1].x.toFixed(1) + ' ' + right[n - 1].y.toFixed(1);
  d += bez(right.slice().reverse());               // borde derecho (suave, invertido)
  return d + ' Z';
}

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
  ribbon.innerHTML = '<svg class="br-svg" xmlns="http://www.w3.org/2000/svg"><defs>' + WEAVE_DEFS + '</defs>'
    + '<path class="br-shape" fill="url(#brStraw)"/></svg>';
  wrap.appendChild(ribbon);
  const svg = ribbon.querySelector('.br-svg');
  const shape = ribbon.querySelector('.br-shape');

  let anchorId = null;
  let ro = null;
  let raf = 0;
  let pts = [];
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
    svg.setAttribute('width', R_W);
    svg.setAttribute('height', g.height);
    svg.setAttribute('viewBox', '0 0 ' + R_W + ' ' + g.height);
  }
  function render(){ shape.setAttribute('d', ribbonPath(pts)); }
  function straightPts(h){
    const seg = h / (R_N - 1), out = [];
    for(let i = 0; i < R_N; i++) out.push({ x: R_CX, y: i * seg, ox: R_CX, oy: i * seg });
    return out;
  }

  /* Verlet: cuerda colgada del vértice 0 (fijo arriba), que cae por gravedad y
     se estira hasta H con restricciones de segmento (8 iteraciones) y
     amortiguación → onda de "látigo" que se asienta. */
  function step(){
    const seg = H / (R_N - 1);
    const grav = Math.min(11, Math.max(1, H / 300));
    for(let i = 1; i < R_N; i++){
      const p = pts[i];
      const vx = (p.x - p.ox) * 0.94, vy = (p.y - p.oy) * 0.94;   // menos amortiguación → ondula más
      p.ox = p.x; p.oy = p.y;
      p.x += vx; p.y += vy + grav;
    }
    pts[0].x = R_CX; pts[0].y = 0;
    for(let k = 0; k < 4; k++){   // restricciones más flojas → cuerda más flexible, no palo
      for(let i = 0; i < R_N - 1; i++){
        const a = pts[i], b = pts[i + 1];
        let dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const diff = (dist - seg) / dist;
        if(i === 0){ b.x -= dx * diff; b.y -= dy * diff; }
        else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
      }
      pts[0].x = R_CX; pts[0].y = 0;
    }
  }
  function animate(){
    let frames = 0;
    const loop = () => {
      step(); render(); frames++;
      let moving = 0;
      for(let i = 1; i < R_N; i++) moving += Math.abs(pts[i].x - pts[i].ox) + Math.abs(pts[i].y - pts[i].oy);
      if(frames < 240 && moving > 0.4){ raf = requestAnimationFrame(loop); }
      else { pts = straightPts(H); render(); raf = 0; }   // asentada: recta
    };
    raf = requestAnimationFrame(loop);
  }

  /* Al hacer scroll/resize solo recolocamos la caja; en reposo la cinta queda
     recta (no re-anima). */
  function reposition(){
    if(!anchorId || ribbon.hidden) return;
    const g = geom();
    if(!g){ hide(); return; }
    applyBox(g);
    if(!raf){ pts = straightPts(H); render(); }
  }

  ribbon.addEventListener('click', () => { if(anchorId) revealAnchor(anchorId); });

  function show(id, { animate: doAnim } = {}){
    anchorId = id;
    ribbon.hidden = false;
    const g = geom();
    if(!g){ hide(); return; }
    applyBox(g);
    if(raf){ cancelAnimationFrame(raf); raf = 0; }
    if(doAnim && !reduce){
      /* arranca colgando recta pero con una ONDA lateral (1,5 longitudes de onda
         que decae hacia la punta) + velocidad inicial → al soltarla ondula y se
         flexa como tela, en vez de quedarse tiesa. La amplitud se acota (no crece
         sin límite con la longitud) para que de lejos no dé el latigazo brusco. */
      pts = straightPts(H);
      const amp = Math.min(46, H * 0.42);
      for(let i = 0; i < R_N; i++){
        const t = i / (R_N - 1);
        const w = Math.sin(t * Math.PI * 1.5) * amp * (1 - 0.25 * t);
        pts[i].x += w;
        pts[i].ox = pts[i].x + w * 0.14;   // velocidad inicial lateral (la onda "viaja")
      }
      animate();
    } else {
      pts = straightPts(H); render();
    }
    if(!ro){ ro = new ResizeObserver(reposition); ro.observe(content); }
    window.addEventListener('resize', reposition);
  }
  function hide(){
    anchorId = null;
    ribbon.hidden = true;
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

/* Herramienta de SUBRAYADO de texto — vive entera en el SDK.
   El usuario activa la herramienta (🖍️ en la barra), selecciona texto y se
   subraya con el color activo. Paleta flotante ("chuleta") con varios colores
   y su SIGNIFICADO, configurable por el usuario. Cambiar de color = un clic;
   desactivar = ✕ / 🖍️ / Esc. Clic sobre un subrayado: lo recolorea (si hay otro
   color activo) o lo quita (si es el mismo).

   Persistencia: cada subrayado se ancla al elemento con `id` o `data-mark-id`
   más cercano y guarda los offsets de carácter [s,e) dentro de él. Como envolver
   texto en <mark> no cambia el nº de caracteres, los offsets son estables entre
   el DOM "marcado" (al guardar) y el DOM limpio (al reaplicar tras un render).
   Storage por tema en localStorage; se reaplica en cada render. */
import { registerLayer, registerExclusive } from './modal-stack.js';
import { esc } from './dom.js';

/* Iconos SVG (sustituyen a los emojis 🖍️/🧼, genéricos): rotulador para la
   herramienta y goma para borrar. Heredan color por currentColor. */
const SVG_MARKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4a2 2 0 0 1 2.8 0l5.2 5.2a2 2 0 0 1 0 2.8Z"/></svg>';
const SVG_ERASER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4L14 6l6 6-9 9Z"/><path d="M22 21H8"/><path d="m15 5 4 4"/></svg>';

const LS_COLORS = 'tai-hl-colors';
const LS_MARKS  = 'tai-highlights';
const LS_ACTIVE = 'tai-hl-active';

const DEFAULT_COLORS = [
  { key: 'imp', color: '#FFE066', label: 'Importante' },
  { key: 'def', color: '#9EE6A6', label: 'Definición' },
  { key: 'num', color: '#98D6F5', label: 'Plazo / número' },
  { key: 'exc', color: '#F7A8B8', label: 'Excepción / trampa' },
  { key: 'key', color: '#D9B8F2', label: 'Palabra clave' }
];

function readJSON(k, fb){ try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (_) { return fb; } }
function writeJSON(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

/* ---------------- colores / chuleta ---------------- */
export function getColors(){
  const c = readJSON(LS_COLORS, null);
  return (Array.isArray(c) && c.length) ? c : DEFAULT_COLORS.map(x => ({ ...x }));
}
export function setColors(list){
  writeJSON(LS_COLORS, list);
  if(!list.some(c => c.key === activeColor)) activeColor = list[0] ? list[0].key : 'imp';
  installColorStyles();
  updateSelStyle();
  renderPalette();
}
export function resetColors(){ writeJSON(LS_COLORS, null); setColors(getColors()); }

let activeColor = localStorage.getItem(LS_ACTIVE) || 'imp';
let eraseMode = false;
function colorByKey(key){ return getColors().find(c => c.key === key); }
export function getActiveColor(){ return activeColor; }
export function setActiveColor(key){
  activeColor = key; eraseMode = false;
  try { localStorage.setItem(LS_ACTIVE, key); } catch (_) {}
  document.body.classList.remove('hl-erase');
  updateSelStyle(); syncPalette();
}
function setEraseMode(v){ eraseMode = v; document.body.classList.toggle('hl-erase', v); updateSelStyle(); syncPalette(); }

/* Estilo del ::selection dentro del contenido: mientras arrastras, el texto se
   ve YA del color activo (efecto orgánico "se subraya conforme seleccionas");
   en modo goma, gris. Sustituye al azul del navegador. */
function updateSelStyle(){
  let st = document.getElementById('hlSelStyle');
  if(!st){ st = document.createElement('style'); st.id = 'hlSelStyle'; document.head.appendChild(st); }
  const bg = eraseMode ? 'rgba(110,110,110,.30)' : ((colorByKey(activeColor) || {}).color || '#FFE066');
  st.textContent = 'body.hl-on #temaContent ::selection{background:' + bg + ';color:inherit;}'
    + 'body.hl-on #temaContent ::-moz-selection{background:' + bg + ';color:inherit;}';
}

/* ---------------- storage de subrayados ---------------- */
function allMarks(){ return readJSON(LS_MARKS, {}); }
function marksFor(id){ const a = allMarks(); return a[id] || []; }
function saveMarks(id, list){ const a = allMarks(); if(list.length) a[id] = list; else delete a[id]; writeJSON(LS_MARKS, a); }

/* ---------------- estilos de color dinámicos ---------------- */
function installColorStyles(){
  let st = document.getElementById('hlColorStyles');
  if(!st){ st = document.createElement('style'); st.id = 'hlColorStyles'; document.head.appendChild(st); }
  st.textContent = getColors().map(c =>
    `mark.hl[data-c="${c.key}"]{background:${c.color};}\n.hl-sw[data-key="${c.key}"] .hl-dot{background:${c.color};}`
  ).join('\n');
}

/* ---------------- anclaje ---------------- */
function anchorFor(node, root){
  let el = node && node.nodeType === 3 ? node.parentElement : node;
  while(el && el !== document.body){
    if(el === root) break;
    if(el.id) return { el, t: 'id', a: el.id };
    if(el.dataset && el.dataset.markId != null) return { el, t: 'mark', a: el.dataset.markId };
    el = el.parentElement;
  }
  return { el: root, t: 'root', a: '' };   // fallback: texto sin id/data-mark-id → ancla al contenedor del tema
}
function findAnchor(root, t, a){
  if(t === 'root') return root;
  try {
    return t === 'id' ? root.querySelector('#' + CSS.escape(a))
                      : root.querySelector('[data-mark-id="' + CSS.escape(a) + '"]');
  } catch (_) { return null; }
}
function offsetTo(anchor, node, off){
  const r = document.createRange();
  r.selectNodeContents(anchor);
  try { r.setEnd(node, off); } catch (_) { return 0; }
  return r.toString().length;
}

/* Envuelve [s,e) del texto de `anchor` en <mark.hl data-c>. Trocea por nodo de
   texto; salta el texto ya dentro de un mark. */
function wrapRange(anchor, s, e, colorKey){
  if(e <= s) return;
  const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT, null);
  let pos = 0, node; const pieces = [];
  while((node = walker.nextNode())){
    const len = node.nodeValue.length;
    const start = pos, end = pos + len;
    const inMark = node.parentElement && node.parentElement.closest('mark.hl');
    if(!inMark && end > s && start < e){
      pieces.push({ node, from: Math.max(0, s - start), to: Math.min(len, e - start) });
    }
    pos = end;
    if(pos >= e) break;
  }
  for(let i = pieces.length - 1; i >= 0; i--){
    const { node, from, to } = pieces[i];
    if(to <= from) continue;
    const range = document.createRange();
    range.setStart(node, from); range.setEnd(node, to);
    const mark = document.createElement('mark');
    mark.className = 'hl'; mark.dataset.c = colorKey;
    try { range.surroundContents(mark); } catch (_) {}
  }
}

/* ---------------- reaplicar / serializar ---------------- */
export function applyHighlightsInto(root, temaId){
  if(!root) return;
  for(const m of marksFor(temaId)){
    const anchor = findAnchor(root, m.t, m.a);
    if(anchor) wrapRange(anchor, m.s, m.e, m.c);
  }
}

/* Re-lee TODOS los <mark.hl> del contenido y regenera el storage (única fuente
   de escritura tras cualquier cambio: añadir, quitar, recolorear). */
function serialize(){
  if(!temaRoot || !temaId) return;
  const list = [];
  temaRoot.querySelectorAll('mark.hl').forEach(mark => {
    const anch = anchorFor(mark, temaRoot);
    if(!anch) return;
    const r = document.createRange();
    r.selectNodeContents(anch.el);
    try { r.setEndBefore(mark); } catch (_) { return; }
    const s = r.toString().length;
    list.push({ t: anch.t, a: anch.a, s, e: s + mark.textContent.length, c: mark.dataset.c });
  });
  saveMarks(temaId, list);
}

/* ---------------- interacción ---------------- */
let temaRoot = null, temaId = null, on = false, suppressClick = false;

export function isHighlightOn(){ return on; }

function unwrap(mark){
  const p = mark.parentNode; if(!p) return;
  while(mark.firstChild) p.insertBefore(mark.firstChild, mark);
  p.removeChild(mark); p.normalize();
}
function eraseInRange(range){
  temaRoot.querySelectorAll('mark.hl').forEach(m => { if(range.intersectsNode(m)) unwrap(m); });
}

function onMouseDown(){ suppressClick = false; }
function onMouseUp(){
  if(!on) return;
  const sel = window.getSelection();
  if(!sel || sel.isCollapsed || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if(!temaRoot.contains(range.commonAncestorContainer)) return;
  if(eraseMode){                                 // goma: quita todo subrayado tocado por la selección
    eraseInRange(range); serialize(); sel.removeAllRanges(); suppressClick = true; return;
  }
  if(!sel.toString().replace(/\s+/g, '')) return;
  const anch = anchorFor(range.commonAncestorContainer, temaRoot);
  if(!anch) return;
  const o1 = offsetTo(anch.el, range.startContainer, range.startOffset);
  const o2 = offsetTo(anch.el, range.endContainer, range.endOffset);
  const s = Math.min(o1, o2), e = Math.max(o1, o2);
  if(e <= s) return;
  wrapRange(anch.el, s, e, activeColor);
  serialize();
  sel.removeAllRanges();
  suppressClick = true;   // el 'click' que sigue a la selección no debe tocar el subrayado
}
function onClick(e){
  if(suppressClick){ suppressClick = false; return; }
  if(!on) return;
  const mark = e.target.closest && e.target.closest('mark.hl');
  if(!mark) return;
  e.preventDefault(); e.stopPropagation();
  if(eraseMode || mark.dataset.c === activeColor) unwrap(mark);   // goma o mismo color → quitar
  else mark.dataset.c = activeColor;                              // otro color → recolorear
  serialize();
}

export function bindHighlighting(root, tId, { signal } = {}){
  temaRoot = root; temaId = tId;
  root.addEventListener('mousedown', onMouseDown, { signal });
  root.addEventListener('mouseup', onMouseUp, { signal });
  root.addEventListener('click', onClick, { capture: true, signal });
}

/* ---------------- activar / desactivar ---------------- */
let btnRef = null;
export function registerHighlightButton(btn){ btnRef = btn; syncButton(); }
function syncButton(){ if(btnRef){ btnRef.classList.toggle('on', on); btnRef.setAttribute('aria-pressed', on ? 'true' : 'false'); } }

export function activateHighlight(){
  if(hlExclusive) hlExclusive.activate();   // cierra el modo "colocar marcapáginas" si estaba
  on = true; document.body.classList.add('hl-on');
  updateSelStyle();
  if(palette){ palette.classList.remove('bar-out'); palette.hidden = false; renderPalette(); }   // barIn (CSS)
  syncButton();
}
export function deactivateHighlight(){
  on = false; eraseMode = false;
  document.body.classList.remove('hl-on', 'hl-erase');
  closeHlSettings();
  syncButton();
  /* salida animada: desliza hacia abajo y luego se oculta (a menos que se
     reactive durante la animación). */
  if(palette && !palette.hidden){
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(reduce){ palette.hidden = true; return; }
    palette.classList.add('bar-out');
    const done = () => {
      palette.removeEventListener('animationend', done);
      palette.classList.remove('bar-out');
      if(!on) palette.hidden = true;
    };
    palette.addEventListener('animationend', done);
  }
}
export function toggleHighlight(){ on ? deactivateHighlight() : activateHighlight(); }

/* ---------------- paleta flotante ("chuleta") ---------------- */
let palette = null;
let hlExclusive = null;
function renderPalette(){
  if(!palette) return;
  const colors = getColors();
  palette.innerHTML =
    '<span class="hl-cap" aria-hidden="true">' + SVG_MARKER + '</span>'
    + colors.map(c => `<button class="hl-sw${!eraseMode && c.key === activeColor ? ' on' : ''}" type="button" data-key="${c.key}" title="${esc(c.label)}"><span class="hl-dot"></span><span class="hl-lbl">${esc(c.label)}</span></button>`).join('')
    + `<button class="hl-sw hl-eraser${eraseMode ? ' on' : ''}" type="button" data-act="erase" title="Goma de borrar"><span class="hl-eico" aria-hidden="true">${SVG_ERASER}</span><span class="hl-lbl">Borrar</span></button>`
    + '<span class="hl-sep"></span>'
    + '<button class="hl-act" type="button" data-act="settings" title="Configurar colores">⚙</button>'
    + '<button class="hl-act" type="button" data-act="off" title="Desactivar (Esc)">✕</button>';
}
function syncPalette(){
  if(!palette) return;
  palette.querySelectorAll('.hl-sw').forEach(b => {
    if(b.dataset.act === 'erase') b.classList.toggle('on', eraseMode);
    else b.classList.toggle('on', !eraseMode && b.dataset.key === activeColor);
  });
}

export function mountHighlight(shell){
  installColorStyles();
  shell.insertAdjacentHTML('beforeend', '<div id="hlPalette" class="hl-palette" role="toolbar" aria-label="Subrayado" hidden></div>');
  palette = shell.querySelector('#hlPalette');
  renderPalette();
  palette.addEventListener('click', (e) => {
    const sw = e.target.closest('.hl-sw');
    if(sw){ sw.dataset.act === 'erase' ? setEraseMode(true) : setActiveColor(sw.dataset.key); return; }
    const act = e.target.closest('.hl-act');
    if(!act) return;
    if(act.dataset.act === 'off') deactivateHighlight();
    else if(act.dataset.act === 'settings') openHlSettings();
  });
  mountHlSettings(shell);
  registerLayer({ isOpen: () => on, close: deactivateHighlight, priority: 20 });
  hlExclusive = registerExclusive({ isOpen: () => on, close: deactivateHighlight });
}

/* ---------------- panel de ajustes (editar la chuleta) ---------------- */
let hlPanel = null;
function paletteRow(c){
  return `<div class="hl-set-row" data-key="${c.key}">
    <input class="hl-set-color" type="color" value="${c.color}" aria-label="Color">
    <input class="hl-set-label" type="text" value="${esc(c.label)}" placeholder="Significado" aria-label="Significado">
    <button class="hl-set-del" type="button" title="Quitar color" aria-label="Quitar color">✕</button>
  </div>`;
}
function renderHlSettings(){
  if(!hlPanel) return;
  hlPanel.querySelector('#hlSetList').innerHTML = getColors().map(paletteRow).join('');
}
function readHlSettings(){
  const rows = [...hlPanel.querySelectorAll('.hl-set-row')];
  return rows.map(r => ({
    key: r.dataset.key,
    color: r.querySelector('.hl-set-color').value,
    label: r.querySelector('.hl-set-label').value.trim() || 'Sin nombre'
  }));
}
function mountHlSettings(shell){
  shell.insertAdjacentHTML('beforeend', `
<div id="hlSettings" class="bks-panel" role="dialog" aria-label="Colores de subrayado">
  <div class="bks-head">
    <span class="bks-title">🖍️ Colores de subrayado</span>
    <button class="bks-close" type="button" aria-label="Cerrar">✕</button>
  </div>
  <div class="bks-body">
    <p class="bks-label">Cada color con su significado. Cambia el color y su nombre; se aplican al instante.</p>
    <div id="hlSetList" class="hl-set-list"></div>
    <div class="hl-set-actions">
      <button id="hlSetAdd" class="btn small" type="button">＋ Añadir color</button>
      <button id="hlSetReset" class="btn small" type="button">Restaurar</button>
    </div>
    <p class="bks-hint">Los subrayados que ya tengas conservan su color aunque cambies el significado.</p>
  </div>
</div>`);
  hlPanel = shell.querySelector('#hlSettings');
  renderHlSettings();
  hlPanel.querySelector('.bks-close').addEventListener('click', closeHlSettings);
  hlPanel.addEventListener('input', () => setColors(readHlSettings()));
  hlPanel.querySelector('#hlSetList').addEventListener('click', (e) => {
    const del = e.target.closest('.hl-set-del');
    if(!del) return;
    if(getColors().length <= 1) return;
    del.closest('.hl-set-row').remove();
    setColors(readHlSettings());
  });
  hlPanel.querySelector('#hlSetAdd').addEventListener('click', () => {
    const list = readHlSettings();
    list.push({ key: 'u' + Date.now().toString(36), color: '#F2C94C', label: 'Nuevo' });
    setColors(list); renderHlSettings();
  });
  hlPanel.querySelector('#hlSetReset').addEventListener('click', () => { resetColors(); renderHlSettings(); });
  registerLayer({ isOpen: () => hlPanel.classList.contains('open'), close: closeHlSettings, priority: 26 });
}
export function openHlSettings(){ if(hlPanel){ renderHlSettings(); hlPanel.classList.add('open'); } }
export function closeHlSettings(){ if(hlPanel) hlPanel.classList.remove('open'); }

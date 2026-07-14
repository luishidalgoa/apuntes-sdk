/* "Plan de estudio": árbol GLOBAL del temario con la PRIORIDAD (baja/media/alta)
   de cada nodo, colapsable y editable in situ (clic cicla). La jerarquía de cada
   tema se extrae de su contenido real: Materia › Tema › Sección › Subpunto.
   - Sección = cabecera de apartado (.apartado-head) o banda numerada (.band).
   - Subpunto = tarjeta (.card) o bloque de artículo (.art-block) que sigue a una
     sección (por ORDEN de documento; en el DOM no están anidados).
   Overlay SPA (no cambia de ruta). Comparte storage con el marcador del
   contenido (marks.js), así que marcar aquí se refleja en el tema y viceversa. */
import { allTemas, materiasWithTemas, hasMaterias } from '../registry.js';
import { levelsMap, cycleTemaLevel, cycleMark, TEMA_MARK_KEY } from './marks.js';
import { registerLayer } from './modal-stack.js';
import { esc } from './dom.js';

let overlay = null, sheet = null, body = null;
let struct = null;           // estructura cacheada (jerarquía por tema)
let filterMin = 0;           // nivel mínimo visible (0 = todo)
const collapsed = new Set(); // claves de grupos plegados; persiste entre re-renders
const caretGlyph = (key) => collapsed.has(key) ? '▸' : '▾';

const BARS = '<span class="mk-bars"><i></i><i></i><i></i></span>';
const LNAME = { 1: 'baja', 2: 'media', 3: 'alta' };
const btnTitle = (lv) => lv ? ('Prioridad ' + LNAME[lv] + ' · clic para cambiar') : 'Sin prioridad · clic: baja › media › alta';
const NODE_SEL = '.apartado-head[id], .band[id], .card[data-mark-id], .art-block[id]';

/* Etiqueta (numeral + título) de un nodo markable según su tipo. */
function labelOf(n){
  if(n.matches('.card[data-mark-id]')){
    const name = n.querySelector('.card-head .name');
    const secn = name && name.querySelector('.secn');
    let title = name ? name.textContent.trim() : '';
    if(secn) title = title.replace(secn.textContent, '').trim();
    return { kind: 'sub', id: n.getAttribute('data-mark-id'), num: secn ? secn.textContent.trim() : '', title: title || n.getAttribute('data-mark-id') };
  }
  if(n.matches('.apartado-head[id]')){
    return { kind: 'section', id: n.id, num: ((n.querySelector('.apn') || {}).textContent || '').trim(), title: ((n.querySelector('h2') || {}).textContent || n.id).trim() };
  }
  if(n.matches('.band[id]')){
    return { kind: 'section', id: n.id, num: ((n.querySelector('.rom') || {}).textContent || '').trim(), title: ((n.querySelector('h2') || {}).textContent || n.id).trim() };
  }
  // .art-block
  return { kind: 'sub', id: n.id, num: '', title: ((n.querySelector('.art-block-head') || {}).textContent || n.id).trim().replace(/\s+/g, ' ').slice(0, 70) };
}

/* Extrae la jerarquía de cada tema renderizando su contenido en un div
   desconectado (como el índice de búsqueda). Se cachea (no cambia en runtime). */
function buildStructure(){
  if(struct) return struct;
  struct = allTemas().map((t, i) => {
    const num = (String(t.k || '').match(/Tema\s+(\d+)/i) || [])[1] || String(i + 1);
    let nodes = [];
    try {
      const box = document.createElement('div');
      t.renderContent(box);
      // Pila de 2 niveles de sección: apartado (nivel 1) › banda (nivel 2) › card.
      let apartado = null, band = null;
      [...box.querySelectorAll(NODE_SEL)].forEach(n => {
        const info = { ...labelOf(n), children: [] };
        if(n.matches('.apartado-head[id]')){ apartado = info; band = null; nodes.push(info); }
        else if(n.matches('.band[id]')){ band = info; (apartado ? apartado.children : nodes).push(info); }
        else { const parent = band || apartado; (parent ? parent.children : nodes).push(info); }  // card/art-block
      });
    } catch(e){}
    return { id: t.id, num, titulo: t.titulo || t.id, nodes };
  });
  // Por defecto las secciones (con hijos) nacen PLEGADAS: el árbol es grande, así
  // se ve Materia › Tema › Sección y se despliega cada una para sus puntos. Un
  // tema SIN secciones (lista plana de tarjetas, p.ej. leg-tema1 con sus 55
  // artículos) nace plegado a nivel de tema para no volcarlo entero. Solo la
  // primera vez (luego el Set refleja lo que abra/cierre el usuario).
  const seed = (temaId, n) => {
    if((n.children || []).length && n.kind === 'section') collapsed.add('x:' + temaId + '/' + n.id);
    (n.children || []).forEach(c => seed(temaId, c));
  };
  struct.forEach(t => {
    t.nodes.forEach(n => seed(t.id, n));
    if(!t.nodes.some(n => n.kind === 'section')) collapsed.add('t:' + t.id);
  });
  return struct;
}

/* Conteo {alta, media} de un conjunto de ids según el storage del tema. */
function countIds(map, ids){
  let alta = 0, media = 0;
  ids.forEach(id => { const lv = map[id] || 0; if(lv === 3) alta++; else if(lv === 2) media++; });
  return { alta, media };
}
/* Todos los ids del subárbol de un nodo (incluido él). */
function walkIds(node, acc){ acc.push(node.id); (node.children || []).forEach(c => walkIds(c, acc)); return acc; }
/* Roll-up de una rama: sus DESCENDIENTES marcados (sin contarse a sí misma). */
function branchCounts(map, node){ return countIds(map, walkIds(node, []).filter(id => id !== node.id)); }
function branchMax(map, node){ return Math.max(...walkIds(node, []).map(id => map[id] || 0), 0); }
/* Roll-up del tema: su propio nivel + todos sus nodos (recursivo). */
function temaCounts(tema, map){
  const ids = [TEMA_MARK_KEY];
  tema.nodes.forEach(n => walkIds(n, ids));
  return countIds(map, ids);
}

function rollupHtml(alta, media){
  if(!alta && !media) return '';
  return '<span class="sp-roll">'
    + (alta ? '<span class="sp-roll-n" data-level="3">' + alta + '</span>' : '')
    + (media ? '<span class="sp-roll-n" data-level="2">' + media + '</span>' : '')
    + '</span>';
}
const setBtn = (scope, temaId, id, lv) =>
  '<button class="mk-set mark-btn" type="button" data-scope="' + scope + '" data-tema="' + esc(temaId) + '"'
  + (id ? ' data-id="' + esc(id) + '"' : '') + ' data-level="' + lv + '" title="' + btnTitle(lv) + '" aria-label="Prioridad">' + BARS + '</button>';
const labelText = (o) => (o.num ? '<span class="sp-n">' + esc(o.num) + '</span> ' : '') + esc(o.title);

/* Fila de un nodo (recursivo): hoja si no tiene hijos; rama colapsable si los
   tiene. Sirve para secciones (banda/apartado) y subpuntos (card/art-block). */
function nodeHtml(temaId, o, map){
  const lv = map[o.id] || 0;
  const kids = o.children || [];
  const isSec = o.kind === 'section';
  if(!kids.length){
    const hide = filterMin && lv < filterMin ? ' sp-hidden' : '';
    return '<div class="sp-row ' + (isSec ? 'sp-sec' : 'sp-sub') + hide + '" data-level="' + lv + '">'
      + '<span class="sp-indent"></span>'
      + '<span class="sp-label' + (isSec ? ' sp-sec-label' : '') + '">' + labelText(o) + '</span>'
      + setBtn('node', temaId, o.id, lv) + '</div>';
  }
  const c = branchCounts(map, o);
  const hide = filterMin && branchMax(map, o) < filterMin ? ' sp-hidden' : '';
  const key = 'x:' + temaId + '/' + o.id;
  const col = collapsed.has(key) ? ' collapsed' : '';
  return '<div class="sp-group sp-sec-group' + hide + col + '" data-key="' + esc(key) + '">'
    + '<div class="sp-row sp-sec" data-level="' + lv + '">'
    +   '<button class="sp-caret" type="button" aria-label="Plegar/desplegar">' + caretGlyph(key) + '</button>'
    +   '<span class="sp-label sp-sec-label">' + labelText(o) + '</span>'
    +   rollupHtml(c.alta, c.media)
    +   setBtn('node', temaId, o.id, lv)
    + '</div>'
    + '<div class="sp-children">' + kids.map(k => nodeHtml(temaId, k, map)).join('') + '</div>'
    + '</div>';
}

function temaHtml(tema){
  const map = levelsMap(tema.id);
  const tLv = map[TEMA_MARK_KEY] || 0;
  const c = temaCounts(tema, map);
  const inner = tema.nodes.map(n => nodeHtml(tema.id, n, map)).join('');
  const maxChild = Math.max(tLv, ...tema.nodes.map(n => branchMax(map, n)), 0);
  const hide = filterMin && maxChild < filterMin ? ' sp-hidden' : '';
  const hasNodes = tema.nodes.length > 0;
  const key = 't:' + tema.id;
  const col = collapsed.has(key) ? ' collapsed' : '';
  return '<div class="sp-group sp-tema-group' + hide + col + '" data-key="' + esc(key) + '">'
    + '<div class="sp-row sp-tema" data-level="' + tLv + '">'
    +   (hasNodes ? '<button class="sp-caret" type="button" aria-label="Plegar/desplegar">' + caretGlyph(key) + '</button>' : '<span class="sp-indent"></span>')
    +   '<a class="sp-label sp-tema-label" href="#/tema/' + esc(tema.id) + '">Tema ' + esc(tema.num) + ' · ' + esc(tema.titulo) + '</a>'
    +   rollupHtml(c.alta, c.media)
    +   setBtn('tema', tema.id, '', tLv)
    + '</div>'
    + (hasNodes ? '<div class="sp-children">' + inner + '</div>' : '')
    + '</div>';
}

function buildTree(){
  const s = buildStructure();
  const byId = new Map(s.map(t => [t.id, t]));
  let html = '';
  if(hasMaterias()){
    materiasWithTemas().forEach(m => {
      const temas = m.temas.map(t => byId.get(t.id)).filter(Boolean);
      const inner = temas.map(temaHtml).join('');
      const tot = temas.reduce((a, t) => { const c = temaCounts(t, levelsMap(t.id)); a.alta += c.alta; a.media += c.media; return a; }, { alta: 0, media: 0 });
      const mkey = 'm:' + m.id;
      html += '<div class="sp-group sp-mat-group' + (collapsed.has(mkey) ? ' collapsed' : '') + '" data-key="' + esc(mkey) + '" style="--sp-accent:' + esc(m.accent || 'var(--ink)') + '">'
        + '<div class="sp-row sp-mat">'
        +   '<button class="sp-caret" type="button" aria-label="Plegar/desplegar">' + caretGlyph(mkey) + '</button>'
        +   '<span class="sp-label sp-mat-label">' + esc(m.label) + '</span>'
        +   rollupHtml(tot.alta, tot.media)
        + '</div>'
        + '<div class="sp-children">' + inner + '</div></div>';
    });
  } else {
    html = s.map(temaHtml).join('');
  }
  return html || '<p class="sp-empty">No hay temas.</p>';
}

function render(){
  body.innerHTML =
    '<div class="sp-toolbar">'
    + '<span class="sp-lede">Marca la prioridad de cada tema, sección y punto; pliega o filtra para ver antes lo importante.</span>'
    + '<div class="sp-filter" role="group" aria-label="Filtrar por prioridad">'
    +   '<button type="button" data-min="0"' + (filterMin === 0 ? ' class="on"' : '') + '>Todo</button>'
    +   '<button type="button" data-min="2"' + (filterMin === 2 ? ' class="on"' : '') + '>≥ Media</button>'
    +   '<button type="button" data-min="3"' + (filterMin === 3 ? ' class="on"' : '') + '>Solo alta</button>'
    + '</div></div>'
    + '<div class="sp-tree">' + buildTree() + '</div>';
}

/* ---------------- overlay ---------------- */
export function mountStudyPlan(shell){
  shell.insertAdjacentHTML('beforeend', `
<div id="planOverlay" role="dialog" aria-modal="true" aria-label="Plan de estudio">
  <div class="plan-sheet">
    <button class="plan-grip" type="button" aria-label="Arrastra para cerrar"></button>
    <div class="plan-head">
      <span class="plan-title">📋 Plan de estudio</span>
      <button class="plan-close" type="button" aria-label="Cerrar">✕</button>
    </div>
    <div class="plan-body" id="planBody"></div>
  </div>
</div>`);
  overlay = shell.querySelector('#planOverlay');
  sheet = overlay.querySelector('.plan-sheet');
  body = overlay.querySelector('#planBody');
  overlay.querySelector('.plan-close').addEventListener('click', closeStudyPlan);
  overlay.addEventListener('click', (e) => { if(e.target === overlay) closeStudyPlan(); });
  installGrip(overlay.querySelector('.plan-grip'), sheet);
  registerLayer({ isOpen: () => overlay.classList.contains('open'), close: closeStudyPlan, priority: 35 });

  body.addEventListener('click', (e) => {
    const caret = e.target.closest('.sp-caret');
    if(caret){
      const g = caret.closest('.sp-group'), k = g.getAttribute('data-key');
      const now = g.classList.toggle('collapsed');
      if(now) collapsed.add(k); else collapsed.delete(k);
      caret.textContent = now ? '▸' : '▾';
      return;
    }
    const set = e.target.closest('.mk-set');
    if(set){
      e.preventDefault();
      const temaId = set.getAttribute('data-tema');
      set.getAttribute('data-scope') === 'tema' ? cycleTemaLevel(temaId) : cycleMark(temaId, set.getAttribute('data-id'));
      const scrollTop = body.scrollTop; render(); body.scrollTop = scrollTop;   // repinta (roll-ups + filtro)
      return;
    }
    const label = e.target.closest('.sp-label[href]');
    if(label){ closeStudyPlan(); /* el href (#/…) navega solo */ return; }
    const f = e.target.closest('.sp-filter button');
    if(f){ filterMin = parseInt(f.getAttribute('data-min'), 10) || 0; render(); }
  });
}

export function openStudyPlan(){
  if(!overlay) return;
  render();
  sheet.style.transform = '';
  overlay.classList.add('open');
}
export function closeStudyPlan(){
  if(overlay) overlay.classList.remove('open');
  if(sheet) sheet.style.transform = '';
}

/* bottom-sheet arrastrable en móvil (grip). En escritorio es modal centrado. */
function installGrip(grip, card){
  if(!grip) return;
  let startY = 0, dy = 0, dragging = false;
  const down = (e) => { dragging = true; startY = e.clientY; dy = 0; card.style.transition = 'none'; try{ grip.setPointerCapture(e.pointerId); }catch(_){ } };
  const move = (e) => { if(!dragging) return; dy = e.clientY - startY; card.style.transform = 'translateY(' + (dy >= 0 ? dy : -Math.min(46, Math.log1p(-dy) * 20)) + 'px)'; };
  const up = (e) => { if(!dragging) return; dragging = false; card.style.transition = ''; try{ grip.releasePointerCapture(e.pointerId); }catch(_){ } if(Math.abs(dy) > 90) closeStudyPlan(); else card.style.transform = ''; };
  grip.addEventListener('pointerdown', down);
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up);
  grip.addEventListener('pointercancel', up);
  grip.addEventListener('click', (e) => e.preventDefault());
}

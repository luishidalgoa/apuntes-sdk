/* "Plan de estudio": árbol GLOBAL del temario (Materia › Tema › Apartado) con la
   PRIORIDAD de cada nodo (baja/media/alta), colapsable y editable in situ (clic
   cicla). Filtro por nivel manteniendo el orden del temario. Overlay SPA (no
   cambia de ruta). Las prioridades salen del mismo storage que el marcador de
   importancia del contenido (marks.js). */
import { allTemas, materiasWithTemas, hasMaterias } from '../registry.js';
import { levelsMap, cycleTemaLevel, cycleMark, TEMA_MARK_KEY } from './marks.js';
import { registerLayer } from './modal-stack.js';
import { esc } from './dom.js';

let overlay = null, sheet = null, body = null;
let struct = null;          // estructura cacheada (apartados por tema)
let filterMin = 0;          // nivel mínimo visible (0 = todo)
const collapsed = new Set();// claves de grupos plegados (m:<id> · t:<id>), persiste entre re-renders
const caretGlyph = (key) => collapsed.has(key) ? '▸' : '▾';

const BARS = '<span class="mk-bars"><i></i><i></i><i></i></span>';
const LNAME = { 1: 'baja', 2: 'media', 3: 'alta' };
const btnTitle = (lv) => lv ? ('Prioridad ' + LNAME[lv] + ' · clic para cambiar') : 'Sin prioridad · clic: baja › media › alta';

/* Extrae los apartados de cada tema renderizando su contenido en un div
   desconectado (como el índice de búsqueda: sin cargar imágenes ni animar).
   Se cachea: el contenido no cambia en runtime. */
function buildStructure(){
  if(struct) return struct;
  struct = allTemas().map((t, i) => {
    const num = (String(t.k || '').match(/Tema\s+(\d+)/i) || [])[1] || String(i + 1);
    let apartados = [];
    try {
      const box = document.createElement('div');
      t.renderContent(box);
      apartados = [...box.querySelectorAll('.apartado-head[id]')].map(h => ({
        id: h.id, title: ((h.querySelector('h2') || {}).textContent || h.id).trim()
      }));
    } catch(e){}
    return { id: t.id, num, titulo: t.titulo || t.id, apartados };
  });
  return struct;
}

/* Cuenta {alta, media} de los descendientes de un tema (su propio nivel + el de
   sus apartados) para el resumen (roll-up) del padre. */
function temaCounts(tema){
  const map = levelsMap(tema.id);
  let alta = 0, media = 0;
  const bump = (lv) => { if(lv === 3) alta++; else if(lv === 2) media++; };
  bump(map[TEMA_MARK_KEY] || 0);
  tema.apartados.forEach(a => bump(map[a.id] || 0));
  return { alta, media };
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

/* HTML de un tema con sus apartados. `visible`: pasa el filtro (nivel mínimo). */
function temaHtml(tema, matAccent){
  const map = levelsMap(tema.id);
  const tLv = map[TEMA_MARK_KEY] || 0;
  const c = temaCounts(tema);
  const aps = tema.apartados.map(a => {
    const lv = map[a.id] || 0;
    const hide = filterMin && lv < filterMin ? ' sp-hidden' : '';
    return '<div class="sp-row sp-ap' + hide + '" data-level="' + lv + '">'
      + '<span class="sp-indent"></span>'
      + '<a class="sp-label" href="#/tema/' + esc(tema.id) + '/' + esc(a.id) + '">' + esc(a.title) + '</a>'
      + setBtn('ap', tema.id, a.id, lv) + '</div>';
  }).join('');
  const maxChild = Math.max(tLv, ...tema.apartados.map(a => map[a.id] || 0), 0);
  const temaHidden = filterMin && maxChild < filterMin ? ' sp-hidden' : '';
  const hasAps = tema.apartados.length > 0;
  const key = 't:' + tema.id;
  const col = collapsed.has(key) ? ' collapsed' : '';
  return '<div class="sp-group sp-tema-group' + temaHidden + col + '" data-key="' + esc(key) + '">'
    + '<div class="sp-row sp-tema" data-level="' + tLv + '">'
    +   (hasAps ? '<button class="sp-caret" type="button" aria-label="Plegar/desplegar">' + caretGlyph(key) + '</button>' : '<span class="sp-indent"></span>')
    +   '<a class="sp-label sp-tema-label" href="#/tema/' + esc(tema.id) + '">Tema ' + esc(tema.num) + ' · ' + esc(tema.titulo) + '</a>'
    +   rollupHtml(c.alta, c.media)
    +   setBtn('tema', tema.id, '', tLv)
    + '</div>'
    + (hasAps ? '<div class="sp-children">' + aps + '</div>' : '')
    + '</div>';
}

function buildTree(){
  const s = buildStructure();
  const byId = new Map(s.map(t => [t.id, t]));
  let html = '';
  if(hasMaterias()){
    materiasWithTemas().forEach(m => {
      const temas = m.temas.map(t => byId.get(t.id)).filter(Boolean);
      const inner = temas.map(t => temaHtml(t, m.accent)).join('');
      const tot = temas.reduce((acc, t) => { const c = temaCounts(t); acc.alta += c.alta; acc.media += c.media; return acc; }, { alta: 0, media: 0 });
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
    html = s.map(t => temaHtml(t, null)).join('');
  }
  return html || '<p class="sp-empty">No hay temas.</p>';
}

function render(){
  body.innerHTML =
    '<div class="sp-toolbar">'
    + '<span class="sp-lede">Marca la prioridad de cada tema y apartado; filtra para ver antes lo importante.</span>'
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
      const lv = set.getAttribute('data-scope') === 'tema' ? cycleTemaLevel(temaId) : cycleMark(temaId, set.getAttribute('data-id'));
      // repintar (recalcula roll-ups y filtro)
      const scrollTop = body.scrollTop; render(); body.scrollTop = scrollTop;
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

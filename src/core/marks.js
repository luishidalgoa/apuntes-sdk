/* Marcar IMPORTANCIA de bloques de contenido, en 3 NIVELES (app de un solo
   usuario → localStorage). Genérico: funciona sobre tarjetas (.card), bloques de
   sección (.art-block) y bandas/títulos (.band[id]). Cada bloque marcable expone
   un id estable por tema: en tarjetas `data-mark-id` (lo pone renderCard), en
   bloques y bandas el propio `id`.
   Niveles: 1=baja (verde) · 2=media (ámbar) · 3=alta (rojo). Clic cicla
   off→1→2→3→off. Estado: { temaId: { id: nivel } }. */

const KEY = 'tai-marks';
const MAX = 3;
const LEVEL_NAMES = { 1: 'baja', 2: 'media', 3: 'alta' };

function readAll(){ try{ return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }catch(e){ return {}; } }
function writeAll(o){ try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){} }

/* Devuelve el mapa { id: nivel } del tema. MIGRA el formato antiguo
   ({ temaId: [ids] } booleano) a niveles: los marcados pasan a "alta" (3), que
   es lo que significaban. Se reescribe la primera vez que se lee ese tema. */
function levelsOf(temaId){
  const all = readAll();
  const v = all[temaId];
  if(Array.isArray(v)){
    const map = {}; v.forEach(id => { map[id] = 3; });
    all[temaId] = map; writeAll(all);
    return map;
  }
  return v || {};
}

export function markLevel(temaId, id){ return levelsOf(temaId)[id] || 0; }
export function markedIds(temaId){ return new Set(Object.keys(levelsOf(temaId))); }
export function isMarked(temaId, id){ return markLevel(temaId, id) > 0; }

/* Cicla el nivel del bloque: off→1→2→3→off. Devuelve el nuevo nivel (0..3). */
export function cycleMark(temaId, id){
  const all = readAll();
  let map = all[temaId];
  if(Array.isArray(map)){ const m = {}; map.forEach(x => { m[x] = 3; }); map = m; }
  map = map || {};
  const next = ((map[id] || 0) + 1) % (MAX + 1);
  if(next === 0) delete map[id]; else map[id] = next;
  all[temaId] = map; writeAll(all);
  return next;
}
/* compat: toggle → cicla (no lo usa la app). */
export function toggleMark(temaId, id){ return cycleMark(temaId, id) > 0; }

function levelTitle(level){
  return level ? ('Importancia: ' + LEVEL_NAMES[level] + ' · clic para cambiar')
               : 'Marcar importancia · clic: baja › media › alta';
}
/* Botón indicador: 3 barras que se rellenan y colorean según el nivel (el CSS lo
   pinta con var(--mk) por severidad). */
const BARS = '<span class="mk-bars"><i></i><i></i><i></i></span>';
export function markButton(id, level = 0){
  return '<button class="mark-btn" type="button" data-mark="' + id + '" data-level="' + level + '"'
    + ' aria-label="Importancia" title="' + levelTitle(level) + '">' + BARS + '</button>';
}

function applyLevel(btn, block, level){
  btn.setAttribute('data-level', level);
  btn.setAttribute('aria-label', 'Importancia' + (level ? ': ' + LEVEL_NAMES[level] : ''));
  btn.title = levelTitle(level);
  if(block){
    if(level) block.setAttribute('data-mark-level', level);
    else block.removeAttribute('data-mark-level');
  }
}

/* Coloca los indicadores en cada bloque marcable, aplica el estado guardado y
   delega los clics (ciclo). Idempotente: no duplica (marca con data-marked). */
export function bindMarks(root, temaId, { signal } = {}){
  const levels = levelsOf(temaId);
  const place = (block, host, id, where) => {
    host.insertAdjacentHTML(where, markButton(id));
    const btn = where === 'beforeend' ? host.lastElementChild : host.firstElementChild;
    applyLevel(btn, block, levels[id] || 0);
  };

  root.querySelectorAll('.card[data-mark-id]:not([data-marked])').forEach(c => {
    c.setAttribute('data-marked', '');
    const row = c.querySelector('.card-head .row1') || c.querySelector('.card-head');
    if(row) place(c, row, c.getAttribute('data-mark-id'), 'afterbegin');
  });
  root.querySelectorAll('.art-block[id]:not([data-marked])').forEach(a => {
    a.setAttribute('data-marked', '');
    const head = a.querySelector('.art-block-head');
    if(head) place(a, head, a.id, 'afterbegin');
  });
  root.querySelectorAll('.band[id]:not([data-marked])').forEach(b => {
    b.setAttribute('data-marked', '');
    place(b, b, b.id, 'beforeend');   // esquina sup. derecha (CSS)
  });
  /* Apartados intra-tema (cabecera .apartado-head con id): también marcables. */
  root.querySelectorAll('.apartado-head[id]:not([data-marked])').forEach(h => {
    h.setAttribute('data-marked', '');
    place(h, h, h.id, 'beforeend');   // esquina sup. derecha (CSS)
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.mark-btn');
    if(!btn) return;
    e.preventDefault(); e.stopPropagation();
    const level = cycleMark(temaId, btn.getAttribute('data-mark'));
    applyLevel(btn, btn.closest('.card, .art-block, .band, .apartado-head'), level);
  }, { signal });
}

/* Nivel de importancia del TEMA entero (clave reservada `__tema__`). Se fija
   desde la vista de Plan de estudio; se muestra en la tarjeta del tema. */
const TEMA_KEY = '__tema__';
export function temaLevel(temaId){ return levelsOf(temaId)[TEMA_KEY] || 0; }
export function cycleTemaLevel(temaId){ return cycleMark(temaId, TEMA_KEY); }

/* Mapa completo { id: nivel } de un tema (para el árbol de prioridades). */
export function levelsMap(temaId){ return { ...levelsOf(temaId) }; }
export const TEMA_MARK_KEY = TEMA_KEY;

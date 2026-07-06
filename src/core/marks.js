/* "Marcar como importante" bloques de contenido (app de un solo usuario →
   localStorage). Genérico: funciona sobre tarjetas (.card), bloques de sección
   (.art-block) y bandas/títulos (.band[id]). Cada bloque marcable expone un id
   estable por tema: en tarjetas `data-mark-id` (lo pone renderCard), en bloques
   y bandas el propio `id` del elemento. En legislación eso es un artículo, una
   sección o un título. Estado guardado como { temaId: [ids…] }. */

const KEY = 'tai-marks';

function readAll(){ try{ return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }catch(e){ return {}; } }
function writeAll(o){ try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){} }

export function markedIds(temaId){ return new Set(readAll()[temaId] || []); }
export function isMarked(temaId, id){ return markedIds(temaId).has(id); }
export function toggleMark(temaId, id){
  const all = readAll(); const list = all[temaId] || [];
  const i = list.indexOf(id);
  if(i >= 0) list.splice(i, 1); else list.push(id);
  all[temaId] = list; writeAll(all);
  return i < 0;   // true = ahora está marcado
}

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';
export function markButton(id){
  return '<button class="mark-btn" type="button" data-mark="' + id
    + '" aria-label="Marcar como importante" title="Marcar como importante">' + STAR + '</button>';
}

/* Coloca las estrellas en cada bloque marcable, aplica el estado guardado y
   delega los clics (toggle). Idempotente: no duplica estrellas (marca los
   bloques ya procesados con data-marked). */
export function bindMarks(root, temaId, { signal } = {}){
  const marked = markedIds(temaId);
  const apply = (block, btn, id) => { if(marked.has(id)){ block.classList.add('marked'); btn.classList.add('on'); } };

  root.querySelectorAll('.card[data-mark-id]:not([data-marked])').forEach(c => {
    c.setAttribute('data-marked', '');
    const row = c.querySelector('.card-head .row1') || c.querySelector('.card-head');
    if(!row) return;
    row.insertAdjacentHTML('afterbegin', markButton(c.getAttribute('data-mark-id')));
    apply(c, row.firstElementChild, c.getAttribute('data-mark-id'));
  });
  root.querySelectorAll('.art-block[id]:not([data-marked])').forEach(a => {
    a.setAttribute('data-marked', '');
    const head = a.querySelector('.art-block-head'); if(!head) return;
    head.insertAdjacentHTML('afterbegin', markButton(a.id));
    apply(a, head.firstElementChild, a.id);
  });
  root.querySelectorAll('.band[id]:not([data-marked])').forEach(b => {
    b.setAttribute('data-marked', '');
    b.insertAdjacentHTML('beforeend', markButton(b.id));   // esquina sup. derecha (CSS)
    apply(b, b.lastElementChild, b.id);
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.mark-btn');
    if(!btn) return;
    e.preventDefault(); e.stopPropagation();
    const now = toggleMark(temaId, btn.getAttribute('data-mark'));
    btn.classList.toggle('on', now);
    const block = btn.closest('.card, .art-block, .band');
    if(block) block.classList.toggle('marked', now);
  }, { signal });
}

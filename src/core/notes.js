/* Notas personales por bloque: el usuario escribe sus apuntes sobre lo que le ha
   costado entender. Va junto a las marcas ★ (mismo sitio, mismo id estable) y
   se guarda igual: app de un solo usuario → localStorage. Como respalda TODAS las
   claves de localStorage, la copia de seguridad (backup.js) ya incluye las notas.
   Estado: { temaId: { blockId: texto } }. Un bloque sin texto no guarda nada.
   El texto admite markdown: se muestra formateado mientras se escribe (vista
   previa en vivo), con el mismo intérprete seguro que el resto del SDK. */
import { renderMarkdown } from './markdown.js';

const KEY = 'tai-notes';
const SAVE_DELAY = 400;

/* Post-it: hoja cuadrada con la esquina inferior doblada y dos líneas de texto. */
const PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v11l-5 5H4z"/><path d="M15 20v-5h5"/><path d="M8 9h8M8 12.5h5"/></svg>';

function readAll(){ try{ return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }catch(e){ return {}; } }
function writeAll(o){ try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){} }

export function getNote(temaId, id){ return (readAll()[temaId] || {})[id] || ''; }

/* Guarda la nota. Texto vacío (o solo blancos) = borrar. Devuelve true si queda nota. */
export function setNote(temaId, id, text){
  const all = readAll();
  const t = all[temaId] || {};
  if((text || '').trim()) t[id] = text; else delete t[id];
  if(Object.keys(t).length) all[temaId] = t; else delete all[temaId];
  writeAll(all);
  return !!(text || '').trim();
}

export function noteButton(id){
  return '<button class="note-btn" type="button" data-note="' + id
    + '" aria-label="Añadir nota" title="Añadir nota">' + PEN + '</button>';
}

function panelHtml(){
  return '<div class="note-panel" hidden>'
    + '<label class="note-label">Mi nota</label>'
    + '<textarea class="note-text" rows="3" placeholder="Lo que te ha costado entender, con tus palabras…"></textarea>'
    + '<div class="note-preview" aria-label="Vista previa"></div>'
    + '<p class="note-hint">Markdown: **negrita**, *cursiva*, `código`, - listas, # títulos, &gt; citas</p>'
    + '<div class="note-foot"><span class="note-state" aria-live="polite"></span>'
    + '<button class="note-clear" type="button">Borrar nota</button></div></div>';
}

/* Identidad del bloque: en tarjetas `data-mark-id`, en artículos su `id`. */
const blockOf = el => el.closest('.card, .art-block');
const idOf = b => b.classList.contains('card') ? b.getAttribute('data-mark-id') : b.id;

/* Pone el botón de nota y el panel en cada tarjeta / artículo marcable, muestra
   las notas ya escritas abiertas y delega los clics y la escritura. Idempotente
   (marca los bloques procesados con data-noted), como bindMarks. */
export function bindNotes(root, temaId, { signal } = {}){
  const saved = readAll()[temaId] || {};

  root.querySelectorAll('.card[data-mark-id]:not([data-noted]), .art-block[id]:not([data-noted])').forEach(b => {
    b.setAttribute('data-noted', '');
    const id = idOf(b);
    const head = b.classList.contains('card')
      ? (b.querySelector('.card-head .row1') || b.querySelector('.card-head'))
      : b.querySelector('.art-block-head');
    if(!head) return;
    const mark = head.querySelector('.mark-btn');
    if(mark) mark.insertAdjacentHTML('afterend', noteButton(id));
    else head.insertAdjacentHTML('afterbegin', noteButton(id));
    b.insertAdjacentHTML('beforeend', panelHtml());

    const text = saved[id] || '';
    const panel = b.querySelector('.note-panel');
    panel.querySelector('.note-text').value = text;
    panel.querySelector('.note-preview').innerHTML = renderMarkdown(text);
    panel.hidden = !text;
    if(text){ b.classList.add('has-note'); b.querySelector('.note-btn').classList.add('on'); }
  });

  /* Vista previa: se formatea en cada pulsación, sin esperar al guardado. */
  const refresh = (ta) => { blockOf(ta).querySelector('.note-preview').innerHTML = renderMarkdown(ta.value); };

  /* Guarda el texto del bloque (con debounce; al salir del campo, al momento). */
  const pending = new Map();
  const commit = (ta) => {
    const block = blockOf(ta); const id = idOf(block);
    clearTimeout(pending.get(id)); pending.delete(id);
    const has = setNote(temaId, id, ta.value);
    block.classList.toggle('has-note', has);
    block.querySelector('.note-btn').classList.toggle('on', has);
    block.querySelector('.note-state').textContent = has ? 'Guardada' : 'Vacía: no se guarda';
  };

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.note-btn');
    if(btn){
      e.preventDefault(); e.stopPropagation();
      const panel = blockOf(btn).querySelector('.note-panel');
      panel.hidden = !panel.hidden;
      if(!panel.hidden) panel.querySelector('.note-text').focus();
      return;
    }
    const clear = e.target.closest('.note-clear');
    if(clear){
      e.preventDefault(); e.stopPropagation();
      const block = blockOf(clear);
      const ta = block.querySelector('.note-text');
      ta.value = '';
      refresh(ta);
      commit(ta);
      block.querySelector('.note-state').textContent = 'Nota borrada';
    }
  }, { signal });

  root.addEventListener('input', (e) => {
    const ta = e.target.closest && e.target.closest('.note-text');
    if(!ta) return;
    const block = blockOf(ta); const id = idOf(block);
    refresh(ta);
    block.querySelector('.note-state').textContent = 'Guardando…';
    clearTimeout(pending.get(id));
    pending.set(id, setTimeout(() => commit(ta), SAVE_DELAY));
  }, { signal });

  root.addEventListener('focusout', (e) => {
    const ta = e.target.closest && e.target.closest('.note-text');
    if(ta && pending.has(idOf(blockOf(ta)))) commit(ta);
  }, { signal });
}

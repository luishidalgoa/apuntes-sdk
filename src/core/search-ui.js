/* Buscador global (overlay). Genérico del SDK: usa el índice de contenido
   (content-index.js) que recorre la estructura común de temas/puntos, así que
   cualquier app del núcleo (TAI, Legislación…) lo hereda sin tocar contenido.
   Se abre con el botón 🔍 de la barra/hub, con ⌘/Ctrl+K o con «/».
   Si la consulta parece una PREGUNTA en lenguaje natural, ofrece responder con
   IA (mini-RAG: recupera los puntos relevantes y la IA responde citándolos). */
import { registerLayer } from './modal-stack.js';
import { searchContent, normalize, warmIndex } from './content-index.js';
import { isQuestion, keyTerms, askTemario } from './search-ask.js';
import { esc } from './dom.js';
import { navigate, parseHash } from '../router.js';
import { temaById, materiaOf, hasMaterias } from '../registry.js';

export const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';

let overlay, input, resultsEl, results = [], activeIdx = -1;
let lastQuery = '', citedRefs = [], asking = false;
/* Contexto de materia: si abres el buscador DENTRO de una materia (su hub o un
   tema suyo), la búsqueda se acota a ella; un chip permite ampliar a todo el
   temario. Fuera de las materias, contexto global. */
let scopeMateria = null;   // { id, label } o null
let scopeActive = true;    // acotar a scopeMateria (el chip lo alterna)

function currentMateria(){
  if(!hasMaterias()) return null;
  const r = parseHash();
  if(r.name === 'materia' && r.materiaId) return materiaOf({ materia: r.materiaId });
  if(r.name === 'tema' && r.temaId){ const t = temaById(r.temaId); return t ? materiaOf(t) : null; }
  return null;
}

export function mountSearch(app){
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="searchOverlay" class="search-overlay" role="dialog" aria-modal="true" aria-label="Buscador del temario" hidden>
      <div class="search-box" role="combobox" aria-expanded="true" aria-owns="searchResults">
        <div class="search-top">
          <span class="search-ico">${SEARCH_ICON}</span>
          <input id="searchInput" class="search-input" type="text" autocomplete="off" autocapitalize="off"
                 spellcheck="false" role="searchbox" aria-controls="searchResults"
                 placeholder="Busca un concepto, un punto, o pregunta (p. ej. ¿qué hace único a un AVL?)">
          <button class="search-esc" id="searchClose" type="button" aria-label="Cerrar">Esc</button>
        </div>
        <div class="search-results" id="searchResults" role="listbox"></div>
        <div class="search-foot"><kbd>↑</kbd><kbd>↓</kbd> moverse · <kbd>↵</kbd> ir · <kbd>Esc</kbd> cerrar · <kbd>⌘K</kbd>/<kbd>/</kbd> abrir</div>
      </div>
    </div>`;
  overlay = wrap.firstElementChild;
  app.appendChild(overlay);
  input = overlay.querySelector('#searchInput');
  resultsEl = overlay.querySelector('#searchResults');

  overlay.querySelector('#searchClose').addEventListener('click', closeSearch);
  overlay.addEventListener('mousedown', (e) => { if(e.target === overlay) closeSearch(); });
  input.addEventListener('input', () => runQuery(input.value));
  input.addEventListener('keydown', onInputKey);
  resultsEl.addEventListener('mousemove', (e) => {
    const it = e.target.closest('.sr-item');
    if(it){ activeIdx = +it.dataset.i; paintActive(); }
  });
  resultsEl.addEventListener('click', (e) => {
    const scopeBtn = e.target.closest('[data-scope]');
    if(scopeBtn){ scopeActive = scopeBtn.dataset.scope === 'mat'; runQuery(input.value); input.focus(); return; }
    if(e.target.closest('[data-ask]')){ doAsk(lastQuery); return; }
    const ref = e.target.closest('[data-goref]');
    if(ref){ gotoRef(+ref.dataset.goref); return; }
    const it = e.target.closest('.sr-item');
    if(it) select(+it.dataset.i);
  });

  registerLayer({ isOpen: () => !overlay.hidden, close: closeSearch, priority: 60 });

  document.addEventListener('keydown', (e) => {
    if((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)){ e.preventDefault(); toggleSearch(); return; }
    if(e.key === '/' && overlay.hidden && !isTyping(e.target)){ e.preventDefault(); openSearch(); }
  });

  /* Precalentar el índice en tiempo de inactividad, INCREMENTAL. */
  const warm = () => { try { warmIndex(); } catch(e){} };
  if('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 });
  else setTimeout(warm, 1500);
}

function isTyping(el){ return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable); }

export function openSearch(){
  if(!overlay || !overlay.hidden) return;
  scopeMateria = currentMateria();
  scopeActive = !!scopeMateria;        // dentro de una materia → acota por defecto
  overlay.hidden = false;
  document.body.classList.add('search-open');
  input.value = '';
  runQuery('');
  setTimeout(() => input.focus(), 20);
}
export function closeSearch(){
  if(!overlay || overlay.hidden) return;
  overlay.hidden = true;
  document.body.classList.remove('search-open');
}
export function toggleSearch(){ overlay && overlay.hidden ? openSearch() : closeSearch(); }

function onInputKey(e){
  if(e.key === 'ArrowDown'){ e.preventDefault(); move(1); }
  else if(e.key === 'ArrowUp'){ e.preventDefault(); move(-1); }
  else if(e.key === 'Enter'){ e.preventDefault(); if(activeIdx >= 0) select(activeIdx); }
}
function move(d){
  if(!results.length) return;
  activeIdx = (activeIdx + d + results.length) % results.length;
  paintActive(true);
}
function paintActive(scroll){
  resultsEl.querySelectorAll('.sr-item').forEach((it, i) => {
    const on = i === activeIdx;
    it.classList.toggle('on', on);
    it.setAttribute('aria-selected', on ? 'true' : 'false');
    if(on && scroll) it.scrollIntoView({ block: 'nearest' });
  });
}
function goto(e){
  if(!e) return;
  closeSearch();
  navigate({ name: 'tema', temaId: e.temaId, anchor: e.anchor || null });
}
function select(i){ goto(results[i]); }
function gotoRef(i){ goto(citedRefs[i]); }

function runQuery(q){
  lastQuery = q;
  const question = q.trim().length >= 2 && isQuestion(q);
  const rq = question ? (keyTerms(q).join(' ') || q) : q;   // en preguntas, recupera por los términos clave
  const scope = (scopeActive && scopeMateria) ? scopeMateria.id : null;
  results = q.trim().length >= 2 ? searchContent(rq, 30, scope) : [];
  activeIdx = results.length ? 0 : -1;
  render(q, question);
}

/* Chip de ámbito: solo aparece si hay contexto de materia. Permite alternar
   entre "solo esta materia" y "todo el temario". */
function scopeChipHtml(){
  if(!scopeMateria) return '';
  return scopeActive
    ? `<div class="sr-scope">Buscando en <b>${esc(scopeMateria.label)}</b><button class="sr-scope-btn" data-scope="all" type="button">Buscar en todo el temario</button></div>`
    : `<div class="sr-scope">Buscando en <b>todo el temario</b><button class="sr-scope-btn" data-scope="mat" type="button">Solo ${esc(scopeMateria.label)}</button></div>`;
}

/* resalta los términos (best-effort, sobre el texto ya escapado) */
function highlight(escaped, terms){
  if(!terms.length) return escaped;
  const rx = new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return escaped.replace(rx, '<mark>$1</mark>');
}
function snippet(text, terms){
  if(!text) return '';
  const low = text.toLowerCase();
  let at = -1;
  for(const t of terms){ const p = low.indexOf(t); if(p >= 0 && (at < 0 || p < at)) at = p; }
  let start = 0;
  if(at > 60){ start = at - 50; }
  let s = text.slice(start, start + 160);
  if(start > 0) s = '… ' + s;
  if(start + 160 < text.length) s = s + ' …';
  return s;
}

function askBarHtml(q){
  const terms = keyTerms(q).slice(0, 6);
  const chips = terms.map(t => `<span class="sr-ask-term">${esc(t)}</span>`).join('');
  return `<div class="sr-ask">
      <div class="sr-ask-l"><span class="sr-ask-spark">✨</span><span class="sr-ask-txt">Parece una pregunta.${terms.length ? ' Detecté: ' + chips : ''}</span></div>
      <button class="sr-ask-btn" data-ask type="button">Responder con IA</button>
    </div>
    <div class="sr-answer-slot" id="srAnswer"></div>`;
}

function answerHtml(answer, cited){
  const clean = (answer || '')
    .replace(/\n?\s*Puntos?\s*:.*$/i, '')     // quita la línea "Puntos: [n]" (ya la mostramos como botones)
    .replace(/\s*\[\d{1,2}\]/g, '')            // quita los marcadores [n] del texto
    .trim();
  citedRefs = cited || [];
  const refs = citedRefs.map((e, i) =>
    `<button class="sr-ref" data-goref="${i}" type="button"><span class="sr-badge">T${esc(e.temaNum)}</span>${e.num ? `<span class="sr-num">${esc(e.num)}</span>` : ''}<span class="sr-ref-t">${esc(e.title)}</span><span class="sr-go">↵</span></button>`
  ).join('');
  return `<div class="sr-answer">
      <div class="sr-answer-h">✨ Respuesta</div>
      <div class="sr-answer-body">${esc(clean).replace(/\n/g, '<br>')}</div>
      ${refs ? `<div class="sr-answer-refs"><span class="sr-refs-l">Ir a la explicación:</span>${refs}</div>` : ''}
    </div>`;
}

async function doAsk(q){
  if(asking || !q || q.trim().length < 2) return;
  asking = true;
  const slot = resultsEl.querySelector('#srAnswer');
  const btn = resultsEl.querySelector('[data-ask]');
  if(btn){ btn.disabled = true; btn.textContent = 'Pensando…'; }
  if(slot) slot.innerHTML = '<div class="sr-answer sr-answer-loading">✨ Pensando…</div>';
  try{
    const { answer, cited } = await askTemario(q);
    if(slot) slot.innerHTML = answer ? answerHtml(answer, cited)
      : '<div class="sr-answer sr-answer-err">No encontré nada en el temario para esa pregunta.</div>';
  }catch(err){
    if(slot) slot.innerHTML = `<div class="sr-answer sr-answer-err">La IA no está disponible ahora mismo (${esc(err.message)}). Mientras, tienes abajo los puntos detectados del temario.</div>`;
  }finally{
    asking = false;
    if(btn){ btn.disabled = false; btn.textContent = 'Responder con IA'; }
  }
}

function render(q, question){
  const kterms = question ? keyTerms(q) : (q.trim().length >= 2 ? normalize(q).split(/\s+/).filter(Boolean) : []);
  const rawTerms = q.trim().split(/\s+/).filter(Boolean);
  const scope = scopeChipHtml();
  if(q.trim().length < 2){
    resultsEl.innerHTML = scope + '<div class="sr-empty">Escribe al menos 2 letras. Busca por <b>concepto</b> (Dijkstra, montículo), por <b>número de punto</b> (4.3.1) o haz una <b>pregunta</b> y deja que la IA te lleve al punto.</div>';
    return;
  }
  const ask = question ? askBarHtml(q) : '';
  if(!results.length){
    resultsEl.innerHTML = scope + ask + `<div class="sr-empty">Sin resultados para «${esc(q)}».</div>`;
    return;
  }
  const items = results.map((e, i) => {
    const title = highlight(esc(e.title), question ? kterms : rawTerms);
    const snip = e.text ? highlight(esc(snippet(e.text, kterms)), question ? kterms : rawTerms) : '';
    return `<button class="sr-item${i === activeIdx ? ' on' : ''}" data-i="${i}" type="button" role="option" aria-selected="${i === activeIdx}">
      <span class="sr-badge">T${esc(e.temaNum)}</span>
      ${e.num ? `<span class="sr-num">${esc(e.num)}</span>` : '<span class="sr-num sr-num-none">·</span>'}
      <span class="sr-main">
        <span class="sr-title">${title}</span>
        <span class="sr-path">${esc(e.path)}</span>
        ${snip ? `<span class="sr-snip">${snip}</span>` : ''}
      </span>
      <span class="sr-go">↵</span>
    </button>`;
  }).join('');
  resultsEl.innerHTML = scope + ask + items;
}

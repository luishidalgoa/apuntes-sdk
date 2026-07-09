/* Buscador global (overlay). Genérico del SDK: usa el índice de contenido
   (content-index.js) que recorre la estructura común de temas/puntos, así que
   cualquier app del núcleo (TAI, Legislación…) lo hereda sin tocar contenido.
   Se abre con el botón 🔍 de la barra/hub, con ⌘/Ctrl+K o con «/». */
import { registerLayer } from './modal-stack.js';
import { searchContent, normalize, warmIndex } from './content-index.js';
import { esc } from './dom.js';
import { navigate } from '../router.js';

export const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';

let overlay, input, resultsEl, results = [], activeIdx = -1;

export function mountSearch(app){
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="searchOverlay" class="search-overlay" role="dialog" aria-modal="true" aria-label="Buscador del temario" hidden>
      <div class="search-box" role="combobox" aria-expanded="true" aria-owns="searchResults">
        <div class="search-top">
          <span class="search-ico">${SEARCH_ICON}</span>
          <input id="searchInput" class="search-input" type="text" autocomplete="off" autocapitalize="off"
                 spellcheck="false" role="searchbox" aria-controls="searchResults"
                 placeholder="Busca un concepto o un punto (p. ej. Dijkstra, 4.3.1, montículo)…">
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
    const it = e.target.closest('.sr-item');
    if(it) select(+it.dataset.i);
  });

  registerLayer({ isOpen: () => !overlay.hidden, close: closeSearch, priority: 60 });

  document.addEventListener('keydown', (e) => {
    if((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)){ e.preventDefault(); toggleSearch(); return; }
    if(e.key === '/' && overlay.hidden && !isTyping(e.target)){ e.preventDefault(); openSearch(); }
  });

  /* Precalentar el índice en tiempo de inactividad, INCREMENTAL (un tema por
     hueco de inactividad, cediendo el hilo entre temas): la 1ª búsqueda es
     instantánea sin congelar el arranque aunque algún tema sea pesado. */
  const warm = () => { try { warmIndex(); } catch(e){} };
  if('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 });
  else setTimeout(warm, 1500);
}

function isTyping(el){ return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable); }

export function openSearch(){
  if(!overlay || !overlay.hidden) return;
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
function select(i){
  const e = results[i];
  if(!e) return;
  closeSearch();
  navigate({ name: 'tema', temaId: e.temaId, anchor: e.anchor || null });
}

function runQuery(q){
  results = q.trim().length >= 2 ? searchContent(q) : [];
  activeIdx = results.length ? 0 : -1;
  render(q);
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

function render(q){
  const terms = q.trim().length >= 2 ? normalize(q).split(/\s+/).filter(Boolean) : [];
  const rawTerms = q.trim().split(/\s+/).filter(Boolean);
  if(q.trim().length < 2){
    resultsEl.innerHTML = '<div class="sr-empty">Escribe al menos 2 letras. Busca por <b>concepto</b> (Dijkstra, montículo, RAID) o por <b>número de punto</b> (4.3.1, 2.5).</div>';
    return;
  }
  if(!results.length){
    resultsEl.innerHTML = `<div class="sr-empty">Sin resultados para «${esc(q)}».</div>`;
    return;
  }
  resultsEl.innerHTML = results.map((e, i) => {
    const title = highlight(esc(e.title), rawTerms);
    const snip = e.text ? highlight(esc(snippet(e.text, terms)), rawTerms) : '';
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
}

/* Paneles singleton del shell:
   - #infoPanel  (derecha): detalle de una referencia cruzada o etiqueta.
   - #fullTextPanel (izquierda): texto fuente de la sección/apartado.
   - #backBtn: volver al punto anterior tras un salto.
   Toda la resolución de claves se parametriza por el "contexto de tema" activo
   (engine del manifiesto): keySplit ('first'|'last') decide por qué punto se
   parte la clave, y sourceDigitFallback permite mapear un apartado como '1a' al
   párrafo '1' del texto fuente. Cada tema declara su estrategia. */

import { linkify } from './render-tema.js';
import { registerLayer } from './modal-stack.js';
import { anchorId } from '../config.js';
import { listData as ftListData } from './enum-list.js';
import { bindFullTextHighlighting, applyFullTextHighlights } from './highlight.js';

const BREAKPOINT = 1300;

let ctx = null;          // contexto del tema activo (null fuera de vistas de tema)
let refMode = 'panel';
try{ refMode = localStorage.getItem('ce-ref-mode') || 'panel'; }catch(e){}

let panel, panelTitle, panelBody;
let ftPanel, ftTitle, ftBody;
let backBtn;
let activeTag = null;
let lastScrollY = null;
let backBtnTimer = null;

export function setTemaContext(c){ ctx = c; }
export function getRefMode(){ return refMode; }

/* ---------- resolución (pura, reutilizable por el preview del examen) ---------- */
export function splitKey(key, mode){
  const k = String(key);
  const idx = mode === 'last' ? k.lastIndexOf('.') : k.indexOf('.');
  return idx === -1 ? [k, null] : [k.slice(0, idx), k.slice(idx + 1)];
}

export function resolveRef(c, key){
  const [artNum, apN] = splitKey(key, c.keySplit);
  const art = c.sections[artNum];
  if(!art) return null;
  let ap = null;
  if(apN && art.apartados) ap = art.apartados.find(a => String(a.n) === apN) || null;
  return { art, artNum, ap };
}

export function resolveVerbatim(c, key){
  const [artNum, apN] = splitKey(key, c.keySplit);
  const art = c.source[artNum];
  if(!art) return null;
  if(!apN) return { art, artNum, para: null };
  let paraKey = apN;
  if(c.sourceDigitFallback){
    const digitMatch = apN.match(/^[0-9]+/);
    paraKey = digitMatch ? digitMatch[0] : apN;
  }
  const para = art.paragraphs.find(p => String(p.n) === paraKey) || null;
  return { art, artNum, para };
}

/* Etiquetas especiales de un apartado (genérico). El tema declara en
   engine.specialTags un mapa kind → { pill, text }; el SDK no conoce ninguna
   etiqueta concreta: pill y texto los aporta siempre la app. */
function tagRows(c, ap){
  if(!ap.tags || !c.specialTags) return '';
  return ap.tags.map(kind => {
    const t = c.specialTags[kind];
    if(!t) return '';
    return '<div class="sp-row"><span class="sp-pill ' + kind + '">' + t.pill + '</span>'
      + '<p>' + t.text + (ap.tagNote ? ' <b>' + ap.tagNote + '.</b>' : '') + '</p></div>';
  }).join('');
}

export function buildPanelContent(c, key){
  const k = String(key);
  /* Referencia a OTRO tema (p.ej. T1-53.2 desde Tema 2): panel con enlace
     de navegación interna (antes abría el archivo del Tema 1 en otra pestaña). */
  if(c.external && k.indexOf(c.external.prefix) === 0){
    const num = k.slice(c.external.prefix.length);
    const dot = num.indexOf('.');
    const artNum = dot === -1 ? num : num.slice(0, dot);
    const apN = dot === -1 ? null : num.slice(dot + 1);
    const title = c.external.map[artNum] || ('artículo ' + artNum);
    const anchor = anchorId(artNum, apN);
    return {
      title: num + ' · ' + c.external.label,
      kind: 'ext',
      body: '<p><span class="sp-pill">Contenido de ' + c.external.label + '</span></p>'
        + '<p><b>' + title + '</b> vive en ' + c.external.label + ', no en este tema.</p>'
        + '<p><a class="btn small on" href="#/tema/' + c.external.temaId + '/' + anchor + '">→ Abrir en ' + c.external.label + '</a></p>'
    };
  }
  const resolved = resolveRef(c, key);
  if(!resolved){
    return { title: 'Fuera de este esquema', kind: 'ref', body: '<p>Este artículo no está cubierto todavía por ningún Tema del temario.</p>' };
  }
  const { art, artNum, ap } = resolved;
  const label = c.labelFor(artNum);
  let title, parts = [], kind = 'ref';
  if(ap){
    title = label + '.' + ap.n + ' · ' + art.title;
    parts.push('<p>' + linkify(ap.text, ap.refs) + '</p>');
    if(ap.tags && c.specialTags){ parts.push(tagRows(c, ap)); kind = 'susp'; }
  } else if(art.apartados){
    title = label + ' · ' + art.title;
    parts.push(art.apartados.map(a => '<p><b>' + a.n + '.</b> ' + linkify(a.text, a.refs) + '</p>').join(''));
  } else {
    title = label + ' · ' + art.title;
    parts.push('<p>' + linkify(art.text, art.refs) + '</p>');
    if(art.tags && c.specialTags){ parts.push(tagRows(c, { tags: art.tags })); kind = 'susp'; }
  }
  return { title, body: parts.join(''), kind };
}

/* Renderiza un párrafo del texto literal: párrafo normal, o intro + lista
   indentada si detecta una enumeración por letras/ordinales. */
function ftParagraph(p){
  const prefix = p.n ? ('<b>' + p.n + '.</b> ') : '';
  const list = ftListData(p.text || '');
  if(list){
    return ((list.intro || prefix) ? '<p class="ft-p">' + prefix + list.intro + '</p>' : '')
      + '<ol class="ft-abc">' + list.items.map(it => '<li><span class="ft-m">' + it.disp + '</span>' + it.text + '</li>').join('') + '</ol>';
  }
  return '<p class="ft-p">' + prefix + p.text + '</p>';
}

export function buildFullTextContent(c, key){
  const resolved = resolveVerbatim(c, key);
  if(!resolved){
    return { title: 'No disponible', body: '<p class="ft-p">No tengo el texto literal de este artículo cargado en el esquema.</p>' };
  }
  const { art, artNum, para } = resolved;
  const label = c.labelFor(artNum);
  if(para){
    return {
      title: label + (para.n ? ('.' + para.n) : '') + ' · texto literal',
      body: '<span class="ft-tag">Texto literal</span>' + ftParagraph(para)
    };
  }
  return {
    title: label + ' · ' + art.title,
    body: '<span class="ft-tag">Texto literal completo</span>'
      + art.paragraphs.map(ftParagraph).join('')
  };
}

/* ---------- apertura/cierre/posicionamiento ---------- */
function positionPanel(tag){
  if(window.innerWidth <= BREAKPOINT){ panel.style.top = ''; return; }
  const rect = tag.getBoundingClientRect();
  const panelH = panel.offsetHeight || 200;
  let top = rect.top - 10;
  top = Math.min(top, window.innerHeight - panelH - 16);
  top = Math.max(top, 16);
  panel.style.top = top + 'px';
}

export function openPanel(tag, key){
  if(!ctx) return;
  const content = buildPanelContent(ctx, key);
  panelTitle.textContent = content.title;
  panelBody.innerHTML = content.body;
  panel.classList.remove('mode-susp', 'mode-ref', 'mode-ext');
  panel.classList.add(content.kind === 'susp' ? 'mode-susp' : content.kind === 'ext' ? 'mode-ext' : 'mode-ref');
  panel.classList.add('open');
  document.body.classList.add('panel-open');
  if(activeTag) activeTag.classList.remove('active');
  if(tag){ tag.classList.add('active'); activeTag = tag; positionPanel(tag); }
}

export function closePanel(){
  panel.classList.remove('open');
  document.body.classList.remove('panel-open');
  if(activeTag){ activeTag.classList.remove('active'); activeTag = null; }
}

export function openFullText(key){
  if(!ctx) return;
  const content = buildFullTextContent(ctx, key);
  ftTitle.textContent = content.title;
  ftBody.innerHTML = content.body;
  applyFullTextHighlights(ftBody, key);   // reaplica los subrayados guardados de este artículo
  ftPanel.classList.add('open');
  document.body.classList.add('fulltext-open');
}

export function closeFullText(){
  ftPanel.classList.remove('open');
  document.body.classList.remove('fulltext-open');
}

function showBackBtn(){
  backBtn.classList.add('show');
  clearTimeout(backBtnTimer);
  backBtnTimer = setTimeout(() => backBtn.classList.remove('show'), 8000);
}

/* ---------- salto a un ancla (modo Saltar, deep-links, preview) ---------- */
export function revealAnchor(id, { flash = true, saveReturn = false } = {}){
  // Por id de elemento (art-blocks, apartados, bandas) o, si no, por data-mark-id
  // (las tarjetas usan data-mark-id, no id) — así el Plan de estudio navega a ellas.
  const esc = (window.CSS && CSS.escape) ? CSS.escape(id) : String(id).replace(/["\\]/g, '\\$&');
  const el = document.getElementById(id) || document.querySelector('[data-mark-id="' + esc + '"]');
  if(!el) return false;
  const card = el.closest('.card');
  const det = card ? card.querySelector('.det, .arts-list') : null;
  const wasClosed = card && !card.classList.contains('open');
  if(saveReturn) lastScrollY = window.scrollY;
  const doScroll = () => {
    el.scrollIntoView({ behavior: 'instant', block: 'center' });
    if(!flash) return;
    const flashEl = el.closest('.art-block') || el;
    flashEl.classList.add('flash');
    setTimeout(() => flashEl.classList.remove('flash'), 1700);
  };
  if(wasClosed && det){
    det.classList.add('no-anim');
    card.classList.add('open');
    void det.offsetHeight;
    doScroll();
    setTimeout(() => det.classList.remove('no-anim'), 50);
  } else {
    if(wasClosed) card.classList.add('open');
    doScroll();
  }
  if(saveReturn) showBackBtn();
  return true;
}

function jumpTo(tag, key){
  const k = String(key);
  if(ctx.external && k.indexOf(ctx.external.prefix) === 0){ openPanel(tag, key); return; }
  const resolved = resolveRef(ctx, key);
  if(!resolved){ openPanel(tag, key); return; }
  const { artNum, ap } = resolved;
  const targetId = ap ? anchorId(artNum, ap.n) : anchorId(artNum);
  if(!revealAnchor(targetId, { saveReturn: true })) revealAnchor(anchorId(artNum), { saveReturn: true });
}

/* ---------- toggle segmentado Referencias [Panel | Saltar] (estado global) ----------
   Antes era un botón que ciclaba y había que adivinar el modo; ahora las dos
   opciones son visibles y se elige la que se quiere directamente. */
export function bindRefModeSegment(container, { signal } = {}){
  if(!container) return;
  const btns = [...container.querySelectorAll('.seg-btn')];
  const update = () => btns.forEach(b => b.classList.toggle('on', b.dataset.mode === refMode));
  update();
  btns.forEach(b => b.addEventListener('click', () => {
    if(refMode === b.dataset.mode) return;
    refMode = b.dataset.mode;
    try{ localStorage.setItem('ce-ref-mode', refMode); }catch(e){}
    update();
    if(refMode === 'jump') closePanel();
  }, { signal }));
}

/* ---------- montaje único en el shell ---------- */
export function mountPanels(shell){
  shell.insertAdjacentHTML('beforeend', `
<div id="infoPanel" role="dialog" aria-label="Detalle de la referencia">
  <div class="sp-head">
    <span class="sp-title">Título</span>
    <button class="sp-close" type="button" aria-label="Cerrar">✕</button>
  </div>
  <div class="sp-body"></div>
</div>
<div id="fullTextPanel" role="dialog" aria-label="Texto fuente">
  <div class="sp-head">
    <span class="sp-title">Título</span>
    <button class="sp-close" type="button" aria-label="Cerrar">✕</button>
  </div>
  <div class="sp-body"></div>
</div>
<button id="backBtn" type="button"><span>←</span> Volver</button>`);

  panel = shell.querySelector('#infoPanel');
  panelTitle = panel.querySelector('.sp-title');
  panelBody = panel.querySelector('.sp-body');
  ftPanel = shell.querySelector('#fullTextPanel');
  ftTitle = ftPanel.querySelector('.sp-title');
  ftBody = ftPanel.querySelector('.sp-body');
  bindFullTextHighlighting(ftBody);   // el "texto literal" también es subrayable (persistido)
  backBtn = shell.querySelector('#backBtn');

  panel.querySelector('.sp-close').addEventListener('click', closePanel);
  ftPanel.querySelector('.sp-close').addEventListener('click', closeFullText);
  backBtn.addEventListener('click', () => {
    if(lastScrollY != null) window.scrollTo({ top: lastScrollY, behavior: 'instant' });
    backBtn.classList.remove('show');
  });

  /* Delegación global de clicks (una sola vez; los selectores de T1 y T2 no
     colisionan porque solo hay una vista montada a la vez). */
  document.addEventListener('click', (e) => {
    const numEl = e.target.closest('.anum, .art-num, .art-hd-num, .ap-n');
    if(numEl){
      e.stopPropagation();
      openFullText(numEl.getAttribute('data-ref'));
      if(panel.classList.contains('open')) closePanel();
      return;
    }
    const tag = e.target.closest('.ref-tag, .susp-tag');
    if(tag){
      e.stopPropagation();
      if(ftPanel.classList.contains('open')) closeFullText();
      const key = tag.getAttribute('data-ref');
      if(refMode === 'jump'){ jumpTo(tag, key); return; }
      if(activeTag === tag){ closePanel(); return; }
      openPanel(tag, key);
      return;
    }
    // clicar la paleta de subrayado (vive fuera de los paneles) NO debe cerrarlos
    if(e.target.closest('.hl-palette, #hlPalette')) return;
    if(panel.classList.contains('open') && !panel.contains(e.target)) closePanel();
    if(ftPanel.classList.contains('open') && !ftPanel.contains(e.target)) closeFullText();
  });

  window.addEventListener('resize', () => { if(activeTag) positionPanel(activeTag); });

  registerLayer({ isOpen: () => ftPanel.classList.contains('open'), close: closeFullText, priority: 20 });
  registerLayer({ isOpen: () => panel.classList.contains('open'), close: closePanel, priority: 10 });
}

/* Glosario de ACRÓNIMOS clicables. La app aporta el glosario
   (`appConfig.glossary = { 'AGE': 'Administración General del Estado', … }`, y
   opcionalmente `tema.glossary` por manifiesto). El SDK auto-envuelve en el
   contenido del tema las apariciones de los acrónimos —SOLO de esa lista blanca,
   con límites de palabra y normalizando puntuación (CCAA/CC.AA.)— en un
   `<abbr class="acro">` clicable. Al clicar (o Enter/Espacio) muestra un rótulo
   con el título completo, con los tokens del SDK. Uno abierto a la vez; se cierra
   con 2º clic, Escape o clic fuera; se voltea arriba/abajo si no cabe.
   Solo lista blanca (nunca "cualquier mayúscula"); no envuelve dentro de
   encabezados, enlaces, refs, chips, SVG ni lo ya envuelto (idempotente); no
   cambia la longitud del texto → no rompe subrayado/marcadores/búsqueda. */
import { config } from '../config.js';
import { registerLayer } from './modal-stack.js';

/* No envolver dentro de estos (interactivos, títulos, refs, código…). */
const SKIP = 'a,h1,h2,h3,h4,button,.ref-tag,.susp-tag,.mark-btn,.chip,.acro,svg,code,kbd,.anum,.art-num,.ap-n,.art-hd-num,.k,.kicker,.badge,.sp-pill';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const strip = (s) => s.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();

/* Matcher desde el glosario (global + override del tema). map: normalizado→título;
   rx: alternación (lista blanca) con puntos opcionales y límites sin lookbehind. */
function buildGlossary(tema){
  const g = { ...(config().glossary || {}), ...((tema && tema.glossary) || {}) };
  const keys = Object.keys(g);
  if(!keys.length) return null;
  const map = new Map(); const pats = [];
  for(const key of keys){
    const letters = key.replace(/[^\p{L}\p{N}]/gu, '');
    if(letters.length < 2) continue;
    const norm = letters.toUpperCase();
    if(!map.has(norm)) map.set(norm, g[key]);
    pats.push([...letters].map(esc).join('\\.?') + '\\.?');   // C\.?C\.?A\.?A\.?\.? → CCAA / CC.AA.
  }
  if(!pats.length) return null;
  pats.sort((a, b) => b.length - a.length);   // el más largo gana
  const rx = new RegExp('(^|[^\\p{L}\\p{N}])(' + pats.join('|') + ')(?![\\p{L}\\p{N}])', 'gu');
  return { map, rx };
}

function inSkip(node, root){
  let el = node.parentElement;
  while(el && el !== root){
    if(el.matches && el.matches(SKIP)) return true;
    el = el.parentElement;
  }
  return false;
}

/* Envuelve los acrónimos del glosario en `root`. Idempotente por raíz. */
export function wrapGlossary(root, tema){
  if(!root || root.dataset.glossaryDone) return;
  const gl = buildGlossary(tema);
  root.dataset.glossaryDone = '1';
  if(!gl) return;
  const { map, rx } = gl;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      if(!n.nodeValue || n.nodeValue.length < 2 || !/[\p{Lu}]/u.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
      return inSkip(n, root) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  const targets = []; let n;
  while((n = walker.nextNode())) targets.push(n);

  for(const node of targets){
    const text = node.nodeValue;
    rx.lastIndex = 0;
    if(!rx.test(text)) continue;
    rx.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while((m = rx.exec(text))){
      const pre = m[1] || '', surface = m[2];
      const start = m.index + pre.length;
      const title = map.get(strip(surface));
      frag.appendChild(document.createTextNode(text.slice(last, start)));
      if(title){
        const ab = document.createElement('abbr');
        ab.className = 'acro'; ab.tabIndex = 0; ab.setAttribute('role', 'button');
        ab.setAttribute('data-acro', title);
        ab.setAttribute('aria-label', surface + ': ' + title);
        ab.textContent = surface;
        frag.appendChild(ab);
      } else {
        frag.appendChild(document.createTextNode(surface));
      }
      last = start + surface.length;
      if(rx.lastIndex === m.index) rx.lastIndex++;   // guard anti-bucle (match vacío)
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
}

/* ---------------- rótulo (popover) ---------------- */
let pop = null, current = null;

function positionAcro(ab){
  const r = ab.getBoundingClientRect();
  pop.style.maxWidth = Math.min(320, window.innerWidth - 24) + 'px';
  pop.style.left = '0px'; pop.style.top = '0px';   // medir sin clamping previo
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = Math.round(r.left + r.width / 2 - pw / 2);
  left = Math.max(10, Math.min(left, window.innerWidth - pw - 10));
  let top = r.bottom + 9, flip = false;
  if(top + ph > window.innerHeight - 8 && r.top - 9 - ph > 8){ top = r.top - 9 - ph; flip = true; }
  pop.classList.toggle('flip', flip);
  pop.style.left = left + 'px';
  pop.style.top = Math.round(top) + 'px';
  pop.style.setProperty('--arrow-x', Math.max(14, Math.min(pw - 14, r.left + r.width / 2 - left)) + 'px');
}
function openAcro(ab){
  if(current && current !== ab) current.classList.remove('acro-open');
  current = ab; ab.classList.add('acro-open');
  pop.textContent = ab.getAttribute('data-acro');
  pop.hidden = false;
  positionAcro(ab);
  pop.classList.remove('in'); void pop.offsetWidth; pop.classList.add('in');
}
export function closeAcro(){
  if(current){ current.classList.remove('acro-open'); current = null; }
  if(pop) pop.hidden = true;
}

export function mountGlossary(shell){
  shell.insertAdjacentHTML('beforeend', '<div id="acroPop" class="acro-pop" role="tooltip" hidden></div>');
  pop = shell.querySelector('#acroPop');
  document.addEventListener('click', (e) => {
    const ab = e.target.closest && e.target.closest('.acro');
    if(ab){ e.preventDefault(); e.stopPropagation(); current === ab ? closeAcro() : openAcro(ab); return; }
    if(current && (!pop.contains(e.target))) closeAcro();
  });
  document.addEventListener('keydown', (e) => {
    if((e.key === 'Enter' || e.key === ' ')){
      const ab = document.activeElement;
      if(ab && ab.classList && ab.classList.contains('acro')){ e.preventDefault(); current === ab ? closeAcro() : openAcro(ab); }
    }
  });
  const reflow = () => { if(current) positionAcro(current); };
  window.addEventListener('resize', reflow, { passive: true });
  window.addEventListener('scroll', reflow, { passive: true, capture: true });
  registerLayer({ isOpen: () => !!current, close: closeAcro, priority: 45 });
}

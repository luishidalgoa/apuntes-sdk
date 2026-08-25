/* "Plan de estudio": árbol GLOBAL del temario con la PRIORIDAD (baja/media/alta)
   de cada nodo, colapsable y editable in situ (clic cicla). La jerarquía de cada
   tema se extrae de su contenido real combinando dos señales:
   - ORDEN de documento para cabeceras (.apartado-head, .band): son títulos,
     hermanos del contenido que encabezan.
   - CONTENCIÓN para bloques (.card, .art-block): un .card puede AGRUPAR
     art-blocks/cards anidados (p.ej. leg-tema1: Capítulo › artículos).
   Un .card sin `data-mark-id` que agrupa es una sección estructural (sin
   prioridad propia, solo pliega y hace roll-up). Overlay SPA. Comparte storage
   con el marcador del contenido (marks.js): marcar aquí se refleja en el tema. */
import { allTemas, materiasWithTemas, hasMaterias } from '../registry.js';
import { levelsMap, cycleTemaLevel, cycleMark, markLevel, registrarDeclaradas, TEMA_MARK_KEY, NIVEL_OMITIR, NIVEL_DEFECTO } from './marks.js';
import { registerLayer } from './modal-stack.js';
import { esc } from './dom.js';

let overlay = null, sheet = null, body = null;
let struct = null;           // estructura cacheada (jerarquía por tema)
let filterMin = 0;           // nivel mínimo visible (0 = todo)
/* «Omitibles» no es un mínimo sino una selección EXACTA: pedir «≥ omitir» no
   significa nada, porque omitir está fuera de la escala de importancia. Por eso
   el filtro tiene dos modos y no un número más. */
let filterSolo = 0;          // 0 = sin filtro exacto · NIVEL_OMITIR = solo omitibles
const collapsed = new Set(); // claves de grupos plegados; persiste entre re-renders
/* Con el filtro «Omitibles» puesto, los grupos se pintan ABIERTOS aunque estén
   plegados: ese filtro existe para revisar lo que descartaste, y un plegado lo
   deja escondido justo cuando lo has pedido. El plegado del usuario no se pierde
   —se ignora mientras dura el filtro y vuelve al quitarlo—. */
const plegado = (key) => collapsed.has(key) && !filterSolo;
const caretGlyph = (key) => plegado(key) ? '▸' : '▾';

const BARS = '<span class="mk-bars"><i></i><i></i><i></i></span>';
const LNAME = { 1: 'baja', 2: 'media', 3: 'alta' };
const btnTitle = (lv) => lv ? ('Prioridad ' + LNAME[lv] + ' · clic para cambiar') : 'Sin prioridad · clic: baja › media › alta';
const HEADER_SEL = '.apartado-head[id], .band[id]';
const STRUCT_SEL = '.apartado-head[id], .band[id], .card, .art-block[id]';
const txt = (el) => el ? (el.textContent || '').trim() : '';

/* Ancestro estructural más cercano (o null si está en la raíz del contenido). */
function nearestStruct(el){
  let p = el.parentElement;
  while(p){ if(p.matches && p.matches(STRUCT_SEL)) return p; p = p.parentElement; }
  return null;
}

/* Etiqueta {id, num, title, markable} de un nodo markable/estructural. */
function labelOf(el){
  if(el.matches('.art-block[id]')){
    return { id: el.id, num: txt(el.querySelector('.art-num')), title: txt(el.querySelector('.art-title')) || el.id, markable: true };
  }
  if(el.matches('.apartado-head[id]')){
    return { id: el.id, num: txt(el.querySelector('.apn')), title: txt(el.querySelector('h2')) || el.id, markable: true };
  }
  if(el.matches('.band[id]')){
    return { id: el.id, num: txt(el.querySelector('.rom')), title: txt(el.querySelector('h2')) || el.id, markable: true };
  }
  // .card — marcable si tiene data-mark-id; si no, es agrupador estructural.
  const markId = el.getAttribute('data-mark-id');
  const name = el.querySelector('.card-head .name');   // título de la tarjeta marcable
  const label = el.querySelector('.card-head .label'); // tarjeta-grupo (leg-tema1): título limpio
  let num = '', title = '';
  if(name){
    // El número puede ir DENTRO de .name como .secn (formato TAI: "1.1") o como
    // HERMANO .sig en la fila (formato Legislación: "Art. 66").
    const secn = name.querySelector('.secn');
    const sig = el.querySelector('.card-head .sig');
    num = secn ? txt(secn) : (sig ? txt(sig) : '');
    title = name.textContent.trim();
    if(secn) title = title.replace(secn.textContent, '').trim();
  } else if(label){
    title = label.textContent.trim();
  } else {
    const head = el.querySelector('.card-head');
    if(head){
      const c = head.cloneNode(true);
      c.querySelectorAll('button, .badge, .chip, .range, .art-tag, .tag, .mark-btn, .desc, .truco, .illus, .icon, p, .arts-list').forEach(x => x.remove());
      title = c.textContent.replace(/\s+/g, ' ').trim();
    }
  }
  return { id: markId || null, num, title, markable: !!markId };   // title puede quedar vacío → se completa en blockNode
}

const slug = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/* Clave de PRIORIDAD de un nodo: su id real si lo tiene (así se sincroniza con
   el marcador del contenido); si es un agrupador sin id, una clave sintética
   estable por título (`~capitulo-i`). Storage por-tema, colisión improbable. */
const pkOf = (id, title) => id || ('~' + slug(title));

let gcount = 0;   // contador para claves de grupos sin id (colapsado)
/* Nodo de bloque (.card/.art-block), recursivo por contención. */
function blockNode(el){
  const info = labelOf(el);
  const gid = info.id || ('g' + (gcount++));
  if(el.matches('.art-block[id]')) return { ...info, gid, pk: info.id, kind: 'sub', children: [] };
  const kids = [];
  el.querySelectorAll('.card, .art-block[id]').forEach(ch => { if(nearestStruct(ch) === el) kids.push(blockNode(ch)); });
  const kind = (kids.length || !info.markable) ? 'section' : 'sub';
  // Tarjeta-grupo sin título (p.ej. la Corona: solo un disclosure con arts 56-65):
  // etiqueta por el rango de artículos que contiene.
  let title = info.title;
  if(!title){
    const nums = [...el.querySelectorAll('.art-block[id] .art-num')].map(a => txt(a)).filter(Boolean);
    title = nums.length ? ('Arts. ' + nums[0] + (nums.length > 1 ? '–' + nums[nums.length - 1] : '')) : (info.id || '—');
  }
  return { ...info, title, gid, pk: pkOf(info.id, title), kind, children: kids };
}
function sectionNode(el){ const info = labelOf(el); return { ...info, gid: info.id, pk: info.id, kind: 'section', children: [] }; }
/* Ancla de navegación: id real del propio nodo, o el del primer descendiente
   con id (p.ej. "Capítulo I" → art-11). null si nada tiene id. */
function navAnchor(node){
  if(node.id) return node.id;
  for(const c of (node.children || [])){ const a = navAnchor(c); if(a) return a; }
  return null;
}

/* Extrae la jerarquía de cada tema renderizando su contenido en un div
   desconectado (como el índice de búsqueda). Se cachea (no cambia en runtime). */
function buildStructure(){
  if(struct) return struct;
  gcount = 0;
  struct = allTemas().map((t, i) => {
    const num = (String(t.k || '').match(/Tema\s+(\d+)/i) || [])[1] || String(i + 1);
    const nodes = [];
    try {
      const box = document.createElement('div');
      t.renderContent(box);
      registrarDeclaradas(t.id, box);   // el árbol ya está delante: no cuesta un render extra
      let apartado = null, band = null;
      // Recorrido de nivel superior: cabeceras (orden) + bloques sin ancestro
      // estructural (los anidados los recoge blockNode por contención).
      const top = [...box.querySelectorAll(STRUCT_SEL)].filter(n => n.matches(HEADER_SEL) || nearestStruct(n) === null);
      top.forEach(n => {
        if(n.matches('.apartado-head[id]')){ apartado = sectionNode(n); band = null; nodes.push(apartado); }
        else if(n.matches('.band[id]')){ band = sectionNode(n); (apartado ? apartado.children : nodes).push(band); }
        else { const node = blockNode(n); (band ? band.children : apartado ? apartado.children : nodes).push(node); }
      });
    } catch(e){}
    return { id: t.id, num, titulo: t.titulo || t.id, nodes };
  });
  // Secciones (nodos con hijos) PLEGADAS por defecto: estado inicial compacto
  // (Materia › Tema › Sección). Un tema sin secciones, plegado a nivel de tema.
  // Solo la primera vez (luego el Set refleja lo que abra/cierre el usuario).
  const seed = (temaId, n) => {
    if((n.children || []).length) collapsed.add('x:' + temaId + '/' + n.gid);
    (n.children || []).forEach(c => seed(temaId, c));
  };
  struct.forEach(t => {
    t.nodes.forEach(n => seed(t.id, n));
    if(!t.nodes.some(n => (n.children || []).length)) collapsed.add('t:' + t.id);
  });
  return struct;
}

/* ¿Se oculta una fila? Dos filtros distintos: `filterMin` es un umbral (ver de
   media para arriba) y `filterSolo` una selección exacta (ver solo lo descartado).
   Además, SIN filtro las omitidas se ocultan de serie: el plan es la lista de lo
   que queda por estudiar, y lo que decidiste saltarte no queda. Se recupera con
   el botón «Omitibles», que existe justo para poder reconsiderarlo. */
function oculta(lv){
  if(filterSolo) return lv !== filterSolo;
  if(filterMin) return lv < filterMin;
  return lv === NIVEL_OMITIR;
}
function ocultaRama(map, node){
  const ks = walkIds(node, []);
  const nivs = ks.length ? ks.map(k => map[k] || NIVEL_DEFECTO) : [NIVEL_DEFECTO];
  /* Una rama se oculta solo si TODOS sus nodos se ocultan: si dentro queda algo
     que estudiar, la rama tiene que seguir viéndose para poder llegar. */
  return nivs.every(oculta);
}

/* Conteo {alta, media, omit} de un conjunto de ids según el storage del tema. */
function countIds(map, ids){
  let alta = 0, media = 0, omit = 0;
  ids.forEach(id => { const lv = map[id] || NIVEL_DEFECTO;
    if(lv === 3) alta++; else if(lv === 2) media++; else if(lv === NIVEL_OMITIR) omit++; });
  return { alta, media, omit };
}
/* Claves de prioridad del subárbol de un nodo (incluido él). */
function walkIds(node, acc){ if(node.pk) acc.push(node.pk); (node.children || []).forEach(c => walkIds(c, acc)); return acc; }
function branchCounts(map, node){ return countIds(map, walkIds(node, []).filter(k => k !== node.pk)); }
function branchMax(map, node){ const ks = walkIds(node, []); return ks.length ? Math.max(...ks.map(k => map[k] || NIVEL_DEFECTO)) : NIVEL_DEFECTO; }
function temaCounts(tema, map){
  const ids = [TEMA_MARK_KEY];
  tema.nodes.forEach(n => walkIds(n, ids));
  return countIds(map, ids);
}

function rollupHtml(alta, media, omit){
  if(!alta && !media && !omit) return '';
  return '<span class="sp-roll">'
    + (alta ? '<span class="sp-roll-n" data-level="3">' + alta + '</span>' : '')
    + (media ? '<span class="sp-roll-n" data-level="2">' + media + '</span>' : '')
    /* Las omitidas se cuentan aparte y no suman a «lo que queda»: el recuento
       existe para saber cuánto has descartado, no para inflar el trabajo. */
    + (omit ? '<span class="sp-roll-n" data-level="-1" title="omitidas">' + omit + '</span>' : '')
    + '</span>';
}
const setBtn = (scope, temaId, id, lv) =>
  '<button class="mk-set mark-btn" type="button" data-scope="' + scope + '" data-tema="' + esc(temaId) + '"'
  + (id ? ' data-id="' + esc(id) + '"' : '') + ' data-level="' + lv + '" title="' + btnTitle(lv) + '" aria-label="Prioridad">' + BARS + '</button>';
/* Etiqueta del nodo: enlace al contenido (su ancla, o la del 1er descendiente
   con id). Si no hay ancla, span no navegable. */
function labelHtml(temaId, o, cls){
  const inner = (o.num ? '<span class="sp-n">' + esc(o.num) + '</span> ' : '') + esc(o.title);
  const anchor = navAnchor(o);
  return anchor
    ? '<a class="sp-label' + cls + '" href="#/tema/' + esc(temaId) + '/' + esc(anchor) + '">' + inner + '</a>'
    : '<span class="sp-label' + cls + '">' + inner + '</span>';
}

/* Fila de un nodo (recursivo): hoja si no tiene hijos; rama colapsable si los
   tiene. TODO nodo lleva botón de prioridad (por su clave `pk`). */
function nodeHtml(temaId, o, map){
  const lv = map[o.pk] || NIVEL_DEFECTO;
  const kids = o.children || [];
  const isSec = o.kind === 'section';
  const btn = setBtn('node', temaId, o.pk, lv);
  if(!kids.length){
    const hide = oculta(lv) ? ' sp-hidden' : '';
    return '<div class="sp-row ' + (isSec ? 'sp-sec' : 'sp-sub') + hide + '" data-level="' + lv + '">'
      + '<span class="sp-indent"></span>'
      + labelHtml(temaId, o, isSec ? ' sp-sec-label' : '')
      + btn + '</div>';
  }
  const c = branchCounts(map, o);
  const hide = ocultaRama(map, o) ? ' sp-hidden' : '';
  const key = 'x:' + temaId + '/' + o.gid;
  const col = plegado(key) ? ' collapsed' : '';
  return '<div class="sp-group sp-sec-group' + hide + col + '" data-key="' + esc(key) + '">'
    + '<div class="sp-row sp-sec" data-level="' + lv + '">'
    +   '<button class="sp-caret" type="button" aria-label="Plegar/desplegar">' + caretGlyph(key) + '</button>'
    +   labelHtml(temaId, o, ' sp-sec-label')
    +   rollupHtml(c.alta, c.media, c.omit)
    +   btn
    + '</div>'
    + '<div class="sp-children">' + kids.map(k => nodeHtml(temaId, k, map)).join('') + '</div>'
    + '</div>';
}

function temaHtml(tema){
  const map = levelsMap(tema.id);
  const tLv = map[TEMA_MARK_KEY] || NIVEL_DEFECTO;
  const c = temaCounts(tema, map);
  const inner = tema.nodes.map(n => nodeHtml(tema.id, n, map)).join('');
  const maxChild = Math.max(tLv, ...tema.nodes.map(n => branchMax(map, n)), NIVEL_DEFECTO);
  /* El tema entero se oculta si TODO lo suyo se oculta: su propio nivel y cada
     rama. Un tema marcado «omitir» desaparece del plan aunque dentro tenga cosas
     sin marcar — decidir saltarse un tema es decidirlo entero. */
  const hide = (tLv === NIVEL_OMITIR || (oculta(maxChild) && tema.nodes.every(n => ocultaRama(map, n))))
    ? ' sp-hidden' : '';
  const hasNodes = tema.nodes.length > 0;
  const key = 't:' + tema.id;
  const col = plegado(key) ? ' collapsed' : '';
  return '<div class="sp-group sp-tema-group' + hide + col + '" data-key="' + esc(key) + '">'
    + '<div class="sp-row sp-tema" data-level="' + tLv + '">'
    +   (hasNodes ? '<button class="sp-caret" type="button" aria-label="Plegar/desplegar">' + caretGlyph(key) + '</button>' : '<span class="sp-indent"></span>')
    +   '<a class="sp-label sp-tema-label" href="#/tema/' + esc(tema.id) + '">Tema ' + esc(tema.num) + ' · ' + esc(tema.titulo) + '</a>'
    +   rollupHtml(c.alta, c.media, c.omit)
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
      const tot = temas.reduce((a, t) => { const c = temaCounts(t, levelsMap(t.id)); a.alta += c.alta; a.media += c.media; a.omit += c.omit; return a; }, { alta: 0, media: 0, omit: 0 });
      const mkey = 'm:' + m.id;
      html += '<div class="sp-group sp-mat-group' + (collapsed.has(mkey) ? ' collapsed' : '') + '" data-key="' + esc(mkey) + '" style="--sp-accent:' + esc(m.accent || 'var(--ink)') + '">'
        + '<div class="sp-row sp-mat">'
        +   '<button class="sp-caret" type="button" aria-label="Plegar/desplegar">' + caretGlyph(mkey) + '</button>'
        +   '<span class="sp-label sp-mat-label">' + esc(m.label) + '</span>'
        +   rollupHtml(tot.alta, tot.media, tot.omit)
        + '</div>'
        + '<div class="sp-children">' + inner + '</div></div>';
    });
  } else {
    html = s.map(temaHtml).join('');
  }
  return html || '<p class="sp-empty">No hay temas.</p>';
}

/* Ajusta el plegado global a una PROFUNDIDAD (atajo): materias · temas ·
   secciones · todo. Referencia la jerarquía por su nombre interno. */
function allKeys(){
  buildStructure();
  const mats = [], temas = [], secs = [];
  const walk = (temaId, n) => { if((n.children || []).length){ secs.push('x:' + temaId + '/' + n.gid); n.children.forEach(c => walk(temaId, c)); } };
  struct.forEach(t => { temas.push('t:' + t.id); t.nodes.forEach(n => walk(t.id, n)); });
  if(hasMaterias()) materiasWithTemas().forEach(m => mats.push('m:' + m.id));
  return { mats, temas, secs };
}
function applyDepth(depth){
  const { mats, temas, secs } = allKeys();
  collapsed.clear();
  if(depth === 'materias') [...mats, ...temas, ...secs].forEach(k => collapsed.add(k));
  else if(depth === 'temas') [...temas, ...secs].forEach(k => collapsed.add(k));
  else if(depth === 'secciones') secs.forEach(k => collapsed.add(k));
  // 'todo' → sin plegados
  render();
}

function render(){
  body.innerHTML =
    '<div class="sp-toolbar">'
    + '<span class="sp-lede">Marca la prioridad de cada tema, sección y punto; pliega o filtra para ver antes lo importante.</span>'
    + '<div class="sp-controls">'
    +   '<div class="sp-expand" role="group" aria-label="Nivel de vista">'
    +     '<span class="sp-ctl-lbl">Ver:</span>'
    +     '<button type="button" data-depth="materias">Materias</button>'
    +     '<button type="button" data-depth="temas">Temas</button>'
    +     '<button type="button" data-depth="secciones">Secciones</button>'
    +     '<button type="button" data-depth="todo">Todo</button>'
    +   '</div>'
    +   '<div class="sp-filter" role="group" aria-label="Filtrar por prioridad">'
    +     '<span class="sp-ctl-lbl">Prioridad:</span>'
    +     '<button type="button" data-min="0"' + (filterMin === 0 && !filterSolo ? ' class="on"' : '') + '>Todo</button>'
    +     '<button type="button" data-min="2"' + (filterMin === 2 && !filterSolo ? ' class="on"' : '') + '>≥ Media</button>'
    +     '<button type="button" data-min="3"' + (filterMin === 3 && !filterSolo ? ' class="on"' : '') + '>Solo alta</button>'
    +     '<button type="button" data-solo="omitir"' + (filterSolo ? ' class="on"' : '') + '>Omitibles</button>'
    +   '</div>'
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
    const dep = e.target.closest('.sp-expand button');
    if(dep){ applyDepth(dep.getAttribute('data-depth')); return; }
    const label = e.target.closest('.sp-label[href]');
    if(label){ closeStudyPlan(); /* el href (#/…) navega solo */ return; }
    const f = e.target.closest('.sp-filter button');
    if(f){
      if(f.hasAttribute('data-solo')){ filterSolo = filterSolo ? 0 : NIVEL_OMITIR; }
      else { filterSolo = 0; filterMin = parseInt(f.getAttribute('data-min'), 10) || 0; }
      render();
    }
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

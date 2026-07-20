import { allTemas, temaById, bloqueOf, hasMaterias, materiasWithTemas, temasOfMateria } from '../registry.js';
import { esc } from '../core/dom.js';
import { config } from '../config.js';
import { getLatestBookmark, clearBookmark, anchorLabel, relTime } from '../core/bookmark.js';
import { openSearch, SEARCH_ICON } from '../core/search-ui.js';
import { bindMateriaCards } from '../core/materia-cards.js';
import { openExam } from './examen.js';
import { openStudyPlan } from '../core/studyplan.js';

/* Portada y hubs. Con `appConfig.materias`, la portada (#/) es un SELECTOR de
   materias (tarjetas) y cada materia tiene su propio hub (#/materia/<id>) con sus
   temas. Sin materias, la portada es directamente la lista de temas (comportamiento
   de una sola materia). Todo se genera del registry; textos desde appConfig. */

function resumeCardHtml(){
  const b = getLatestBookmark();
  if(!b) return '';
  const tema = temaById(b.temaId);
  if(!tema) return '';
  const idx = allTemas().indexOf(tema);
  const art = anchorLabel(b.temaId, b.anchor);
  return `
      <a class="resume-card" href="#/tema/${b.temaId}/${b.anchor}" id="resumeCard">
        <span class="rc-ico">↩</span>
        <span class="rc-body">
          <span class="rc-k">Seguir donde lo dejaste · ${esc(relTime(b.ts))}</span>
          <span class="rc-t">Tema ${idx + 1} — ${esc(tema.titulo)}${art ? ' · ' + esc(art) : ''}</span>
        </span>
        <button class="rc-close" id="resumeDismiss" type="button" aria-label="Descartar marcador" title="Descartar">✕</button>
      </a>`;
}

function searchBarHtml(){
  return `
        <button class="hub-search search-trigger" id="hubSearchBtn" type="button">
          <span class="hs-ico">${SEARCH_ICON}</span>
          <span class="hs-txt">Buscar un concepto o un punto del temario…</span>
          <span class="st-key">⌘K</span>
        </button>`;
}

/* Acceso discreto al Plan de estudio (árbol de prioridades) desde los hubs: el
   desplegable "Temas" solo existe dentro de un tema, y el plan es global.
   Va en el hub que LISTA TEMAS: con materias, el de cada materia (la portada es
   solo un selector); sin materias, la portada, que ya es la lista de temas. Si
   no, una app de una sola materia se queda sin acceso al plan desde el inicio. */
function hubToolsHtml(){
  return `
        <div class="hub-tools">
          <button class="hub-tool" id="hubPlanBtn" type="button"><span aria-hidden="true">📋</span> Plan de estudio</button>
        </div>`;
}

function temaCardHtml(t){
  return `
            <a class="tema-card" style="--accent:${t.accent}" href="#/tema/${t.id}">
              <div class="tema-num">${esc(t.numeral)}</div>
              <div class="tema-body">
                <div class="tema-k">${esc(t.k)}</div>
                <div class="tema-title">${esc(t.titulo)}</div>
                <div class="tema-desc">${esc(t.descripcion)}</div>
              </div>
              <div class="tema-arrow">→</div>
            </a>`;
}
/* Badge en abanico (Images Badge): los numerales de los temas, solapados; al
   pasar el ratón por la tarjeta se despliegan. */
function fanBadgeHtml(temas){
  const chips = temas.slice(0, 4).map((t, i) =>
    `<span class="mc-chip" style="--i:${i};--chip-accent:${t.accent || 'var(--ink)'}">${esc(String(t.numeral || i + 1))}</span>`
  ).join('');
  const n = temas.length;
  return `<span class="mc-badge"><span class="mc-chips">${chips}</span><span class="mc-badge-t">${n} tema${n === 1 ? '' : 's'}</span></span>`;
}
function materiaCardHtml(m){
  const iconHtml = m.icon
    ? `<div class="mc-icon" data-icon="${esc(m.icon)}" data-depth="46"></div>`
    : `<div class="tema-num" data-depth="46">${esc(m.numeral || (m.label || '·').slice(0, 1))}</div>`;
  return `
            <a class="tema-card materia-card mc-3d" style="--accent:${m.accent || 'var(--ink)'}" href="#/materia/${m.id}">
              ${iconHtml}
              <div class="tema-body" data-depth="22">
                <div class="tema-k">${fanBadgeHtml(m.temas)}</div>
                <div class="tema-title">${esc(m.label)}</div>
                <div class="tema-desc">${esc(m.descripcion || '')}</div>
              </div>
              <div class="tema-arrow" data-depth="34">→</div>
            </a>`;
}
/* Tarjeta que ABRE el overlay de examen (no navega). Con materiaId, el examen
   se acota a esa materia; sin él, banco global. */
function examCardHtml(cfg, materiaId){
  const kicker = materiaId ? 'Solo esta materia' : 'Banco único · todos los temas';
  return `
            <a class="tema-card mc-3d" style="--accent:var(--ink)" href="#" role="button" data-exam data-materia="${esc(materiaId || '')}">
              <div class="mc-icon" data-icon="exam" data-depth="46"></div>
              <div class="tema-body" data-depth="22">
                <div class="tema-k">${kicker}</div>
                <div class="tema-title">Examen</div>
                <div class="tema-desc">${cfg.examLede || 'Preguntas filtrables por apartado, con temporizador opcional y asistente de dudas.'}</div>
              </div>
              <div class="tema-arrow" data-depth="34">→</div>
            </a>`;
}

/* Agrupa una lista de temas por `bloque` (si alguno lo declara); si no, un solo
   grupo sin cabecera. Genérico y acotado a los temas que se le pasen (para poder
   agrupar SOLO los de una materia). */
function groupByBloque(temas){
  if(!temas.some(t => t.bloque)) return [{ label: null, temas }];
  const groups = [], byId = new Map();
  temas.forEach(t => {
    const b = bloqueOf(t), key = b ? b.id : ' ';
    let g = byId.get(key);
    if(!g){ g = { label: b ? b.label : null, temas: [] }; byId.set(key, g); groups.push(g); }
    g.temas.push(t);
  });
  return groups;
}
function temaCardsHtml(temas){
  return groupByBloque(temas).map(g =>
    (g.label ? `<h2 class="bloque-head">${esc(g.label)}</h2>` : '')
    + `<div class="temas">${g.temas.map(temaCardHtml).join('')}</div>`
  ).join('');
}

function wireHub(root){
  const sb = root.querySelector('#hubSearchBtn');
  if(sb) sb.addEventListener('click', openSearch);
  const planBtn = root.querySelector('#hubPlanBtn');
  if(planBtn) planBtn.addEventListener('click', openStudyPlan);
  const examLink = root.querySelector('[data-exam]');
  if(examLink) examLink.addEventListener('click', (e) => {
    e.preventDefault();
    openExam({ materiaId: examLink.getAttribute('data-materia') || null });
  });
  const dismiss = root.querySelector('#resumeDismiss');
  if(dismiss){
    dismiss.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const b = getLatestBookmark(); if(b) clearBookmark(b.temaId);
      const card = root.querySelector('#resumeCard');
      if(card) card.remove();
    });
  }
  bindMateriaCards(root);   // iconos animados + tilt 3D de las tarjetas mc-3d
}

/* Portada (#/): selector de materias si las hay; si no, la lista de temas. */
export const temarioView = {
  mount(root){
    const cfg = config();
    const body = hasMaterias()
      ? `<div class="temas">${materiasWithTemas().map(materiaCardHtml).join('')}</div>
         <div class="temas">${examCardHtml(cfg)}</div>`
      : `${temaCardsHtml(allTemas())}<div class="temas">${examCardHtml(cfg)}</div>`;
    root.innerHTML = `
      <div class="wrap">
        <p class="eyebrow">${cfg.eyebrow || ''}</p>
        <h1>${cfg.title || 'Temario'}</h1>
        <p class="lede">${cfg.lede || 'Un esquema navegable por cada tema: tarjetas, referencias cruzadas, examen y minijuegos.'}</p>
        ${searchBarHtml()}
        ${hasMaterias() ? '' : hubToolsHtml()}
        ${resumeCardHtml()}
        ${body}
        ${cfg.footer ? `<footer>${cfg.footer}</footer>` : ''}
      </div>`;
    wireHub(root);
  }
};

/* Hub de una materia (#/materia/<id>): cabecera de la materia + sus temas. */
export const materiaView = {
  mount(root, route){
    const cfg = config();
    const m = materiasWithTemas().find(x => x.id === route.materiaId);
    if(!m){ location.hash = '#/'; return; }
    root.innerHTML = `
      <div class="wrap">
        <a class="btn ghost hub-back" href="#/">← Materias</a>
        <p class="eyebrow">${esc(cfg.title || 'Temario')}</p>
        <h1>${esc(m.label)}</h1>
        <p class="lede">${esc(m.descripcion || '')}</p>
        ${searchBarHtml()}
        ${hubToolsHtml()}
        ${temaCardsHtml(m.temas)}
        <div class="temas">${examCardHtml(cfg, m.id)}</div>
      </div>`;
    wireHub(root);
  }
};

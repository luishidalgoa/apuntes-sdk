import { allTemas, temaById, bloqueOf, hasMaterias, materiasWithTemas, temasOfMateria } from '../registry.js';
import { esc } from '../core/dom.js';
import { config } from '../config.js';
import { getBookmark, clearBookmark, anchorLabel, relTime } from '../core/bookmark.js';
import { openSearch, SEARCH_ICON } from '../core/search-ui.js';

/* Portada y hubs. Con `appConfig.materias`, la portada (#/) es un SELECTOR de
   materias (tarjetas) y cada materia tiene su propio hub (#/materia/<id>) con sus
   temas. Sin materias, la portada es directamente la lista de temas (comportamiento
   de una sola materia). Todo se genera del registry; textos desde appConfig. */

function resumeCardHtml(){
  const b = getBookmark();
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
function materiaCardHtml(m){
  const n = m.temas.length;
  return `
            <a class="tema-card materia-card" style="--accent:${m.accent || 'var(--ink)'}" href="#/materia/${m.id}">
              <div class="tema-num">${esc(m.numeral || (m.label || '·').slice(0, 1))}</div>
              <div class="tema-body">
                <div class="tema-k">${n} tema${n === 1 ? '' : 's'}</div>
                <div class="tema-title">${esc(m.label)}</div>
                <div class="tema-desc">${esc(m.descripcion || '')}</div>
              </div>
              <div class="tema-arrow">→</div>
            </a>`;
}
function examCardHtml(cfg){
  return `
            <a class="tema-card" style="--accent:var(--ink)" href="#/examen">
              <div class="tema-num">📝</div>
              <div class="tema-body">
                <div class="tema-k">Banco único · todos los temas</div>
                <div class="tema-title">Examen</div>
                <div class="tema-desc">${cfg.examLede || 'Preguntas filtrables por bloque, con temporizador opcional y asistente de dudas.'}</div>
              </div>
              <div class="tema-arrow">→</div>
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
  const dismiss = root.querySelector('#resumeDismiss');
  if(dismiss){
    dismiss.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      clearBookmark();
      const card = root.querySelector('#resumeCard');
      if(card) card.remove();
    });
  }
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
        ${temaCardsHtml(m.temas)}
        <div class="temas">${examCardHtml(cfg)}</div>
      </div>`;
    wireHub(root);
  }
};

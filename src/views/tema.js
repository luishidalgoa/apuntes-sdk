/* Vista genérica de tema: cabecera + barra de controles uniforme + contenido
   del manifiesto (template estático de T1 o tarjetas data-driven de T2). */
import { allTemas, temaById, bloqueOf, hasMaterias, materiaOf, temasOfMateria } from '../registry.js';
import { setTemaContext, bindRefModeSegment, revealAnchor, closePanel, closeFullText } from '../core/panels.js';
import { bindCardInteractions, bindToggleAll, bindRepaso } from '../core/render-tema.js';
import { bindTabletButton } from '../core/tablet.js';
import { openGames, closeGames } from '../games/engine.js';
import { bindDropdown } from '../core/dropdown.js';
import { createBookmarkUI, markAnchor, anchorFromClick, clearBookmark, getBookmark } from '../core/bookmark.js';
import { bindMarks } from '../core/marks.js';
import { bindHighlighting, applyHighlightsInto, toggleHighlight, registerHighlightButton } from '../core/highlight.js';
import { exportBackup, importBackup } from '../core/backup.js';
import { registerLayer } from '../core/modal-stack.js';
import { openSearch, SEARCH_ICON } from '../core/search-ui.js';

const ICONS = {
  all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  ref: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  exam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  games: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="12" rx="4"/><line x1="8" y1="11" x2="8" y2="15"/><line x1="6" y1="13" x2="10" y2="13"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="14" r="1"/></svg>',
  tablet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>'
};

/* Navegación: enlace al hub + desplegable de temas (sin flechas). */
function temaItemHtml(t, current){
  const i = allTemas().indexOf(t);
  // número real del tema (de su `k`, p.ej. "Tema 2 · …"); si no, la posición
  const n = (String(t.k || '').match(/Tema\s+(\d+)/i) || [])[1] || String(i + 1);
  // los bloques/secciones del tema (sus chips de salto), separados y con ellipsis
  const blq = (t.chips || []).map(c => c.label).join(' · ');
  return `
                <a class="opts-item${t === current ? ' on' : ''}" href="#/tema/${t.id}">
                  <span class="ti-num">${n}</span>
                  <span class="ti-body"><span class="ti-title">Tema ${n} — ${t.titulo}</span>${blq ? `<span class="ti-desc">${blq}</span>` : `<span class="ti-desc">${t.descripcion || ''}</span>`}</span>
                </a>`;
}
function temasDropdownHtml(tema){
  // Con materias, el desplegable se acota a los temas de la materia actual
  // (navegas dentro de tu materia). Dentro, si hay `bloque`, se agrupan; si no,
  // lista plana. Sin materias, lista todos los temas (retrocompatible).
  const mat = hasMaterias() ? materiaOf(tema) : null;
  const temas = mat ? temasOfMateria(mat.id) : allTemas();
  let inner;
  if(temas.some(t => t.bloque)){
    const groups = [], byId = new Map();
    temas.forEach(t => {
      const b = bloqueOf(t), key = b ? b.id : ' ';
      let g = byId.get(key);
      if(!g){ g = { label: b ? b.label : null, temas: [] }; byId.set(key, g); groups.push(g); }
      g.temas.push(t);
    });
    inner = groups.map(g =>
      (g.label ? `<div class="ti-bloque-head" role="presentation">${g.label}</div>` : '')
      + g.temas.map(t => temaItemHtml(t, tema)).join('')
    ).join('');
  } else {
    inner = temas.map(t => temaItemHtml(t, tema)).join('');
  }
  return `
            <div class="opts-wrap">
              <button class="btn ghost" id="temasBtn" aria-haspopup="true" aria-expanded="false">Temas</button>
              <div class="opts-pop opts-pop-left" id="temasPop" role="menu" hidden>
                ${inner}
              </div>
            </div>`;
}

/* Saltos de sección dentro de la página (fila propia bajo los controles). */
function sectionJumpHtml(tema){
  if(!tema.chips || !tema.chips.length) return '';
  return `<div class="section-jump reveal" style="animation-delay:.08s">
        <span class="sj-label">En esta página</span>
        ${tema.chips.map(c => `<a class="chip ${c.cls}" href="#/tema/${tema.id}/${c.anchor}">${c.label}</a>`).join('\n        ')}
      </div>`;
}

export const temaViewFactory = {
  create(){
    let ac = null;
    return {
      mount(root, route){
        const tema = temaById(route.temaId);
        if(!tema){
          location.hash = '#/';
          return;
        }
        ac = new AbortController();
        const { signal } = ac;

        // Con materias, "volver" lleva al hub de la materia del tema; si no, a la portada.
        const mat = hasMaterias() ? materiaOf(tema) : null;
        const backHref = mat ? '#/materia/' + mat.id : '#/';
        const backLabel = mat ? '← ' + mat.label : '📚 Temario';

        root.innerHTML = `
      <div class="wrap" style="--tema-accent:${tema.accent}">
        <header class="top reveal">${tema.headerHtml}</header>
        <nav class="controls reveal" style="animation-delay:.05s" aria-label="Navegación del tema">
          <div class="nav-left">
            <a class="btn ghost" href="${backHref}">${backLabel}</a>
            ${temasDropdownHtml(tema)}
          </div>
          <button class="nav-search search-trigger" id="searchBtn" type="button" title="Buscar en el temario (⌘K / /)" aria-label="Buscar en el temario">
            <span class="hs-ico">${SEARCH_ICON}</span>
            <span class="hs-txt">Buscar en el temario…</span>
            <span class="st-key">⌘K</span>
          </button>
          <div class="nav-right">
            <a class="btn action" href="#/examen/${tema.id}">${ICONS.exam} Examen</a>
            <button class="btn icon-btn" id="bookmarkBtn" type="button" title="Marcar aquí" aria-label="Marcar aquí">🔖</button>
            <button class="btn icon-btn" id="highlightBtn" type="button" title="Subrayar" aria-label="Subrayar" aria-pressed="false">🖍️</button>
            <div class="opts-wrap">
              <button class="btn" id="optsBtn" aria-haspopup="true" aria-expanded="false">${ICONS.gear} Opciones</button>
              <div class="opts-pop" id="optsPop" role="menu" hidden>
                <div class="opts-row opts-row-seg">
                  <span class="opts-label">Referencias</span>
                  <span class="seg" role="group" aria-label="Modo de referencias">
                    <button class="seg-btn" type="button" data-mode="panel">Panel</button>
                    <button class="seg-btn" type="button" data-mode="jump">Saltar</button>
                  </span>
                </div>
                <button class="opts-item" id="toggleAll">${ICONS.all} Desplegar todo</button>
                <button class="opts-item" id="toggleRepaso">${ICONS.eye} Activar repaso</button>
                <button class="opts-item" id="toggleTablet">${ICONS.tablet} Modo tablet</button>
                <div class="opts-div" aria-hidden="true"></div>
                <button class="opts-item" id="startGamesBtn">${ICONS.games} Minijuegos</button>
                <div class="opts-div" aria-hidden="true"></div>
                <button class="opts-item" id="exportBackupBtn">${ICONS.download} Exportar copia</button>
                <button class="opts-item" id="importBackupBtn">${ICONS.upload} Importar copia</button>
              </div>
            </div>
          </div>
        </nav>
        ${sectionJumpHtml(tema)}
        <div id="temaContent"></div>
      </div>`;

        tema.renderContent(root.querySelector('#temaContent'));
        setTemaContext(tema.engine);

        root.querySelector('#searchBtn').addEventListener('click', openSearch, { signal });

        bindCardInteractions(root, { signal });
        bindMarks(root.querySelector('#temaContent'), tema.id, { signal });   // ★ marcar importante

        /* 🖍️ subrayado: reaplica los guardados, engancha selección/quitar y el botón */
        const hlRoot = root.querySelector('#temaContent');
        applyHighlightsInto(hlRoot, tema.id);
        bindHighlighting(hlRoot, tema.id, { signal });
        const highlightBtn = root.querySelector('#highlightBtn');
        registerHighlightButton(highlightBtn);
        highlightBtn.addEventListener('click', () => toggleHighlight(), { signal });
        bindToggleAll(root.querySelector('#toggleAll'), root, { signal });
        bindRepaso(root.querySelector('#toggleRepaso'), root, { signal });
        bindRefModeSegment(root.querySelector('.seg'), { signal });
        bindTabletButton(root.querySelector('#toggleTablet'), { signal });

        /* Desplegables del navbar: Temas (navegación) y Opciones (herramientas).
           En Opciones los clics internos NO cierran el menú (son toggles). */
        bindDropdown(root.querySelector('#temasBtn'), root.querySelector('#temasPop'), { signal });
        const opts = bindDropdown(root.querySelector('#optsBtn'), root.querySelector('#optsPop'), { signal, closeOnItemClick: false });

        root.querySelector('#startGamesBtn').addEventListener('click', () => {
          opts.close();
          openGames(tema.engine, tema.games);
        }, { signal });

        root.querySelector('#exportBackupBtn').addEventListener('click', () => {
          opts.close();
          exportBackup();
        }, { signal });
        root.querySelector('#importBackupBtn').addEventListener('click', () => {
          opts.close();
          importBackup({ onDone: () => location.reload() });
        }, { signal });

        /* Marcapáginas: botón 🔖 fijo en la barra. Al pulsarlo se entra en modo
           "elegir": tocas el artículo (o subpunto) donde quieres la marca y la
           pestañita cuelga de esa tarjeta, con el tallo estirado hasta el
           subpunto exacto. La pestañita también abre este modo (cambiar/quitar). */
        const bookmarkBtn = root.querySelector('#bookmarkBtn');
        const content = root.querySelector('#temaContent');

        const hint = document.createElement('div');
        hint.className = 'bm-hint';
        hint.hidden = true;
        hint.innerHTML = '<span class="bm-hint-txt">🔖 Toca el artículo donde quieres el marcapáginas</span>'
          + '<button class="btn small" id="bmRemove" type="button" hidden>Quitar</button>'
          + '<button class="btn small" id="bmCancel" type="button">Cancelar</button>';
        root.querySelector('.wrap').appendChild(hint);

        let placing = false;
        const bookmarkUI = createBookmarkUI(root, tema.id, { onTabClick: () => { if(!placing) enterPlacing(); } });
        function refreshBookmarkUI(){
          const marked = !!getBookmark(tema.id);
          bookmarkBtn.classList.toggle('on', marked);
          const label = marked ? 'Cambiar o quitar el marcapáginas' : 'Poner un marcapáginas';
          bookmarkBtn.title = label;
          bookmarkBtn.setAttribute('aria-label', label);
        }
        function enterPlacing(){
          placing = true;
          document.body.classList.add('bookmark-placing');
          hint.querySelector('#bmRemove').hidden = !getBookmark(tema.id);
          hint.hidden = false;
          bookmarkBtn.classList.add('on');
        }
        function exitPlacing(){
          placing = false;
          document.body.classList.remove('bookmark-placing');
          hint.hidden = true;
          refreshBookmarkUI();
        }

        const existing = getBookmark(tema.id);
        if(bookmarkUI && existing) bookmarkUI.show(existing.anchor, { animate: false });
        refreshBookmarkUI();

        bookmarkBtn.addEventListener('click', () => { placing ? exitPlacing() : enterPlacing(); }, { signal });
        hint.querySelector('#bmCancel').addEventListener('click', exitPlacing, { signal });
        hint.querySelector('#bmRemove').addEventListener('click', () => {
          clearBookmark(tema.id);
          if(bookmarkUI) bookmarkUI.hide();
          exitPlacing();
        }, { signal });

        /* En modo colocar, el clic elige el artículo (y no dispara refs/paneles). */
        content.addEventListener('click', (e) => {
          if(!placing) return;
          if(e.target.closest('.disclosure')) return;   // dejar desplegar/plegar para navegar
          if(e.target.closest('.mark-btn')) return;      // la estrella no coloca marcapáginas
          if(e.target.closest('.bm-tab')) return;        // la propia pestañita no re-coloca
          const anchor = anchorFromClick(e.target);
          if(!anchor) return;
          e.preventDefault();
          e.stopPropagation();
          markAnchor(tema.id, anchor);
          if(bookmarkUI) bookmarkUI.show(anchor, { animate: true });
          exitPlacing();
        }, { capture: true, signal });

        registerLayer({ isOpen: () => placing, close: exitPlacing, priority: 25 });

        if(route.anchor){
          /* en la primera carga, esperar a las fuentes: el swap tipográfico
             recoloca el layout y dejaría el scroll descentrado */
          const go = () => setTimeout(() => revealAnchor(route.anchor), 0);
          if(document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(go);
          else go();
        }

        return () => {
          ac.abort();
          setTemaContext(null);
          closePanel();
          closeFullText();
          closeGames();
          if(bookmarkUI) bookmarkUI.destroy();
          document.body.classList.remove('repaso', 'panel-open', 'fulltext-open', 'bookmark-placing');
        };
      },
      update(route){
        if(route.anchor) revealAnchor(route.anchor);
      }
    };
  }
};

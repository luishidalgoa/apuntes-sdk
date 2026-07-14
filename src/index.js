/* Punto de entrada JS del SDK de apuntes. La app hace:

     import 'apuntes-sdk/styles';
     import './palette.css';
     import { createApp } from 'apuntes-sdk';
     import { TEMAS } from './registry.js';
     createApp(appConfig, TEMAS);

   createApp inyecta la config y el registro de temas, monta el shell (una vez)
   y arranca el router hash. Los manifiestos de cada tema usan los helpers de
   render reexportados abajo. */
import { CRAYON_FILTERS } from './core/dom.js';
import { createRouter } from './router.js';
import { mountPanels } from './core/panels.js';
import { mountGamesOverlay } from './games/engine.js';
import { installEscapeHandler } from './core/modal-stack.js';
import { applyTabletMode } from './core/tablet.js';
import { temarioView, materiaView } from './views/temario.js';
import { temaViewFactory } from './views/tema.js';
import { mountExamOverlay } from './views/examen.js';
import { mountRefPreview } from './exam/preview.js';
import { mountHighlight } from './core/highlight.js';
import { mountSearch } from './core/search-ui.js';
import { setConfig } from './config.js';
import { setRegistry } from './registry.js';

/* Tiñe el chrome del navegador (barra superior de Safari iOS, Android) con el
   papel de la app: inyecta <meta name="theme-color"> con el token --paper
   computado (cada paleta puede sobreescribirlo). Si el index.html de la app ya
   trae uno estático (recomendado: evita el flash blanco antes del JS), se
   respeta y no se duplica. Complementa a html{background} de base.css. */
function ensureThemeColor(){
  if(document.querySelector('meta[name="theme-color"]')) return;
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  const m = document.createElement('meta');
  m.name = 'theme-color';
  m.content = paper || '#FBF7EF';
  document.head.appendChild(m);
}

export function createApp(appConfig, temas, { mountEl } = {}){
  setConfig(appConfig);
  setRegistry(temas);
  ensureThemeColor();

  const app = mountEl || document.getElementById('app');
  app.insertAdjacentHTML('beforeend', CRAYON_FILTERS);
  const viewRoot = document.createElement('div');
  viewRoot.id = 'view';
  app.appendChild(viewRoot);
  mountPanels(app);
  mountGamesOverlay(app);
  mountExamOverlay(app);   // examen como overlay (SPA), no como ruta
  mountRefPreview(app);
  mountHighlight(app);
  mountSearch(app);
  installEscapeHandler();
  applyTabletMode();

  createRouter({
    root: viewRoot,
    views: { hub: temarioView, materia: materiaView, tema: temaViewFactory },
    ctx: {}
  });
}

/* API pública para los manifiestos de tema y juegos custom de la app */
export { esc, CRAYON_FILTERS } from './core/dom.js';
export { linkify, renderCard, renderArtRow, renderCardTreesInto, renderSectionsInto, renderArticleBlock, specialTagChip } from './core/render-tema.js';
export { config, anchorId } from './config.js';
export { revealAnchor } from './core/panels.js';
export { bindMarks, markButton, isMarked, toggleMark, markedIds, markLevel, cycleMark } from './core/marks.js';
export { renderInfographic, renderInfographicInto, INFO_ICONS } from './core/infographic.js';
export { bindHighlighting, applyHighlightsInto, toggleHighlight, registerHighlightButton,
         isHighlightOn, getColors as getHighlightColors, setColors as setHighlightColors } from './core/highlight.js';
export { exportBackup, importBackup, buildBackup, applyBackup } from './core/backup.js';
export { openExam, closeExam } from './views/examen.js';
export { mountSearch, openSearch, closeSearch, SEARCH_ICON } from './core/search-ui.js';
export { buildIndex, warmIndex, invalidateIndex, searchContent } from './core/content-index.js';
export { bindScrollReveal, unbindScrollReveal } from './core/scroll-reveal.js';
export { bindMateriaCards, MATERIA_ICONS } from './core/materia-cards.js';

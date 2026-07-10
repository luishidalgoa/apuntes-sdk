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
import { examenViewFactory } from './views/examen.js';
import { mountRefPreview } from './exam/preview.js';
import { mountBookmarkSettings } from './core/bookmark-settings.js';
import { mountHighlight } from './core/highlight.js';
import { mountSearch } from './core/search-ui.js';
import { setConfig } from './config.js';
import { setRegistry } from './registry.js';

export function createApp(appConfig, temas, { mountEl } = {}){
  setConfig(appConfig);
  setRegistry(temas);

  const app = mountEl || document.getElementById('app');
  app.insertAdjacentHTML('beforeend', CRAYON_FILTERS);
  const viewRoot = document.createElement('div');
  viewRoot.id = 'view';
  app.appendChild(viewRoot);
  mountPanels(app);
  mountGamesOverlay(app);
  mountRefPreview(app);
  mountBookmarkSettings(app);
  mountHighlight(app);
  mountSearch(app);
  installEscapeHandler();
  applyTabletMode();

  createRouter({
    root: viewRoot,
    views: { hub: temarioView, materia: materiaView, tema: temaViewFactory, examen: examenViewFactory },
    ctx: {}
  });
}

/* API pública para los manifiestos de tema y juegos custom de la app */
export { esc, CRAYON_FILTERS } from './core/dom.js';
export { linkify, renderCard, renderArtRow, renderCardTreesInto, renderSectionsInto, renderArticleBlock, specialTagChip } from './core/render-tema.js';
export { config, anchorId } from './config.js';
export { revealAnchor } from './core/panels.js';
export { openBookmarkSettings } from './core/bookmark-settings.js';
export { bindMarks, markButton, isMarked, toggleMark, markedIds } from './core/marks.js';
export { renderInfographic, renderInfographicInto, INFO_ICONS } from './core/infographic.js';
export { bindHighlighting, applyHighlightsInto, toggleHighlight, registerHighlightButton,
         isHighlightOn, getColors as getHighlightColors, setColors as setHighlightColors } from './core/highlight.js';
export { exportBackup, importBackup, buildBackup, applyBackup } from './core/backup.js';
export { mountSearch, openSearch, closeSearch, SEARCH_ICON } from './core/search-ui.js';
export { buildIndex, warmIndex, invalidateIndex, searchContent } from './core/content-index.js';
export { bindScrollReveal, unbindScrollReveal } from './core/scroll-reveal.js';

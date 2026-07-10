/* "Ver en el temario" del examen: el modal renderiza la sección DIRECTAMENTE
   desde los datos del tema dueño, con resolución cross-tema vía externalPrefixes
   (p.ej. una clave con prefijo cuyo contenido vive en otro tema) y degradación
   clara para secciones fuera del temario. */
import { allTemas } from '../registry.js';
import { config, anchorId } from '../config.js';
import { splitKey, buildPanelContent } from '../core/panels.js';
import { registerLayer } from '../core/modal-stack.js';

let overlay, titleEl, bodyEl, gotoBtn;
let currentTarget = null;

/* Busca qué tema puede resolver el `articulo` de una pregunta.
   Devuelve {tema, key} o null si ningún tema lo cubre. */
export function resolveQuestionRef(q){
  if(!q.articulo) return null;
  const key = String(q.articulo);
  for(const t of allTemas()){
    const [base] = splitKey(key, t.engine.keySplit);
    if(t.engine.sections[base]) return { tema: t, key };
  }
  /* claves con prefijo de otro tema cuya sección vive en un tema con claves
     sin prefijo (p.ej. CE-62 → '62' del Tema 1). Los prefijos los declara la app. */
  for(const prefix of (config().externalPrefixes || [])){
    if(key.indexOf(prefix) === 0){
      const plain = key.slice(prefix.length);
      for(const t of allTemas()){
        const [base] = splitKey(plain, t.engine.keySplit);
        if(t.engine.sections[base]) return { tema: t, key: plain };
      }
    }
  }
  return null;
}

function anchorFor(tema, key){
  const [base, ap] = splitKey(key, tema.engine.keySplit);
  return anchorId(base, ap);
}

export function openRefPreview(q){
  const resolved = resolveQuestionRef(q);
  if(resolved){
    const { tema, key } = resolved;
    const content = buildPanelContent(tema.engine, key);
    const crossNote = (q.temaId && q.temaId !== tema.id)
      ? '<p><span class="sp-pill">Contenido de ' + tema.titulo + '</span></p>' : '';
    titleEl.textContent = content.title;
    bodyEl.innerHTML = crossNote + content.body;
    currentTarget = '#/tema/' + tema.id + '/' + anchorFor(tema, key);
    gotoBtn.style.display = '';
    gotoBtn.setAttribute('href', currentTarget);
  } else {
    titleEl.textContent = (q.articulo ? q.articulo + ' · ' : '') + 'fuera del temario actual';
    bodyEl.innerHTML =
      '<p><span class="sp-pill">Fuera del esquema</span></p>'
      + '<p>Este contenido todavía no está desarrollado en ningún Tema del temario.</p>'
      + (q.explicacion ? ('<p><b>Explicación de la pregunta:</b> ' + q.explicacion + '</p>') : '');
    currentTarget = null;
    gotoBtn.style.display = 'none';
  }
  overlay.classList.add('open');
}

let cardEl = null;
export function closeRefPreview(){
  overlay.classList.remove('open');
  if(cardEl){ cardEl.style.transform = ''; }
  bodyEl.innerHTML = '';
}

export function mountRefPreview(shell){
  shell.insertAdjacentHTML('beforeend', `
<div id="refPreviewOverlay" role="dialog" aria-label="Vista previa del temario">
  <div class="ref-preview-card">
    <button class="ref-preview-grip" type="button" aria-label="Arrastra para ajustar o cerrar"></button>
    <div class="ref-preview-head">
      <span class="ref-preview-title" id="refPreviewTitle">Vista previa</span>
      <a class="btn small" id="refPreviewGoto" href="#/">Ir al tema →</a>
      <button class="ref-preview-close" type="button" aria-label="Cerrar">✕</button>
    </div>
    <div class="ref-preview-body" id="refPreviewBody"></div>
  </div>
</div>`);
  overlay = shell.querySelector('#refPreviewOverlay');
  cardEl = overlay.querySelector('.ref-preview-card');
  titleEl = overlay.querySelector('#refPreviewTitle');
  bodyEl = overlay.querySelector('#refPreviewBody');
  gotoBtn = overlay.querySelector('#refPreviewGoto');
  overlay.querySelector('.ref-preview-close').addEventListener('click', closeRefPreview);
  overlay.addEventListener('click', (e) => { if(e.target === overlay) closeRefPreview(); });
  gotoBtn.addEventListener('click', () => closeRefPreview());
  registerLayer({ isOpen: () => overlay.classList.contains('open'), close: closeRefPreview, priority: 40 });
  installSheetDrag(overlay.querySelector('.ref-preview-grip'), cardEl);
}

/* Arrastre del bottom-sheet (solo móvil): tirar del "grip" y soltar tras un
   desplazamiento vertical (en cualquier sentido) suficiente CIERRA la hoja;
   si no, vuelve a su sitio. Feedback en vivo siguiendo el dedo. En escritorio el
   grip está oculto (drawer lateral) y esto no interfiere. Pointer Events con
   captura → el gesto sigue aunque el dedo salga de la barra. */
function installSheetDrag(grip, card){
  if(!grip) return;
  let startY = 0, dy = 0, dragging = false;
  const onDown = (e) => {
    dragging = true; startY = e.clientY; dy = 0;
    card.style.transition = 'none';
    try{ grip.setPointerCapture(e.pointerId); }catch(_){}
  };
  const onMove = (e) => {
    if(!dragging) return;
    dy = e.clientY - startY;
    // abajo: sigue al dedo 1:1; arriba: resistencia (no debe crecer, solo asomar)
    const shown = dy >= 0 ? dy : -Math.min(48, Math.log1p(-dy) * 20);
    card.style.transform = 'translateY(' + shown + 'px)';
  };
  const onUp = (e) => {
    if(!dragging) return;
    dragging = false;
    card.style.transition = '';
    try{ grip.releasePointerCapture(e.pointerId); }catch(_){}
    if(Math.abs(dy) > 90){ closeRefPreview(); }   // desplazamiento claro → cerrar
    else { card.style.transform = ''; }           // insuficiente → vuelve a su sitio
  };
  grip.addEventListener('pointerdown', onDown);
  grip.addEventListener('pointermove', onMove);
  grip.addEventListener('pointerup', onUp);
  grip.addEventListener('pointercancel', onUp);
  grip.addEventListener('click', (e) => e.preventDefault());
}

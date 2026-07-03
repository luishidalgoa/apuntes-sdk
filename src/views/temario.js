import { allTemas, temaById } from '../registry.js';
import { esc } from '../core/dom.js';
import { config } from '../config.js';
import { getBookmark, clearBookmark, anchorLabel, relTime } from '../core/bookmark.js';

/* Hub: lista de temas generada del registry + acceso al examen + tarjeta
   "seguir donde lo dejaste" (marcador de lectura). Textos desde appConfig. */

function resumeCardHtml(){
  const b = getBookmark();
  if(!b) return '';
  const tema = temaById(b.temaId);
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

export const temarioView = {
  mount(root){
    const cfg = config();
    root.innerHTML = `
      <div class="wrap">
        <p class="eyebrow">${cfg.eyebrow || ''}</p>
        <h1>${cfg.title || 'Temario'}</h1>
        <p class="lede">${cfg.lede || 'Un esquema navegable por cada tema: tarjetas, referencias cruzadas, examen y minijuegos.'}</p>
        ${resumeCardHtml()}
        <div class="temas">
          ${allTemas().map((t, i) => `
            <a class="tema-card" style="--accent:${t.accent}" href="#/tema/${t.id}">
              <div class="tema-num">${esc(t.numeral)}</div>
              <div class="tema-body">
                <div class="tema-k">${esc(t.k)}</div>
                <div class="tema-title">${esc(t.titulo)}</div>
                <div class="tema-desc">${esc(t.descripcion)}</div>
              </div>
              <div class="tema-arrow">→</div>
            </a>`).join('')}

          <a class="tema-card" style="--accent:var(--ink)" href="#/examen">
            <div class="tema-num">📝</div>
            <div class="tema-body">
              <div class="tema-k">Banco único · todos los temas</div>
              <div class="tema-title">Examen</div>
              <div class="tema-desc">${cfg.examLede || 'Preguntas filtrables por bloque, con temporizador opcional y asistente de dudas.'}</div>
            </div>
            <div class="tema-arrow">→</div>
          </a>
        </div>
        ${cfg.footer ? `<footer>${cfg.footer}</footer>` : ''}
      </div>`;

    const dismiss = root.querySelector('#resumeDismiss');
    if(dismiss){
      dismiss.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearBookmark();
        root.querySelector('#resumeCard').remove();
      });
    }
  }
};

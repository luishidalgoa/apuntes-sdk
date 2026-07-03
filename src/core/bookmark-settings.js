/* Panel lateral derecho de ajustes del marcapáginas. Se abre desde el ítem
   "Marcapáginas" del menú Opciones. Por ahora: elegir el estilo de animación
   (cuerda / muelle); al elegir, se previsualiza en la cinta activa. */
import { registerLayer } from './modal-stack.js';
import { getBookmarkAnim, setBookmarkAnim, previewBookmarkAnim } from './bookmark.js';

let panel = null;

const ANIMS = [
  { id: 'cuerda', ico: '🪢', title: 'Cuerda', desc: 'Cinta flexible que ondula y se dobla como tela al caer.' },
  { id: 'muelle', ico: '🪀', title: 'Yo-yo', desc: 'La cinta arranca enrollada en espiral arriba y se desenrolla cayendo de arriba abajo, lento, hasta quedar recta.' }
];

function syncActive(){
  if(!panel) return;
  const cur = getBookmarkAnim();
  panel.querySelectorAll('.bks-opt').forEach(b => {
    const on = b.dataset.anim === cur;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

export function mountBookmarkSettings(shell){
  shell.insertAdjacentHTML('beforeend', `
<div id="bookmarkPanel" class="bks-panel" role="dialog" aria-label="Ajustes del marcapáginas">
  <div class="bks-head">
    <span class="bks-title">🔖 Marcapáginas</span>
    <button class="bks-close" type="button" aria-label="Cerrar">✕</button>
  </div>
  <div class="bks-body">
    <p class="bks-label">Animación al colocar el marcador</p>
    <div class="bks-opts">
      ${ANIMS.map(a => `
      <button class="bks-opt" type="button" data-anim="${a.id}" aria-pressed="false">
        <span class="bks-opt-ico">${a.ico}</span>
        <span class="bks-opt-body"><span class="bks-opt-t">${a.title}</span><span class="bks-opt-d">${a.desc}</span></span>
        <span class="bks-opt-check">✓</span>
      </button>`).join('')}
    </div>
    <p class="bks-hint">Se aplica la próxima vez que coloques el marcador (🔖). Si ya tienes uno puesto, se previsualiza al elegir.</p>
  </div>
</div>`);
  panel = shell.querySelector('#bookmarkPanel');
  panel.querySelector('.bks-close').addEventListener('click', closeBookmarkSettings);
  panel.querySelectorAll('.bks-opt').forEach(b => b.addEventListener('click', () => {
    setBookmarkAnim(b.dataset.anim);
    syncActive();
    previewBookmarkAnim();
  }));
  syncActive();
  registerLayer({ isOpen: () => panel.classList.contains('open'), close: closeBookmarkSettings, priority: 25 });
}

export function openBookmarkSettings(){
  if(!panel) return;
  syncActive();
  panel.classList.add('open');   // visibilidad y deslizado por CSS (.open), sin depender de rAF
}
export function closeBookmarkSettings(){
  if(!panel) return;
  panel.classList.remove('open');
}

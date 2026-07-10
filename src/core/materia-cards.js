/* Tarjetas "vivas" de materia/examen (inspiración: Aceternity UI).
   - Tilt 3D: la tarjeta rota siguiendo el ratón (perspective + rotateX/rotateY)
     y sus capas internas ([data-depth]) se ELEVAN con translateZ al hover
     (como el 3D Card Effect).
   - Iconos a medida por materia: escenas SVG dibujadas ex profeso (balanza,
     chip, examen…) montadas sobre una losa con gradiente del acento y ANIMADAS
     con Motion (la API vanilla de la casa de Framer Motion): la balanza oscila,
     el chip late y sus pistas fluyen, los checks se dibujan en secuencia.
   - Badge en abanico: los numerales de los temas de la materia, solapados, se
     despliegan al hover (como el Images Badge).
   Respeta `prefers-reduced-motion` (sin bucles ni tilt). */
import { animate } from 'motion';

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- catálogo de escenas (SVG a medida, no glifos genéricos) ---------- */
const S = (inner) => `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

export const MATERIA_ICONS = {
  /* Balanza de la justicia: el brazo oscila, los platillos cuelgan. */
  law: S(`
    <g class="ic-part ic-law">
      <line x1="32" y1="14" x2="32" y2="46" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <path d="M22 50h20" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="32" cy="12" r="3.2" fill="#fff"/>
      <g class="law-beam">
        <line x1="14" y1="18" x2="50" y2="18" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
        <g class="law-pan">
          <path d="M14 18v7" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>
          <path d="M7 25h14a7 7 0 0 1-14 0Z" fill="#fff" opacity=".92"/>
        </g>
        <g class="law-pan">
          <path d="M50 18v7" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>
          <path d="M43 25h14a7 7 0 0 1-14 0Z" fill="#fff" opacity=".92"/>
        </g>
      </g>
    </g>`),

  /* Chip/CPU: el núcleo late y las pistas del circuito fluyen. */
  chip: S(`
    <g class="ic-part ic-chip">
      <g stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8">
        <line x1="24" y1="6" x2="24" y2="14"/><line x1="32" y1="6" x2="32" y2="14"/><line x1="40" y1="6" x2="40" y2="14"/>
        <line x1="24" y1="50" x2="24" y2="58"/><line x1="32" y1="50" x2="32" y2="58"/><line x1="40" y1="50" x2="40" y2="58"/>
        <line x1="6" y1="24" x2="14" y2="24"/><line x1="6" y1="32" x2="14" y2="32"/><line x1="6" y1="40" x2="14" y2="40"/>
        <line x1="50" y1="24" x2="58" y2="24"/><line x1="50" y1="32" x2="58" y2="32"/><line x1="50" y1="40" x2="58" y2="40"/>
      </g>
      <rect x="14" y="14" width="36" height="36" rx="7" stroke="#fff" stroke-width="3" fill="rgba(255,255,255,.08)"/>
      <rect class="chip-core" x="25" y="25" width="14" height="14" rx="4" fill="#fff"/>
      <path class="chip-trace" d="M18 44c6 0 6-8 12-8" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 5" opacity=".85"/>
      <path class="chip-trace" d="M46 20c-6 0-6 8-12 8" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 5" opacity=".85"/>
    </g>`),

  /* Hoja de examen: los checks se dibujan uno tras otro. */
  exam: S(`
    <g class="ic-part ic-exam">
      <rect x="14" y="8" width="36" height="48" rx="7" stroke="#fff" stroke-width="3" fill="rgba(255,255,255,.08)"/>
      <path d="M24 8.5v-2a4 4 0 0 1 16 0v2" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>
      <g stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55">
        <line x1="30" y1="22" x2="43" y2="22"/><line x1="30" y1="33" x2="43" y2="33"/><line x1="30" y1="44" x2="43" y2="44"/>
      </g>
      <g stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <path class="exam-check" d="M20 22l2.6 2.6L27 20"/>
        <path class="exam-check" d="M20 33l2.6 2.6L27 31"/>
        <path class="exam-check" d="M20 44l2.6 2.6L27 42"/>
      </g>
    </g>`)
};

/* ---------- animaciones de cada escena (Motion) ---------- */
function animateScene(iconEl, kind){
  if(reduceMotion()) return;
  const part = iconEl.querySelector('.ic-part');
  if(part) animate(part, { y: [0, -2.5, 0] }, { duration: 3.8, repeat: Infinity, ease: 'easeInOut' });

  if(kind === 'law'){
    const beam = iconEl.querySelector('.law-beam');
    if(beam) animate(beam, { rotate: [-5, 5, -5] }, { duration: 4.2, repeat: Infinity, ease: 'easeInOut' });
  }
  if(kind === 'chip'){
    const core = iconEl.querySelector('.chip-core');
    if(core) animate(core, { opacity: [0.55, 1, 0.55], scale: [1, 1.12, 1] }, { duration: 1.9, repeat: Infinity, ease: 'easeInOut' });
    iconEl.querySelectorAll('.chip-trace').forEach((t, i) => {
      animate(t, { strokeDashoffset: [0, -18] }, { duration: 1.4 + i * 0.3, repeat: Infinity, ease: 'linear' });
    });
  }
  if(kind === 'exam'){
    iconEl.querySelectorAll('.exam-check').forEach((c, i) => {
      const len = c.getTotalLength ? c.getTotalLength() : 12;
      c.style.strokeDasharray = String(len);
      animate(c, { strokeDashoffset: [len, 0, 0, len] }, {
        duration: 3.2, delay: i * 0.35, repeat: Infinity, ease: 'easeInOut',
        times: [0, 0.25, 0.8, 1]
      });
    });
  }
}

/* ---------- tilt 3D (Aceternity 3D Card) ---------- */
const MAX_TILT = 9;
function bindTilt(card){
  const onMove = (e) => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform =
      `perspective(900px) rotateX(${(-py * MAX_TILT).toFixed(2)}deg) rotateY(${(px * MAX_TILT).toFixed(2)}deg)`;
  };
  const onEnter = () => { card.classList.add('mc-on'); card.classList.remove('mc-reset'); };
  const onLeave = () => {
    card.classList.remove('mc-on');
    card.classList.add('mc-reset');            // vuelta con muelle (transition CSS con rebote)
    card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
  };
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerenter', onEnter);
  card.addEventListener('pointerleave', onLeave);
}

/* Monta iconos + tilt en las tarjetas `.mc-3d` de la vista actual. */
export function bindMateriaCards(root){
  if(!root) return;
  root.querySelectorAll('.mc-icon[data-icon]').forEach((el) => {
    const kind = el.getAttribute('data-icon');
    const scene = MATERIA_ICONS[kind];
    if(!scene) return;
    el.innerHTML = scene;
    animateScene(el, kind);
  });
  // la profundidad de cada capa pasa a variable CSS (translateZ del hover)
  root.querySelectorAll('.mc-3d [data-depth]').forEach((el) => {
    el.style.setProperty('--depth', el.getAttribute('data-depth'));
  });
  if(!reduceMotion()) root.querySelectorAll('.mc-3d').forEach(bindTilt);
}

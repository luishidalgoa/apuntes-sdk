/* Scroll-reveal genérico: las tarjetas, bandas y bloques suben y aparecen al
   ENTRAR en el viewport y se atenúan al SALIR (en las dos direcciones). Da
   "vida" al scroll sin que la app haga nada: el router lo re-cablea en cada
   vista. Respeta `prefers-reduced-motion`.

   Robustez: el IntersectionObserver hace la animación bidireccional (entrar/
   salir), pero además un fallback de scroll REVELA lo que esté a la vista (nunca
   oculta). Así, aunque el observador no dispare (entornos raros/pestaña en
   segundo plano), el contenido nunca se queda invisible: al hacer scroll aparece.
   Y la revelación inicial es SÍNCRONA (antes del primer paint) → sin parpadeo. */

const SELECTOR = '.tema-card, .card, .node, .band, .art-block';

function reduceMotion(){
  return typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let current = null;   // { io, onScroll } de la vista actual

export function unbindScrollReveal(){
  if(!current) return;
  if(current.io) current.io.disconnect();
  if(current.onScroll){
    window.removeEventListener('scroll', current.onScroll);
    window.removeEventListener('resize', current.onScroll);
  }
  current = null;
}

export function bindScrollReveal(root){
  unbindScrollReveal();
  if(!root || reduceMotion()) return;   // sin animación → el contenido se ve normal (no lleva `.sr`)

  const vh = () => window.innerHeight || document.documentElement.clientHeight || 0;
  // Revela (solo añade) lo que toca el viewport. Safety + estado inicial: generoso
  // para que en la carga nada del primer pliegue quede oculto.
  const revealInView = () => {
    const h = vh();
    root.querySelectorAll('.sr:not(.sr-in)').forEach((el) => {
      const r = el.getBoundingClientRect();
      if(r.top < h && r.bottom > 0) el.classList.add('sr-in');
    });
  };

  // Observador: anima en las dos direcciones (entrar y salir del viewport).
  const io = (typeof IntersectionObserver !== 'undefined')
    ? new IntersectionObserver((entries) => {
        for(const e of entries) e.target.classList.toggle('sr-in', e.isIntersecting);
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    : null;

  root.querySelectorAll(SELECTOR).forEach((el) => {
    el.classList.add('sr');
    if(io) io.observe(el);
  });
  revealInView();   // estado inicial síncrono (sin parpadeo)

  // Fallback de scroll (throttle simple): revela lo que va entrando.
  let ticking = false;
  const onScroll = () => {
    if(ticking) return;
    ticking = true;
    setTimeout(() => { ticking = false; revealInView(); }, 120);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  current = { io, onScroll };
}

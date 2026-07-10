/* Navbar responsive (v0.1.31): tres modos sobre el MISMO DOM de .controls.
   - Desktop (>1100px): barra inline en el flujo, restilizada como píldora glass.
   - Tablet (761–1100px): "isla" flotante sticky (blur fuerte, despegada).
   - Móvil (≤760px): dock FIJO inferior de 4 huecos (Temas · Buscar · Examen ·
     Más). "Más" abre una hoja (bottom sheet) a la que este módulo MUEVE los
     controles secundarios (Volver, Marcapáginas, Subrayar, Opciones) — moverlos
     conserva sus listeners; al volver a ancho se restauran a su sitio.
   Excepción Safari iOS: su barra de URL vive abajo y chocaría con el dock, así
   que el dock se ancla ARRIBA (body.nav-top). */
import { registerLayer } from './modal-stack.js';

const MQ_MOBILE = '(max-width: 760px)';

/* Safari de verdad en iOS (Chrome/Firefox/Edge en iOS llevan CriOS/FxiOS/EdgiOS
   en el UA; el WebKit de dentro es el mismo pero su barra inferior no). También
   iPadOS moderno, que se camufla de macOS pero tiene pantalla táctil. */
export function isIOSSafari(){
  const ua = navigator.userAgent;
  const iOS = /iP(hone|ad|od)/.test(ua) || (/(Macintosh)/.test(ua) && navigator.maxTouchPoints > 1);
  return iOS && /Safari\//.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS|Chrome)/.test(ua);
}

const ICO_MORE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>';

/* nav: el <nav class="controls"> ya montado por la vista.
   opts.sheetSelectors: selectores (dentro de nav) de lo que va a la hoja "Más"
   en móvil, en orden. Devuelve { destroy }. */
export function mountResponsiveNav(nav, { sheetSelectors = [] } = {}){
  if(!nav) return null;
  const wrap = nav.closest('.wrap') || document.body;
  document.body.classList.add('nav-docked');
  if(isIOSSafari()) document.body.classList.add('nav-top');

  /* botón "Más" (solo visible en móvil, por CSS) */
  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.className = 'btn nav-more';
  moreBtn.setAttribute('aria-haspopup', 'true');
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.innerHTML = ICO_MORE + '<span class="nav-lab">Más</span>';
  nav.appendChild(moreBtn);

  /* hoja "Más" + telón */
  const scrim = document.createElement('div');
  scrim.className = 'nav-scrim';
  scrim.hidden = true;
  const sheet = document.createElement('div');
  sheet.className = 'nav-sheet';
  sheet.hidden = true;
  sheet.setAttribute('role', 'menu');
  sheet.innerHTML = '<div class="nav-sheet-grip" aria-hidden="true"></div><div class="nav-sheet-body"></div>';
  wrap.appendChild(scrim);
  wrap.appendChild(sheet);
  const sheetBody = sheet.querySelector('.nav-sheet-body');

  let open = false;
  function setOpen(v){
    open = v;
    sheet.hidden = !v;
    scrim.hidden = !v;
    moreBtn.setAttribute('aria-expanded', String(v));
    document.body.classList.toggle('nav-sheet-open', v);
  }
  moreBtn.addEventListener('click', () => setOpen(!open));
  scrim.addEventListener('click', () => setOpen(false));
  /* un tap en un enlace/acción de la hoja la cierra (los popups internos como
     Opciones se quedan: expanden dentro de la hoja) */
  sheetBody.addEventListener('click', (e) => {
    if(e.target.closest('a')) setOpen(false);
  });
  registerLayer({ isOpen: () => open, close: () => setOpen(false), priority: 35 });

  /* mover los secundarios a la hoja en móvil y devolverlos a su sitio en ancho;
     un comentario-placeholder recuerda la posición original de cada uno */
  const moved = [];
  function toSheet(){
    sheetSelectors.forEach(sel => {
      const el = nav.querySelector(sel);
      if(!el) return;
      const ph = document.createComment('nav-ph');
      el.parentNode.insertBefore(ph, el);
      sheetBody.appendChild(el);
      moved.push({ el, ph });
    });
  }
  function fromSheet(){
    setOpen(false);
    while(moved.length){
      const { el, ph } = moved.pop();
      ph.parentNode.insertBefore(el, ph);
      ph.remove();
    }
  }
  const mq = window.matchMedia(MQ_MOBILE);
  let mobileNow = null;
  const onChange = () => {
    if(mq.matches === mobileNow) return;
    mobileNow = mq.matches;
    mobileNow ? toSheet() : fromSheet();
  };
  onChange();
  mq.addEventListener('change', onChange);
  /* respaldo: algunos entornos embebidos no disparan el change de matchMedia */
  window.addEventListener('resize', onChange);

  function destroy(){
    mq.removeEventListener('change', onChange);
    window.removeEventListener('resize', onChange);
    fromSheet();
    moreBtn.remove(); sheet.remove(); scrim.remove();
    document.body.classList.remove('nav-docked', 'nav-sheet-open');
    /* nav-top es rasgo del navegador, no de la vista: se queda */
  }
  return { destroy, close: () => setOpen(false) };
}

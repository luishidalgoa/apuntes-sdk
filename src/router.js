import { bindScrollReveal } from './core/scroll-reveal.js';

/* Router por location.hash — NUNCA pushState (lanza SecurityError en file://).
   Rutas:  #/               → hub
           #/materia/<id>   → hub de materia
           #/tema/<id>      → tema (con ancla opcional: #/tema/tema1/art-13-4)
   (El examen ya NO es una ruta: es un overlay SPA, ver openExam.)
   Cada vista es { mount(root, params, ctx) → cleanup? , update?(params) }.
   Si cambia solo el ancla dentro del mismo tema, se llama update() en vez de
   desmontar/montar (así el salto no pierde el estado de la página). */

export function parseHash(){
  const seg = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if(seg.length === 0) return { name: 'hub' };
  if(seg[0] === 'materia' && seg[1]) return { name: 'materia', materiaId: seg[1] };
  if(seg[0] === 'tema' && seg[1]) return { name: 'tema', temaId: seg[1], anchor: seg.slice(2).join('/') || null };
  /* Un examen oficial SI es ruta propia: es una sesion larga que se comparte y
     se retoma por enlace, no un overlay que se abre y se cierra. */
  if(seg[0] === 'examenes' || seg[0] === 'oficiales') return { name: 'oficiales' };
  if(seg[0] === 'oficial' && seg[1]) return { name: 'oficial', examenId: seg[1] };
  /* 'examen' ya NO es una ruta: el examen por temas es un overlay (openExam).
     Un enlace antiguo #/examen cae en la portada sin romper. */
  return { name: 'hub' };
}

export function href(route){
  if(route.name === 'hub') return '#/';
  if(route.name === 'materia') return '#/materia/' + route.materiaId;
  if(route.name === 'tema') return '#/tema/' + route.temaId + (route.anchor ? '/' + route.anchor : '');
  if(route.name === 'oficiales') return '#/examenes';
  if(route.name === 'oficial') return '#/oficial/' + route.examenId;
  return '#/';
}

export function navigate(route){
  location.hash = href(route);
}

export function createRouter({ root, views, ctx }){
  let current = null;   // { route, cleanup, view }

  function render(){
    const route = parseHash();
    const sameView = current
      && current.route.name === route.name
      && (route.name !== 'tema' || current.route.temaId === route.temaId);

    if(sameView && current.view.update){
      current.route = route;
      current.view.update(route);
      return;
    }

    if(current && current.cleanup) current.cleanup();
    root.innerHTML = '';
    document.body.className = document.body.className
      .split(/\s+/).filter(c => c && !c.startsWith('view-')).join(' ');

    const view = views[route.name];
    const instance = view.create ? view.create() : view;
    document.body.classList.add('view-' + (route.name === 'tema' ? route.temaId : route.name));
    const cleanup = instance.mount(root, route, ctx) || null;
    current = { route, cleanup, view: instance };
    if(!route.anchor) window.scrollTo(0, 0);

    /* Transición de entrada de la vista (re-dispara la animación quitando y
       reañadiendo la clase con un reflow) + scroll-reveal del contenido (síncrono,
       antes del paint, para que no haya parpadeo). */
    root.classList.remove('view-in'); void root.offsetWidth; root.classList.add('view-in');
    bindScrollReveal(root);
  }

  window.addEventListener('hashchange', render);
  render();
  return { render };
}

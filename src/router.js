/* Router por location.hash — NUNCA pushState (lanza SecurityError en file://).
   Rutas:  #/            → hub
           #/tema/<id>   → tema (con ancla opcional: #/tema/tema1/art-13-4)
           #/examen      → examen
   Cada vista es { mount(root, params, ctx) → cleanup? , update?(params) }.
   Si cambia solo el ancla dentro del mismo tema, se llama update() en vez de
   desmontar/montar (así el salto no pierde el estado de la página). */

export function parseHash(){
  const seg = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if(seg.length === 0) return { name: 'hub' };
  if(seg[0] === 'materia' && seg[1]) return { name: 'materia', materiaId: seg[1] };
  if(seg[0] === 'tema' && seg[1]) return { name: 'tema', temaId: seg[1], anchor: seg.slice(2).join('/') || null };
  if(seg[0] === 'examen') return { name: 'examen', temaId: seg[1] || null };
  return { name: 'hub' };
}

export function href(route){
  if(route.name === 'hub') return '#/';
  if(route.name === 'materia') return '#/materia/' + route.materiaId;
  if(route.name === 'tema') return '#/tema/' + route.temaId + (route.anchor ? '/' + route.anchor : '');
  if(route.name === 'examen') return '#/examen' + (route.temaId ? '/' + route.temaId : '');
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
  }

  window.addEventListener('hashchange', render);
  render();
  return { render };
}

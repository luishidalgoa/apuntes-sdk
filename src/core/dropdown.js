/* Desplegable genérico del navbar (Temas, Opciones): toggle en el botón,
   cierre por clic fuera, por Escape (pila modal) y al pulsar un item. */
import { registerLayer } from './modal-stack.js';

export function bindDropdown(btn, pop, { signal, closeOnItemClick = true } = {}){
  const set = (open) => {
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.classList.toggle('on', open);
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(pop.hidden); }, { signal });
  document.addEventListener('click', (e) => {
    if(pop.hidden) return;
    if(closeOnItemClick && pop.contains(e.target)){ set(false); return; }
    if(!pop.contains(e.target) && !btn.contains(e.target)) set(false);
  }, { signal });
  registerLayer({ isOpen: () => !pop.hidden, close: () => set(false), priority: 15 });
  return { close: () => set(false) };
}

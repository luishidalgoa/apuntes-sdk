/* Pila modal central para la tecla Escape. En los HTML antiguos cada
   componente registraba su propio listener y un Escape cerraba varias capas
   a la vez (y en el Examen mataba el temporizador aunque no hubiera nada
   abierto — bug corregido aquí): ahora se cierra SOLO la capa abierta de
   mayor prioridad. */
const layers = [];

export function registerLayer({ isOpen, close, priority = 0 }){
  layers.push({ isOpen, close, priority });
  layers.sort((a, b) => b.priority - a.priority);
}

let installed = false;
export function installEscapeHandler(){
  if(installed) return;
  installed = true;
  document.addEventListener('keydown', (e) => {
    if(e.key !== 'Escape') return;
    const top = layers.find(l => l.isOpen());
    if(top) top.close();
  });
}

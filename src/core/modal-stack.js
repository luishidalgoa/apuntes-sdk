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

/* Barras flotantes de fondo mutuamente excluyentes (marcapáginas "colocar" y
   la barra de subrayado): ambas viven pegadas abajo y se solaparían. Cada una
   se registra; al activar una, se cierran las demás abiertas. */
const exclusives = [];
export function registerExclusive(entry){
  exclusives.push(entry);   // { isOpen, close }
  return {
    activate(){ exclusives.forEach(e => { if(e !== entry && e.isOpen && e.isOpen()) e.close(); }); },
    dispose(){ const i = exclusives.indexOf(entry); if(i >= 0) exclusives.splice(i, 1); }
  };
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

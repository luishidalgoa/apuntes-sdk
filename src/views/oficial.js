/* Ruta de un examen oficial: `#/oficial/<id>`.

   Es ruta y no overlay a propósito. El examen por temas se abre, se hace y se
   cierra en un rato; un examen oficial son ~110 minutos: se comparte por enlace,
   se retoma, y merece entrada propia en el historial del navegador. */

import { examenById, normalizarExamen } from '../core/examen-oficial.js';
import { mountExamenHoja } from './examen-hoja.js';

export const oficialViewFactory = {
  create(){
    let ctl = null;
    return {
      mount(root, route){
        const crudo = examenById(route.examenId);
        if(!crudo){ location.hash = '#/'; return; }
        const examen = normalizarExamen(crudo);
        root.innerHTML = '<div class="wrap view-oficial">'
          + '<p class="volver-row"><a class="volver" href="#/">← Volver</a></p>'
          + '<div id="oficialHost"></div>'
          + '</div>';
        ctl = mountExamenHoja(root.querySelector('#oficialHost'), examen);
        window.scrollTo(0, 0);
        /* El router recoge la limpieza de lo que devuelve `mount`. Sin esto el
           cronómetro seguiría corriendo tras salir del examen. */
        return () => { if(ctl){ ctl.destroy(); ctl = null; } };
      }
    };
  }
};

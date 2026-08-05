/* Índice ÚNICO de exámenes: `#/examenes`.

   Una sola puerta para las dos formas de examinarse. Desde fuera son lo mismo
   —«quiero hacer preguntas»— y solo se distinguen al elegir: el banco por temas
   se filtra y sirve para estudiar un punto; una convocatoria oficial entra
   entera y sirve para ensayar el examen. Dos tarjetas en la portada obligaban a
   entender esa diferencia ANTES de entrar, que es justo al revés. */

import { allExamenes, normalizarExamen } from '../core/examen-oficial.js';
import { config } from '../config.js';
import { materiasWithTemas } from '../registry.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fichaHtml(crudo){
  const ex = normalizarExamen(crudo);
  /* Los avisos van AQUÍ y no solo dentro del examen: lo que decide si merece la
     pena empezar uno de dos horas es saber antes si corrige y si es firme. */
  const sellos = [
    ex.provisional ? '<span class="ofi-sello prov">plantilla provisional</span>' : '',
    ex.plantilla === 'ausente' ? '<span class="ofi-sello sin">sin plantilla · no corrige</span>' : '',
    ex.plantilla === 'parcial' ? '<span class="ofi-sello sin">' + ex.sinPlantilla + ' sin respuesta</span>' : '',
    ex.preguntas.some(q => q.anulada)
      ? '<span class="ofi-sello an">' + ex.preguntas.filter(q => q.anulada).length + ' anuladas</span>' : '',
    /* El descuento se anuncia en la ficha porque cambia CÓMO se hace el examen,
       no solo la nota: conviene saberlo antes de empezar, no al corregir.
       Y su AUSENCIA también se anuncia: callar cuando no se sabe deja al usuario
       sin poder distinguir «este examen no penaliza» de «no sabemos si penaliza»,
       y la nota le sale más generosa que la real sin ninguna señal. Es el mismo
       fallo que un dato inventado, en su versión silenciosa. */
    ex.penalizacion
      ? '<span class="ofi-sello pen">penaliza 1/' + Math.round(1 / ex.penalizacion) + '</span>'
      : '<span class="ofi-sello nopen">penalización sin verificar · corrige sin descuento</span>'
  ].filter(Boolean).join('');
  const corregibles = ex.preguntas.filter(q => !q.anulada).length;
  return `
      <a class="ofi-card" href="#/oficial/${esc(ex.id)}">
        <div class="ofi-cab">
          <span class="ofi-tit">${esc(ex.titulo)}</span>
          ${ex.modelo ? `<span class="ofi-mod">Modelo ${esc(ex.modelo)}</span>` : ''}
        </div>
        <div class="ofi-datos">
          <span>${ex.preguntas.length} preguntas</span>
          ${corregibles !== ex.preguntas.length ? `<span>corrige sobre ${corregibles}</span>` : ''}
          ${ex.minutos ? `<span>${ex.minutos} min</span>` : '<span class="ofi-flojo">sin tiempo oficial</span>'}
          ${ex.reservas.length ? `<span>${ex.reservas.length} de reserva</span>` : ''}
        </div>
        ${sellos ? `<div class="ofi-sellos">${sellos}</div>` : ''}
      </a>`;
}

export const oficialesViewFactory = {
  create(){
    let ac = null;
    return {
      mount(root, route){
        const cfg = config();
        const lista = allExamenes();
        const mat = route && route.materiaId
          ? (materiasWithTemas().find(x => x.id === route.materiaId) || null) : null;
        ac = new AbortController();

        const oficiales = lista.length ? `
          <p class="ex-sub">Convocatorias reales, enteras y en su orden. No se trocean por temas:
            lo que entrenan es justo el conjunto y el reparto que no eliges.</p>
          <div class="ofi-lista">${lista.map(fichaHtml).join('')}</div>`
          : '<p class="ex-sub">Todavía no hay convocatorias cargadas.</p>';

        root.innerHTML = `<div class="wrap view-examenes">
          <nav class="controls" aria-label="Navegación">
            <div class="nav-left"><a class="btn ghost" href="${mat ? '#/materia/' + esc(mat.id) : '#/'}">← ${mat ? esc(mat.label) : 'Temario'}</a></div>
          </nav>
          <h1>Exámenes oficiales</h1>
          ${oficiales}
        </div>`;

        window.scrollTo(0, 0);
        return () => { if(ac){ ac.abort(); ac = null; } };
      }
    };
  }
};

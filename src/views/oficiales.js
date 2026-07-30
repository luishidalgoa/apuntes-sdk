/* Índice de exámenes oficiales: `#/oficiales`.

   Existe solo cuando hay más de uno. Con uno solo, la tarjeta del hub entra
   directa al examen — un índice de un elemento es un clic de peaje. */

import { allExamenes, normalizarExamen } from '../core/examen-oficial.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fichaHtml(crudo){
  const ex = normalizarExamen(crudo);
  /* Los avisos van AQUÍ y no solo dentro del examen: lo que decide si merece la
     pena empezar uno de 110 minutos es saber antes si corrige y si es firme. */
  const sellos = [
    ex.provisional ? '<span class="ofi-sello prov">plantilla provisional</span>' : '',
    ex.plantilla === 'ausente' ? '<span class="ofi-sello sin">sin plantilla · no corrige</span>' : '',
    ex.plantilla === 'parcial' ? '<span class="ofi-sello sin">' + ex.sinPlantilla + ' sin respuesta</span>' : '',
    ex.preguntas.some(q => q.anulada)
      ? '<span class="ofi-sello an">' + ex.preguntas.filter(q => q.anulada).length + ' anuladas</span>' : '',
    /* El descuento se anuncia en la ficha porque cambia CÓMO se hace el examen,
       no solo la nota: conviene saberlo antes de empezar, no al corregir. */
    ex.penalizacion ? '<span class="ofi-sello pen">penaliza 1/' + Math.round(1 / ex.penalizacion) + '</span>' : ''
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
    return {
      mount(root){
        const lista = allExamenes();
        if(!lista.length){ location.hash = '#/'; return; }
        root.innerHTML = `<div class="wrap view-oficiales">
          <p class="volver-row"><a class="volver" href="#/">← Volver</a></p>
          <h1>Exámenes oficiales</h1>
          <p class="lede">Convocatorias reales, enteras y en su orden. No se trocean por temas:
            lo que entrena un examen oficial es justo el conjunto y el reparto que no eliges.</p>
          <div class="ofi-lista">${lista.map(fichaHtml).join('')}</div>
        </div>`;
        window.scrollTo(0, 0);
      }
    };
  }
};

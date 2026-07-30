/* Índice ÚNICO de exámenes: `#/examenes`.

   Una sola puerta para las dos formas de examinarse. Desde fuera son lo mismo
   —«quiero hacer preguntas»— y solo se distinguen al elegir: el banco por temas
   se filtra y sirve para estudiar un punto; una convocatoria oficial entra
   entera y sirve para ensayar el examen. Dos tarjetas en la portada obligaban a
   entender esa diferencia ANTES de entrar, que es justo al revés. */

import { allExamenes, normalizarExamen } from '../core/examen-oficial.js';
import { openExam } from './examen.js';
import { config } from '../config.js';

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
    let ac = null;
    return {
      mount(root){
        const cfg = config();
        const lista = allExamenes();
        ac = new AbortController();

        const oficiales = lista.length ? `
          <h2 class="ex-sec">Convocatorias oficiales</h2>
          <p class="ex-sub">Exámenes reales, enteros y en su orden. No se trocean por temas:
            lo que entrenan es justo el conjunto y el reparto que no eliges.</p>
          <div class="ofi-lista">${lista.map(fichaHtml).join('')}</div>` : '';

        root.innerHTML = `<div class="wrap view-examenes">
          <nav class="controls" aria-label="Navegación">
            <div class="nav-left"><a class="btn ghost" href="#/">← Temario</a></div>
          </nav>
          <h1>Exámenes</h1>
          <h2 class="ex-sec">Banco de preguntas</h2>
          <p class="ex-sub">${esc(cfg.examLede || 'Preguntas filtrables por materia, tema y bloque, con temporizador opcional.')}</p>
          <div class="ofi-lista">
            <a class="ofi-card" href="#" data-exam>
              <div class="ofi-cab"><span class="ofi-tit">Practicar por temas</span></div>
              <div class="ofi-datos"><span>eliges materia, tema y cuántas preguntas</span></div>
            </a>
          </div>
          ${oficiales}
        </div>`;

        root.addEventListener('click', (e) => {
          const a = e.target.closest('[data-exam]');
          if(!a) return;
          e.preventDefault();
          openExam({});
        }, { signal: ac.signal });

        window.scrollTo(0, 0);
        return () => { if(ac){ ac.abort(); ac = null; } };
      }
    };
  }
};

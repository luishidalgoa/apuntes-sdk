/* Índice ÚNICO de exámenes: `#/examenes`.

   Una sola puerta para las dos formas de examinarse. Desde fuera son lo mismo
   —«quiero hacer preguntas»— y solo se distinguen al elegir: el banco por temas
   se filtra y sirve para estudiar un punto; una convocatoria oficial entra
   entera y sirve para ensayar el examen. Dos tarjetas en la portada obligaban a
   entender esa diferencia ANTES de entrar, que es justo al revés. */

import { examenesPorTipo, normalizarExamen } from '../core/examen-oficial.js';
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
      /* «Sin verificar» solo tiene sentido si HAY un criterio oficial que
         verificar. En un simulacro no lo hay, asi que ese texto inventaria una
         deuda inexistente y ademas insinuaria que el examen es oficial. */
      : (ex.tipo === 'simulacro'
        ? '<span class="ofi-sello nopen">sin descuento por error</span>'
        : '<span class="ofi-sello nopen">penalización sin verificar · corrige sin descuento</span>')
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
        const mat = route && route.materiaId
          ? (materiasWithTemas().find(x => x.id === route.materiaId) || null) : null;
        ac = new AbortController();

        const reales = examenesPorTipo('oficial');
        const simulados = examenesPorTipo('simulacro');

        /* Dos secciones, y el porque va escrito: no se separan por orden sino
           por PROCEDENCIA de las respuestas. En una convocatoria la correcta es
           la que marco el tribunal; en un simulacro se deduce de la norma. Las
           dos sirven para estudiar, pero solo una es la prueba. */
        const bloque = (titulo, sub, arr) => arr.length ? `
          <h2 class="ofi-h2">${titulo}</h2>
          <p class="ex-sub">${sub}</p>
          <div class="ofi-lista">${arr.map(fichaHtml).join('')}</div>` : '';

        const oficiales = (reales.length || simulados.length) ? (
          bloque('Convocatorias oficiales',
            'Exámenes reales, enteros y en su orden. No se trocean por temas: lo que entrenan es justo '
            + 'el conjunto y el reparto que no eliges. Las respuestas son las del tribunal.',
            reales)
          + bloque('Simulacros',
            'No han caído en ninguna convocatoria: se han montado para repasar. Las respuestas están '
            + 'razonadas contra la norma, no firmadas por un tribunal — sirven para practicar, pero '
            + 'ante una duda manda el texto legal.',
            simulados)
        ) : '<p class="ex-sub">Todavía no hay exámenes cargados.</p>';

        root.innerHTML = `<div class="wrap view-examenes">
          <nav class="controls" aria-label="Navegación">
            <div class="nav-left"><a class="btn ghost" href="${mat ? '#/materia/' + esc(mat.id) : '#/'}">← ${mat ? esc(mat.label) : 'Temario'}</a></div>
          </nav>
          <h1>Exámenes completos</h1>
          ${oficiales}
        </div>`;

        window.scrollTo(0, 0);
        return () => { if(ac){ ac.abort(); ac = null; } };
      }
    };
  }
};

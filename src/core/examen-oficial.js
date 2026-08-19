/* Exámenes oficiales completos — una unidad, no un filtro del banco.

   El examen por temas y este resuelven cosas distintas. El banco te deja elegir
   ámbito y número de preguntas para estudiar un punto; un examen oficial vale
   precisamente por lo que NO puedes elegir: su orden, su reparto entre materias
   y su tiempo. Trocearlo por temas destruye lo que lo hace útil, así que aquí
   entra íntegro y con su identidad (año, convocatoria, modelo).

   Lo que el formato real exige y un modelo ingenuo se deja:
     · `correcta: null` — la plantilla oficial se publica APARTE del cuadernillo.
       Sin ella no se puede corregir, y el simulador debe DECIRLO en vez de
       puntuar a cero, que es la forma que tiene un fallo de datos de disfrazarse
       de mal resultado.
     · `anulada` — tras las alegaciones se anulan preguntas. Una anulada no
       puntúa ni cuenta para el total: si la corriges como fallo, mientes.
     · `reserva` — solo entran en juego si se anula alguna. Se presentan aparte,
       porque en el examen real no forman parte de los 100.
*/

import { config } from '../config.js';

let EXAMENES = [];

export function setExamenes(lista){ EXAMENES = Array.isArray(lista) ? lista : []; }
export function allExamenes(){ return EXAMENES; }
/* Separar por procedencia es cosa del modelo, no de cada vista: si el filtro se
   repite en la vista, el indice y el modal, basta olvidarlo en uno para que un
   simulacro aparezca entre las convocatorias. */
export function examenesPorTipo(t){
  return EXAMENES.filter(e => (e.tipo === 'simulacro' ? 'simulacro' : 'oficial') === t);
}
export function examenById(id){ return EXAMENES.find(e => e.id === id) || null; }

/* Normaliza un examen declarado por la app y avisa de lo que falta. No lanza:
   un examen incompleto debe poder abrirse (para leerlo o para maquetar) — lo
   que no debe es fingir que se puede corregir. */
export function normalizarExamen(ex){
  const preguntas = (ex.preguntas || []).map((q, i) => ({
    n: q.n != null ? q.n : i + 1,
    pregunta: q.pregunta || '',
    respuestas: q.respuestas || [],
    correcta: q.correcta == null ? null : q.correcta,
    anulada: !!q.anulada,
    reserva: !!q.reserva,
    explicacion: q.explicacion || '',
    /* `articulo` y `temaId` viajan hasta la vista o el enlace al temario no se
       puede pintar. Se caian aqui en silencio: el examen declaraba la referencia
       de sus 40 preguntas y el boton no salia en ninguna, sin error ninguno. */
    articulo: q.articulo || '',
    temaId: q.temaId || ''
  }));
  const test = preguntas.filter(q => !q.reserva);
  const reservas = preguntas.filter(q => q.reserva);
  const sinPlantilla = test.filter(q => q.correcta === null && !q.anulada).length;
  return {
    id: ex.id,
    titulo: ex.titulo || ex.id,
    anio: ex.anio || null,
    convocatoria: ex.convocatoria || '',
    modelo: ex.modelo || '',
    minutos: ex.minutos || null,
    fuente: ex.fuente || '',
    /* Plantilla PROVISIONAL: el proceso de alegaciones sigue abierto y las
       respuestas pueden cambiar. Es un eje distinto de `plantilla` —ahí se mide
       si HAY respuestas, aquí si son FIRMES—, y las dos importan: estudiar con
       respuestas que pueden moverse no es lo mismo que con respuestas cerradas.
       Lo que más cambia entre provisional y definitiva son las anulaciones. */
    provisional: !!ex.provisional,
    /* PROCEDENCIA de las respuestas, que es de donde sale todo lo demas.
       'oficial'   → la `correcta` es la que marco el tribunal.
       'simulacro' → la `correcta` se DEDUCE de la norma, por buena que sea la
                     deduccion. No es peor material para estudiar, pero no tiene
                     la misma autoridad, y mezclarlos borra justo esa diferencia.
       Por defecto 'oficial' porque los que ya existian lo son; declarar un
       simulacro es responsabilidad de quien lo escribe. Un simulacro presentado
       como oficial hace creer que unas respuestas deducidas las firmo un
       tribunal — el mismo fallo silencioso que corregir sin plantilla. */
    tipo: ex.tipo === 'simulacro' ? 'simulacro' : 'oficial',
    /* Penalizacion por error, en fracción del valor de un acierto. El examen
       real de TAI descuenta E/3, y eso NO es un detalle de puntuación: con un
       tercio de descuento, contestar al azar entre cuatro opciones tiene
       esperanza CERO, así que dejar en blanco pasa a ser una decisión legítima
       en vez de una renuncia. Un simulador que solo cuenta aciertos enseña lo
       contrario —a rellenarlo todo—, que es justo el hábito que arruina un
       examen con descuento. Es propiedad de CADA convocatoria: sus criterios
       de corrección se publican por proceso. */
    penalizacion: ex.penalizacion != null ? ex.penalizacion : null,
    preguntas: test,
    reservas,
    /* Estado de la plantilla, que decide si la corrección es honesta:
       'completa' → todas tienen respuesta · 'parcial' → algunas ·
       'ausente' → ninguna: se puede hacer, no corregir. */
    plantilla: sinPlantilla === 0 ? 'completa' : (sinPlantilla === test.length ? 'ausente' : 'parcial'),
    sinPlantilla
  };
}

/* Corrige una hoja de respuestas. `marcadas` es { [n]: indiceOpcion }.
   Las anuladas salen del total en vez de contar como fallo, y las que no tienen
   plantilla se cuentan aparte: no son ni aciertos ni fallos, son desconocidas. */
export function corregir(examen, marcadas){
  /* Manda la del examen; `examPenalty` de la app queda como respaldo para las
     que no la declaren. Sin ninguna de las dos, no se penaliza. */
  const penaliza = examen.penalizacion != null
    ? examen.penalizacion
    : (config().examPenalty != null ? config().examPenalty : 0);
  let ok = 0, mal = 0, blanco = 0, anuladas = 0, sinDato = 0;
  const detalle = [];
  for(const q of examen.preguntas){
    if(q.anulada){ anuladas++; detalle.push({ n: q.n, estado: 'anulada' }); continue; }
    const marcada = marcadas[q.n];
    if(q.correcta === null){ sinDato++; detalle.push({ n: q.n, estado: 'sin-plantilla', marcada }); continue; }
    /* La correcta viaja también en las dejadas en blanco: al revisar, una que no
       contestaste es justo donde quieres ver cuál era. */
    if(marcada == null){ blanco++; detalle.push({ n: q.n, estado: 'blanco', correcta: q.correcta }); continue; }
    const acierto = String(marcada) === String(q.correcta);
    if(acierto) ok++; else mal++;
    detalle.push({ n: q.n, estado: acierto ? 'ok' : 'mal', marcada, correcta: q.correcta });
  }
  const corregibles = ok + mal + blanco;
  /* Puntuacion DIRECTA: la del acta, y puede ser negativa si se ha disparado a
     ciegas. No se recorta a 0 porque ver el número en rojo es la lección. */
  const descuento = mal * penaliza;
  const directa = ok - descuento;
  /* La nota sobre 10 sí tiene suelo: un «-1,2 / 10» no significa nada para
     nadie, mientras que la directa negativa sí. */
  const nota = corregibles ? Math.max(0, directa / corregibles * 10) : null;
  return { ok, mal, blanco, anuladas, sinDato, corregibles,
    penaliza, descuento, directa, nota, detalle };
}

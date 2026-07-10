/* Registro de temas del SDK. La app inyecta su lista de temas al arrancar
   (createApp la pasa aquí). El hub, el examen (bloques y recuentos), las
   flashcards y los deep-links se generan a partir de esta lista. */
import { config } from './config.js';

let TEMAS = [];

export function setRegistry(temas){ TEMAS = temas || []; }
export function allTemas(){ return TEMAS; }
export function temaById(id){ return TEMAS.find(t => t.id === id) || null; }

/* ---- MATERIAS: puerta de navegación de primer nivel (opcional) ----
   La app declara `appConfig.materias = [{ id, label, descripcion?, accent?,
   numeral? }]` y cada tema declara `materia:'<id>'`. Si no hay materias, la app
   es de una sola materia (portada = lista de temas) y estas funciones lo
   reflejan (hasMaterias()=false). Es una capa de NAVEGACIÓN, por encima de la
   agrupación por `bloque` (que sigue actuando DENTRO de cada materia). */
export function hasMaterias(){ const m = config().materias; return Array.isArray(m) && m.length > 0; }
export function materiaOf(tema){
  if(!tema || !tema.materia) return null;
  return (config().materias || []).find(m => m.id === tema.materia) || { id: tema.materia, label: tema.materia };
}
export function temasOfMateria(id){ return TEMAS.filter(t => t.materia === id); }
/* Materias declaradas, EN ORDEN, con sus temas adjuntos; solo las que tienen
   al menos un tema. [{ id, label, descripcion, accent, numeral, temas:[...] }]. */
export function materiasWithTemas(){
  return (config().materias || [])
    .map(m => ({ ...m, temas: temasOfMateria(m.id) }))
    .filter(m => m.temas.length > 0);
}

/* ---- Agrupación genérica de temas por "bloque" (capa por encima del tema) ----
   Contrato (opcional, agnóstico): un tema puede declarar `bloque` como una
   etiqueta (`'Bloque 1'`) o un objeto (`{ id, label }`). El SDK no hardcodea
   nada: agrupa/etiqueta por lo que declara cada tema. Si NINGÚN tema trae
   `bloque`, no hay agrupación (100% retrocompatible). El hub, el buscador, el
   examen y el desplegable de Temas consumen estas dos funciones, así que basta
   con que cada app rellene `bloque` en sus manifiestos para que la capa aparezca
   en todas partes. */
export function bloqueOf(tema){
  const b = tema && tema.bloque;
  if(!b) return null;
  if(typeof b === 'string') return { id: b, label: b };
  return { id: b.id || b.label, label: b.label || b.id };
}
export function hasBloques(){ return TEMAS.some(t => t.bloque); }
/* Temas agrupados por bloque, en orden de aparición en el registry:
   [{ id, label, temas:[...] }]. Los temas sin `bloque` caen en un grupo con
   `label:null` (se renderiza sin cabecera). */
export function groupedTemas(){
  const groups = [];
  const byId = new Map();
  TEMAS.forEach((t) => {
    const b = bloqueOf(t);
    const key = b ? b.id : '';
    let g = byId.get(key);
    if(!g){ g = { id: b ? b.id : null, label: b ? b.label : null, temas: [] }; byId.set(key, g); groups.push(g); }
    g.temas.push(t);
  });
  return groups;
}

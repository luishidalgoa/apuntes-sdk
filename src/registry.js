/* Registro de temas del SDK. La app inyecta su lista de temas al arrancar
   (createApp la pasa aquí). El hub, el examen (bloques y recuentos), las
   flashcards y los deep-links se generan a partir de esta lista. */
let TEMAS = [];

export function setRegistry(temas){ TEMAS = temas || []; }
export function allTemas(){ return TEMAS; }
export function temaById(id){ return TEMAS.find(t => t.id === id) || null; }

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

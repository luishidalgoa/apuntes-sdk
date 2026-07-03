/* Registro de temas del SDK. La app inyecta su lista de temas al arrancar
   (createApp la pasa aquí). El hub, el examen (bloques y recuentos), las
   flashcards y los deep-links se generan a partir de esta lista. */
let TEMAS = [];

export function setRegistry(temas){ TEMAS = temas || []; }
export function allTemas(){ return TEMAS; }
export function temaById(id){ return TEMAS.find(t => t.id === id) || null; }

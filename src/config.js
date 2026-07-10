/* Configuración de la app que consume el SDK. La app llama a createApp(config,
   temas) y aquí queda accesible para los módulos del SDK (IA, hub, preview,
   render de anclas…). Recoge todo lo que antes estaba hardcodeado a legislación. */
let CONFIG = {
  title: 'Apuntes',            // título del hub (h1)
  eyebrow: '',                 // línea superior del hub
  subject: '',                 // asignatura (metadatos/subtítulos)
  lede: '',                    // párrafo introductorio del hub
  examLede: '',                // descripción de la tarjeta "Examen" del hub
  footer: '',                  // pie del hub
  aiSystemPrompt: '',          // prompt de sistema del tutor IA del examen
  searchAiSystemPrompt: '',    // prompt del buscador con IA (si vacío, uno genérico con subject/title)
  anchorPrefix: 'sec-',        // prefijo de los id de sección y de los deep-links
  externalPrefixes: [],        // prefijos de refs a otros temas (p.ej. ['CE-'])
  detailLabel: null,           // (n)=>string para el botón "desplegar" de la tarjeta
  materias: []                 // (opcional) puerta de navegación de primer nivel:
                               // [{ id, label, descripcion?, accent?, numeral? }]. Cada tema
                               // declara a qué materia pertenece (`materia:'<id>'`). Si está
                               // vacío, la app es de una sola materia (portada = lista de temas).
};

export function setConfig(c){ CONFIG = { ...CONFIG, ...(c || {}) }; }
export function config(){ return CONFIG; }

/* id de ancla de una sección (o de su apartado). Centralizado para que el
   prefijo sea configurable sin esparcir concatenaciones por todo el SDK. */
export function anchorId(base, ap){
  return CONFIG.anchorPrefix + base + (ap != null && ap !== '' ? '-' + ap : '');
}

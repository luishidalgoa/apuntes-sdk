/* Manifiesto de un tema de la demo (astronomía básica). Es la PLANTILLA de
   cómo se crea una asignatura sobre el SDK: datos propios + el contrato neutro
   (sections/source/labelFor/keySplit), y el SDK pone todo lo demás (shell,
   paneles, examen, juegos, marcador, diseño). */
import { renderCardTreesInto } from 'apuntes-sdk';

/* --- Contenido: "secciones" (antes 'articles' en legislación) --- */
const SECTIONS = {
  sol: { title: 'El Sol', text: 'Estrella de tipo G que concentra el 99,8% de la masa del sistema solar. Su energía procede de la fusión de hidrógeno en helio.' },
  luna: { title: 'La Luna', apartados: [
    { n: 1, text: 'Único satélite natural de la Tierra; muestra siempre la misma cara (rotación síncrona).' },
    { n: 2, text: 'Su gravedad, junto a la del Sol, provoca las mareas.', refs: [{ t: 'el Sol', r: 'sol' }] }
  ] },
  tierra: { title: 'La Tierra', apartados: [
    { n: 1, text: 'Tercer planeta desde el Sol y el único con vida conocida.' },
    { n: 2, text: 'Completa una órbita alrededor del Sol en 365,25 días.', tags: ['dato'] }
  ] }
};

/* --- Texto fuente (antes 'verbatim'): se muestra al pulsar el número --- */
const SOURCE = {
  sol: { title: 'El Sol', paragraphs: [{ n: null, text: 'El Sol es la estrella central del sistema solar y contiene aproximadamente el 99,8% de su masa total.' }] },
  luna: { title: 'La Luna', paragraphs: [
    { n: 1, text: 'La Luna es el único satélite natural de la Tierra.' },
    { n: 2, text: 'Su influencia gravitatoria, sumada a la del Sol, produce las mareas.' }
  ] },
  tierra: { title: 'La Tierra', paragraphs: [
    { n: 1, text: 'La Tierra es el tercer planeta en distancia al Sol.' },
    { n: 2, text: 'Su período orbital es de 365,25 días.' }
  ] }
};

/* etiquetas especiales del tema (genéricas; el SDK no conoce ninguna concreta) */
const SPECIAL_TAGS = {
  dato: { pill: '★ Dato clave', text: 'Cifra que conviene memorizar.', chip: 'clave', icon: '★' }
};

const engine = {
  sections: SECTIONS,
  source: SOURCE,
  labelFor: (k) => (SECTIONS[k] ? SECTIONS[k].title : k),
  keySplit: 'first',
  specialTags: SPECIAL_TAGS
};

/* --- Tarjetas curadas (data-driven, como Tema 2/3 de legislación) --- */
const svg = (inner) => '<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
const CARDS = [
  { sig: '☀️', name: 'El Sol', artNums: ['sol'],
    desc: 'La <b>estrella</b> central del sistema. Concentra casi toda la masa.',
    truco: 'El 99,8% de la masa está en el Sol',
    illus: svg('<circle cx="30" cy="30" r="16" fill="#e8a13a"/><g stroke="#e8a13a" stroke-width="2"><line x1="30" y1="4" x2="30" y2="12"/><line x1="30" y1="48" x2="30" y2="56"/><line x1="4" y1="30" x2="12" y2="30"/><line x1="48" y1="30" x2="56" y2="30"/></g>') },
  { sig: '🌙', name: 'La Luna', artNums: ['luna'],
    desc: 'El <b>satélite</b> de la Tierra. Responsable de las mareas.',
    truco: 'Rotación síncrona: siempre la misma cara',
    illus: svg('<circle cx="30" cy="30" r="16" fill="#cbb27a"/><circle cx="24" cy="26" r="3" fill="#a68f5f"/><circle cx="36" cy="34" r="4" fill="#a68f5f"/>') },
  { sig: '🌍', name: 'La Tierra', artNums: ['tierra'],
    desc: 'Nuestro <b>planeta</b>. El único con vida conocida.',
    truco: 'Una órbita completa = 365,25 días',
    illus: svg('<circle cx="30" cy="30" r="16" fill="#3f8fd0"/><path d="M18 26c6 2 10-2 16 0s8 4 10 2" stroke="#2f9e6a" stroke-width="5" fill="none"/>') }
];

const TEMPLATE = `
  <div class="band b-astro reveal">
    <div class="rom">☉</div>
    <div>
      <div class="k">Demo · 3 secciones</div>
      <h2>El sistema solar</h2>
      <div class="sub">Sol, Luna y Tierra: lo esencial en tarjetas. Despliega cada una para ver el texto fuente.</div>
    </div>
  </div>
  <div class="tree" id="tree-astro"></div>`;

/* --- Minijuegos: clasificación + flashcards (derivadas de las secciones) --- */
const SORT_BUCKETS = [
  { key: 'estrella', label: 'Estrella' },
  { key: 'planeta', label: 'Planeta' },
  { key: 'satelite', label: 'Satélite' }
];
const SORT_ITEMS = [
  { prompt: 'Concentra el 99,8% de la masa del sistema', correctKey: 'estrella' },
  { prompt: 'Único con vida conocida', correctKey: 'planeta' },
  { prompt: 'Provoca las mareas junto al Sol', correctKey: 'satelite' },
  { prompt: 'Fusiona hidrógeno en helio', correctKey: 'estrella' },
  { prompt: 'Da una vuelta al Sol en 365,25 días', correctKey: 'planeta' },
  { prompt: 'Muestra siempre la misma cara a la Tierra', correctKey: 'satelite' }
];

const games = [
  { id: 'clasifica', ico: '🗂', title: '¿Qué tipo de cuerpo?', desc: 'Clasifica cada pista en estrella, planeta o satélite.',
    start: (api) => api.playSorting({ title: '¿Qué tipo de cuerpo?', buckets: SORT_BUCKETS, items: SORT_ITEMS, rounds: 6 }) },
  { id: 'flash', ico: '🃏', title: 'Flashcards', desc: 'Repasa las secciones una a una.',
    start: (api) => api.startFlashcards() }
];

/* --- Preguntas de examen (bloque agregable con las de otros temas) --- */
const questions = [
  { id: 1, bloque: 'Sistema solar', articulo: 'sol', pregunta: '¿Qué porcentaje de la masa del sistema solar concentra el Sol?',
    respuestas: ['Un 50%', 'Un 75%', 'Un 99,8%', 'Un 90%'], correcta: 'Un 99,8%',
    explicacion: 'El Sol acumula el 99,8% de la masa total del sistema solar.' },
  { id: 2, bloque: 'Sistema solar', articulo: 'luna.2', pregunta: '¿Qué fenómeno provoca principalmente la Luna en la Tierra?',
    respuestas: ['Las estaciones', 'Las mareas', 'El viento', 'Los eclipses de Sol'], correcta: 'Las mareas',
    explicacion: 'La gravedad de la Luna (con la del Sol) provoca las mareas.' },
  { id: 3, bloque: 'Sistema solar', articulo: 'tierra.2', pregunta: '¿Cuánto tarda la Tierra en dar una vuelta al Sol?',
    respuestas: ['24 horas', '28 días', '365,25 días', '687 días'], correcta: '365,25 días',
    explicacion: 'El período orbital de la Tierra es de 365,25 días.' },
  { id: 4, bloque: 'Sistema solar', articulo: 'luna.1', pregunta: '¿Por qué vemos siempre la misma cara de la Luna?',
    respuestas: ['Porque no gira', 'Por su rotación síncrona', 'Porque está muy lejos', 'Por las mareas'], correcta: 'Por su rotación síncrona',
    explicacion: 'La Luna rota sobre sí misma en el mismo tiempo que tarda en orbitar la Tierra (rotación síncrona).' }
];

export default {
  id: 'tema1',
  numeral: '☉',
  k: 'Demo · Sistema solar',
  titulo: 'El sistema solar',
  descripcion: 'Sol, Luna y Tierra: lo esencial, para probar el SDK sin nada de legislación.',
  accent: 'var(--astro)',
  headerHtml: `<p class="eyebrow">Demo · SDK de apuntes</p>
    <h1>El <em>sistema solar</em></h1>
    <p class="lede">Una asignatura mínima montada solo con el SDK: tarjetas con texto fuente, referencias cruzadas, examen y minijuegos.</p>`,
  chips: [{ cls: 'a-astro', anchor: 'tree-astro', label: 'Cuerpos' }],
  engine,
  renderContent(el){
    el.innerHTML = TEMPLATE;
    renderCardTreesInto(el, engine, [{ containerId: 'tree-astro', cards: CARDS, cls: 'a-astro' }]);
  },
  games,
  questions,
  bloques: ['Sistema solar']
};

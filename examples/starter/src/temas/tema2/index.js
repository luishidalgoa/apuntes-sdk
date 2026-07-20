/* Manifiesto del Tema 2 de la demo · Órbitas y leyes de Kepler.
   Escrito siguiendo ÚNICAMENTE docs/SKILL-crear-tema.md, para validar que el
   contrato del skill basta para producir un tema completo y funcional. */
import { renderCardTreesInto, mountStepper } from 'apuntes-sdk';

/* --- §4 engine: contenido citable --- */
const SECTIONS = {
  kepler1: { title: 'Primera ley (órbitas)', apartados: [
    { n: 1, text: 'Los planetas describen órbitas elípticas con el Sol en uno de los focos.' },
    { n: 2, text: 'La excentricidad mide cuánto se aparta la elipse de una circunferencia.' }
  ] },
  kepler2: { title: 'Segunda ley (áreas)', apartados: [
    { n: 1, text: 'La línea que une un planeta con el Sol barre áreas iguales en tiempos iguales.' },
    { n: 2, text: 'Por eso el planeta va más rápido en el perihelio y más lento en el afelio.' }
  ] },
  kepler3: { title: 'Tercera ley (períodos)', text: 'El cuadrado del período orbital es proporcional al cubo del semieje mayor: T² ∝ a³. Si el semieje se mide en UA y el período en años, la constante vale 1.' },
  gravitacion: { title: 'Gravitación universal', text: 'Dos cuerpos se atraen con una fuerza proporcional al producto de sus masas e inversamente proporcional al cuadrado de la distancia.' }
};

const SOURCE = {
  kepler1: { title: 'Primera ley', paragraphs: [
    { n: 1, text: 'Todos los planetas se desplazan alrededor del Sol describiendo órbitas elípticas, estando el Sol situado en uno de los focos.' },
    { n: 2, text: 'La excentricidad e de una elipse cumple 0 ≤ e < 1; para e = 0 la elipse es una circunferencia.' }
  ] },
  kepler2: { title: 'Segunda ley', paragraphs: [
    { n: 1, text: 'El radio vector que une un planeta y el Sol barre áreas iguales en tiempos iguales.' },
    { n: 2, text: 'La velocidad areolar es constante, de donde se sigue la conservación del momento angular.' }
  ] },
  kepler3: { title: 'Tercera ley', paragraphs: [
    { n: null, text: 'Para cualquier planeta, el cuadrado de su período orbital es directamente proporcional al cubo de la longitud del semieje mayor de su órbita.' }
  ] }
};

const engine = {
  sections: SECTIONS,
  source: SOURCE,
  labelFor: (k) => (SECTIONS[k] ? SECTIONS[k].title : k),
  keySplit: 'first',
  specialTags: {}
};

/* --- §3.3 tarjetas (datos; el helper pone el DOM y el data-mark-id) --- */
const svg = (inner) => '<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';

const CARDS_LEYES = [
  { sig: '1.1', name: 'Primera ley · órbitas elípticas', artNums: ['kepler1'],
    desc: 'Las órbitas son <b>elipses</b>, no círculos, con el Sol en un foco.',
    truco: 'El Sol NO está en el centro: está en un foco',
    illus: svg('<ellipse cx="30" cy="30" rx="22" ry="14" stroke="#3f8fd0" stroke-width="2"/><circle cx="16" cy="30" r="4" fill="#e8a13a"/>') },
  { sig: '1.2', name: 'Segunda ley · áreas iguales', artNums: ['kepler2'],
    desc: 'El radio vector barre <b>áreas iguales</b> en tiempos iguales.',
    truco: 'Cerca del Sol corre más; lejos, más lento',
    illus: svg('<circle cx="14" cy="30" r="4" fill="#e8a13a"/><path d="M14 30 L44 18 L44 42 Z" fill="#3f8fd0" opacity=".35"/>') },
  { sig: '1.3', name: 'Tercera ley · T² ∝ a³', artNums: ['kepler3'],
    desc: 'Relaciona el <b>período</b> con el tamaño de la órbita, medido en UA.',
    truco: 'T al cuadrado, a al cubo',
    illus: svg('<circle cx="30" cy="30" r="6" fill="#e8a13a"/><circle cx="30" cy="30" r="13" stroke="#3f8fd0" stroke-width="1.5"/><circle cx="30" cy="30" r="22" stroke="#3f8fd0" stroke-width="1.5"/>') }
];

const CARDS_CAUSA = [
  { sig: '2.1', name: 'Gravitación universal', artNums: ['gravitacion'],
    desc: 'La ley de <b>Newton</b> explica por qué se cumplen las de Kepler.',
    truco: 'Fuerza ∝ masas / distancia²',
    illus: svg('<circle cx="18" cy="30" r="9" fill="#e8a13a"/><circle cx="44" cy="30" r="5" fill="#3f8fd0"/><path d="M28 30h10" stroke="#8b8475" stroke-width="2" stroke-dasharray="3 3"/>') }
];

/* --- §3.1/§3.2 plantilla: apartado + bandas CON id + contenedores --- */
const TEMPLATE = `
  <div class="apartado-head reveal" id="ap-kepler">
    <span class="apn">Apartado 1</span>
    <h2>Las leyes de Kepler</h2>
    <p class="apsub">Cómo se mueven los planetas: la descripción cinemática.</p>
  </div>

  <div class="band b-orbita reveal" id="leyes">
    <div class="rom">1</div>
    <div>
      <div class="k">Cómo se mueven</div>
      <h2>Las tres leyes</h2>
      <div class="sub">Órbitas elípticas, velocidad variable y relación período-tamaño.</div>
    </div>
  </div>
  <div class="tree" id="tree-leyes"></div>

  <div class="card a-orbita" data-mark-id="demo-orbita">
    <div class="card-head"><div class="body">
      <div class="row1"><span class="sig">▶</span><span class="name">Recorre la órbita</span></div>
      <p class="desc">Avanza paso a paso y observa cómo cambia la <b>velocidad</b> según la segunda ley.</p>
    </div></div>
    <div data-widget="orbita"></div>
  </div>

  <div class="band b-orbita reveal" id="causa">
    <div class="rom">2</div>
    <div>
      <div class="k">Por qué se mueven así</div>
      <h2>La causa: la gravitación</h2>
      <div class="sub">Newton demuestra que las leyes de Kepler se deducen de la gravitación.</div>
    </div>
  </div>
  <div class="tree" id="tree-causa"></div>`;

/* --- Datos del simulador: un paso = una posición en la órbita --- */
const ORBITA = [
  { t: 'Perihelio', d: 'El punto más cercano al Sol: aquí el planeta va <b>más rápido</b>.', x: 8,  v: 'máxima' },
  { t: 'Cuadratura', d: 'A media distancia la velocidad es <b>intermedia</b>.',              x: 30, v: 'media' },
  { t: 'Afelio',    d: 'El punto más lejano: aquí el planeta va <b>más lento</b>.',          x: 52, v: 'mínima' },
  { t: 'Regreso',   d: 'Al acercarse vuelve a acelerar: se cumple la <b>segunda ley</b>.',   x: 30, v: 'media' }
];
/* Pinta un paso: el planeta sobre la elipse + el rótulo de velocidad. */
const escenaOrbita = (s) => svg(
  '<ellipse cx="30" cy="30" rx="24" ry="15" stroke="#3f8fd0" stroke-width="1.5"/>'
  + '<circle cx="14" cy="30" r="5" fill="#e8a13a"/>'
  + '<circle cx="' + s.x + '" cy="30" r="3.4" fill="#2f6ea8"/>'
  + '<text x="30" y="55" font-size="6" text-anchor="middle" fill="#8b8475">velocidad ' + s.v + '</text>'
);

/* --- §7 examen --- */
const questions = [
  { id: 1, bloque: 'Órbitas', articulo: 'kepler1.1',
    pregunta: 'Según la primera ley de Kepler, ¿qué forma tienen las órbitas planetarias?',
    respuestas: ['Circunferencias perfectas', 'Elipses con el Sol en un foco', 'Parábolas', 'Espirales'],
    correcta: 'Elipses con el Sol en un foco',
    explicacion: 'Las órbitas son elípticas y el Sol ocupa uno de los dos focos, no el centro.' },
  { id: 2, bloque: 'Órbitas', articulo: 'kepler2.2',
    pregunta: '¿Dónde se mueve más rápido un planeta en su órbita?',
    respuestas: ['En el afelio', 'En el perihelio', 'A velocidad constante', 'En los nodos'],
    correcta: 'En el perihelio',
    explicacion: 'Al barrer áreas iguales en tiempos iguales, cerca del Sol (perihelio) la velocidad es mayor.' },
  { id: 3, bloque: 'Órbitas', articulo: 'kepler3',
    pregunta: '¿Qué relación establece la tercera ley de Kepler?',
    respuestas: ['T ∝ a', 'T² ∝ a³', 'T³ ∝ a²', 'T ∝ 1/a'],
    correcta: 'T² ∝ a³',
    explicacion: 'El cuadrado del período es proporcional al cubo del semieje mayor.' },
  { id: 4, bloque: 'Órbitas', articulo: 'gravitacion',
    pregunta: 'En la ley de gravitación universal, la fuerza es inversamente proporcional a…',
    respuestas: ['La distancia', 'El cuadrado de la distancia', 'El cubo de la distancia', 'La masa'],
    correcta: 'El cuadrado de la distancia',
    explicacion: 'F = G·m₁·m₂/d²: la fuerza decae con el cuadrado de la distancia.' }
];

/* --- §8 minijuegos (flashcards salen de engine.sections sin configurar) --- */
const games = [
  { id: 'flash-kepler', ico: '🃏', title: 'Flashcards', desc: 'Repasa las leyes una a una.',
    start: (api) => api.startFlashcards() }
];

export default {
  id: 'tema2',
  numeral: '◐',
  k: 'Demo · Órbitas y Kepler',
  titulo: 'Órbitas y leyes de Kepler',
  descripcion: 'Las tres leyes de Kepler y la gravitación universal que las explica.',
  accent: 'var(--orbita)',
  headerHtml: `<p class="eyebrow">Demo · SDK de apuntes</p>
    <h1>Órbitas y <em>leyes de Kepler</em></h1>
    <p class="lede">Cómo se mueven los planetas y por qué: de la descripción de Kepler a la causa de Newton.</p>`,
  chips: [
    { cls: 'a-orbita', anchor: 'leyes', label: 'Las tres leyes' },
    { cls: 'a-orbita', anchor: 'causa', label: 'Gravitación' }
  ],
  engine,
  renderContent(el){
    el.innerHTML = TEMPLATE;
    renderCardTreesInto(el, engine, [
      { containerId: 'tree-leyes', cards: CARDS_LEYES, cls: 'a-orbita' },
      { containerId: 'tree-causa', cards: CARDS_CAUSA, cls: 'a-orbita' }
    ]);
    /* Simulador con el motor de pasos del SDK: el tema solo aporta los datos y
       cómo se pinta un paso; controles, cronómetro y contador los pone el SDK. */
    mountStepper(el.querySelector('[data-widget="orbita"]'), {
      steps: ORBITA,
      render: ({ step }) => escenaOrbita(step),
      narrate: ({ step }) => '<b>' + step.t + '.</b> ' + step.d,
      preset: 'deck'                                 // diapositivas: ‹ Anterior / Siguiente ›
    });
  },
  games,
  questions,
  glossary: { UA: 'Unidad Astronómica' },   // ≥2 letras y debe aparecer en la prosa
  bloques: ['Órbitas']
};
